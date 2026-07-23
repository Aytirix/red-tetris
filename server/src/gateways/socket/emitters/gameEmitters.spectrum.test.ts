import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Socket } from "socket.io";
import type { Game } from "../../../core/Game.js";
import { Piece } from "../../../core/Piece.js";
import { Player } from "../../../core/Player.js";
import { BOARD_HEIGHT, BOARD_WIDTH, type Board, type Cell, type PlayerGameState } from "../../../types/game/gameTypes.js";
import { I, O } from "../../../types/game/piecesGameTypes.js";
import { spectatorSocketStore } from "../spectatorSocketStore.js";
import { userSocketStore } from "../userSocketStore.js";
import { emitGameOver, emitGameStart, emitGameUpdate, emitSpectatorGame, getSpectrumBoard } from "./gameEmitters.js";

type FakeSocket = Socket & { emit: ReturnType<typeof vi.fn> };

function makeSocket(id: string): FakeSocket {
	return { id, emit: vi.fn(), on: vi.fn(), join: vi.fn(), leave: vi.fn() } as unknown as FakeSocket;
}

function emptyBoard(): Board {
	return Array.from({ length: BOARD_HEIGHT }, () =>
		Array.from({ length: BOARD_WIDTH }, () => 0 as Cell),
	);
}

function makeState(name: string, socketId = `sock-${name}`): { state: PlayerGameState; socket: FakeSocket } {
	const socket = makeSocket(socketId);
	const player = new Player(name, socket, `${name}-avatar`, "pirate");
	const state: PlayerGameState = {
		board: emptyBoard(),
		score: 0,
		level: 1,
		pieceIndex: 0,
		player,
		isAlive: true,
		spectator: false,
		currentPiece: new Piece(O, "O"),
		nextPiece: new Piece(I, "I"),
	};
	return { state, socket };
}

function fakeGame(state: Map<string, PlayerGameState>): Game {
	return {
		getState: () => state,
		getPlayerStateBySocketId: (socketId: string) => state.get(socketId),
	} as unknown as Game;
}

function lastPayload(socket: FakeSocket, event: string): any {
	const calls = socket.emit.mock.calls.filter((call) => call[0] === event);
	return calls[calls.length - 1]?.[1];
}

/** Colonne x du plateau, de haut en bas. */
function column(board: Board, x: number): Cell[] {
	return board.map((row) => row[x] as Cell);
}

