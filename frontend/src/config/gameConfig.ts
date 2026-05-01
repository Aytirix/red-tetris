import type { GameBoardCell, PieceType } from "../types/game";

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

export type CellThemeEntry = {
	color?: string;
	gradient?: string;
	image?: string;
	glow?: string;
	border?: string;
};

// Config centrale: change la couleur / image / glow d'un seul endroit.
export const CELL_THEME: Record<Exclude<GameBoardCell, 0> | "empty" | "filled", CellThemeEntry> = {
	empty: {
		color: "transparent",
		border: "rgba(255, 255, 255, 0.04)",
	},
	filled: {
		gradient: "linear-gradient(160deg, #aeb8d3 0%, #5b6582 100%)",
		glow: "0 0 6px rgba(174, 184, 211, 0.4)",
		border: "rgba(255, 255, 255, 0.18)",
	},
	I: {
		gradient: "linear-gradient(160deg, #6fe9ff 0%, #1c78c0 100%)",
		glow: "0 0 8px rgba(61, 231, 255, 0.55)",
		border: "rgba(143, 234, 255, 0.6)",
	},
	J: {
		gradient: "linear-gradient(160deg, #6f8bff 0%, #2a3da0 100%)",
		glow: "0 0 8px rgba(110, 139, 255, 0.55)",
		border: "rgba(143, 162, 255, 0.55)",
	},
	L: {
		gradient: "linear-gradient(160deg, #ffb05c 0%, #c97214 100%)",
		glow: "0 0 8px rgba(255, 176, 92, 0.55)",
		border: "rgba(255, 198, 130, 0.55)",
	},
	O: {
		gradient: "linear-gradient(160deg, #ffe46e 0%, #d6a63b 100%)",
		glow: "0 0 8px rgba(255, 228, 110, 0.55)",
		border: "rgba(255, 232, 130, 0.55)",
	},
	S: {
		gradient: "linear-gradient(160deg, #6fff9d 0%, #1ea35a 100%)",
		glow: "0 0 8px rgba(110, 255, 157, 0.55)",
		border: "rgba(143, 255, 175, 0.55)",
	},
	T: {
		gradient: "linear-gradient(160deg, #c578ff 0%, #6e2bbf 100%)",
		glow: "0 0 8px rgba(197, 120, 255, 0.55)",
		border: "rgba(212, 152, 255, 0.55)",
	},
	Z: {
		gradient: "linear-gradient(160deg, #ff6f8b 0%, #c01c45 100%)",
		glow: "0 0 8px rgba(255, 111, 139, 0.55)",
		border: "rgba(255, 143, 167, 0.55)",
	},
	penalty: {
		gradient: "linear-gradient(160deg, #4a4f63 0%, #1d2030 100%)",
		glow: "inset 0 0 6px rgba(0, 0, 0, 0.6)",
		border: "rgba(255, 255, 255, 0.1)",
	},
};

export function getCellTheme(cell: GameBoardCell): CellThemeEntry {
	if (cell === 0) return CELL_THEME.empty;
	if (cell === "penalty") return CELL_THEME.penalty;
	return CELL_THEME[cell];
}

export function isFilledCell(cell: GameBoardCell): boolean {
	return cell !== 0;
}
