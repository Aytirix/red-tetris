// Types partagés du domaine « statistiques ». Les DTO (StatsState & co) sont la forme
// EXACTE envoyée au client via `stats:State` ; le front les revalide de son côté.

export type FactionName = "marine" | "pirate";

// Résultat d'un joueur pour UNE partie terminée, tel que fourni par Game au moment du
// règlement de fin de partie. `hadWinner` distingue une vraie défaite (partie décisive
// perdue) d'une partie solo/sans vainqueur, qui ne doit pas gonfler le compteur de
// défaites.
export type GameResultInput = {
	username: string;
	faction: string | null;
	mode: string;
	score: number;
	lines: number;
	tetris: number;
	level: number;
	won: boolean;
	hadWinner: boolean;
	durationMs: number;
};

export type UserStats = {
	username: string;
	faction: FactionName | null;
	totalGames: number;
	wins: number;
	losses: number;
	// Ratio victoires / (victoires + défaites), dans [0, 1]. 0 si aucune partie décisive.
	winRate: number;
	bestScore: number;
	totalLines: number;
	totalTetris: number;
	playtimeMs: number;
};

export type LeaderboardEntry = {
	username: string;
	faction: FactionName | null;
	value: number;
};

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

export type FactionStandings = {
	factions: FactionAggregate[];
	// « Le meilleur camp » : la faction en tête aux victoires, ou null en cas d'égalité
	// (ou si aucune faction n'a encore gagné).
	leader: FactionName | null;
};

// Une ligne du classement d'un mode : le meilleur score d'un joueur DANS ce mode, plus
// ses cumuls (parties/lignes/tetris) pour ce mode.
export type ModeLeaderboardEntry = {
	username: string;
	faction: FactionName | null;
	bestScore: number;
	games: number;
	lines: number;
	tetris: number;
};

// Classement d'un mode de jeu : joueurs triés par meilleur score dans ce mode.
export type ModeLeaderboard = {
	mode: string;
	entries: ModeLeaderboardEntry[];
};

export type StatsState = {
	// `me` est null si le socket n'est pas authentifié ou n'a pas de compte : les
	// classements/factions/modes restent visibles pour tout le monde.
	me: UserStats | null;
	leaderboards: Leaderboards;
	factions: FactionStandings;
	// Un classement par mode de jeu (le client propose un sélecteur pour changer de mode).
	modes: ModeLeaderboard[];
};

export function isFactionName(value: unknown): value is FactionName {
	return value === "marine" || value === "pirate";
}