describe("spectre des adversaires", () => {
	beforeEach(() => {
		spectatorSocketStore.clear();
		userSocketStore.clear();
		vi.clearAllMocks();
	});

	describe("getSpectrumBoard", () => {
		it("laisse vide une colonne sans aucun bloc", () => {
			expect(column(getSpectrumBoard(emptyBoard()), 3).every((cell) => cell === 0)).toBe(true);
		});

		it("remplit la colonne depuis le bloc le plus haut jusqu'en bas", () => {
			const board = emptyBoard();
			board[15]![2] = "T";

			const spectrum = getSpectrumBoard(board);

			for (let y = 0; y < BOARD_HEIGHT; y++)
				expect(spectrum[y]![2]).toBe(y >= 15 ? "spectrum" : 0);
		});

		it("comble les trous sous la pile: la profondeur n'est pas divulguee", () => {
			const board = emptyBoard();
			board[10]![4] = "I"; // bloc haut
			board[18]![4] = "Z"; // bloc bas, avec un vide entre les deux

			const spectrum = getSpectrumBoard(board);

			for (let y = 10; y < BOARD_HEIGHT; y++)
				expect(spectrum[y]![4]).toBe("spectrum");
		});

		it("efface toute couleur de piece", () => {
			const board = emptyBoard();
			board[19]![0] = "I";
			board[19]![1] = "Z";
			board[19]![2] = "penalty";

			const cells = getSpectrumBoard(board).flat();

			expect(cells.every((cell) => cell === 0 || cell === "spectrum")).toBe(true);
		});

		it("traite chaque colonne independamment", () => {
			const board = emptyBoard();
			board[5]![0] = "O";
			board[17]![1] = "O";

			const spectrum = getSpectrumBoard(board);

			expect(spectrum[5]![0]).toBe("spectrum");
			expect(spectrum[5]![1]).toBe(0);
			expect(spectrum[17]![1]).toBe("spectrum");
		});

		it("ne modifie pas le plateau d'origine", () => {
			const board = emptyBoard();
			board[12]![7] = "S";

			getSpectrumBoard(board);

			expect(board[12]![7]).toBe("S");
			expect(board[13]![7]).toBe(0);
		});
	});

	describe("ce que recoit un JOUEUR", () => {
		function twoPlayers() {
			const luffy = makeState("luffy", "sock-luffy");
			const zoro = makeState("zoro", "sock-zoro");
			// Pile coloree chez zoro, avec un trou dessous.
			zoro.state.board[14]![3] = "T";
			zoro.state.board[19]![3] = "I";
			const state = new Map<string, PlayerGameState>([
				["sock-luffy", luffy.state],
				["sock-zoro", zoro.state],
			]);
			return { luffy, zoro, state };
		}

		it("game:start ne contient que le spectre des adversaires", () => {
			const { luffy, state } = twoPlayers();

			emitGameStart(state, fakeGame(state));
			const opponents = lastPayload(luffy.socket, "game:start").opponents;

			expect(opponents).toHaveLength(1);
			expect(opponents[0].username).toBe("zoro");
			expect(opponents[0].board.flat().every((cell: Cell) => cell === 0 || cell === "spectrum")).toBe(true);
			// La pile est vue depuis son sommet, trou compris.
			expect(column(opponents[0].board, 3).filter((cell) => cell === "spectrum")).toHaveLength(BOARD_HEIGHT - 14);
		});

		it("game:update ne contient que le spectre des adversaires", () => {
			const { luffy, state } = twoPlayers();

			emitGameUpdate(luffy.state, state);
			const opponents = lastPayload(luffy.socket, "game:update").opponents;

			expect(opponents[0].board.flat().every((cell: Cell) => cell === 0 || cell === "spectrum")).toBe(true);
			expect(opponents[0].alive).toBe(true);
		});

		it("son propre plateau garde ses couleurs", () => {
			const { luffy, state } = twoPlayers();
			luffy.state.board[19]![0] = "Z";

			emitGameUpdate(luffy.state, state);
			const payload = lastPayload(luffy.socket, "game:update");

			expect(payload.board[19][0]).toBe("Z");
		});
	});

	describe("ce que recoit un SPECTATEUR", () => {
		it("voit les vrais plateaux, couleurs et trous compris", () => {
			const luffy = makeState("luffy", "sock-luffy");
			const zoro = makeState("zoro", "sock-zoro");
			zoro.state.board[14]![3] = "T";
			const state = new Map<string, PlayerGameState>([
				["sock-luffy", luffy.state],
				["sock-zoro", zoro.state],
			]);
			const spectatorSocket = makeSocket("sock-spectateur");

			emitSpectatorGame(spectatorSocket, fakeGame(state), luffy.state.player);
			const payload = lastPayload(spectatorSocket, "game:SpectatorGame");

			expect(payload.spectator).toBe("luffy");
			expect(payload.opponents).toHaveLength(1);
			expect(payload.opponents[0].username).toBe("zoro");
			// Couleur d'origine conservee, et rien n'est comble en dessous.
			expect(payload.opponents[0].board[14][3]).toBe("T");
			expect(payload.opponents[0].board[15][3]).toBe(0);
			expect(payload.opponents[0].board.flat().includes("spectrum")).toBe(false);
		});

		it("ne se voit pas lui-meme dans la liste des adversaires", () => {
			const luffy = makeState("luffy", "sock-luffy");
			const zoro = makeState("zoro", "sock-zoro");
			const state = new Map<string, PlayerGameState>([
				["sock-luffy", luffy.state],
				["sock-zoro", zoro.state],
			]);
			// Le spectateur est zoro lui-meme (joueur elimine qui regarde luffy).
			const payloadSocket = makeSocket("sock-zoro");

			emitSpectatorGame(payloadSocket, fakeGame(state), luffy.state.player);
			const payload = lastPayload(payloadSocket, "game:SpectatorGame");

			expect(payload.opponents).toHaveLength(0);
		});
	});

	describe("emitGameOver — spectateurs purs", () => {
		it("notifie aussi les spectateurs abonnes a la partie", () => {
			const luffy = makeState("luffy", "sock-luffy");
			const state = new Map<string, PlayerGameState>([["sock-luffy", luffy.state]]);
			const game = fakeGame(state);
			// Spectateur pur: present dans les stores, jamais dans `state`.
			const nami = makeSocket("sock-nami");
			spectatorSocketStore.set("sock-nami", { game, player: luffy.state.player });
			userSocketStore.set("sock-nami", { username: "nami", subscribe: false, socket: nami });

			emitGameOver(state, "luffy");

			const payload = lastPayload(nami, "game:over");
			expect(payload).toBeDefined();
			expect(payload.winner).toBe("luffy");
			expect(payload.scores).toEqual([{ username: "luffy", score: 0 }]);
		});

		it("ne notifie pas deux fois un joueur elimine devenu spectateur", () => {
			const luffy = makeState("luffy", "sock-luffy");
			const zoro = makeState("zoro", "sock-zoro");
			zoro.state.isAlive = false;
			const state = new Map<string, PlayerGameState>([
				["sock-luffy", luffy.state],
				["sock-zoro", zoro.state],
			]);
			const game = fakeGame(state);
			// zoro est mort ET abonne comme spectateur: il est dans les DEUX boucles.
			spectatorSocketStore.set("sock-zoro", { game, player: luffy.state.player });
			userSocketStore.set("sock-zoro", { username: "zoro", subscribe: false, socket: zoro.socket });

			emitGameOver(state, "luffy");

			const overCalls = zoro.socket.emit.mock.calls.filter((call) => call[0] === "game:over");
			expect(overCalls).toHaveLength(1);
		});

		it("n'envoie rien aux spectateurs d'une AUTRE partie", () => {
			const luffy = makeState("luffy", "sock-luffy");
			const state = new Map<string, PlayerGameState>([["sock-luffy", luffy.state]]);
			const autreState = new Map<string, PlayerGameState>();
			const nami = makeSocket("sock-nami");
			spectatorSocketStore.set("sock-nami", { game: fakeGame(autreState), player: luffy.state.player });
			userSocketStore.set("sock-nami", { username: "nami", subscribe: false, socket: nami });

			emitGameOver(state, "luffy");

			expect(lastPayload(nami, "game:over")).toBeUndefined();
		});
	});
});
