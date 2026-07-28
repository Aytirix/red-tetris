import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { Socket } from "socket.io";

// Les emitters reseau sont neutralises, SAUF getRenderedBoard qui est la vraie
// implementation: Game.lockPiece() s'en sert pour incruster la piece dans le board.
vi.mock("../gateways/socket/emitters/gameEmitters.js", async (importOriginal) => {
	const actual = await importOriginal<typeof import("../gateways/socket/emitters/gameEmitters.js")>();
	return {
		...actual,
		emitGameStart: vi.fn(),
		emitGameUpdate: vi.fn(),
		emitGameOver: vi.fn(),
		emitPlayerEliminated: vi.fn(),
		emitSpectatorForPlayer: vi.fn(),
	};
});

// settleGameRewards touche Prisma -> mock complet.
vi.mock("../services/shopService.js", () => ({
	settleGameRewards: vi.fn(async () => undefined),
}));

import { Game } from "./Game.js";
import { Piece } from "./Piece.js";
import { Player } from "./Player.js";
import { Room } from "./room.js";
import {
	BOARD_HEIGHT,
	BOARD_WIDTH,
	INVISIBLE_FADE_MS,
	INVISIBLE_JOKER_COUNT,
	INVISIBLE_JOKER_REVEAL_MS,
	INVISIBLE_REVEAL_CAP_MS,
	INVISIBLE_REVEAL_PER_LINE_MS,
	SPRINT_TARGET_LINES,
	SUDDEN_DEATH_TICK_MS,
	ULTRA_DURATION_MS,
	type Board,
	type Cell,
	type GameMode,
	type PieceType,
	type PlayerGameState,
} from "../types/game/gameTypes.js";
import { I, O, pieces, T, type PieceShape } from "../types/game/piecesGameTypes.js";
import { LOCK_GRACE_MIN_MS } from "../types/game/gameTypes.js";
import {
	emitGameOver,
	emitGameStart,
	emitGameUpdate,
	emitPlayerEliminated,
	emitSpectatorForPlayer,
} from "../gateways/socket/emitters/gameEmitters.js";
import { settleGameRewards } from "../services/shopService.js";

function makeSocket(id: string): Socket {
	return {
		id,
		emit: vi.fn(),
		on: vi.fn(),
		join: vi.fn(),
		leave: vi.fn(),
	} as unknown as Socket;
}

function makePlayer(name: string, socketId = `sock-${name}`): Player {
	return new Player(name, makeSocket(socketId), `${name}-avatar`, "pirate");
}

function emptyRow(): Cell[] {
	return Array.from({ length: BOARD_WIDTH }, () => 0 as Cell);
}

/** Ligne pleine, ou pleine sauf les colonnes listees dans `holes`. */
function fullRow(holes: number[] = []): Cell[] {
	return Array.from({ length: BOARD_WIDTH }, (_v, x) => (holes.includes(x) ? 0 : ("I" as Cell)));
}

function emptyBoard(): Board {
	return Array.from({ length: BOARD_HEIGHT }, () => emptyRow());
}

/** Cree un piece placee en (x, y) absolus. */
function placedPiece(shape: PieceShape, type: PieceType, x: number, y: number): Piece {
	const piece = new Piece(shape, type);
	while (piece.getX() > x) piece.moveLeft();
	while (piece.getX() < x) piece.moveRight();
	while (piece.getY() < y) piece.moveDown();
	return piece;
}

type Setup = { game: Game; room: Room; players: Player[]; states: PlayerGameState[] };

function makeGame(playerCount = 1, mode: GameMode = "classique"): Setup {
	const room = new Room("salle");
	const players = Array.from({ length: playerCount }, (_v, i) => makePlayer(`joueur${i}`, `sock${i}`));
	for (const player of players) room.addPlayer(player);
	const game = new Game(mode, players, room);
	const states = players.map((player) => game.getPlayerStateBySocketId(player.getSocketId())!);
	return { game, room, players, states };
}

