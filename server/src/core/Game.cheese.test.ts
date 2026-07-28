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
import { Player } from "./Player.js";
import { Room } from "./room.js";
import {
	BOARD_HEIGHT,
	CHEESE_START_GARBAGE,
	CHEESE_TOTAL_GARBAGE,
	type PlayerGameState,
} from "../types/game/gameTypes.js";
import { emitGameOver } from "../gateways/socket/emitters/gameEmitters.js";

function makeSocket(id: string): Socket {
	return { id, emit: vi.fn(), on: vi.fn(), join: vi.fn(), leave: vi.fn() } as unknown as Socket;
}

function setup(playerCount = 1): { game: Game; states: PlayerGameState[] } {
	const room = new Room("salle");
	const players = Array.from({ length: playerCount }, (_v, i) =>
		new Player(`joueur${i}`, makeSocket(`sock${i}`), "avatar", "pirate"));
	for (const player of players) room.addPlayer(player);
	const game = new Game("cheese", players, room);
	const states = players.map((player) => game.getPlayerStateBySocketId(player.getSocketId())!);
	game.start();
	// La gravite n'a rien a faire ici: les tests pilotent le plateau a la main.
	vi.clearAllTimers();
	return { game, states };
}

/** Index des rangees de gruyere presentes sur le plateau, de haut en bas. */
function garbageRows(state: PlayerGameState): number[] {
	return state.board.flatMap((row, y) => (row.some((cell) => cell === "garbage") ? [y] : []));
}

/**
 * Bouche le trou de la rangee de gruyere la plus BASSE et la nettoie, comme le ferait
 * une piece posee dedans. Renvoie false s'il n'y a plus rien a creuser.
 */
function digOneRow(game: Game, state: PlayerGameState): boolean {
	const rows = garbageRows(state);
	const y = rows[rows.length - 1];
	if (y === undefined)
		return false;
	const row = state.board[y]!;
	const hole = row.indexOf(0);
	if (hole < 0)
		return false;
	row[hole] = "I";
	game.clearLines(state);
	return true;
}

/**
 * Mode cheese: 20 rangees percees a creuser, dont 10 seulement sont posees au depart.
 * Le plateau remonte au rythme des destructions jusqu'a les avoir toutes servies.
 */
