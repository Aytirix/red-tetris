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
	ultra: "2 minutes, meilleur score.",
	suddendeath: "Vitesse maximale dès la première pièce.",
	invisible: "Une pièce posée s'efface en 3 s… mais reste solide.",
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
