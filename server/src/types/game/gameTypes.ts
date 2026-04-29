import type { Piece } from "../../core/Piece.js";
import type { Player } from "../../core/Player.js";
import type { PieceShape } from "./piecesGameTypes.js";

export const BOARD_WIDTH = 10;
export const BOARD_HEIGHT = 20;

export type PieceType = "I" | "J" | "L" | "O" | "S" | "T" | "Z";

export type currentPiece = {
	type: PieceType;
	x: number;
	y: number;
	rotation: number
};

export type Cell = 0 | 1 | 2;

export type Board = Cell [][];

export type PlayerGameState = {
	board: Board;
	score: number;
	pieceIndex: number
	player: Player;
	isAlive: boolean;
	currentPiece?: Piece;
	nextPiece?: Piece;
}