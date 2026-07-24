import { describe, it, expect, vi, beforeEach } from "vitest";

const recordGameResult = vi.fn();
const getUserStats = vi.fn();
const getLeaderboards = vi.fn();
const getFactionAggregates = vi.fn();
const getModeLeaderboards = vi.fn();

vi.mock("../repositories/statsRepositories.js", () => ({
	recordGameResult: (...a: unknown[]) => recordGameResult(...a),
	getUserStats: (...a: unknown[]) => getUserStats(...a),
	getLeaderboards: (...a: unknown[]) => getLeaderboards(...a),
	getFactionAggregates: (...a: unknown[]) => getFactionAggregates(...a),
	getModeLeaderboards: (...a: unknown[]) => getModeLeaderboards(...a),
}));

import { getStatsState, recordGameResults } from "./statsService.js";
import type { FactionAggregate, GameResultInput } from "../types/statsTypes.js";

function agg(faction: "marine" | "pirate", wins: number): FactionAggregate {
	return { faction, wins, losses: 0, tetris: 0, lines: 0, bestScore: 0 };
}

const EMPTY_BOARDS = { topScore: [], topWins: [], topTetris: [], topLines: [] };

beforeEach(() => {
	vi.clearAllMocks();
	getLeaderboards.mockResolvedValue(EMPTY_BOARDS);
	getModeLeaderboards.mockResolvedValue([]);
	getUserStats.mockResolvedValue(null);
});

describe("recordGameResults (best-effort)", () => {
	it("enregistre chaque entrée", async () => {
		recordGameResult.mockResolvedValue(undefined);
		const entries = [{ username: "a" }, { username: "b" }] as unknown as GameResultInput[];
		await recordGameResults(entries);
		expect(recordGameResult).toHaveBeenCalledTimes(2);
	});

	it("un échec n'interrompt pas les autres enregistrements", async () => {
		const spy = vi.spyOn(console, "error").mockImplementation(() => {});
		recordGameResult.mockRejectedValueOnce(new Error("db down")).mockResolvedValueOnce(undefined);
		const entries = [{ username: "a" }, { username: "b" }] as unknown as GameResultInput[];
		await recordGameResults(entries);
		expect(recordGameResult).toHaveBeenCalledTimes(2);
		expect(spy).toHaveBeenCalled();
	});
});

describe("getStatsState — meilleur camp", () => {
	it("désigne la faction en tête aux victoires comme leader", async () => {
		getFactionAggregates.mockResolvedValue([agg("marine", 3), agg("pirate", 7)]);
		const state = await getStatsState("luffy");
		expect(state.factions.leader).toBe("pirate");
	});

	it("pas de leader en cas d'égalité", async () => {
		getFactionAggregates.mockResolvedValue([agg("marine", 5), agg("pirate", 5)]);
		expect((await getStatsState(null)).factions.leader).toBeNull();
	});

	it("pas de leader si personne n'a gagné", async () => {
		getFactionAggregates.mockResolvedValue([agg("marine", 0), agg("pirate", 0)]);
		expect((await getStatsState(null)).factions.leader).toBeNull();
	});

	it("me est null quand aucun username n'est fourni (pas d'appel getUserStats)", async () => {
		getFactionAggregates.mockResolvedValue([]);
		const state = await getStatsState(null);
		expect(state.me).toBeNull();
		expect(getUserStats).not.toHaveBeenCalled();
	});

	it("charge les stats du joueur quand un username est fourni", async () => {
		getFactionAggregates.mockResolvedValue([]);
		getUserStats.mockResolvedValue({ username: "luffy" });
		const state = await getStatsState("luffy");
		expect(getUserStats).toHaveBeenCalledWith("luffy");
		expect(state.me).toMatchObject({ username: "luffy" });
	});
});
