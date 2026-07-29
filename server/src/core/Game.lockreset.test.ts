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
import { BOARD_HEIGHT, BOARD_WIDTH, MAX_LOCK_RESETS, type Board, type Cell } from "../types/game/gameTypes.js";
import { I } from "../types/game/piecesGameTypes.js";

function makeSocket(id: string): Socket {
	return { id, emit: vi.fn(), on: vi.fn(), join: vi.fn(), leave: vi.fn() } as unknown as Socket;
}

function emptyBoard(): Board {
	return Array.from({ length: BOARD_HEIGHT }, () =>
		Array.from({ length: BOARD_WIDTH }, () => 0 as Cell),
	);
}

/**
 * Defaut corrige: le wall kick vertical decolle une piece posee, ce qui la rendait a
 * nouveau "en vol" et remettait son sursis de verrouillage a zero. Spammer la rotation
 * (le client repete la touche toutes les 45 ms) suffisait donc a faire leviter une
 * piece indefiniment: elle ne se verrouillait JAMAIS, et la partie ne pouvait plus
 * finir. MAX_LOCK_RESETS plafonne ces relances.
 */
describe("plafond de relance du sursis de verrouillage", () => {
	beforeEach(() => { vi.useFakeTimers(); vi.clearAllMocks(); });
	afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });

	function groundedGame() {
		const room = new Room("salle");
		const player = new Player("joueur", makeSocket("sock0"), "avatar", "pirate");
		room.addPlayer(player);
		const game = new Game("classique", [player], room);
		const state = game.getPlayerStateBySocketId("sock0")!;
		state.board = emptyBoard();
		const piece = new Piece(I, "I");
		while (game.canMove(state, 0, 1)) piece.moveDown();
		state.currentPiece = piece;
		game.refreshLockState(state);
		return { game, state, piece, socketId: "sock0" };
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

	it("laisse le joueur ajuster: les premieres relances restent gratuites", () => {
		const { game, state, socketId } = groundedGame();

		game.rotate(socketId);

		expect(state.lockResets).toBeLessThanOrEqual(1);
		expect(state.groundedAt).toBeNull();
	});

	it("conserve l'horodatage de contact une fois le plafond atteint", () => {
		const { game, state } = groundedGame();
		state.lockResets = MAX_LOCK_RESETS;
		const contact = state.groundedAt;
		// La piece a de la place sous elle (elle vient d'etre decollee par un kick).
		state.currentPiece!.translate(0, -2);

		game.refreshLockState(state);

		expect(state.groundedAt).toBe(contact);
	});

	it("rend son budget de relances a chaque nouvelle piece", () => {
		const { game, state } = groundedGame();
		state.lockResets = MAX_LOCK_RESETS;

		game.spawnPiece(state);

		expect(state.lockResets).toBe(0);
	});
});
