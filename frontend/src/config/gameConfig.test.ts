import { describe, expect, it } from "vitest";
import {
	CELL_THEME,
	PIECE_SHAPES,
	getCellTheme,
	isFilledCell,
	trimShape,
} from "./gameConfig";
import type { GameBoardCell, PieceType } from "../types/game";

const PIECE_TYPES: PieceType[] = ["I", "J", "L", "O", "S", "T", "Z"];

describe("PIECE_SHAPES", () => {
	it("expose une forme pour chacune des 7 pieces", () => {
		expect(Object.keys(PIECE_SHAPES).sort()).toEqual([...PIECE_TYPES].sort());
	});

	it("contient des matrices carrees non vides et au moins une cellule pleine", () => {
		for (const type of PIECE_TYPES) {
			const shape = PIECE_SHAPES[type];
			expect(shape.length).toBeGreaterThan(0);
			for (const row of shape) {
				expect(row.length).toBe(shape.length);
			}
			expect(shape.flat().some((v) => v === 1)).toBe(true);
		}
	});

	it("a le bon nombre de cellules pleines par piece (4 blocs de tetromino)", () => {
		for (const type of PIECE_TYPES) {
			const filled = PIECE_SHAPES[type].flat().filter((v) => v === 1).length;
			expect(filled).toBe(4);
		}
	});
});

describe("getCellTheme", () => {
	it("retourne le theme vide pour une cellule 0", () => {
		expect(getCellTheme(0)).toBe(CELL_THEME.empty);
		expect(getCellTheme(0).color).toBe("transparent");
	});

	it("retourne le theme penalite pour une cellule 'penalty'", () => {
		expect(getCellTheme("penalty")).toBe(CELL_THEME.penalty);
	});

	it("retourne un theme monochrome pour une cellule de spectre", () => {
		expect(getCellTheme("spectrum")).toBe(CELL_THEME.spectrum);
		// Le spectre ne doit jamais reprendre la couleur d'une piece.
		for (const type of PIECE_TYPES)
			expect(CELL_THEME.spectrum.gradient).not.toBe(CELL_THEME[type].gradient);
	});

	it("retourne le theme associe pour chaque type de piece", () => {
		for (const type of PIECE_TYPES) {
			expect(getCellTheme(type)).toBe(CELL_THEME[type]);
			expect(getCellTheme(type).gradient).toBeTruthy();
		}
	});
});

describe("isFilledCell", () => {
	it("est faux uniquement pour la cellule vide", () => {
		expect(isFilledCell(0)).toBe(false);
	});

	it("est vrai pour les pieces et la penalite", () => {
		const cells: GameBoardCell[] = [...PIECE_TYPES, "penalty"];
		for (const cell of cells) {
			expect(isFilledCell(cell)).toBe(true);
		}
	});
});

describe("trimShape", () => {
	it("retire les lignes et colonnes vides autour de la piece", () => {
		expect(trimShape(PIECE_SHAPES.I)).toEqual([[1, 1, 1, 1]]);
	});

	it("conserve les trous internes de la forme", () => {
		expect(trimShape(PIECE_SHAPES.T)).toEqual([
			[0, 1, 0],
			[1, 1, 1],
		]);
		expect(trimShape(PIECE_SHAPES.S)).toEqual([
			[0, 1, 1],
			[1, 1, 0],
		]);
	});

	it("laisse inchangee une forme deja compacte", () => {
		expect(trimShape(PIECE_SHAPES.O)).toEqual([
			[1, 1],
			[1, 1],
		]);
	});

	it("retourne la forme telle quelle si aucune cellule n'est pleine", () => {
		const empty = [
			[0, 0],
			[0, 0],
		];
		expect(trimShape(empty)).toBe(empty);
	});

	it("gere une cellule pleine isolee au centre", () => {
		expect(
			trimShape([
				[0, 0, 0],
				[0, 1, 0],
				[0, 0, 0],
			]),
		).toEqual([[1]]);
	});

	it("gere une forme pleine sur les bords opposes", () => {
		expect(
			trimShape([
				[1, 0, 0],
				[0, 0, 0],
				[0, 0, 1],
			]),
		).toEqual([
			[1, 0, 0],
			[0, 0, 0],
			[0, 0, 1],
		]);
	});

	it("ne mute pas la forme d'entree", () => {
		const source = PIECE_SHAPES.J.map((row) => [...row]);
		trimShape(PIECE_SHAPES.J);
		expect(PIECE_SHAPES.J).toEqual(source);
	});
});

describe("CELL_THEME", () => {
	it("declare une entree pour chaque piece plus empty/filled/penalty/spectrum", () => {
		const keys = Object.keys(CELL_THEME).sort();
		expect(keys).toEqual([...PIECE_TYPES, "empty", "filled", "penalty", "spectrum"].sort());
	});

	it("fournit une bordure pour toutes les entrees", () => {
		for (const entry of Object.values(CELL_THEME)) {
			expect(typeof entry.border).toBe("string");
		}
	});
});
