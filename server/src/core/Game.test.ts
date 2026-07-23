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
import { BOARD_HEIGHT, BOARD_WIDTH, type Board, type Cell, type PieceType, type PlayerGameState } from "../types/game/gameTypes.js";
import { I, O, pieces, T, type PieceShape } from "../types/game/piecesGameTypes.js";
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

function makeGame(playerCount = 1, mode: "classique" | "ultra" | "sprint" = "classique"): Setup {
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

		it("attaches the game to every player and flags them in-game", () => {
			const { game, players } = makeGame(3);
			for (const player of players) {
				expect(player.getGame()).toBe(game);
				expect(player.getInGame()).toBe(true);
			}
		});

		it("keeps the mode given at construction", () => {
			expect(makeGame(1, "ultra").game.mode).toBe("ultra");
			expect(makeGame(1, "sprint").game.mode).toBe("sprint");
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

		it("adds 100 points per cleared line", () => {
			const { game, states } = makeGame(1);
			const state = states[0]!;
			state.board = emptyBoard();
			state.board[BOARD_HEIGHT - 1] = fullRow();

			game.clearLines(state);

			expect(state.score).toBe(100);
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

			expect(state.score).toBe(400);
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

			expect(state.score).toBe(200);
			expect(state.board[BOARD_HEIGHT - 1]![0]).toBe("O");
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
			expect(state.currentPiece.shape).toEqual([[1], [1], [1], [1]]);
			expect(emitGameUpdate).toHaveBeenCalledTimes(1);
		});

		it("decale la piece (wall kick) quand la rotation en place est bloquee par un obstacle", () => {
			const { game, states } = makeGame(1);
			const state = states[0]!;
			// I horizontal en (x=4, y=0): la rotation verticale occuperait la colonne 4,
			// mais (2,4) est pris. Un kick d'une case a gauche la fait tenir en colonne 3.
			state.currentPiece = new Piece(I, "I");
			state.board[2]![4] = "O";
			game.rotate("sock0");
			expect(state.currentPiece.shape).toEqual([[1], [1], [1], [1]]);
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
		it("levels up every 500 points in solo", () => {
			const { game, states } = makeGame(1);
			const state = states[0]!;

			state.score = 500;
			game.updateLevel(state);
			expect(state.level).toBe(2);

			state.score = 1500;
			game.updateLevel(state);
			expect(state.level).toBe(4);
		});

		it("does not change the level below the next threshold", () => {
			const { game, states } = makeGame(1);
			const state = states[0]!;
			state.score = 400;
			game.updateLevel(state);
			expect(state.level).toBe(1);
		});

		it("never levels up in multiplayer", () => {
			const { game, states } = makeGame(2);
			const state = states[0]!;
			state.score = 5000;
			game.updateLevel(state);
			expect(state.level).toBe(1);
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

			expect(victim.isAlive).toBe(false);
			expect(survivor.currentPiece.getY()).toBe(1);
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
});
