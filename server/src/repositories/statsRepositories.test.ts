import { describe, it, expect, vi, beforeEach } from "vitest";

const userFindUnique = vi.fn();
const userFindMany = vi.fn();
const factionFindMany = vi.fn();
const gameGroupBy = vi.fn();
const transaction = vi.fn();

// tx : le client transactionnel passé au callback de $transaction.
const tx = {
	gameRecord: { create: vi.fn() },
	user: { findUnique: vi.fn(), update: vi.fn() },
	factionStats: { findUnique: vi.fn(), upsert: vi.fn() },
};

vi.mock("../config/prisma.js", () => ({
	prisma: {
		user: {
			findUnique: (...a: unknown[]) => userFindUnique(...a),
			findMany: (...a: unknown[]) => userFindMany(...a),
		},
		factionStats: { findMany: (...a: unknown[]) => factionFindMany(...a) },
		gameRecord: { groupBy: (...a: unknown[]) => gameGroupBy(...a) },
		$transaction: (...a: unknown[]) => transaction(...a),
	},
}));

import {
	getFactionAggregates,
	getLeaderboards,
	getModeLeaderboards,
	getUserStats,
	recordGameResult,
} from "./statsRepositories.js";
import type { GameResultInput } from "../types/statsTypes.js";

const BASE: GameResultInput = {
	username: "luffy",
	faction: "pirate",
	mode: "classique",
	score: 1000,
	lines: 12,
	tetris: 2,
	level: 3,
	won: true,
	hadWinner: true,
	durationMs: 60000,
};

beforeEach(() => {
	vi.clearAllMocks();
	transaction.mockImplementation(async (cb: (t: typeof tx) => unknown) => cb(tx));
	tx.user.findUnique.mockResolvedValue({ bestScore: 500 });
	tx.factionStats.findUnique.mockResolvedValue({ bestScore: 800 });
});

describe("recordGameResult", () => {
	it("insère un GameRecord avec les champs de la partie", async () => {
		await recordGameResult(BASE);
		expect(tx.gameRecord.create).toHaveBeenCalledWith({
			data: expect.objectContaining({
				username: "luffy",
				faction: "pirate",
				mode: "classique",
				score: 1000,
				lines: 12,
				tetris: 2,
				level: 3,
				won: true,
				durationMs: 60000,
			}),
		});
	});

	it("victoire décisive: incrémente wins, pas losses, et bat le record de score", async () => {
		await recordGameResult(BASE);
		const data = tx.user.update.mock.calls[0]![0].data;
		expect(data.wins).toEqual({ increment: 1 });
		expect(data.losses).toBeUndefined();
		expect(data.totalGames).toEqual({ increment: 1 });
		expect(data.totalLines).toEqual({ increment: 12 });
		expect(data.totalTetris).toEqual({ increment: 2 });
		expect(data.playtimeMs).toEqual({ increment: 60000 });
		// 1000 > 500 -> nouveau record.
		expect(data.bestScore).toBe(1000);
	});

	it("défaite décisive: incrémente losses, pas wins", async () => {
		await recordGameResult({ ...BASE, won: false });
		const data = tx.user.update.mock.calls[0]![0].data;
		expect(data.losses).toEqual({ increment: 1 });
		expect(data.wins).toBeUndefined();
	});

	it("partie solo (sans vainqueur): ni win ni loss, mais totaux comptés", async () => {
		await recordGameResult({ ...BASE, won: false, hadWinner: false });
		const data = tx.user.update.mock.calls[0]![0].data;
		expect(data.wins).toBeUndefined();
		expect(data.losses).toBeUndefined();
		expect(data.totalGames).toEqual({ increment: 1 });
	});

	it("ne bat pas le record si le score est inférieur", async () => {
		tx.user.findUnique.mockResolvedValue({ bestScore: 5000 });
		await recordGameResult(BASE);
		expect(tx.user.update.mock.calls[0]![0].data.bestScore).toBeUndefined();
	});

	it("met à jour la faction (upsert) quand elle est connue", async () => {
		await recordGameResult(BASE);
		expect(tx.factionStats.upsert).toHaveBeenCalledTimes(1);
		const args = tx.factionStats.upsert.mock.calls[0]![0];
		expect(args.where).toEqual({ faction: "pirate" });
		expect(args.update.wins).toEqual({ increment: 1 });
		expect(args.update.bestScore).toBe(1000); // 1000 > 800
	});

	it("ne touche pas aux factions sans camp (faction null)", async () => {
		await recordGameResult({ ...BASE, faction: null });
		expect(tx.factionStats.upsert).not.toHaveBeenCalled();
		expect(tx.gameRecord.create.mock.calls[0]![0].data.faction).toBeNull();
	});

	it("normalise une faction invalide en null", async () => {
		await recordGameResult({ ...BASE, faction: "aliens" });
		expect(tx.gameRecord.create.mock.calls[0]![0].data.faction).toBeNull();
		expect(tx.factionStats.upsert).not.toHaveBeenCalled();
	});
});

