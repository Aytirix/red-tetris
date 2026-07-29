import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { Socket } from "socket.io";

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

vi.mock("../services/shopService.js", () => ({
	settleGameRewards: vi.fn(async () => undefined),
}));

import { Game } from "./Game.js";
import { Piece } from "./Piece.js";
import { Player } from "./Player.js";
import { Room } from "./room.js";
import { BOARD_HEIGHT, BOARD_WIDTH, type Board, type Cell } from "../types/game/gameTypes.js";
import { I } from "../types/game/piecesGameTypes.js";

function makeSocket(id: string): Socket {
	return { id, emit: vi.fn(), on: vi.fn(), join: vi.fn(), leave: vi.fn() } as unknown as Socket;
}

function emptyBoard(): Board {
	return Array.from({ length: BOARD_HEIGHT }, () =>
		Array.from({ length: BOARD_WIDTH }, () => 0 as Cell),
	);
}

/** Non-regression : spammer la rotation faisait leviter une piece indefiniment. */
describe("le sursis de verrouillage ne repart que sur une vraie descente", () => {
	beforeEach(() => { vi.useFakeTimers(); vi.clearAllMocks(); });
	afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });

	/** Partie dont la piece I est deja tombee au contact, comme l'aurait fait la gravite. */
	function groundedGame(board: Board = emptyBoard()) {
		const room = new Room("salle");
		const player = new Player("joueur", makeSocket("sock0"), "avatar", "pirate");
		room.addPlayer(player);
		const game = new Game("classique", [player], room);
		const state = game.getPlayerStateBySocketId("sock0")!;
		state.board = board;
		state.currentPiece = new Piece(I, "I");
		state.deepestY = -1;
		state.groundedAt = null;
		while (game.canMove(state, 0, 1)) {
			state.currentPiece.moveDown();
			game.refreshLockState(state);
		}
		game.refreshLockState(state);
		return { game, state, piece: state.currentPiece, socketId: "sock0" };
	}

	it("verrouille la piece meme si le joueur spamme la rotation", () => {
		const { game, state, piece, socketId } = groundedGame();

		let frames = 0;
		for (; frames < 60; frames++) {
			for (let r = 0; r < 9; r++) {
				game.rotate(socketId);
				vi.advanceTimersByTime(45);
			}
			game.tick();
			if (state.currentPiece !== piece) break;
		}

		expect(frames).toBeLessThan(60);
		expect(state.board.some((row) => row.some((cell) => cell !== 0))).toBe(true);
	});

	it("un decollage sans progression ne relance pas le sursis", () => {
		const { game, state } = groundedGame();
		const contact = state.groundedAt;
		expect(contact).not.toBeNull();
		vi.advanceTimersByTime(80);

		// Le wall kick vertical decolle la piece: elle peut a nouveau descendre, mais elle
		// n'a atteint aucune rangee inedite.
		state.currentPiece!.translate(0, -2);
		game.refreshLockState(state);

		expect(state.groundedAt).toBe(contact);
	});

	it("se verrouille des le retour au contact, sans nouveau sursis", () => {
		const { game, state } = groundedGame();
		const contact = state.groundedAt;
		state.currentPiece!.translate(0, -2);
		game.refreshLockState(state);
		vi.advanceTimersByTime(2_000);

		// La gravite la ramene sur les rangees qu'elle occupait deja.
		while (game.canMove(state, 0, 1)) {
			state.currentPiece!.moveDown();
			game.refreshLockState(state);
		}

		expect(state.groundedAt).toBe(contact);
		expect(game.getLockDelayMs(state)).toBe(0);
	});

	it("relance le sursis quand la piece atteint une rangee inedite", () => {
		// Colonnes 4 a 9 bouchees sur les 3 dernieres rangees, colonnes 0 a 3 libres:
		// la piece I se pose a droite, puis trouve le puits a gauche.
		const board = emptyBoard();
		for (let y = BOARD_HEIGHT - 3; y < BOARD_HEIGHT; y++)
			for (let x = 4; x < BOARD_WIDTH; x++)
				board[y]![x] = "I";
		const { game, state, socketId } = groundedGame(board);
		const contact = state.groundedAt;
		const posee = state.deepestY;
		expect(contact).not.toBeNull();

		// Glisser au-dessus du puits ne suffit pas: la piece n'est pas encore descendue.
		for (let i = 0; i < 4; i++)
			game.move(socketId, "left");
		expect(state.groundedAt).toBe(contact);

		vi.advanceTimersByTime(100);
		game.move(socketId, "down");

		expect(state.deepestY).toBeGreaterThan(posee);
		expect(state.groundedAt).toBeNull();
	});

	it("chaque nouvelle piece repart avec un sursis neuf", () => {
		const { game, state } = groundedGame();

		game.spawnPiece(state);

		expect(state.groundedAt).toBeNull();
		expect(state.deepestY).toBe(-1);
	});
});