describe("Game", () => {
	beforeEach(() => {
		vi.useFakeTimers();
		vi.clearAllMocks();
		vi.spyOn(console, "log").mockImplementation(() => undefined);
	});

	afterEach(() => {
		vi.useRealTimers();
		vi.restoreAllMocks();
	});

	describe("constructor", () => {
		it("creates one state per player, initialised and alive", () => {
			const { game, players, states } = makeGame(2);

			expect(game.getState().size).toBe(2);
			for (const [index, state] of states.entries()) {
				expect(state.score).toBe(0);
				expect(state.level).toBe(1);
				expect(state.pieceIndex).toBe(0);
				expect(state.isAlive).toBe(true);
				expect(state.spectator).toBe(false);
				expect(state.player).toBe(players[index]);
				expect(state.board.length).toBe(BOARD_HEIGHT);
			}
		});

		it("attaches the game to every player", () => {
			const { game, players } = makeGame(3);
			for (const player of players) {
				expect(player.getGame()).toBe(game);
			}
		});

		it("keeps the mode given at construction", () => {
			expect(makeGame(1, "classique").game.mode).toBe("classique");
		});

		it("indexes the states by socket id", () => {
			const { game } = makeGame(2);
			expect(game.getPlayerStateBySocketId("sock0")).toBeDefined();
			expect(game.getPlayerStateBySocketId("sock1")).toBeDefined();
			expect(game.getPlayerStateBySocketId("inconnu")).toBeUndefined();
		});
	});

	describe("createBoard", () => {
		it("creates a board of 20 rows x 10 columns", () => {
			const board = makeGame(1).game.createBoard();
			expect(board.length).toBe(20);
			for (const row of board) expect(row.length).toBe(10);
		});

		it("fills the board with zeros", () => {
			const board = makeGame(1).game.createBoard();
			expect(board.every((row) => row.every((cell) => cell === 0))).toBe(true);
		});

		it("returns a fresh board on each call", () => {
			const { game } = makeGame(1);
			const a = game.createBoard();
			const b = game.createBoard();
			expect(a).not.toBe(b);
			a[0]![0] = "I";
			expect(b[0]![0]).toBe(0);
		});
	});

	describe("randomPiece", () => {
		it("returns a bag of exactly 7 pieces", () => {
			expect(makeGame(1).game.randomPiece().length).toBe(7);
		});

		it("contains exactly one of each piece type, without duplicate", () => {
			const { game } = makeGame(1);
			const expected: PieceType[] = ["I", "J", "L", "O", "S", "T", "Z"];
			for (let attempt = 0; attempt < 50; attempt++) {
				const bag = game.randomPiece();
				expect([...bag].sort()).toEqual([...expected].sort());
				expect(new Set(bag).size).toBe(7);
			}
		});

		it("shuffles the bag (not always the same order over many draws)", () => {
			const { game } = makeGame(1);
			const orders = new Set<string>();
			for (let attempt = 0; attempt < 60; attempt++) orders.add(game.randomPiece().join(""));
			expect(orders.size).toBeGreaterThan(1);
		});
	});

	describe("getPieceQueue / ensurePieceQueue", () => {
		it("returns the same piece for the same index (queue is stable)", () => {
			const { game } = makeGame(1);
			const first = game.getPieceQueue(3);
			expect(game.getPieceQueue(3)).toBe(first);
			expect(game.getPieceQueue(3)).toBe(first);
		});

		it("extends the queue on demand beyond the first bag", () => {
			const { game } = makeGame(1);
			expect(() => game.getPieceQueue(50)).not.toThrow();
			expect(game.getPieceQueue(50)).toBeDefined();
		});

		it("extends the queue by whole 7-piece bags", () => {
			const { game } = makeGame(1);
			game.ensurePieceQueue(13);
			const secondBag = Array.from({ length: 7 }, (_v, i) => game.getPieceQueue(7 + i));
			expect(new Set(secondBag).size).toBe(7);
		});

		it("PARTAGE la file entre les joueurs: meme index => meme piece", () => {
			const { game } = makeGame(3);
			for (let index = 0; index < 40; index++) {
				const reference = game.getPieceQueue(index);
				expect(game.getPieceQueue(index)).toBe(reference);
			}
		});

		it("PARTAGE la file: deux joueurs qui posent la meme piece recoivent la meme suite", () => {
			const { game, states } = makeGame(2);
			const first = states[0]!;
			const second = states[1]!;

			const firstSequence: PieceType[] = [];
			const secondSequence: PieceType[] = [];
			for (let step = 0; step < 20; step++) {
				game.spawnPiece(first);
				game.spawnPiece(second);
				firstSequence.push(first.currentPiece!.type);
				secondSequence.push(second.currentPiece!.type);
				expect(first.currentPiece!.type).toBe(second.currentPiece!.type);
				expect(first.nextPiece!.type).toBe(second.nextPiece!.type);
				first.pieceIndex++;
				second.pieceIndex++;
			}
			expect(firstSequence).toEqual(secondSequence);
		});

		it("les joueurs desynchronises restent sur la meme file partagee", () => {
			const { game, states } = makeGame(2);
			const first = states[0]!;
			const second = states[1]!;

			first.pieceIndex = 5;
			second.pieceIndex = 0;
			game.spawnPiece(first);
			game.spawnPiece(second);
			const pieceAtIndexFive = first.currentPiece!.type;

			second.pieceIndex = 5;
			game.spawnPiece(second);
			expect(second.currentPiece!.type).toBe(pieceAtIndexFive);
		});

		it("throws when the requested index cannot exist", () => {
			const { game } = makeGame(1);
			expect(() => game.getPieceQueue(-1)).toThrow("No piece type available in PIECES_TYPES");
		});
	});

	describe("canMove", () => {
		it("returns false when there is no current piece", () => {
			const { game, states } = makeGame(1);
			expect(game.canMove(states[0]!, 0, 1)).toBe(false);
		});

		it("allows a move on an empty board", () => {
			const { game, states } = makeGame(1);
			const state = states[0]!;
			state.currentPiece = new Piece(O, "O");
			expect(game.canMove(state, -1, 0)).toBe(true);
			expect(game.canMove(state, 1, 0)).toBe(true);
			expect(game.canMove(state, 0, 1)).toBe(true);
		});

		it("blocks on the LEFT wall", () => {
			const { game, states } = makeGame(1);
			const state = states[0]!;
			state.currentPiece = placedPiece(O, "O", 0, 0);
			expect(game.canMove(state, -1, 0)).toBe(false);
			expect(game.canMove(state, 1, 0)).toBe(true);
		});

		it("blocks on the RIGHT wall", () => {
			const { game, states } = makeGame(1);
			const state = states[0]!;
			state.currentPiece = placedPiece(O, "O", BOARD_WIDTH - 2, 0);
			expect(game.canMove(state, 1, 0)).toBe(false);
			expect(game.canMove(state, -1, 0)).toBe(true);
		});

		it("blocks on the FLOOR", () => {
			const { game, states } = makeGame(1);
			const state = states[0]!;
			state.currentPiece = placedPiece(O, "O", 4, BOARD_HEIGHT - 2);
			expect(game.canMove(state, 0, 1)).toBe(false);
		});

		it("blocks against an occupied cell", () => {
			const { game, states } = makeGame(1);
			const state = states[0]!;
			state.currentPiece = new Piece(O, "O");
			state.board[2]![4] = "I";
			expect(game.canMove(state, 0, 1)).toBe(false);
		});

		it("ignores the empty cells of the piece shape", () => {
			const { game, states } = makeGame(1);
			const state = states[0]!;
			// T = [[0,1,0],[1,1,1]] : la cellule (0,0) de la forme est vide.
			state.currentPiece = new Piece(T, "T");
			state.board[0]![4] = "I";
			expect(game.canMove(state, 0, 0)).toBe(true);
		});
	});

	describe("canRotate", () => {
		it("returns false when there is no current piece", () => {
			const { game, states } = makeGame(1);
			expect(game.canRotate([[1]], states[0]!)).toBe(false);
		});

		it("accepts a rotation that fits on an empty board", () => {
			const { game, states } = makeGame(1);
			const state = states[0]!;
			state.currentPiece = new Piece(I, "I");
			expect(game.canRotate(state.currentPiece.getRotatedShape()!, state)).toBe(true);
		});

		it("refuses a rotation that would leave the board on the right", () => {
			const { game, states } = makeGame(1);
			const state = states[0]!;
			state.currentPiece = placedPiece([[1], [1], [1], [1]], "I", BOARD_WIDTH - 1, 0);
			expect(game.canRotate(I.map((row) => [...row]), state)).toBe(false);
		});

		it("refuses a rotation that would go through the floor", () => {
			const { game, states } = makeGame(1);
			const state = states[0]!;
			state.currentPiece = placedPiece(I, "I", 0, BOARD_HEIGHT - 1);
			expect(game.canRotate([[1], [1], [1], [1]], state)).toBe(false);
		});

		it("refuses a rotation that overlaps an occupied cell", () => {
			const { game, states } = makeGame(1);
			const state = states[0]!;
			state.currentPiece = new Piece(I, "I");
			state.board[2]![4] = "I";
			expect(game.canRotate([[1], [1], [1], [1]], state)).toBe(false);
		});
	});

	describe("canSpawn", () => {
		it("returns false without current piece", () => {
			const { game, states } = makeGame(1);
			expect(game.canSpawn(states[0]!)).toBe(false);
		});

		it("returns true on an empty board", () => {
			const { game, states } = makeGame(1);
			const state = states[0]!;
			state.currentPiece = new Piece(O, "O");
			expect(game.canSpawn(state)).toBe(true);
		});

		it("returns false when the spawn zone is occupied", () => {
			const { game, states } = makeGame(1);
			const state = states[0]!;
			state.currentPiece = new Piece(O, "O");
			state.board[0]![4] = "Z";
			expect(game.canSpawn(state)).toBe(false);
		});

		it("returns false when the piece overflows the board", () => {
			const { game, states } = makeGame(1);
			const state = states[0]!;
			state.currentPiece = placedPiece(I, "I", BOARD_WIDTH - 1, 0);
			expect(game.canSpawn(state)).toBe(false);
		});
	});

	describe("clearLines", () => {
		it("removes a full line and keeps a 20-row board", () => {
			const { game, states } = makeGame(1);
			const state = states[0]!;
			state.board = emptyBoard();
			state.board[BOARD_HEIGHT - 1] = fullRow();

			game.clearLines(state);

			expect(state.board.length).toBe(BOARD_HEIGHT);
			expect(state.board.every((row) => row.length === BOARD_WIDTH)).toBe(true);
			expect(state.board[BOARD_HEIGHT - 1]!.every((cell) => cell === 0)).toBe(true);
		});

		it("makes the rows above fall down", () => {
			const { game, states } = makeGame(1);
			const state = states[0]!;
			state.board = emptyBoard();
			state.board[BOARD_HEIGHT - 2]![3] = "T";
			state.board[BOARD_HEIGHT - 1] = fullRow();

			game.clearLines(state);

			expect(state.board[BOARD_HEIGHT - 1]![3]).toBe("T");
			expect(state.board[BOARD_HEIGHT - 2]![3]).toBe(0);
		});

		it("adds 100 points for a single line", () => {
			const { game, states } = makeGame(1);
			const state = states[0]!;
			state.board = emptyBoard();
			state.board[BOARD_HEIGHT - 1] = fullRow();

			game.clearLines(state);

			expect(state.score).toBe(100);
		});

		// Bareme Guideline: la prime aux multi-lignes est la mecanique du jeu. Quatre
		// lignes d'un coup valent 800, contre 400 si elles sont faites une par une.
		it.each([
			[1, 100],
			[2, 300],
			[3, 500],
			[4, 800],
		])("scores %i line(s) cleared at once as %i points", (lines, expected) => {
			const { game, states } = makeGame(1);
			const state = states[0]!;
			state.board = emptyBoard();
			for (let i = 0; i < lines; i++)
				state.board[BOARD_HEIGHT - 1 - i] = fullRow();

			game.clearLines(state);

			expect(state.score).toBe(expected);
		});

		it("multiplies the line score by the current level", () => {
			const { game, states } = makeGame(1);
			const state = states[0]!;
			state.level = 4;
			state.board = emptyBoard();
			state.board[BOARD_HEIGHT - 1] = fullRow();
			state.board[BOARD_HEIGHT - 2] = fullRow();

			game.clearLines(state);

			expect(state.score).toBe(300 * 4);
		});

		// Les lignes sont payees a la vitesse a laquelle elles ont ete jouees: le niveau
		// qu'elles debloquent ne doit pas s'appliquer retroactivement.
		it("scores at the level in force before the level-up", () => {
			const { game, states } = makeGame(1);
			const state = states[0]!;
			state.lines = 4; // la 5e ligne fait passer au niveau 2
			state.board = emptyBoard();
			state.board[BOARD_HEIGHT - 1] = fullRow();

			game.clearLines(state);

			expect(state.score).toBe(100);
			expect(state.level).toBe(2);
		});

		it("clears several lines at once and scores them all", () => {
			const { game, states } = makeGame(1);
			const state = states[0]!;
			state.board = emptyBoard();
			state.board[BOARD_HEIGHT - 1] = fullRow();
			state.board[BOARD_HEIGHT - 2] = fullRow();
			state.board[BOARD_HEIGHT - 3] = fullRow();
			state.board[BOARD_HEIGHT - 4] = fullRow();

			game.clearLines(state);

			expect(state.score).toBe(800);
			expect(state.board.every((row) => row.every((cell) => cell === 0))).toBe(true);
		});

		it("does nothing when no line is complete", () => {
			const { game, states } = makeGame(1);
			const state = states[0]!;
			state.board = emptyBoard();
			state.board[BOARD_HEIGHT - 1] = fullRow([9]);

			game.clearLines(state);

			expect(state.score).toBe(0);
			expect(state.board[BOARD_HEIGHT - 1]![0]).toBe("I");
		});

		it("clears non-contiguous lines", () => {
			const { game, states } = makeGame(1);
			const state = states[0]!;
			state.board = emptyBoard();
			state.board[10] = fullRow();
			state.board[15] = fullRow();
			state.board[BOARD_HEIGHT - 1]![0] = "O";

			game.clearLines(state);

			expect(state.score).toBe(300);
			expect(state.board[BOARD_HEIGHT - 1]![0]).toBe("O");
		});
	});

	describe("penalty lines", () => {
		it("createPenaltyLine builds a full solid row with no hole", () => {
			const { game } = makeGame(1);
			const line = game.createPenaltyLine();
			expect(line.length).toBe(BOARD_WIDTH);
			expect(line.every((cell) => cell === "penalty")).toBe(true);
		});

		it("addPenaltyLines stacks solid lines at the bottom and pushes the board up", () => {
			const { game, states } = makeGame(1);
			const state = states[0]!;
			state.board = emptyBoard();
			state.board[BOARD_HEIGHT - 1]![0] = "T";

			game.addPenaltyLines(state, 2);

			expect(state.board.length).toBe(BOARD_HEIGHT);
			// Les 2 lignes du bas sont pleines de pénalité, sans brèche.
			for (const y of [BOARD_HEIGHT - 1, BOARD_HEIGHT - 2])
				expect(state.board[y]!.every((cell) => cell === "penalty")).toBe(true);
			// L'ancien contenu a remonté de 2 rangs.
			expect(state.board[BOARD_HEIGHT - 3]![0]).toBe("T");
		});

		it("clearLines never clears a penalty row (indestructible)", () => {
			const { game, states } = makeGame(1);
			const state = states[0]!;
			state.board = emptyBoard();
			state.board[BOARD_HEIGHT - 1] = game.createPenaltyLine();

			game.clearLines(state);

			expect(state.score).toBe(0);
			expect(state.board[BOARD_HEIGHT - 1]!.every((cell) => cell === "penalty")).toBe(true);
		});

		it("sends n-1 penalty lines to opponents when n lines are cleared", () => {
			const { game, states } = makeGame(2);
			const [attacker, victim] = states as [PlayerGameState, PlayerGameState];
			attacker.board = emptyBoard();
			attacker.board[BOARD_HEIGHT - 1] = fullRow([4, 5]);
			attacker.board[BOARD_HEIGHT - 2] = fullRow([4, 5]);
			attacker.currentPiece = placedPiece(O, "O", 4, BOARD_HEIGHT - 2);
			victim.board = emptyBoard();

			game.lockAndSpawnNext(attacker);

			// 2 lignes complétées -> 1 seule ligne de pénalité (n-1), pleine.
			expect(victim.board.length).toBe(BOARD_HEIGHT);
			expect(victim.board[BOARD_HEIGHT - 1]!.every((cell) => cell === "penalty")).toBe(true);
			expect(victim.board[BOARD_HEIGHT - 2]!.every((cell) => cell === 0)).toBe(true);
		});

		it("sends no penalty when only a single line is cleared", () => {
			const { game, states } = makeGame(2);
			const [attacker, victim] = states as [PlayerGameState, PlayerGameState];
			attacker.board = emptyBoard();
			attacker.board[BOARD_HEIGHT - 1] = fullRow([4, 5]);
			attacker.currentPiece = placedPiece(O, "O", 4, BOARD_HEIGHT - 2);
			victim.board = emptyBoard();

			game.lockAndSpawnNext(attacker);

			// 1 ligne complétée -> n-1 = 0 pénalité: le plateau adverse reste vierge.
			expect(victim.board.every((row) => row.every((cell) => cell === 0))).toBe(true);
		});

		it("remonte la piece en vol avec le plateau (elle ne s'incruste pas dans la penalite)", () => {
			const { game, states } = makeGame(1);
			const state = states[0]!;
			state.board = emptyBoard();
			// Piece posee tout en bas: sans correction, les lignes de penalite arrivent
			// SOUS elle et la piece se retrouve a l'interieur de la zone indestructible.
			state.currentPiece = placedPiece(O, "O", 4, BOARD_HEIGHT - 2);

			game.addPenaltyLines(state, 2);

			// La piece a ete remontee: sa position courante est libre de toute collision.
			expect(game.canMove(state, 0, 0)).toBe(true);
			expect(state.currentPiece!.getY()).toBe(BOARD_HEIGHT - 4);
		});

		it("garde les lignes de penalite pleines et indestructibles apres verrouillage", () => {
			const { game, states } = makeGame(1);
			const state = states[0]!;
			state.board = emptyBoard();
			state.currentPiece = placedPiece(O, "O", 4, BOARD_HEIGHT - 2);

			game.addPenaltyLines(state, 2);
			game.lockPiece(state);
			const cleared = game.clearLines(state);

			// La piece ne doit avoir ecrase aucune cellule "penalty": les 2 lignes du bas
			// restent pleines, donc non nettoyables, et rien n'est credite.
			for (const y of [BOARD_HEIGHT - 1, BOARD_HEIGHT - 2])
				expect(state.board[y]!.every((cell) => cell === "penalty")).toBe(true);
			expect(cleared).toBe(0);
			expect(state.score).toBe(0);
		});

		it("tue le joueur quand la penalite pousse sa pile hors du plateau (top-out)", () => {
			const { game, states } = makeGame(1);
			const state = states[0]!;
			state.board = emptyBoard();
			// Bloc tout en haut: la ligne 0 va sortir du terrain -> top-out.
			state.board[0]![3] = "T";

			game.addPenaltyLines(state, 1);

			expect(state.isAlive).toBe(false);
		});

		it("ne tue pas quand les lignes poussees dehors sont vides", () => {
			const { game, states } = makeGame(1);
			const state = states[0]!;
			state.board = emptyBoard();
			state.board[BOARD_HEIGHT - 1]![3] = "T";

			game.addPenaltyLines(state, 2);

			expect(state.isAlive).toBe(true);
		});

		it("elimine l'adversaire dont la pile deborde et le notifie", () => {
			const { game, states } = makeGame(3);
			const [attacker, victim, other] = states as [PlayerGameState, PlayerGameState, PlayerGameState];
			attacker.board = emptyBoard();
			attacker.board[BOARD_HEIGHT - 1] = fullRow([4, 5]);
			attacker.board[BOARD_HEIGHT - 2] = fullRow([4, 5]);
			attacker.currentPiece = placedPiece(O, "O", 4, BOARD_HEIGHT - 2);
			victim.board = emptyBoard();
			victim.board[0]![0] = "T"; // pile au plafond -> mourra sur la penalite
			other.board = emptyBoard();

			game.lockAndSpawnNext(attacker);

			expect(victim.isAlive).toBe(false);
			expect(other.isAlive).toBe(true);
			// La partie continue (2 vivants) -> la victime est notifiee individuellement.
			expect(emitPlayerEliminated).toHaveBeenCalled();
		});

		it("does not send penalty in solo mode", () => {
			const { game, states } = makeGame(1);
			const state = states[0]!;
			state.board = emptyBoard();
			state.board[BOARD_HEIGHT - 1] = fullRow([4, 5]);
			state.board[BOARD_HEIGHT - 2] = fullRow([4, 5]);
			state.currentPiece = placedPiece(O, "O", 4, BOARD_HEIGHT - 2);

			// Aucun adversaire: addPenaltyToOpponents court-circuite via isSolo().
			expect(() => game.lockAndSpawnNext(state)).not.toThrow();
		});
	});

	describe("move", () => {
		it("moves the piece to the left", () => {
			const { game, states } = makeGame(1);
			const state = states[0]!;
			state.currentPiece = new Piece(O, "O");
			game.move("sock0", "left");
			expect(state.currentPiece.getX()).toBe(3);
		});

		it("moves the piece to the right", () => {
			const { game, states } = makeGame(1);
			const state = states[0]!;
			state.currentPiece = new Piece(O, "O");
			game.move("sock0", "right");
			expect(state.currentPiece.getX()).toBe(5);
		});

		it("moves the piece down", () => {
			const { game, states } = makeGame(1);
			const state = states[0]!;
			state.currentPiece = new Piece(O, "O");
			game.move("sock0", "down");
			expect(state.currentPiece.getY()).toBe(1);
		});

		it("refuses to go through the left wall", () => {
			const { game, states } = makeGame(1);
			const state = states[0]!;
			state.currentPiece = placedPiece(O, "O", 0, 0);
			game.move("sock0", "left");
			expect(state.currentPiece.getX()).toBe(0);
		});

		it("refuses to go through the right wall", () => {
			const { game, states } = makeGame(1);
			const state = states[0]!;
			state.currentPiece = placedPiece(O, "O", BOARD_WIDTH - 2, 0);
			game.move("sock0", "right");
			expect(state.currentPiece.getX()).toBe(BOARD_WIDTH - 2);
		});

		it("refuses to go through the floor", () => {
			const { game, states } = makeGame(1);
			const state = states[0]!;
			state.currentPiece = placedPiece(O, "O", 4, BOARD_HEIGHT - 2);
			game.move("sock0", "down");
			expect(state.currentPiece.getY()).toBe(BOARD_HEIGHT - 2);
		});

		it("notifies the player and its spectators", () => {
			const { game, states } = makeGame(1);
			states[0]!.currentPiece = new Piece(O, "O");
			game.move("sock0", "left");
			expect(emitGameUpdate).toHaveBeenCalledTimes(1);
			expect(emitSpectatorForPlayer).toHaveBeenCalledTimes(1);
		});

		it("does nothing for an unknown socket id", () => {
			const { game } = makeGame(1);
			game.move("inconnu", "left");
			expect(emitGameUpdate).not.toHaveBeenCalled();
		});

		it("does nothing without a current piece", () => {
			const { game } = makeGame(1);
			game.move("sock0", "left");
			expect(emitGameUpdate).not.toHaveBeenCalled();
		});

		it("does nothing for a dead player", () => {
			const { game, states } = makeGame(1);
			const state = states[0]!;
			state.currentPiece = new Piece(O, "O");
			state.isAlive = false;
			game.move("sock0", "left");
			expect(state.currentPiece.getX()).toBe(4);
			expect(emitGameUpdate).not.toHaveBeenCalled();
		});
	});

	describe("rotate", () => {
		it("applies the rotated shape when it fits", () => {
			const { game, states } = makeGame(1);
			const state = states[0]!;
			state.currentPiece = new Piece(I, "I");
			game.rotate("sock0");
			// Boite 4x4: la barre verticale se place en colonne 2 de la boite.
			expect(state.currentPiece.shape).toEqual([
				[0, 0, 1, 0],
				[0, 0, 1, 0],
				[0, 0, 1, 0],
				[0, 0, 1, 0],
			]);
			expect(emitGameUpdate).toHaveBeenCalledTimes(1);
		});

		// La piece pivote SUR PLACE: la boite ne bouge pas, donc ni x ni y ne changent
		// tant que la rotation tient. C'etait le defaut d'avant — la boite changeait de
		// dimensions et la piece se decalait d'une demi-case a chaque quart de tour.
		it("ne deplace pas la piece quand la rotation tient", () => {
			const { game, states } = makeGame(1);
			const state = states[0]!;
			const piece = new Piece(pieces.T, "T");
			piece.translate(0, 5);
			state.currentPiece = piece;

			game.rotate("sock0");

			expect(state.currentPiece.getX()).toBe(4);
			expect(state.currentPiece.getY()).toBe(5);
		});

		// Floor kick: une piece a plat sur le sol n'a pas la place de se dresser. Sans
		// decalage vertical la rotation ne faisait RIEN, ce qui se ressent comme un bug.
		it("souleve la piece posee au sol pour la laisser se dresser", () => {
			const { game, states } = makeGame(1);
			const state = states[0]!;
			const piece = new Piece(pieces.T, "T");
			// T a plat, ses cases sur les deux dernieres rangees du plateau.
			piece.translate(0, BOARD_HEIGHT - 2);
			state.currentPiece = piece;

			game.rotate("sock0");

			expect(state.currentPiece.getY()).toBe(BOARD_HEIGHT - 3);
			expect(state.currentPiece.shape).toEqual([
				[0, 1, 0],
				[0, 1, 1],
				[0, 1, 0],
			]);
		});

		it("abandonne la rotation quand aucun decalage ne tient", () => {
			const { game, states } = makeGame(1);
			const state = states[0]!;
			const piece = new Piece(pieces.T, "T");
			piece.translate(0, BOARD_HEIGHT - 2);
			state.currentPiece = piece;
			// Tout est pris autour: ni les decalages horizontaux ni les floor kicks ne
			// peuvent placer la barre verticale.
			for (let y = 0; y < BOARD_HEIGHT - 2; y++)
				for (let x = 0; x < BOARD_WIDTH; x++)
					state.board[y]![x] = "Z";

			game.rotate("sock0");

			expect(state.currentPiece.shape).toEqual(pieces.T);
			expect(state.currentPiece.getY()).toBe(BOARD_HEIGHT - 2);
		});

		it("decale la piece (wall kick) quand la rotation en place est bloquee par un obstacle", () => {
			const { game, states } = makeGame(1);
			const state = states[0]!;
			// I horizontal en (x=4, y=0): la rotation verticale occuperait la colonne 6
			// (x + 2), mais (2,6) est pris. Un kick d'une case a gauche la fait tenir en
			// colonne 5.
			state.currentPiece = new Piece(I, "I");
			state.board[2]![6] = "O";
			game.rotate("sock0");
			expect(state.currentPiece.getX()).toBe(3);
			expect(state.currentPiece.getY()).toBe(0);
			expect(emitGameUpdate).toHaveBeenCalledTimes(1);
		});

		it("decolle du mur droit un I vertical pour le remettre a plat", () => {
			const { game, states } = makeGame(1);
			const state = states[0]!;
			// I vertical plaque contre le mur droit (colonne 9). A plat il deborderait
			// jusqu'a la colonne 12: il faut le decaler de 3 cases a gauche.
			state.currentPiece = placedPiece([[1], [1], [1], [1]], "I", BOARD_WIDTH - 1, 0);
			game.rotate("sock0");
			expect(state.currentPiece.shape).toEqual([[1, 1, 1, 1]]);
			expect(state.currentPiece.getX()).toBe(BOARD_WIDTH - 4);
			expect(emitGameUpdate).toHaveBeenCalledTimes(1);
		});

		it("ne monte jamais la piece pour tourner (pas de floor kick)", () => {
			const { game, states } = makeGame(1);
			const state = states[0]!;
			// I horizontal pose sur le sol: le tourner verticalement traverserait le sol,
			// et aucun decalage horizontal ne l'en empeche -> la rotation est refusee,
			// la piece ne remonte pas.
			state.currentPiece = placedPiece(I, "I", 4, BOARD_HEIGHT - 1);
			game.rotate("sock0");
			expect(state.currentPiece.shape).toEqual(I);
			expect(state.currentPiece.getY()).toBe(BOARD_HEIGHT - 1);
			expect(emitGameUpdate).not.toHaveBeenCalled();
		});

		it("keeps the shape when no kick fits", () => {
			const { game, states } = makeGame(1);
			const state = states[0]!;
			// Ligne 2 entierement pleine: la rotation verticale du I touche cette ligne
			// quelle que soit la colonne -> aucun wall kick ne peut la sauver.
			state.currentPiece = new Piece(I, "I");
			for (let x = 0; x < BOARD_WIDTH; x++)
				state.board[2]![x] = "O";
			game.rotate("sock0");
			expect(state.currentPiece.shape).toEqual(I);
			expect(state.currentPiece.getX()).toBe(4);
			expect(emitGameUpdate).not.toHaveBeenCalled();
		});

		it("does nothing when the rotated shape cannot be computed", () => {
			const { game, states } = makeGame(1);
			const state = states[0]!;
			state.currentPiece = new Piece([], "I");
			game.rotate("sock0");
			expect(emitGameUpdate).not.toHaveBeenCalled();
		});

		it("does nothing for an unknown socket, no piece or a dead player", () => {
			const { game, states } = makeGame(1);
			game.rotate("inconnu");
			game.rotate("sock0");
			states[0]!.currentPiece = new Piece(I, "I");
			states[0]!.isAlive = false;
			game.rotate("sock0");
			expect(emitGameUpdate).not.toHaveBeenCalled();
		});
	});

	describe("drop (hard drop)", () => {
		it("drops the piece all the way down and locks it", () => {
			const { game, states } = makeGame(1);
			const state = states[0]!;
			state.currentPiece = new Piece(O, "O");

			game.drop("sock0");

			expect(state.board[BOARD_HEIGHT - 1]![4]).toBe("O");
			expect(state.board[BOARD_HEIGHT - 1]![5]).toBe("O");
			expect(state.board[BOARD_HEIGHT - 2]![4]).toBe("O");
			expect(state.board[BOARD_HEIGHT - 2]![5]).toBe("O");
		});

		it("stacks the piece on top of what is already locked", () => {
			const { game, states } = makeGame(1);
			const state = states[0]!;
			state.board[BOARD_HEIGHT - 1] = fullRow([0]);
			state.currentPiece = new Piece(O, "O");

			game.drop("sock0");

			expect(state.board[BOARD_HEIGHT - 2]![4]).toBe("O");
			expect(state.board[BOARD_HEIGHT - 3]![4]).toBe("O");
		});

		it("spawns the next piece and advances the shared queue index", () => {
			const { game, states } = makeGame(1);
			const state = states[0]!;
			const expectedNext = game.getPieceQueue(1);
			state.currentPiece = new Piece(O, "O");

			game.drop("sock0");

			expect(state.pieceIndex).toBe(1);
			expect(state.currentPiece!.type).toBe(expectedNext);
			expect(state.currentPiece!.getY()).toBe(0);
		});

		it("notifies the player after a successful drop", () => {
			const { game, states } = makeGame(1);
			states[0]!.currentPiece = new Piece(O, "O");
			game.drop("sock0");
			expect(emitGameUpdate).toHaveBeenCalled();
			expect(emitSpectatorForPlayer).toHaveBeenCalled();
		});

		it("does nothing for an unknown socket, no piece or a dead player", () => {
			const { game, states } = makeGame(1);
			game.drop("inconnu");
			game.drop("sock0");
			states[0]!.currentPiece = new Piece(O, "O");
			states[0]!.isAlive = false;
			game.drop("sock0");
			expect(emitGameUpdate).not.toHaveBeenCalled();
		});
	});

	describe("lockPiece", () => {
		it("burns the current piece into the board", () => {
			const { game, states } = makeGame(1);
			const state = states[0]!;
			state.currentPiece = new Piece(T, "T");

			game.lockPiece(state);

			expect(state.board[0]![5]).toBe("T");
			expect(state.board[1]![4]).toBe("T");
			expect(state.board[1]![5]).toBe("T");
			expect(state.board[1]![6]).toBe("T");
			expect(state.board[0]![4]).toBe(0);
		});

		it("keeps the already locked cells", () => {
			const { game, states } = makeGame(1);
			const state = states[0]!;
			state.board[BOARD_HEIGHT - 1]![0] = "Z";
			state.currentPiece = new Piece(O, "O");

			game.lockPiece(state);

			expect(state.board[BOARD_HEIGHT - 1]![0]).toBe("Z");
		});
	});

	describe("lockAndSpawnNext", () => {
		it("locks, clears the completed line and scores it", () => {
			const { game, states } = makeGame(1);
			const state = states[0]!;
			state.board[BOARD_HEIGHT - 1] = fullRow([4, 5]);
			state.currentPiece = placedPiece(O, "O", 4, BOARD_HEIGHT - 2);

			const isGameOver = game.lockAndSpawnNext(state);

			expect(isGameOver).toBe(false);
			expect(state.score).toBe(100);
			expect(state.board[BOARD_HEIGHT - 1]![4]).toBe("O");
			expect(state.board[BOARD_HEIGHT - 1]![0]).toBe(0);
		});

		it("increments pieceIndex and spawns the next piece", () => {
			const { game, states } = makeGame(1);
			const state = states[0]!;
			state.currentPiece = placedPiece(O, "O", 4, BOARD_HEIGHT - 2);

			game.lockAndSpawnNext(state);

			expect(state.pieceIndex).toBe(1);
			expect(state.currentPiece!.type).toBe(game.getPieceQueue(1));
			expect(state.nextPiece!.type).toBe(game.getPieceQueue(2));
		});

		it("returns true and ends a solo game when the spawn is impossible", () => {
			const { game, room, states } = makeGame(1);
			const state = states[0]!;
			state.board[0] = fullRow([9]);
			state.board[1] = fullRow([9]);
			state.currentPiece = placedPiece(O, "O", 0, BOARD_HEIGHT - 2);

			const isGameOver = game.lockAndSpawnNext(state);

			expect(isGameOver).toBe(true);
			expect(state.isAlive).toBe(false);
			expect(room.getStatus()).toBe("waiting");
			expect(emitGameOver).toHaveBeenCalledTimes(1);
			expect(emitPlayerEliminated).not.toHaveBeenCalled();
		});

		it("notifies only the eliminated player while the game continues", () => {
			const { game, states } = makeGame(3);
			const victim = states[0]!;
			victim.board[0] = fullRow([9]);
			victim.board[1] = fullRow([9]);
			victim.currentPiece = placedPiece(O, "O", 0, BOARD_HEIGHT - 2);

			const isGameOver = game.lockAndSpawnNext(victim);

			expect(isGameOver).toBe(false);
			expect(victim.isAlive).toBe(false);
			expect(emitPlayerEliminated).toHaveBeenCalledTimes(1);
			expect(emitGameOver).not.toHaveBeenCalled();
		});
	});

	describe("spawnPiece", () => {
		it("assigns the current and the next piece from the shared queue", () => {
			const { game, states } = makeGame(1);
			const state = states[0]!;
			state.pieceIndex = 4;

			game.spawnPiece(state);

			expect(state.currentPiece!.type).toBe(game.getPieceQueue(4));
			expect(state.nextPiece!.type).toBe(game.getPieceQueue(5));
			expect(state.currentPiece!.shape).toEqual(pieces[game.getPieceQueue(4)]);
		});

		it("spawns at the top of the board", () => {
			const { game, states } = makeGame(1);
			const state = states[0]!;
			game.spawnPiece(state);
			expect(state.currentPiece!.getY()).toBe(0);
			expect(state.currentPiece!.getX()).toBe(4);
		});

		it("keeps the player alive when the spawn zone is free", () => {
			const { game, states } = makeGame(1);
			const state = states[0]!;
			game.spawnPiece(state);
			expect(state.isAlive).toBe(true);
		});

		it("kills the player when the spawn zone is blocked", () => {
			const { game, states } = makeGame(1);
			const state = states[0]!;
			state.board[0] = fullRow();
			state.board[1] = fullRow();

			game.spawnPiece(state);

			expect(state.isAlive).toBe(false);
		});
	});

	describe("isSolo", () => {
		it("is true with a single player", () => {
			expect(makeGame(1).game.isSolo()).toBe(true);
		});

		it("is false with several players", () => {
			expect(makeGame(2).game.isSolo()).toBe(false);
			expect(makeGame(4).game.isSolo()).toBe(false);
		});
	});

	describe("updateLevel", () => {
		// Le niveau suit les LIGNES, pas le score: avec le bareme Guideline (multi-lignes
		// primees puis multipliees par le niveau), un seuil en points s'emballerait.
		it("levels up every 5 lines in solo", () => {
			const { game, states } = makeGame(1);
			const state = states[0]!;

			state.lines = 5;
			game.updateLevel(state);
			expect(state.level).toBe(2);

			state.lines = 15;
			game.updateLevel(state);
			expect(state.level).toBe(4);
		});

		it("does not change the level below the next threshold", () => {
			const { game, states } = makeGame(1);
			const state = states[0]!;
			state.lines = 4;
			game.updateLevel(state);
			expect(state.level).toBe(1);
		});

		// Un gros score obtenu en peu de lignes (Tetris) ne doit plus faire monter le niveau.
		it("ignores the score entirely", () => {
			const { game, states } = makeGame(1);
			const state = states[0]!;
			state.score = 100_000;
			state.lines = 0;
			game.updateLevel(state);
			expect(state.level).toBe(1);
		});

		it("never levels up in multiplayer", () => {
			const { game, states } = makeGame(2);
			const state = states[0]!;
			state.lines = 50;
			game.updateLevel(state);
			expect(state.level).toBe(1);
		});
	});

	describe("points de descente", () => {
		// Bareme Guideline: descendre soi-meme rapporte 1 pt/case, lacher d'un coup 2.
		it("marque 1 point par case descendue au soft drop", () => {
			const { game, states, players } = makeGame(1);
			const state = states[0]!;
			state.currentPiece = placedPiece(O, "O", 4, 0);

			game.move(players[0]!.getSocketId(), "down");

			expect(state.score).toBe(1);
		});

		// Marteler la touche contre le sol ne doit rien rapporter: c'est la case
		// PARCOURUE qui compte, pas l'appui.
		it("ne marque rien quand la piece ne peut plus descendre", () => {
			const { game, states, players } = makeGame(1);
			const state = states[0]!;
			state.currentPiece = placedPiece(O, "O", 4, BOARD_HEIGHT - 2);

			game.move(players[0]!.getSocketId(), "down");
			game.move(players[0]!.getSocketId(), "down");

			expect(state.score).toBe(0);
		});

		it("ne marque rien sur un deplacement lateral", () => {
			const { game, states, players } = makeGame(1);
			const state = states[0]!;
			state.currentPiece = placedPiece(O, "O", 4, 0);

			game.move(players[0]!.getSocketId(), "left");
			game.move(players[0]!.getSocketId(), "right");

			expect(state.score).toBe(0);
		});

		it("marque 2 points par case a la chute instantanee", () => {
			const { game, states, players } = makeGame(1);
			const state = states[0]!;
			state.board = emptyBoard();
			state.currentPiece = placedPiece(O, "O", 4, 0);

			game.drop(players[0]!.getSocketId());

			// La piece O part de la rangee 0 et s'arrete sur le fond: 18 cases parcourues.
			expect(state.score).toBe((BOARD_HEIGHT - 2) * 2);
		});

		it("ne marque rien en lachant une piece deja posee", () => {
			const { game, states, players } = makeGame(1);
			const state = states[0]!;
			state.board = emptyBoard();
			state.currentPiece = placedPiece(O, "O", 4, BOARD_HEIGHT - 2);

			game.drop(players[0]!.getSocketId());

			expect(state.score).toBe(0);
		});
	});

	describe("getLockGraceMs", () => {
		// Plus confortable qu'une frame seche, mais accelere comme la chute.
		it("laisse plus de temps qu'une frame de gravite", () => {
			const { game } = makeGame(1);
			expect(game.getLockGraceMs()).toBeGreaterThan(game.getTickSpeed());
		});

		it("se resserre quand le niveau monte", () => {
			const { game, states } = makeGame(1);
			const state = states[0]!;

			state.level = 1;
			const debut = game.getLockGraceMs();
			state.level = 5;
			const milieu = game.getLockGraceMs();

			expect(milieu).toBeLessThan(debut);
		});

		it("ne descend pas sous un plancher jouable aux niveaux les plus rapides", () => {
			const { game, states } = makeGame(1);
			states[0]!.level = 50;

			expect(game.getLockGraceMs()).toBe(LOCK_GRACE_MIN_MS);
		});

		// Exigence du sujet (V.1.1): la piece doit toujours survivre a la frame du contact.
		it("reste au moins egal a une frame, a tous les niveaux", () => {
			const { game, states } = makeGame(1);
			for (const level of [1, 2, 5, 9, 20, 50]) {
				states[0]!.level = level;
				expect(game.getLockGraceMs()).toBeGreaterThanOrEqual(game.getTickSpeed());
			}
		});
	});

	describe("getLockDelayMs", () => {
		// Une piece qui ne peut plus descendre n'est verrouillee qu'au tick SUIVANT: le
		// client a besoin de ce sursis pour afficher un decompte juste.
		it("est null tant que la piece peut descendre", () => {
			const { game, states } = makeGame(1);
			const state = states[0]!;
			state.currentPiece = placedPiece(O, "O", 4, 0);

			expect(game.getLockDelayMs(state)).toBeNull();
		});

		// Le verrouillage n'etant evalue qu'aux ticks, l'echeance annoncee est le premier
		// tick au-dela du sursis: jamais moins que le sursis, jamais plus d'un tick de plus.
		it("annonce au moins le sursis complet des que la piece touche la pile", () => {
			const { game, states } = makeGame(1);
			const state = states[0]!;
			state.currentPiece = placedPiece(O, "O", 4, BOARD_HEIGHT - 2);
			game.restartTickInterval();
			game.refreshLockState(state);

			const remaining = game.getLockDelayMs(state)!;
			expect(remaining).toBeGreaterThanOrEqual(game.getLockGraceMs());
			expect(remaining).toBeLessThan(game.getLockGraceMs() + game.getTickSpeed());
		});

		// Le sursis s'ecoule: bouger la piece ne le relance pas, sinon on la retiendrait
		// indefiniment en la faisant glisser.
		it("decroit avec le temps ecoule depuis le contact", () => {
			const { game, states } = makeGame(1);
			const state = states[0]!;
			state.currentPiece = placedPiece(O, "O", 4, BOARD_HEIGHT - 2);
			game.restartTickInterval();
			game.refreshLockState(state);

			const before = game.getLockDelayMs(state)!;
			vi.advanceTimersByTime(100);

			expect(game.getLockDelayMs(state)).toBe(before - 100);
		});

		// Le coeur du correctif: une piece posee juste avant un tick n'avait presque aucun
		// temps d'ajustement, alors que le sujet en promet une frame entiere.
		it("accorde une frame pleine meme quand la piece touche juste avant un tick", () => {
			const { game, states } = makeGame(1);
			const state = states[0]!;
			game.restartTickInterval();
			vi.clearAllTimers(); // les ticks sont pilotes a la main
			const tick = game.getTickSpeed();
			vi.advanceTimersByTime(tick - 20);

			state.currentPiece = placedPiece(O, "O", 4, BOARD_HEIGHT - 2);
			game.refreshLockState(state);

			expect(game.getLockDelayMs(state)).toBeGreaterThanOrEqual(game.getLockGraceMs());
			expect(tick).toBeGreaterThan(0);
		});

		// Sans gravite en cours (partie mise en pause par une fin de partie, derive de
		// l'horloge), le sursis se borne a zero au lieu de partir en negatif.
		it("ne descend jamais sous zero", () => {
			const { game, states } = makeGame(1);
			const state = states[0]!;
			state.currentPiece = placedPiece(O, "O", 4, BOARD_HEIGHT - 2);
			game.restartTickInterval();
			game.refreshLockState(state);
			// Gravite coupee (fin de partie) : le temps passe sans qu'aucun tick ne
			// reprogramme l'echeance.
			vi.clearAllTimers();

			vi.advanceTimersByTime(10_000);

			expect(game.getLockDelayMs(state)).toBe(0);
		});

		it("est null pour un joueur elimine", () => {
			const { game, states } = makeGame(1);
			const state = states[0]!;
			state.currentPiece = placedPiece(O, "O", 4, BOARD_HEIGHT - 2);
			state.isAlive = false;

			expect(game.getLockDelayMs(state)).toBeNull();
		});
	});

	describe("getTickSpeed", () => {
		it("is fixed at 400ms in multiplayer", () => {
			const { game, states } = makeGame(2);
			states[0]!.level = 9;
			expect(game.getTickSpeed()).toBe(400);
		});

		it("starts at 400ms at level 1 in solo", () => {
			expect(makeGame(1).game.getTickSpeed()).toBe(400);
		});

		it("accelerates by 40ms per level", () => {
			const { game, states } = makeGame(1);
			states[0]!.level = 2;
			expect(game.getTickSpeed()).toBe(360);
			states[0]!.level = 5;
			expect(game.getTickSpeed()).toBe(240);
		});

		it("never goes below 80ms", () => {
			const { game, states } = makeGame(1);
			states[0]!.level = 50;
			expect(game.getTickSpeed()).toBe(80);
		});
	});

	describe("checkGameOver", () => {
		it("solo: not finished while the player is alive", () => {
			const { game } = makeGame(1);
			expect(game.checkGameOver()).toBe(false);
			expect(emitGameOver).not.toHaveBeenCalled();
		});

		it("solo: finished as soon as the player dies, without winner", () => {
			const { game, states } = makeGame(1);
			states[0]!.isAlive = false;

			expect(game.checkGameOver()).toBe(true);
			expect(emitGameOver).toHaveBeenCalledWith(game.getState(), null);
		});

		it("multi: not finished while two players are alive", () => {
			const { game, states } = makeGame(3);
			states[0]!.isAlive = false;
			expect(game.checkGameOver()).toBe(false);
		});

		it("multi: finished when only one player is left, who is the winner", () => {
			const { game, states } = makeGame(3);
			states[0]!.isAlive = false;
			states[1]!.isAlive = false;

			expect(game.checkGameOver()).toBe(true);
			expect(emitGameOver).toHaveBeenCalledWith(game.getState(), "joueur2");
		});

		it("multi: no winner when everybody is dead", () => {
			const { game, states } = makeGame(2);
			for (const state of states) state.isAlive = false;

			expect(game.checkGameOver()).toBe(true);
			expect(emitGameOver).toHaveBeenCalledWith(game.getState(), null);
		});

		it("reopens the room and detaches the finished game", () => {
			const { game, room, states } = makeGame(1);
			room.setStatus("playing");
			room.setGame(game);
			states[0]!.isAlive = false;

			game.checkGameOver();

			expect(room.getStatus()).toBe("waiting");
			expect(room.getGame()).toBeNull();
		});

		it("credits every player with its final score", () => {
			const { game, states } = makeGame(2);
			states[0]!.score = 1200;
			states[1]!.score = 300;
			for (const state of states) state.isAlive = false;

			game.checkGameOver();

			expect(settleGameRewards).toHaveBeenCalledTimes(1);
			expect(vi.mocked(settleGameRewards).mock.calls[0]![0]).toEqual([
				expect.objectContaining({ username: "joueur0", score: 1200 }),
				expect.objectContaining({ username: "joueur1", score: 300 }),
			]);
		});

		it("stops the tick interval", () => {
			const { game, states } = makeGame(1);
			game.restartTickInterval();
			states[0]!.isAlive = false;
			states[0]!.currentPiece = new Piece(O, "O");

			game.checkGameOver();
			vi.advanceTimersByTime(5000);

			expect(states[0]!.currentPiece.getY()).toBe(0);
		});
	});

	describe("restartTickInterval", () => {
		it("schedules ticks at the current speed", () => {
			const { game, states } = makeGame(1);
			const state = states[0]!;
			state.currentPiece = new Piece(O, "O");

			game.restartTickInterval();
			vi.advanceTimersByTime(400);

			expect(state.currentPiece.getY()).toBe(1);
		});

		it("replaces the previous interval instead of stacking one more", () => {
			const { game, states } = makeGame(1);
			const state = states[0]!;
			state.currentPiece = new Piece(O, "O");

			game.restartTickInterval();
			game.restartTickInterval();
			vi.advanceTimersByTime(400);

			expect(state.currentPiece.getY()).toBe(1);
		});
	});

	describe("start", () => {
		it("spawns a piece for every player then broadcasts the start", () => {
			const { game, states } = makeGame(2);

			game.start();

			for (const state of states) {
				expect(state.currentPiece).toBeDefined();
				expect(state.nextPiece).toBeDefined();
			}
			expect(emitGameStart).toHaveBeenCalledTimes(1);
		});

		it("gives the same first piece to every player (shared queue)", () => {
			const { game, states } = makeGame(3);
			game.start();
			const types = states.map((state) => state.currentPiece!.type);
			expect(new Set(types).size).toBe(1);
		});

		it("starts the automatic gravity", () => {
			const { game, states } = makeGame(1);
			game.start();

			vi.advanceTimersByTime(400 * 3);

			expect(states[0]!.currentPiece!.getY()).toBe(3);
		});
	});

	describe("tick", () => {
		it("makes the current piece fall by one row", () => {
			const { game, states } = makeGame(1);
			const state = states[0]!;
			state.currentPiece = new Piece(O, "O");

			game.tick();

			expect(state.currentPiece.getY()).toBe(1);
			expect(emitGameUpdate).toHaveBeenCalledTimes(1);
		});

		it("locks the piece and spawns the next one when it hits the floor", () => {
			const { game, states } = makeGame(1);
			const state = states[0]!;
			state.currentPiece = placedPiece(O, "O", 4, BOARD_HEIGHT - 2);

			// Contact au 1er tick, verrouillage seulement une fois le sursis ecoule.
			game.tick();
			vi.advanceTimersByTime(game.getLockGraceMs());
			game.tick();

			expect(state.board[BOARD_HEIGHT - 1]![4]).toBe("O");
			expect(state.pieceIndex).toBe(1);
		});

		it("skips dead players", () => {
			const { game, states } = makeGame(2);
			const dead = states[0]!;
			const alive = states[1]!;
			dead.currentPiece = new Piece(O, "O");
			dead.isAlive = false;
			alive.currentPiece = new Piece(O, "O");

			game.tick();

			expect(dead.currentPiece.getY()).toBe(0);
			expect(alive.currentPiece.getY()).toBe(1);
		});

		it("does nothing harmful without a current piece", () => {
			const { game, states } = makeGame(1);
			const state = states[0]!;
			state.board[0] = fullRow([9]);
			state.board[1] = fullRow([9]);

			expect(() => game.tick()).not.toThrow();
			expect(state.isAlive).toBe(false);
		});

		it("stops the loop as soon as the game is over", () => {
			const { game, room, states } = makeGame(1);
			const state = states[0]!;
			state.board[0] = fullRow([9]);
			state.board[1] = fullRow([9]);
			state.currentPiece = placedPiece(O, "O", 0, BOARD_HEIGHT - 2);

			game.tick();
			vi.advanceTimersByTime(game.getLockGraceMs());
			game.tick();

			expect(state.isAlive).toBe(false);
			expect(emitGameOver).toHaveBeenCalledTimes(1);
			expect(room.getGame()).toBeNull();
		});

		it("keeps ticking the remaining players after one elimination", () => {
			const { game, states } = makeGame(3);
			const victim = states[0]!;
			const survivor = states[1]!;
			victim.board[0] = fullRow([9]);
			victim.board[1] = fullRow([9]);
			victim.currentPiece = placedPiece(O, "O", 0, BOARD_HEIGHT - 2);
			survivor.currentPiece = new Piece(O, "O");

			game.tick();
			vi.advanceTimersByTime(game.getLockGraceMs());
			game.tick();

			expect(victim.isAlive).toBe(false);
			expect(survivor.currentPiece.getY()).toBe(2);
			expect(emitPlayerEliminated).toHaveBeenCalledTimes(1);
		});
	});

	describe("getState", () => {
		it("exposes the live state map", () => {
			const { game, states } = makeGame(2);
			const map = game.getState();
			expect(map.size).toBe(2);
			expect([...map.values()]).toEqual(states);
		});
	});

	// ─── Modes de jeu ────────────────────────────────────────────────────────────

	describe("compteur de lignes", () => {
		it("cumule les lignes nettoyees (base des objectifs de mode)", () => {
			const { game, states } = makeGame(1);
			const state = states[0]!;
			expect(state.lines).toBe(0);

			state.board[BOARD_HEIGHT - 1] = fullRow();
			state.board[BOARD_HEIGHT - 2] = fullRow();
			game.clearLines(state);

			expect(state.lines).toBe(2);
		});
	});

	describe("mode sprint", () => {
		it("expose l'objectif de lignes", () => {
			expect(makeGame(1, "sprint").game.getLinesTarget()).toBe(SPRINT_TARGET_LINES);
			expect(makeGame(1, "classique").game.getLinesTarget()).toBeNull();
		});

		it("termine la partie quand un joueur atteint l'objectif, et le declare vainqueur", () => {
			const { game, states, players } = makeGame(2, "sprint");
			states[1]!.lines = SPRINT_TARGET_LINES;

			expect(game.checkGameOver()).toBe(true);
			expect(vi.mocked(emitGameOver)).toHaveBeenCalledWith(expect.anything(), players[1]!.getName());
		});

		it("ne termine pas la partie sous l'objectif", () => {
			const { game, states } = makeGame(2, "sprint");
			states[1]!.lines = SPRINT_TARGET_LINES - 1;

			expect(game.checkGameOver()).toBe(false);
		});
	});

	describe("mode ultra", () => {
		it("arme le chrono au demarrage et l'expose", () => {
			const { game } = makeGame(1, "ultra");
			expect(game.getTimeLeftMs()).toBeNull();

			game.start();

			expect(game.getTimeLeftMs()).toBe(ULTRA_DURATION_MS);
			expect(makeGame(1, "classique").game.getTimeLeftMs()).toBeNull();
		});

		// setSystemTime (et non advanceTimersByTime): on veut avancer l'HORLOGE sans
		// executer les ticks de gravite, qui simuleraient 2 minutes de jeu et
		// termineraient la partie par top-out avant l'expiration testee.
		it("termine la partie a l'expiration du chrono, meilleur score vainqueur", () => {
			const { game, states, players } = makeGame(2, "ultra");
			game.start();
			states[0]!.score = 100;
			states[1]!.score = 900;

			vi.setSystemTime(Date.now() + ULTRA_DURATION_MS);

			expect(game.checkGameOver()).toBe(true);
			expect(vi.mocked(emitGameOver)).toHaveBeenCalledWith(expect.anything(), players[1]!.getName());
		});

		it("ne termine pas la partie avant l'expiration", () => {
			const { game } = makeGame(2, "ultra");
			game.start();

			vi.setSystemTime(Date.now() + ULTRA_DURATION_MS - 1000);

			expect(game.checkGameOver()).toBe(false);
			expect(game.getTimeLeftMs()).toBe(1000);
		});
	});

	describe("mode sudden death", () => {
		it("tourne a vitesse maximale, en solo comme en multi", () => {
			expect(makeGame(1, "suddendeath").game.getTickSpeed()).toBe(SUDDEN_DEATH_TICK_MS);
			expect(makeGame(3, "suddendeath").game.getTickSpeed()).toBe(SUDDEN_DEATH_TICK_MS);
		});

		it("garde la vitesse constante malgre la montee de niveau", () => {
			const { game, states } = makeGame(1, "suddendeath");
			const state = states[0]!;
			state.score = 5000;
			game.updateLevel(state);

			expect(game.getTickSpeed()).toBe(SUDDEN_DEATH_TICK_MS);
		});
	});

	describe("mode invisible", () => {
		it("ne produit aucun fondu hors du mode invisible", () => {
			const { game, states } = makeGame(1, "classique");
			expect(game.getFadeGrid(states[0]!)).toBeNull();
		});

		it("efface progressivement une piece verrouillee puis la rend invisible a 3s", () => {
			const { game, states } = makeGame(1, "invisible");
			const state = states[0]!;
			state.currentPiece = placedPiece(O, "O", 4, BOARD_HEIGHT - 2);

			game.lockPiece(state);
			const cellY = BOARD_HEIGHT - 1;
			const cellX = 4;
			expect(state.board[cellY]![cellX]).toBe("O");
			expect(game.getFadeGrid(state)![cellY]![cellX]).toBe(1);

			vi.advanceTimersByTime(INVISIBLE_FADE_MS / 2);
			expect(game.getFadeGrid(state)![cellY]![cellX]).toBeCloseTo(0.5, 2);

			vi.advanceTimersByTime(INVISIBLE_FADE_MS / 2);
			expect(game.getFadeGrid(state)![cellY]![cellX]).toBe(0);
			// La cellule reste SOLIDE une fois invisible.
			expect(state.board[cellY]![cellX]).toBe("O");
		});

		it("garde les cases vides et les lignes de penalite pleinement visibles", () => {
			const { game, states } = makeGame(2, "invisible");
			const state = states[0]!;
			game.addPenaltyLines(state, 1);

			const fade = game.getFadeGrid(state)!;
			expect(state.board[BOARD_HEIGHT - 1]!.every((cell) => cell === "penalty")).toBe(true);
			expect(fade[BOARD_HEIGHT - 1]!.every((opacity) => opacity === 1)).toBe(true);
			expect(fade[0]!.every((opacity) => opacity === 1)).toBe(true);
		});

		it("redonne 2s de visibilite totale par ligne completee", () => {
			const { game, states } = makeGame(1, "invisible");
			const state = states[0]!;
			// Piece posee AU-DESSUS des lignes a completer: elle survit au nettoyage et
			// permet d'observer la reprise du fondu apres la revelation.
			state.currentPiece = placedPiece(O, "O", 0, BOARD_HEIGHT - 4);
			game.lockPiece(state);
			vi.advanceTimersByTime(INVISIBLE_FADE_MS);
			expect(game.getFadeGrid(state)![BOARD_HEIGHT - 3]![0]).toBe(0);

			// Deux lignes completees => 4s de revelation totale.
			state.board[BOARD_HEIGHT - 1] = fullRow();
			state.board[BOARD_HEIGHT - 2] = fullRow();
			expect(game.clearLines(state)).toBe(2);
			// La piece est descendue de 2 rangees avec le plateau.
			expect(state.board[BOARD_HEIGHT - 1]![0]).toBe("O");

			expect(game.getFadeGrid(state)!.every((row) => row.every((o) => o === 1))).toBe(true);

			// Toujours pleinement visible jusqu'au bout des 4s.
			vi.advanceTimersByTime(2 * INVISIBLE_REVEAL_PER_LINE_MS - 100);
			expect(game.getFadeGrid(state)![BOARD_HEIGHT - 1]![0]).toBe(1);

			// Puis la disparition est PROGRESSIVE (comme une brique posee), pas nette.
			vi.advanceTimersByTime(100 + INVISIBLE_FADE_MS / 2);
			expect(game.getFadeGrid(state)![BOARD_HEIGHT - 1]![0]).toBeCloseTo(0.5, 2);

			vi.advanceTimersByTime(INVISIBLE_FADE_MS / 2);
			expect(game.getFadeGrid(state)![BOARD_HEIGHT - 1]![0]).toBe(0);
		});

		it("prolonge une revelation deja en cours au lieu de l'ecraser", () => {
			const { game, states } = makeGame(1, "invisible");
			const state = states[0]!;
			state.currentPiece = placedPiece(O, "O", 0, BOARD_HEIGHT - 4);
			game.lockPiece(state);

			state.board[BOARD_HEIGHT - 1] = fullRow();
			game.clearLines(state);
			const afterFirst = state.lockedAt[BOARD_HEIGHT - 2]![0]!;

			vi.advanceTimersByTime(500);
			state.board[BOARD_HEIGHT - 1] = fullRow();
			game.clearLines(state);

			// La seconde ligne AJOUTE 2s a la fin de la revelation en cours (pas de reset).
			expect(state.lockedAt[BOARD_HEIGHT - 1]![0]).toBe(afterFirst + INVISIBLE_REVEAL_PER_LINE_MS);
		});

		it("decale les horodatages avec le plateau quand une ligne est completee", () => {
			const { game, states } = makeGame(1, "invisible");
			const state = states[0]!;
			// Une cellule verrouillee juste au-dessus d'une ligne qui va disparaitre.
			state.currentPiece = placedPiece(O, "O", 0, BOARD_HEIGHT - 3);
			game.lockPiece(state);
			state.board[BOARD_HEIGHT - 1] = fullRow();

			vi.advanceTimersByTime(INVISIBLE_FADE_MS / 2);
			game.clearLines(state);

			// Le O (2 rangees) est descendu d'une ligne, ses horodatages AUSSI: ils
			// occupent desormais les deux dernieres rangees, et la rangee liberee
			// au-dessus n'en porte plus.
			expect(state.board[BOARD_HEIGHT - 1]![0]).toBe("O");
			expect(state.lockedAt[BOARD_HEIGHT - 1]![0]).not.toBe(0);
			expect(state.lockedAt[BOARD_HEIGHT - 2]![0]).not.toBe(0);
			expect(state.lockedAt[BOARD_HEIGHT - 3]![0]).toBe(0);
			// Les cases restees vides n'ont toujours aucun horodatage.
			expect(state.lockedAt[BOARD_HEIGHT - 1]![9]).toBe(0);
		});

		it("offre 3 jokers qui revelent le plateau puis s'epuisent", () => {
			const { game, states } = makeGame(1, "invisible");
			const state = states[0]!;
			state.currentPiece = placedPiece(O, "O", 0, BOARD_HEIGHT - 2);
			game.lockPiece(state);
			vi.advanceTimersByTime(INVISIBLE_FADE_MS);
			expect(state.jokersLeft).toBe(INVISIBLE_JOKER_COUNT);
			expect(game.getFadeGrid(state)![BOARD_HEIGHT - 1]![0]).toBe(0);

			expect(game.useJoker("sock0")).toBe(true);
			expect(state.jokersLeft).toBe(2);
			expect(game.getFadeGrid(state)![BOARD_HEIGHT - 1]![0]).toBe(1);

			// Toujours visible pendant 3s, puis estompage progressif.
			vi.advanceTimersByTime(INVISIBLE_JOKER_REVEAL_MS);
			expect(game.getFadeGrid(state)![BOARD_HEIGHT - 1]![0]).toBe(1);
			vi.advanceTimersByTime(INVISIBLE_FADE_MS / 2);
			expect(game.getFadeGrid(state)![BOARD_HEIGHT - 1]![0]).toBeCloseTo(0.5, 2);

			// Les jokers s'epuisent et ne sont plus utilisables.
			expect(game.useJoker("sock0")).toBe(true);
			expect(game.useJoker("sock0")).toBe(true);
			expect(state.jokersLeft).toBe(0);
			expect(game.useJoker("sock0")).toBe(false);
		});

		it("refuse le joker hors mode invisible, pour un mort ou un socket inconnu", () => {
			const classique = makeGame(1, "classique");
			expect(classique.game.useJoker("sock0")).toBe(false);

			const { game, states } = makeGame(1, "invisible");
			expect(game.useJoker("inconnu")).toBe(false);
			states[0]!.isAlive = false;
			expect(game.useJoker("sock0")).toBe(false);
			expect(states[0]!.jokersLeft).toBe(INVISIBLE_JOKER_COUNT);
		});

		it("decale aussi les horodatages quand des lignes de penalite arrivent", () => {
			const { game, states } = makeGame(2, "invisible");
			const state = states[0]!;
			state.currentPiece = placedPiece(O, "O", 0, BOARD_HEIGHT - 2);
			game.lockPiece(state);
			expect(state.lockedAt[BOARD_HEIGHT - 1]![0]).not.toBe(0);

			game.addPenaltyLines(state, 1);

			// Tout est remonte d'une rangee: l'horodatage suit la piece.
			expect(state.lockedAt[BOARD_HEIGHT - 2]![0]).not.toBe(0);
			// La ligne de penalite ajoutee en bas n'a pas d'horodatage (toujours visible).
			expect(state.lockedAt[BOARD_HEIGHT - 1]!.every((t) => t === 0)).toBe(true);
		});
	});
});