describe("getUserStats", () => {
	it("calcule le ratio de victoires", async () => {
		userFindUnique.mockResolvedValue({
			username: "luffy", faction: "pirate", wins: 3, losses: 1,
			totalGames: 5, totalLines: 40, totalTetris: 4, bestScore: 2000, playtimeMs: 12345,
		});
		const stats = await getUserStats("luffy");
		expect(stats).toMatchObject({ username: "luffy", faction: "pirate", winRate: 0.75, bestScore: 2000 });
	});

	it("ratio 0 sans partie décisive", async () => {
		userFindUnique.mockResolvedValue({
			username: "z", faction: null, wins: 0, losses: 0,
			totalGames: 2, totalLines: 0, totalTetris: 0, bestScore: 0, playtimeMs: 0,
		});
		expect((await getUserStats("z"))!.winRate).toBe(0);
	});

	it("renvoie null pour un utilisateur inconnu", async () => {
		userFindUnique.mockResolvedValue(null);
		expect(await getUserStats("inconnu")).toBeNull();
	});
});

describe("getLeaderboards", () => {
	it("ne garde que les valeurs > 0 et mappe la valeur du champ", async () => {
		userFindMany.mockResolvedValue([
			{ username: "a", faction: "pirate", bestScore: 900 },
			{ username: "b", faction: "marine", wins: 5 },
			{ username: "c", faction: null, totalTetris: 3 },
			{ username: "d", faction: "pirate", totalLines: 20 },
		]);
		const boards = await getLeaderboards();
		// 4 appels findMany, chacun filtré sur { [champ]: { gt: 0 } }
		expect(userFindMany).toHaveBeenCalledTimes(4);
		expect(userFindMany.mock.calls[0]![0]).toMatchObject({ where: { bestScore: { gt: 0 } } });
		expect(boards.topScore[0]).toEqual({ username: "a", faction: "pirate", value: 900 });
	});
});

describe("getFactionAggregates", () => {
	it("mappe et filtre les factions invalides", async () => {
		factionFindMany.mockResolvedValue([
			{ faction: "pirate", wins: 10, losses: 2, tetris: 5, lines: 30, bestScore: 1500 },
			{ faction: "bidon", wins: 1, losses: 1, tetris: 0, lines: 0, bestScore: 0 },
		]);
		const aggs = await getFactionAggregates();
		expect(aggs).toHaveLength(1);
		expect(aggs[0]).toMatchObject({ faction: "pirate", wins: 10, bestScore: 1500 });
	});
});

describe("getModeLeaderboards", () => {
	it("regroupe par mode, trie les joueurs par meilleur score décroissant", async () => {
		gameGroupBy.mockResolvedValue([
			{ mode: "classique", username: "luffy", faction: "pirate", _count: { _all: 5 }, _max: { score: 900 }, _sum: { lines: 40, tetris: 4 } },
			{ mode: "classique", username: "garp", faction: "marine", _count: { _all: 3 }, _max: { score: 1500 }, _sum: { lines: 20, tetris: 1 } },
			{ mode: "sprint", username: "zoro", faction: "pirate", _count: { _all: 2 }, _max: { score: 300 }, _sum: { lines: 10, tetris: 0 } },
		]);
		const modes = await getModeLeaderboards();
		// Classique a 2 joueurs -> passe avant sprint (1 joueur).
		expect(modes[0]!.mode).toBe("classique");
		// Dans classique, garp (1500) devance luffy (900).
		expect(modes[0]!.entries.map((e) => e.username)).toEqual(["garp", "luffy"]);
		expect(modes[0]!.entries[0]).toMatchObject({ username: "garp", bestScore: 1500, games: 3, lines: 20, tetris: 1 });
		expect(modes[1]!.mode).toBe("sprint");
	});

	it("remplace les agrégats nuls par 0 et neutralise une faction invalide", async () => {
		gameGroupBy.mockResolvedValue([
			{ mode: "ultra", username: "x", faction: "bidon", _count: { _all: 1 }, _max: { score: null }, _sum: { lines: null, tetris: null } },
		]);
		expect(await getModeLeaderboards()).toEqual([
			{ mode: "ultra", entries: [{ username: "x", faction: null, bestScore: 0, games: 1, lines: 0, tetris: 0 }] },
		]);
	});
});
