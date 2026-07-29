export type PieceType = "I" | "J" | "L" | "O" | "S" | "T" | "Z";

// Modes de jeu (doit rester aligne sur GAME_MODES cote serveur).
// Nombre de jokers du mode invisible. DOIT rester aligne sur INVISIBLE_JOKER_COUNT
// (server/src/types/game/gameTypes.ts): sert a borner la valeur recue et a afficher
// les etoiles restantes.
export const MAX_JOKERS = 3;

export const GAME_MODES = ["classique", "sprint", "ultra", "suddendeath", "invisible", "cascade", "cheese"] as const;
export type GameMode = (typeof GAME_MODES)[number];

export const GAME_MODE_LABELS: Record<GameMode, string> = {
	classique: "Classique",
	sprint: "Sprint",
	ultra: "Ultra",
	suddendeath: "Sudden Death",
	invisible: "Invisible",
	cascade: "Cascade",
	cheese: "Gruyère",
};

export const GAME_MODE_HINTS: Record<GameMode, string> = {
	classique: "Règles de base : le dernier debout gagne.",
	sprint: "Premier à 40 lignes.",
	ultra: "2 minutes, meilleur score.",
	suddendeath: "Vitesse maximale dès la première pièce.",
	invisible: "Une pièce posée s'efface en 3 s… mais reste solide.",
	cascade: "Les blocs retombent après un nettoyage : enchaîne les chaînes.",
	cheese: "20 rangées trouées à creuser, le plateau remonte.",
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
	cascade: 1,
	// Gruyère se joue seul (contre-la-montre) comme à plusieurs (course).
	cheese: 1,
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
		"Vitesse de chute constante : à égalité pour tout le monde.",
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
	cascade: [
		"Après chaque nettoyage, les blocs qui ne reposent plus sur rien retombent.",
		"Une retombée peut compléter de nouvelles lignes : c'est une chaîne.",
		"Chaque maillon multiplie le score : 2ᵉ salve ×2, 3ᵉ ×3, et ainsi de suite.",
		"Les pièces tombent entières : un pont posé garde le trou qu'il recouvre.",
		"Les lignes de toute la chaîne comptent ensemble pour la pénalité envoyée.",
	],
	cheese: [
		"Le plateau démarre avec 10 rangées trouées d'une seule case.",
		"Objectif : creuser les 20 rangées de la partie.",
		"Toutes les 2 rangées creusées, le plateau remonte d'une nouvelle rangée.",
		"Le compteur « À creuser » décompte les 20 rangées, celles en coulisse comprises.",
		"À plusieurs, c'est une course : le premier à finir gagne.",
	],
};

export function isGameMode(value: string): value is GameMode {
	return (GAME_MODES as readonly string[]).includes(value);
}

// "spectrum": cellule du spectre d'un adversaire (hauteur de pile, sans couleur).
// Un joueur ne recoit que ca de ses adversaires; un spectateur recoit les vrais plateaux.
// "garbage" : rangée trouée du mode Gruyère — grise comme une pénalité, mais
// nettoyable (c'est l'objectif du mode, pas une sanction).
export type GameBoardCell = 0 | PieceType | "penalty" | "spectrum" | "garbage";

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

/**
 * Mode Cascade : blocs qui viennent de retomber. Le plateau reçu les montre déjà
 * ARRIVÉS ; sans la distance parcourue on ne pourrait que les faire apparaître d'un
 * coup. `id` ne change qu'à une nouvelle retombée : l'info reste dans les frames
 * suivantes, et c'est lui qui évite de rejouer l'animation à chaque frame.
 */
export type CascadeFall = {
	id: number;
	/** Position d'ARRIVÉE de la case, et nombre de rangées qu'elle vient de descendre. */
	cells: { x: number; y: number; rows: number }[];
};

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
	/** « Tetris » réussis par le joueur affiché : 4 lignes nettoyées d'un seul coup. */
	tetris: number;
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
	/**
	 * Mode Gruyère : rangées trouées qu'il reste à creuser (celles déjà servies ET
	 * celles encore en coulisse), null dans les autres modes. Ne remonte jamais :
	 * une remontée du plateau ne fait que dévoiler du gruyère déjà compté.
	 */
	garbageLeft: number | null;
	/** Mode Cascade : retombée à animer, null s'il n'y en a pas eu. */
	cascade: CascadeFall | null;
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