describe("Game — correctifs d'audit", () => {
	beforeEach(() => {
		vi.useFakeTimers();
		vi.clearAllMocks();
		vi.spyOn(console, "log").mockImplementation(() => undefined);
	});
	afterEach(() => {
		vi.useRealTimers();
		vi.restoreAllMocks();
	});

	describe("ultra: le chrono fait foi", () => {
		it("ne termine PAS la partie a la premiere elimination", () => {
			const { game, states } = makeGame(2, "ultra");
			game.start();
			states[0]!.isAlive = false;

			// Regle de survie neutralisee tant que le chrono tourne.
			expect(game.checkGameOver()).toBe(false);
		});

		it("sacre le MEILLEUR SCORE, pas le survivant", () => {
			const { game, states, players } = makeGame(2, "ultra");
			game.start();
			states[0]!.score = 9000;
			states[0]!.isAlive = false; // gros score mais elimine
			states[1]!.score = 10;

			vi.setSystemTime(Date.now() + ULTRA_DURATION_MS);

			expect(game.checkGameOver()).toBe(true);
			expect(vi.mocked(emitGameOver)).toHaveBeenCalledWith(expect.anything(), players[0]!.getName());
		});

		it("termine avec le meilleur score si tout le monde meurt avant le chrono", () => {
			const { game, states, players } = makeGame(2, "ultra");
			game.start();
			states[0]!.score = 5000;
			states[1]!.score = 100;
			states[0]!.isAlive = false;
			states[1]!.isAlive = false;

			expect(game.checkGameOver()).toBe(true);
			expect(vi.mocked(emitGameOver)).toHaveBeenCalledWith(expect.anything(), players[0]!.getName());
		});
	});

	describe("sprint: un joueur mort ne gagne pas", () => {
		it("ignore un finisher elimine et laisse gagner le survivant", () => {
			const { game, states, players } = makeGame(2, "sprint");
			states[0]!.lines = SPRINT_TARGET_LINES;
			states[0]!.isAlive = false;

			expect(game.checkGameOver()).toBe(true);
			expect(vi.mocked(emitGameOver)).toHaveBeenCalledWith(expect.anything(), players[1]!.getName());
		});
	});

	describe("invisible: la banque de visibilite est plafonnee", () => {
		it("ne depasse jamais le plafond meme en enchainant les revelations", () => {
			const { game, states } = makeGame(1, "invisible");
			const state = states[0]!;
			state.currentPiece = placedPiece(O, "O", 0, BOARD_HEIGHT - 2);
			game.lockPiece(state);

			const start = Date.now();
			for (let i = 0; i < 50; i++) game.grantReveal(state, INVISIBLE_REVEAL_PER_LINE_MS);

			expect(state.revealUntil).toBe(start + INVISIBLE_REVEAL_CAP_MS);
			// Au-dela du plafond, le fondu reprend normalement.
			vi.setSystemTime(start + INVISIBLE_REVEAL_CAP_MS + INVISIBLE_FADE_MS);
			expect(game.getFadeGrid(state)![BOARD_HEIGHT - 1]![0]).toBe(0);
		});

		it("fait disparaitre une piece posee PENDANT une revelation avec les autres", () => {
			const { game, states } = makeGame(1, "invisible");
			const state = states[0]!;
			// Ancienne piece + revelation en cours.
			state.currentPiece = placedPiece(O, "O", 0, BOARD_HEIGHT - 2);
			game.lockPiece(state);
			game.grantReveal(state, INVISIBLE_JOKER_REVEAL_MS);
			// Nouvelle piece posee pendant la revelation.
			state.currentPiece = placedPiece(O, "O", 4, BOARD_HEIGHT - 2);
			game.lockPiece(state);

			// Les deux partagent le meme depart de fondu: aucune ne s'efface avant l'autre.
			expect(state.lockedAt[BOARD_HEIGHT - 1]![4]).toBe(state.lockedAt[BOARD_HEIGHT - 1]![0]);
			vi.advanceTimersByTime(INVISIBLE_JOKER_REVEAL_MS + INVISIBLE_FADE_MS / 2);
			const fade = game.getFadeGrid(state)!;
			expect(fade[BOARD_HEIGHT - 1]![4]).toBeCloseTo(fade[BOARD_HEIGHT - 1]![0]!, 5);
		});
	});
});

