import type { Piece } from "../../core/Piece.js";
import type { Player } from "../../core/Player.js";
import type { PieceShape } from "./piecesGameTypes.js";

export const BOARD_WIDTH = 10;
export const BOARD_HEIGHT = 20;

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
	pieceIndex: number
	player: Player;
	isAlive: boolean;
	spectator: boolean | string;
	currentPiece?: Piece;
	nextPiece?: Piece;
}
