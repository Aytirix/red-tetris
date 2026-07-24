// Revalidation défensive du payload `stats:State` (back -> front). On ne fait jamais
// confiance à la forme reçue : chaque champ manquant/invalide retombe sur une valeur
// sûre pour que l'UI ne casse jamais.

export type FactionName = "marine" | "pirate";

export type UserStats = {
	username: string;
	faction: FactionName | null;
	totalGames: number;
	wins: number;
	losses: number;
	winRate: number;
	bestScore: number;
	totalLines: number;
	totalTetris: number;
	playtimeMs: number;
};

export type LeaderboardEntry = { username: string; faction: FactionName | null; value: number };

export type Leaderboards = {
	topScore: LeaderboardEntry[];
	topWins: LeaderboardEntry[];
	topTetris: LeaderboardEntry[];
	topLines: LeaderboardEntry[];
};

export type FactionAggregate = {
	faction: FactionName;
	wins: number;
	losses: number;
	tetris: number;
	lines: number;
	bestScore: number;
};

export type FactionStandings = { factions: FactionAggregate[]; leader: FactionName | null };

export type ModeLeaderboardEntry = {
	username: string;
	faction: FactionName | null;
	bestScore: number;
	games: number;
	lines: number;
	tetris: number;
};

export type ModeLeaderboard = {
	mode: string;
	entries: ModeLeaderboardEntry[];
};

export type StatsState = {
	me: UserStats | null;
	leaderboards: Leaderboards;
	factions: FactionStandings;
	modes: ModeLeaderboard[];
};

export const EMPTY_LEADERBOARDS: Leaderboards = {
	topScore: [],
	topWins: [],
	topTetris: [],
	topLines: [],
};

export const EMPTY_STATS: StatsState = {
	me: null,
	leaderboards: EMPTY_LEADERBOARDS,
	factions: { factions: [], leader: null },
	modes: [],
};

function num(value: unknown): number {
	return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function asRecord(value: unknown): Record<string, unknown> | null {
	return value && typeof value === "object" ? (value as Record<string, unknown>) : null;
}

function asFaction(value: unknown): FactionName | null {
	return value === "marine" || value === "pirate" ? value : null;
}

function normalizeUserStats(raw: unknown): UserStats | null {
	const r = asRecord(raw);
	if (!r || typeof r.username !== "string") return null;
	return {
		username: r.username,
		faction: asFaction(r.faction),
		totalGames: num(r.totalGames),
		wins: num(r.wins),
		losses: num(r.losses),
		winRate: num(r.winRate),
		bestScore: num(r.bestScore),
		totalLines: num(r.totalLines),
		totalTetris: num(r.totalTetris),
		playtimeMs: num(r.playtimeMs),
	};
}

function normalizeLeaderboard(raw: unknown): LeaderboardEntry[] {
	if (!Array.isArray(raw)) return [];
	const out: LeaderboardEntry[] = [];
	for (const item of raw) {
		const r = asRecord(item);
		if (!r || typeof r.username !== "string") continue;
		out.push({ username: r.username, faction: asFaction(r.faction), value: num(r.value) });
	}
	return out;
}

function normalizeLeaderboards(raw: unknown): Leaderboards {
	const r = asRecord(raw);
	if (!r) return EMPTY_LEADERBOARDS;
	return {
		topScore: normalizeLeaderboard(r.topScore),
		topWins: normalizeLeaderboard(r.topWins),
		topTetris: normalizeLeaderboard(r.topTetris),
		topLines: normalizeLeaderboard(r.topLines),
	};
}

function normalizeFactions(raw: unknown): FactionStandings {
	const r = asRecord(raw);
	if (!r) return { factions: [], leader: null };
	const factions: FactionAggregate[] = [];
	if (Array.isArray(r.factions)) {
		for (const item of r.factions) {
			const f = asRecord(item);
			const faction = asFaction(f?.faction);
			if (!f || !faction) continue;
			factions.push({
				faction,
				wins: num(f.wins),
				losses: num(f.losses),
				tetris: num(f.tetris),
				lines: num(f.lines),
				bestScore: num(f.bestScore),
			});
		}
	}
	return { factions, leader: asFaction(r.leader) };
}

function normalizeModeEntries(raw: unknown): ModeLeaderboardEntry[] {
	if (!Array.isArray(raw)) return [];
	const out: ModeLeaderboardEntry[] = [];
	for (const item of raw) {
		const r = asRecord(item);
		if (!r || typeof r.username !== "string") continue;
		out.push({
			username: r.username,
			faction: asFaction(r.faction),
			bestScore: num(r.bestScore),
			games: num(r.games),
			lines: num(r.lines),
			tetris: num(r.tetris),
		});
	}
	return out;
}

function normalizeModes(raw: unknown): ModeLeaderboard[] {
	if (!Array.isArray(raw)) return [];
	const out: ModeLeaderboard[] = [];
	for (const item of raw) {
		const r = asRecord(item);
		if (!r || typeof r.mode !== "string") continue;
		out.push({ mode: r.mode, entries: normalizeModeEntries(r.entries) });
	}
	return out;
}

export function normalizeStatsState(raw: unknown): StatsState | null {
	const r = asRecord(raw);
	if (!r) return null;
	return {
		me: normalizeUserStats(r.me),
		leaderboards: normalizeLeaderboards(r.leaderboards),
		factions: normalizeFactions(r.factions),
		modes: normalizeModes(r.modes),
	};
}

export function normalizeStatsError(raw: unknown): string | null {
	const r = asRecord(raw);
	if (!r) return null;
	return typeof r.message === "string" ? r.message : "Opération impossible";
}
