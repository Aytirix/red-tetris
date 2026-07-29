import {
	getFactionAggregates,
	getLeaderboards,
	getModeLeaderboards,
	getUserStats,
	recordGameResult,
} from "../repositories/statsRepositories.js";
import type {
	FactionAggregate,
	FactionName,
	FactionStandings,
	GameResultInput,
	StatsState,
} from "../types/statsTypes.js";

// « Le meilleur camp » : la faction qui a le plus de victoires. Égalité (ou aucune
// victoire) => pas de leader désigné.
function pickLeader(factions: FactionAggregate[]): FactionName | null {
	let best: FactionAggregate | null = null;
	let tied = false;
	for (const faction of factions) {
		if (!best || faction.wins > best.wins) {
			best = faction;
			tied = false;
		} else if (faction.wins === best.wins) {
			tied = true;
		}
	}
	if (!best || best.wins === 0 || tied) return null;
	return best.faction;
}

async function getFactionStandings(): Promise<FactionStandings> {
	const factions = await getFactionAggregates();
	return { factions, leader: pickLeader(factions) };
}

/** Enregistre les resultats de fin de partie, joueur par joueur, en best-effort. */
export async function recordGameResults(entries: GameResultInput[]): Promise<void> {
	for (const entry of entries) {
		try {
			await recordGameResult(entry);
		} catch (err) {
			console.error(`recordGameResult failed for ${entry.username}:`, err);
		}
	}
}

/** Etat complet des statistiques pour un socket. */
export async function getStatsState(username: string | null): Promise<StatsState> {
	const [me, leaderboards, factions, modes] = await Promise.all([
		username ? getUserStats(username) : Promise.resolve(null),
		getLeaderboards(),
		getFactionStandings(),
		getModeLeaderboards(),
	]);
	return { me, leaderboards, factions, modes };
}
