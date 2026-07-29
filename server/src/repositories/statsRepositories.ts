import { prisma } from "../config/prisma.js";
import type { Faction } from "../generated/prisma/enums.js";
import {
	isFactionName,
	type FactionAggregate,
	type GameResultInput,
	type LeaderboardEntry,
	type Leaderboards,
	type ModeLeaderboard,
	type ModeLeaderboardEntry,
	type UserStats,
} from "../types/statsTypes.js";

const LEADERBOARD_SIZE = 10;

function toFaction(value: string | null): Faction | null {
	return isFactionName(value) ? value : null;
}

/** Enregistre le resultat d'une partie pour un joueur, dans une transaction. */
export async function recordGameResult(input: GameResultInput): Promise<void> {
	const faction = toFaction(input.faction);
	const wonDecisive = input.hadWinner && input.won;
	const lostDecisive = input.hadWinner && !input.won;

	await prisma.$transaction(async (tx) => {
		await tx.gameRecord.create({
			data: {
				username: input.username,
				faction,
				mode: input.mode,
				score: input.score,
				lines: input.lines,
				tetris: input.tetris,
				level: input.level,
				won: input.won,
				durationMs: input.durationMs,
			},
		});

		const user = await tx.user.findUnique({
			where: { username: input.username },
			select: { bestScore: true },
		});
		await tx.user.update({
			where: { username: input.username },
			data: {
				totalGames: { increment: 1 },
				totalLines: { increment: input.lines },
				totalTetris: { increment: input.tetris },
				playtimeMs: { increment: input.durationMs },
				...(wonDecisive ? { wins: { increment: 1 } } : {}),
				...(lostDecisive ? { losses: { increment: 1 } } : {}),
				// Prisma n'a pas de MAX atomique : on compare au meilleur score lu dans la
				// même transaction et on n'écrit que si on bat le record.
				...(input.score > (user?.bestScore ?? 0) ? { bestScore: input.score } : {}),
			},
		});

		if (faction) {
			const current = await tx.factionStats.findUnique({
				where: { faction },
				select: { bestScore: true },
			});
			await tx.factionStats.upsert({
				where: { faction },
				create: {
					faction,
					wins: wonDecisive ? 1 : 0,
					losses: lostDecisive ? 1 : 0,
					tetris: input.tetris,
					lines: input.lines,
					bestScore: input.score,
				},
				update: {
					tetris: { increment: input.tetris },
					lines: { increment: input.lines },
					...(wonDecisive ? { wins: { increment: 1 } } : {}),
					...(lostDecisive ? { losses: { increment: 1 } } : {}),
					...(input.score > (current?.bestScore ?? 0) ? { bestScore: input.score } : {}),
				},
			});
		}
	});
}

// ─── Lectures / agrégations ────────────────────────────────────────────────────

export async function getUserStats(username: string): Promise<UserStats | null> {
	const user = await prisma.user.findUnique({
		where: { username },
		select: {
			username: true,
			faction: true,
			wins: true,
			losses: true,
			totalGames: true,
			totalLines: true,
			totalTetris: true,
			bestScore: true,
			playtimeMs: true,
		},
	});
	if (!user) return null;
	const decisive = user.wins + user.losses;
	return {
		username: user.username,
		faction: toFaction(user.faction),
		totalGames: user.totalGames,
		wins: user.wins,
		losses: user.losses,
		winRate: decisive > 0 ? user.wins / decisive : 0,
		bestScore: user.bestScore,
		totalLines: user.totalLines,
		totalTetris: user.totalTetris,
		playtimeMs: user.playtimeMs,
	};
}

type LeaderRow = { username: string; faction: Faction | null };

function toEntry(row: LeaderRow, value: number): LeaderboardEntry {
	return { username: row.username, faction: toFaction(row.faction), value };
}
export async function getLeaderboards(): Promise<Leaderboards> {
	const base = { take: LEADERBOARD_SIZE } as const;
	const [byScore, byWins, byTetris, byLines] = await Promise.all([
		prisma.user.findMany({
			...base,
			where: { bestScore: { gt: 0 } },
			orderBy: { bestScore: "desc" },
			select: { username: true, faction: true, bestScore: true },
		}),
		prisma.user.findMany({
			...base,
			where: { wins: { gt: 0 } },
			orderBy: { wins: "desc" },
			select: { username: true, faction: true, wins: true },
		}),
		prisma.user.findMany({
			...base,
			where: { totalTetris: { gt: 0 } },
			orderBy: { totalTetris: "desc" },
			select: { username: true, faction: true, totalTetris: true },
		}),
		prisma.user.findMany({
			...base,
			where: { totalLines: { gt: 0 } },
			orderBy: { totalLines: "desc" },
			select: { username: true, faction: true, totalLines: true },
		}),
	]);
	return {
		topScore: byScore.map((r) => toEntry(r, r.bestScore)),
		topWins: byWins.map((r) => toEntry(r, r.wins)),
		topTetris: byTetris.map((r) => toEntry(r, r.totalTetris)),
		topLines: byLines.map((r) => toEntry(r, r.totalLines)),
	};
}

export async function getFactionAggregates(): Promise<FactionAggregate[]> {
	const rows = await prisma.factionStats.findMany({
		select: { faction: true, wins: true, losses: true, tetris: true, lines: true, bestScore: true },
	});
	return rows
		.filter((row): row is typeof row & { faction: Faction } => isFactionName(row.faction))
		.map((row) => ({
			faction: row.faction,
			wins: row.wins,
			losses: row.losses,
			tetris: row.tetris,
			lines: row.lines,
			bestScore: row.bestScore,
		}));
}

// Classement PAR MODE : pour chaque mode, les joueurs triés par meilleur score dans ce
// mode. On agrège d'abord (mode, joueur) via groupBy, puis on regroupe par mode côté JS.
export async function getModeLeaderboards(): Promise<ModeLeaderboard[]> {
	const rows = await prisma.gameRecord.groupBy({
		by: ["mode", "username", "faction"],
		_count: { _all: true },
		_max: { score: true },
		_sum: { lines: true, tetris: true },
	});

	const byMode = new Map<string, ModeLeaderboardEntry[]>();
	for (const row of rows) {
		const entry: ModeLeaderboardEntry = {
			username: row.username,
			faction: toFaction(row.faction),
			bestScore: row._max.score ?? 0,
			games: row._count._all,
			lines: row._sum.lines ?? 0,
			tetris: row._sum.tetris ?? 0,
		};
		const list = byMode.get(row.mode);
		if (list) list.push(entry);
		else byMode.set(row.mode, [entry]);
	}

	return [...byMode.entries()]
		.map(([mode, entries]) => ({
			mode,
			entries: entries.sort((a, b) => b.bestScore - a.bestScore).slice(0, LEADERBOARD_SIZE),
		}))
		// Modes les plus joués en premier (nombre de joueurs classés).
		.sort((a, b) => b.entries.length - a.entries.length);
}
