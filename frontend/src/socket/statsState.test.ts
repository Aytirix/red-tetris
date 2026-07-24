import { describe, it, expect } from "vitest";
import { normalizeStatsError, normalizeStatsState } from "./statsState";

describe("normalizeStatsState", () => {
	it("renvoie null pour une entrée non-objet", () => {
		expect(normalizeStatsState(null)).toBeNull();
		expect(normalizeStatsState("nope")).toBeNull();
	});

	it("comble les champs manquants par des valeurs sûres", () => {
		const state = normalizeStatsState({});
		expect(state).toEqual({
			me: null,
			leaderboards: { topScore: [], topWins: [], topTetris: [], topLines: [] },
			factions: { factions: [], leader: null },
			modes: [],
		});
	});

	it("parse des stats individuelles valides", () => {
		const state = normalizeStatsState({
			me: {
				username: "luffy", faction: "pirate", totalGames: 5, wins: 3, losses: 2,
				winRate: 0.6, bestScore: 2000, totalLines: 40, totalTetris: 4, playtimeMs: 99000,
			},
		});
		expect(state!.me).toMatchObject({ username: "luffy", faction: "pirate", winRate: 0.6 });
	});

	it("rejette un me sans username et neutralise une faction invalide", () => {
		expect(normalizeStatsState({ me: { totalGames: 3 } })!.me).toBeNull();
		const state = normalizeStatsState({
			me: { username: "x", faction: "aliens", totalGames: 1 },
		});
		expect(state!.me!.faction).toBeNull();
	});

	it("filtre les entrées de classement mal formées", () => {
		const state = normalizeStatsState({
			leaderboards: {
				topScore: [
					{ username: "a", faction: "marine", value: 900 },
					{ faction: "pirate", value: 100 }, // pas de username -> ignoré
					"garbage",
				],
			},
		});
		expect(state!.leaderboards.topScore).toEqual([
			{ username: "a", faction: "marine", value: 900 },
		]);
	});

	it("filtre les factions invalides et lit le leader", () => {
		const state = normalizeStatsState({
			factions: {
				factions: [
					{ faction: "pirate", wins: 10, losses: 1, tetris: 2, lines: 3, bestScore: 5 },
					{ faction: "bidon", wins: 1 },
				],
				leader: "pirate",
			},
		});
		expect(state!.factions.factions).toHaveLength(1);
		expect(state!.factions.leader).toBe("pirate");
	});

	it("parse un classement par mode et coerce les valeurs non finies en 0", () => {
		const state = normalizeStatsState({
			modes: [
				{
					mode: "classique",
					entries: [
						{ username: "luffy", faction: "pirate", bestScore: NaN, games: "x", lines: 5, tetris: 2 },
						{ faction: "marine", bestScore: 10 }, // pas de username -> ignoré
					],
				},
			],
		});
		expect(state!.modes[0]!.mode).toBe("classique");
		expect(state!.modes[0]!.entries).toEqual([
			{ username: "luffy", faction: "pirate", bestScore: 0, games: 0, lines: 5, tetris: 2 },
		]);
	});
});

describe("normalizeStatsError", () => {
	it("extrait le message ou renvoie un défaut", () => {
		expect(normalizeStatsError({ message: "boum" })).toBe("boum");
		expect(normalizeStatsError({})).toBe("Opération impossible");
		expect(normalizeStatsError(null)).toBeNull();
	});
});