describe("Game — correctifs d'audit (iteration 2)", () => {
	beforeEach(() => {
		vi.useFakeTimers();
		vi.clearAllMocks();
		vi.spyOn(console, "log").mockImplementation(() => undefined);
	});
	afterEach(() => {
		vi.useRealTimers();
		vi.restoreAllMocks();
	});

	it("ultra: un joueur qui QUITTE ne peut pas etre sacre vainqueur", () => {
		const { game, states, players } = makeGame(2, "ultra");
		game.start();
		states[0]!.score = 5000;
		states[1]!.score = 100;
		game.abandon("sock0"); // depart volontaire, gros score

		vi.setSystemTime(Date.now() + ULTRA_DURATION_MS);
		expect(game.checkGameOver()).toBe(true);

		expect(states[0]!.hasAbandoned).toBe(true);
		expect(vi.mocked(emitGameOver)).toHaveBeenCalledWith(expect.anything(), players[1]!.getName());
	});

	it("un top-out n'est PAS un abandon (le joueur reste classe)", () => {
		const { game, states, players } = makeGame(2, "ultra");
		game.start();
		states[0]!.score = 5000;
		states[0]!.isAlive = false; // top-out, pas de depart
		states[1]!.score = 100;

		vi.setSystemTime(Date.now() + ULTRA_DURATION_MS);
		game.checkGameOver();

		expect(states[0]!.hasAbandoned).toBe(false);
		expect(vi.mocked(emitGameOver)).toHaveBeenCalledWith(expect.anything(), players[0]!.getName());
	});

	it("ne consomme pas un joker sans effet (banque deja au plafond)", () => {
		const { game, states } = makeGame(1, "invisible");
		const state = states[0]!;
		state.currentPiece = placedPiece(O, "O", 0, BOARD_HEIGHT - 2);
		game.lockPiece(state);

		expect(game.useJoker("sock0")).toBe(true);   // 3s
		expect(game.useJoker("sock0")).toBe(true);   // 6s -> plafond atteint
		expect(game.useJoker("sock0")).toBe(false);  // refuse: aucun effet possible
		expect(state.jokersLeft).toBe(1);
	});
});

describe("Game — correctifs d'audit (iteration 3)", () => {
	beforeEach(() => {
		vi.useFakeTimers();
		vi.clearAllMocks();
		vi.spyOn(console, "log").mockImplementation(() => undefined);
	});
	afterEach(() => {
		vi.useRealTimers();
		vi.restoreAllMocks();
	});

	it("refuse un joker dont le gain serait rogne par le plafond (garde non inerte)", () => {
		const { game, states } = makeGame(1, "invisible");
		const state = states[0]!;
		game.grantReveal(state, INVISIBLE_REVEAL_CAP_MS); // banque pleine

		// Meme legerement apres, le gain restant est trop faible: joker preserve.
		vi.advanceTimersByTime(50);
		expect(game.useJoker("sock0")).toBe(false);
		expect(state.jokersLeft).toBe(INVISIBLE_JOKER_COUNT);

		// Une fois la banque suffisamment vidée, le joker redevient utile.
		vi.advanceTimersByTime(INVISIBLE_JOKER_REVEAL_MS);
		expect(game.useJoker("sock0")).toBe(true);
		expect(state.jokersLeft).toBe(INVISIBLE_JOKER_COUNT - 1);
	});
});
