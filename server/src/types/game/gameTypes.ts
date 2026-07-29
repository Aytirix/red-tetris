import type { Piece } from "../../core/Piece.js";
import type { Player } from "../../core/Player.js";
import type { PieceShape } from "./piecesGameTypes.js";

export const BOARD_WIDTH = 10;
export const BOARD_HEIGHT = 20;

// Modes de jeu disponibles. "classique" = regles de base (survie / dernier debout).
export const GAME_MODES = ["classique", "sprint", "ultra", "suddendeath", "invisible", "cascade", "cheese"] as const;
export type GameMode = (typeof GAME_MODES)[number];

export function isGameMode(value: string): value is GameMode {
	return (GAME_MODES as readonly string[]).includes(value);
}
export const LINE_CLEAR_SCORES = [0, 100, 300, 500, 800] as const;
export const SOFT_DROP_POINTS_PER_CELL = 1;
export const HARD_DROP_POINTS_PER_CELL = 2;
export const LINES_PER_LEVEL = 5;
export const LOCK_GRACE_FACTOR = 1.75;
// Plancher: aux niveaux les plus rapides (frame a 80 ms), 1,75 frame ne laisserait pas
// le temps de reagir. En dessous de ce seuil le jeu devient injouable, pas difficile.
export const LOCK_GRACE_MIN_MS = 250;

// Sprint: premier a nettoyer 40 lignes.
export const SPRINT_TARGET_LINES = 40;
// Ultra: 2 minutes, meilleur score.
export const ULTRA_DURATION_MS = 120_000;
// Sudden death: vitesse maximale des le depart (une seule vie, le plus endurant gagne).
export const SUDDEN_DEATH_TICK_MS = 120;
// Invisible: une piece verrouillee s'efface progressivement et disparait apres 3s.
export const INVISIBLE_FADE_MS = 3_000;
// Invisible: chaque ligne completee redonne 2s de visibilite totale (cumulables).
export const INVISIBLE_REVEAL_PER_LINE_MS = 2_000;
// Invisible: plafond de visibilite "en banque". Sans lui, un joueur qui enchaine
// les lignes garderait le plateau visible en permanence et annulerait le mode.
export const INVISIBLE_REVEAL_CAP_MS = 6_000;
// Invisible: jokers par partie, chacun revelant le plateau 3s a la demande.
export const INVISIBLE_JOKER_COUNT = 3;
export const INVISIBLE_JOKER_REVEAL_MS = 3_000;

// Cheese: nombre total de lignes de gruyere (percees d'un trou) a creuser pour
// gagner la course.
export const CHEESE_TOTAL_GARBAGE = 20;
// Cheese: combien sont posees sur le plateau au coup d'envoi. Les autres attendent
// leur tour: le plateau ne peut pas commencer avec 20 rangees sur 20.
export const CHEESE_START_GARBAGE = 10;
export const CHEESE_CLEARS_PER_RISE = 2;

export type PieceType = "I" | "J" | "L" | "O" | "S" | "T" | "Z";

export type currentPiece = {
	type: PieceType;
};
export type Cell = 0 | PieceType | "penalty" | "spectrum" | "garbage";

export type Board = Cell [][];

export type OpponentBoard = {
	username: string;
	board: Board;
	alive: boolean;
};

/** Mode cascade : retombee de blocs a animer par le client. */
export type CascadeFall = {
	id: number;
	/** Position d'ARRIVEE de la case, et nombre de rangees qu'elle vient de descendre. */
	cells: { x: number; y: number; rows: number }[];
};

export type PlayerGameState = {
	board: Board;
	score: number;
	level: number;
	// Total de lignes nettoyees (objectif du mode sprint).
	lines: number;
	// Nombre de « Tetris » realises (4 lignes nettoyees d'un coup). Statistiques.
	tetris: number;
	lockedAt: number[][];
	pieceIds: number[][];
	cascade: CascadeFall | null;
	// Mode invisible: jokers restants (revelation a la demande).
	jokersLeft: number;
	revealUntil: number;
	groundedAt: number | null;
	// Rangee la plus basse jamais atteinte par la piece courante. Sert a distinguer une
	// vraie descente d'un sur-place: seule la premiere relance le sursis.
	deepestY: number;
	garbageCleared: number;
	garbageServed: number;
	pieceIndex: number
	player: Player;
	isAlive: boolean;
	// Depart volontaire (room:leave / deconnexion), distinct d'un top-out: un joueur
	// parti ne peut pas remporter une partie au score.
	hasAbandoned: boolean;
	spectator: boolean | string;
	currentPiece?: Piece;
	nextPiece?: Piece;
}
