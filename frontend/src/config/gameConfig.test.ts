import { describe, expect, it } from "vitest";
import { PIECE_SHAPES, trimShape } from "./gameConfig";
import type { PieceType } from "../types/game";

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

