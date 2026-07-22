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
import { O } from "../types/game/piecesGameTypes.js";

function makeSocket(id: string): Socket {
	return { id, emit: vi.fn(), on: vi.fn(), join: vi.fn(), leave: vi.fn() } as unknown as Socket;
}

function emptyBoard(): Board {
	return Array.from({ length: BOARD_HEIGHT }, () =>
		Array.from({ length: BOARD_WIDTH }, () => 0 as Cell),
	);
}

/**
 * Exigence du sujet (V.1.1): "Once a piece touches the pile, it becomes immobile
 * only on the next frame - allowing last-moment adjustments."
 *
 * Le lock delay n'est pas code explicitement, il decoule de la structure de tick():
 * le tick qui amene la piece au contact se contente de la faire descendre, et c'est
 * seulement le tick suivant qui la verrouille. Entre les deux, le joueur garde une
 * frame entiere pour ajuster. Ces tests verrouillent ce comportement.
 */
describe("lock delay", () => {
	beforeEach(() => {
		vi.useFakeTimers();
		vi.clearAllMocks();
		vi.spyOn(console, "log").mockImplementation(() => undefined);
	});

	afterEach(() => {
		vi.useRealTimers();
		vi.restoreAllMocks();
	});

	function setup(topY = BOARD_HEIGHT - 3) {
		const room = new Room("salle");
		const player = new Player("joueur", makeSocket("sock0"), "avatar", "pirate");
		room.addPlayer(player);
		const game = new Game("classique", [player], room);
		const state = game.getPlayerStateBySocketId("sock0")!;
		state.board = emptyBoard();
		// Piece O (carre 2x2): elle occupe les lignes topY et topY + 1.
		const piece = new Piece(O, "O");
		while (piece.getY() < topY) piece.moveDown();
		state.currentPiece = piece;
		return { game, state, piece, socketId: "sock0" };
	}

	it("ne verrouille pas la piece au tick qui l'amene au contact", () => {
		const { game, state, piece } = setup();

		game.tick();

		// Elle a bien touche la pile...
		expect(game.canMove(state, 0, 1)).toBe(false);
		// ...mais elle est toujours la piece courante, et rien n'est fige dans le board.
		expect(state.currentPiece).toBe(piece);
		expect(state.board.every((row) => row.every((cell) => cell === 0))).toBe(true);
	});

	it("laisse le joueur ajuster la piece pendant cette frame", () => {
		const { game, state, piece, socketId } = setup();

		game.tick();
		const xAvant = piece.getX();
		game.move(socketId, "left");

		expect(state.currentPiece?.getX()).toBe(xAvant - 1);
		expect(state.currentPiece).toBe(piece);
	});

	it("verrouille la piece au tick suivant", () => {
		const { game, state, piece } = setup();

		game.tick();
		game.tick();

		// Nouvelle piece en jeu, et l'ancienne est incrustee dans le board.
		expect(state.currentPiece).not.toBe(piece);
		expect(state.board.some((row) => row.some((cell) => cell !== 0))).toBe(true);
	});

	it("repousse le verrouillage si l'ajustement rouvre une descente", () => {
		// Une case plus haut, pour que ce soit bien le tick qui amene au contact.
		const { game, state, socketId } = setup(BOARD_HEIGHT - 4);
		// Marche a partir de la colonne 5: la piece (colonnes 4-5) repose dessus,
		// mais un pas a gauche (colonnes 3-4) lui rend de la place pour descendre.
		const bottom = state.board[BOARD_HEIGHT - 1]!;
		for (let x = 5; x < BOARD_WIDTH; x++) bottom[x] = "I";
		const piece = state.currentPiece!;
		while (piece.getX() < 4) piece.moveRight();

		game.tick();
		expect(game.canMove(state, 0, 1)).toBe(false);

		game.move(socketId, "left");
		// La piece peut de nouveau descendre: le tick suivant la fait tomber au lieu de la figer.
		expect(game.canMove(state, 0, 1)).toBe(true);
		game.tick();
		expect(state.currentPiece).toBe(piece);
	});
});