describe("mode cheese", () => {
	beforeEach(() => {
		vi.useFakeTimers();
		vi.clearAllMocks();
		vi.spyOn(console, "log").mockImplementation(() => undefined);
	});

	afterEach(() => {
		vi.useRealTimers();
		vi.restoreAllMocks();
	});

	it("pose CHEESE_START_GARBAGE rangees au coup d'envoi, collees au sol", () => {
		const { states } = setup();
		const state = states[0]!;

		const rows = garbageRows(state);
		expect(rows).toHaveLength(CHEESE_START_GARBAGE);
		// Contigues et posees tout en bas: le joueur garde le haut du plateau libre.
		expect(rows[rows.length - 1]).toBe(BOARD_HEIGHT - 1);
		expect(rows[0]).toBe(BOARD_HEIGHT - CHEESE_START_GARBAGE);
		expect(state.garbageServed).toBe(CHEESE_START_GARBAGE);
	});

	it("perce chaque rangee d'un seul trou, jamais au meme endroit que la voisine", () => {
		const { states } = setup();
		const state = states[0]!;

		let previousHole = -1;
		for (const y of garbageRows(state)) {
			const row = state.board[y]!;
			const holes = row.flatMap((cell, x) => (cell === 0 ? [x] : []));
			expect(holes).toHaveLength(1);
			// Deux trous alignes se nettoieraient d'une seule barre I: le fromage doit
			// obliger a repositionner les pieces.
			expect(holes[0]).not.toBe(previousHole);
			previousHole = holes[0]!;
		}
	});

	it("sert le meme fromage a tous les joueurs (course equitable)", () => {
		const { states } = setup(2);
		expect(states[0]!.board).toEqual(states[1]!.board);
	});

	it("annonce les 20 rangees a creuser, celles en coulisse comprises", () => {
		const { game, states } = setup();
		const state = states[0]!;
		expect(game.getGarbageLeft(state)).toBe(CHEESE_TOTAL_GARBAGE);
	});

	it("decompte une rangee creusee (le gruyere se nettoie, contrairement a une penalite)", () => {
		const { game, states } = setup();
		const state = states[0]!;

		expect(digOneRow(game, state)).toBe(true);

		expect(state.garbageCleared).toBe(1);
		expect(game.getGarbageLeft(state)).toBe(CHEESE_TOTAL_GARBAGE - 1);
		expect(garbageRows(state)).toHaveLength(CHEESE_START_GARBAGE - 1);
		expect(state.lines).toBe(1);
	});

	it("fait remonter le plateau d'une rangee toutes les deux creusees", () => {
		const { game, states } = setup();
		const state = states[0]!;

		digOneRow(game, state);
		// Une seule creusee: rien de nouveau n'est servi.
		expect(state.garbageServed).toBe(CHEESE_START_GARBAGE);

		digOneRow(game, state);
		expect(state.garbageServed).toBe(CHEESE_START_GARBAGE + 1);
		// Le plateau a remonte: 8 rangees restantes + 1 servie = 9 a l'ecran.
		expect(garbageRows(state)).toHaveLength(CHEESE_START_GARBAGE - 1);
		// La nouvelle rangee arrive PAR LE BAS.
		expect(garbageRows(state).at(-1)).toBe(BOARD_HEIGHT - 1);
	});

	it("va au bout des 20 rangees sans jamais laisser le plateau sans rien a creuser", () => {
		const { game, states } = setup();
		const state = states[0]!;

		let dug = 0;
		while (digOneRow(game, state))
			dug++;

		// Toutes servies, toutes creusees: la course peut se terminer.
		expect(dug).toBe(CHEESE_TOTAL_GARBAGE);
		expect(state.garbageServed).toBe(CHEESE_TOTAL_GARBAGE);
		expect(state.garbageCleared).toBe(CHEESE_TOTAL_GARBAGE);
		expect(game.getGarbageLeft(state)).toBe(0);
		expect(garbageRows(state)).toEqual([]);
	});

	it("termine la course des que les 20 rangees sont creusees, et sacre le premier", () => {
		const { game, states } = setup(2);
		const [first, second] = states as [PlayerGameState, PlayerGameState];

		expect(game.checkGameOver()).toBe(false);
		first.garbageCleared = CHEESE_TOTAL_GARBAGE;

		expect(game.checkGameOver()).toBe(true);
		expect(emitGameOver).toHaveBeenCalledWith(expect.anything(), "joueur0");
		expect(second.isAlive).toBe(true);
	});

	it("ne sacre PAS un joueur mort qui a franchi l'objectif en topant-out", () => {
		const { game, states } = setup(2);
		const [first, second] = states as [PlayerGameState, PlayerGameState];
		first.garbageCleared = CHEESE_TOTAL_GARBAGE;
		first.isAlive = false;

		// La partie s'arrete par la regle de survie (dernier debout), pas par l'objectif.
		expect(game.checkGameOver()).toBe(true);
		expect(emitGameOver).toHaveBeenCalledWith(expect.anything(), second.player.getName());
	});

	it("en solo, finir termine la partie sans designer de vainqueur", () => {
		const { game, states } = setup(1);
		states[0]!.garbageCleared = CHEESE_TOTAL_GARBAGE;

		expect(game.checkGameOver()).toBe(true);
		// Comme en ultra solo: sans adversaire, pas de victoire au classement.
		expect(emitGameOver).toHaveBeenCalledWith(expect.anything(), null);
	});

	it("ne compte aucun gruyere dans les autres modes", () => {
		const room = new Room("salle");
		const player = new Player("joueur", makeSocket("sock0"), "avatar", "pirate");
		room.addPlayer(player);
		const game = new Game("classique", [player], room);
		const state = game.getPlayerStateBySocketId("sock0")!;
		game.start();
		vi.clearAllTimers();

		expect(game.getGarbageLeft(state)).toBeNull();
		expect(garbageRows(state)).toEqual([]);
	});
});
