export type PieceType = "I" | "J" | "L" | "O" | "S" | "T" | "Z";

// Modes de jeu (doit rester aligne sur GAME_MODES cote serveur).
// Nombre de jokers du mode invisible. DOIT rester aligne sur INVISIBLE_JOKER_COUNT
// (server/src/types/game/gameTypes.ts): sert a borner la valeur recue et a afficher
// les etoiles restantes.
export const MAX_JOKERS = 3;

export const GAME_MODES = ["classique", "sprint", "ultra", "suddendeath", "invisible"] as const;
export type GameMode = (typeof GAME_MODES)[number];

export const GAME_MODE_LABELS: Record<GameMode, string> = {
	classique: "Classique",
	sprint: "Sprint",
	ultra: "Ultra",
	suddendeath: "Sudden Death",
	invisible: "Invisible",
};

export const GAME_MODE_HINTS: Record<GameMode, string> = {
	classique: "Règles de base : le dernier debout gagne.",
	sprint: "Premier à 40 lignes.",
	ultra: "2 minutes, meilleur scorssse.",
	suddendeath: "Vitesse maximale dès la première pièce.",
	invisible: "Une pièce posée s'efface en 3 s… mais reste solide.",
};

// Nombre minimum de joueurs pour lancer un mode. Sprint est une COURSE : il n'a de sens
// qu'à plusieurs. Le serveur applique la même règle (autoritatif) ; ceci ne fait que
// désactiver le bouton côté client. DOIT rester aligné sur le serveur.
export const GAME_MODE_MIN_PLAYERS: Record<GameMode, number> = {
	classique: 1,
	sprint: 2,
	ultra: 1,
	suddendeath: 1,
	invisible: 1,
};

// Règles détaillées affichées dans le lobby (une puce par ligne).
export const GAME_MODE_RULES: Record<GameMode, string[]> = {
	classique: [
		"Nettoie des lignes pour marquer des points : 100 / 300 / 500 / 800 selon que tu en fais 1, 2, 3 ou 4 d'un coup.",
		"En solo, le niveau multiplie le score : au niveau 3, un Tetris vaut 2 400 points.",
		"Descendre la pièce toi-même rapporte : 1 point par case, 2 si tu la lâches d'un coup.",
		"Chaque ligne que tu nettoies envoie des lignes de pénalité aux adversaires.",
		"Le dernier joueur encore en vie remporte la partie.",
	],
	sprint: [
		"Objectif : être le premier à nettoyer 40 lignes.",
		"⚠ Nécessite au moins 2 joueurs (c'est une course).",
		"La vitesse de chute augmente avec le niveau.",
	],
	ultra: [
		"Partie chronométrée : 2 minutes.",
		"Le meilleur score à la fin du temps l'emporte.",
		"Vise les Tetris (4 lignes d'un coup) : 800 points, contre 400 pour les mêmes lignes faites une par une.",
	],
	suddendeath: [
		"Vitesse maximale dès la première pièce.",
		"Une seule vie : le plus endurant gagne.",
		"Réflexes indispensables.",
	],
	invisible: [
		"Une pièce posée s'efface après 3 s… mais reste solide.",
		"Chaque ligne complétée redonne 2 s de visibilité (cumulables).",
		"3 jokers pour révéler le plateau à la demande.",
	],
};

export function isGameMode(value: string): value is GameMode {
	return (GAME_MODES as readonly string[]).includes(value);
}

// "spectrum": cellule du spectre d'un adversaire (hauteur de pile, sans couleur).
// Un joueur ne recoit que ca de ses adversaires; un spectateur recoit les vrais plateaux.
export type GameBoardCell = 0 | PieceType | "penalty" | "spectrum";

export type GameBoard = GameBoardCell[][];

export type OpponentBoard = {
	username: string;
	board: GameBoard;
	alive: boolean;
};

export type GamePiece = {
	type: PieceType;
};

export type GhostCell = { x: number; y: number };

export type GameStatePayload = {
	board: GameBoard;
	opponents: OpponentBoard[];
	currentPiece: GamePiece | null;
	nextPiece: GamePiece | null;
	score: number;
	level: number;
	spectator: false | string;
	ghost: GhostCell[];
	mode: GameMode;
	/** Lignes nettoyees par le joueur affiche. */
	lines: number;
	/** Objectif de lignes (sprint), null sinon. */
	linesTarget: number | null;
	/** Temps restant en ms (ultra), null sinon. */
	timeLeftMs: number | null;
	/** Opacite par cellule (mode invisible), null sinon. Aligne sur `board`. */
	fade: number[][] | null;
	/** Jokers restants (mode invisible). Voir MAX_JOKERS. */
	jokersLeft: number;
	/** Cosmetique du proprietaire du plateau affiche (thème de pièces), null si inconnu. */
	theme: string | null;
	/**
	 * Sursis (ms) avant que la pièce posée sur la pile ne se verrouille, null si elle
	 * peut encore descendre. Le serveur le calcule depuis son dernier tick : le joueur
	 * a un tick complet pour glisser la pièce, et bouger ne le repousse pas.
	 */
	lockInMs: number | null;
};

export type GameOverScore = {
	username: string;
	score: number;
	level?: number;
};

export type GameOverPayload = {
	winner: string | null;
	scores: GameOverScore[];
};
