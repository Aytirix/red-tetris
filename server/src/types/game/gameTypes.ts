import type { Piece } from "../../core/Piece.js";
import type { Player } from "../../core/Player.js";
import type { PieceShape } from "./piecesGameTypes.js";

export const BOARD_WIDTH = 10;
export const BOARD_HEIGHT = 20;

// Modes de jeu disponibles. "classique" = regles de base (survie / dernier debout).
export const GAME_MODES = ["classique", "sprint", "ultra", "suddendeath", "invisible"] as const;
export type GameMode = (typeof GAME_MODES)[number];

export function isGameMode(value: string): value is GameMode {
	return (GAME_MODES as readonly string[]).includes(value);
}

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

export type PieceType = "I" | "J" | "L" | "O" | "S" | "T" | "Z";

export type currentPiece = {
	type: PieceType;
};

// "spectrum": cellule du spectre envoye aux adversaires (hauteur de pile, sans couleur).
export type Cell = 0 | PieceType | "penalty" | "spectrum";

export type Board = Cell [][];

export type OpponentBoard = {
	username: string;
	board: Board;
	alive: boolean;
};

export type PlayerGameState = {
	board: Board;
	score: number;
	level: number;
	// Total de lignes nettoyees (objectif du mode sprint).
	lines: number;
	// Nombre de « Tetris » realises (4 lignes nettoyees d'un coup). Statistiques.
	tetris: number;
	// Instant de verrouillage (ms) de chaque cellule, aligne sur `board`. 0 = pas de
	// verrouillage horodate (case vide ou ligne de penalite). Sert au fondu du mode
	// invisible; decale en meme temps que le plateau (lignes completees / penalites).
	lockedAt: number[][];
	// Mode invisible: jokers restants (revelation a la demande).
	jokersLeft: number;
	// Mode invisible: instant a partir duquel le fondu reprend. Sert de PLANCHER a
	// l'horodatage des pieces posees pendant une revelation, pour qu'elles
	// disparaissent avec les autres et non avant.
	revealUntil: number;
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
