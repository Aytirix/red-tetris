import type { PieceType } from "../types/game";

// Forme canonique de chaque pièce dans une grille (0/1).
// Utilisé pour dessiner la preview de la nextPiece côté front.
export const PIECE_SHAPES: Record<PieceType, number[][]> = {
	I: [
		[0, 0, 0, 0],
		[1, 1, 1, 1],
		[0, 0, 0, 0],
		[0, 0, 0, 0],
	],
	J: [
		[1, 0, 0],
		[1, 1, 1],
		[0, 0, 0],
	],
	L: [
		[0, 0, 1],
		[1, 1, 1],
		[0, 0, 0],
	],
	O: [
		[1, 1],
		[1, 1],
	],
	S: [
		[0, 1, 1],
		[1, 1, 0],
		[0, 0, 0],
	],
	T: [
		[0, 1, 0],
		[1, 1, 1],
		[0, 0, 0],
	],
	Z: [
		[1, 1, 0],
		[0, 1, 1],
		[0, 0, 0],
	],
};

// Réduit une forme à sa bounding box (retire les lignes/colonnes vides).
// Utilisé pour la preview de pièce (next + boutique).
export function trimShape(shape: number[][]): number[][] {
	let top = shape.length, bottom = -1, left = shape[0].length, right = -1;
	for (let y = 0; y < shape.length; y++) {
		for (let x = 0; x < shape[y].length; x++) {
			if (shape[y][x]) {
				if (y < top) top = y;
				if (y > bottom) bottom = y;
				if (x < left) left = x;
				if (x > right) right = x;
			}
		}
	}
	if (bottom === -1) return shape;
	const out: number[][] = [];
	for (let y = top; y <= bottom; y++) out.push(shape[y].slice(left, right + 1));
	return out;
}
