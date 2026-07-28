import { describe, it, expect } from "vitest";
import {
	computeMainCellSize,
	computeMiniCellSize,
	fitCellSize,
	MAIN_CELL_MAX,
	MAIN_CELL_MIN,
} from "./boardSizing";

/** Hauteur réellement occupée par le plateau rendu, gouttières et cadre compris. */
function renderedBoardHeight(rows: number, cell: number): number {
	return rows * cell + (rows - 1) * 2 + 22;
}

/** Place verticale disponible autour du plateau (padding scène + HUD déduits). */
function availableHeight(viewportHeight: number): number {
	return viewportHeight - 132;
}

describe("computeMainCellSize", () => {
	it("garde la taille historique de 38 px sur un grand écran", () => {
		expect(
			computeMainCellSize({ viewportWidth: 2560, viewportHeight: 1400, rows: 20, cols: 10 }),
		).toBe(MAIN_CELL_MAX);
	});

	it("ne dépasse jamais le plafond, même sur un écran démesuré", () => {
		expect(
			computeMainCellSize({ viewportWidth: 5120, viewportHeight: 2880, rows: 20, cols: 10 }),
		).toBe(MAIN_CELL_MAX);
	});

	it("réduit la cellule sur un écran de PC portable peu haut", () => {
		const cell = computeMainCellSize({
			viewportWidth: 1366,
			viewportHeight: 700,
			rows: 20,
			cols: 10,
		});
		expect(cell).toBeLessThan(MAIN_CELL_MAX);
		expect(cell).toBeGreaterThanOrEqual(MAIN_CELL_MIN);
	});

	// Le bug d'origine : à 38 px figés le plateau dépassait le bas du viewport.
	it.each([
		[1920, 1080],
		[1600, 900],
		[1440, 900],
		[1366, 768],
		[1366, 700],
		[1280, 800],
		[1024, 640],
	])("tient dans le viewport %ix%i", (viewportWidth, viewportHeight) => {
		const rows = 20;
		const cell = computeMainCellSize({ viewportWidth, viewportHeight, rows, cols: 10 });
		expect(renderedBoardHeight(rows, cell)).toBeLessThanOrEqual(availableHeight(viewportHeight));
	});

	it("ne descend pas sous le plancher de lisibilité sur un viewport minuscule", () => {
		expect(
			computeMainCellSize({ viewportWidth: 400, viewportHeight: 200, rows: 20, cols: 10 }),
		).toBe(MAIN_CELL_MIN);
	});

	it("grandit quand le plateau a moins de lignes", () => {
		const tall = computeMainCellSize({ viewportWidth: 1440, viewportHeight: 800, rows: 20, cols: 10 });
		const short = computeMainCellSize({ viewportWidth: 1440, viewportHeight: 800, rows: 12, cols: 10 });
		expect(short).toBeGreaterThan(tall);
	});

	it("retombe sur la taille max si le plateau est vide (pas de division par zéro)", () => {
		expect(
			computeMainCellSize({ viewportWidth: 1280, viewportHeight: 800, rows: 0, cols: 0 }),
		).toBe(MAIN_CELL_MAX);
	});

	it("est contraint par la largeur quand le plateau est très large", () => {
		const cell = computeMainCellSize({
			viewportWidth: 1024,
			viewportHeight: 2000,
			rows: 20,
			cols: 40,
		});
		expect(cell).toBeLessThan(MAIN_CELL_MAX);
	});

	it("ne rétrécit jamais quand la fenêtre grandit", () => {
		let previous = 0;
		for (const height of [600, 700, 800, 900, 1000, 1200]) {
			const cell = computeMainCellSize({
				viewportWidth: 1920,
				viewportHeight: height,
				rows: 20,
				cols: 10,
			});
			expect(cell).toBeGreaterThanOrEqual(previous);
			previous = cell;
		}
	});
});

describe("fitCellSize", () => {
	// Le plateau est dimensionné sur la place MESURÉE : il ne doit jamais la dépasser,
	// sinon la scène (qui ne défile plus) le rognerait.
	it.each([
		[420, 900],
		[420, 700],
		[380, 560],
		[300, 480],
	])("tient dans une zone de %ix%i px", (availableWidth, availableHeight) => {
		const rows = 20;
		const cols = 10;
		const cell = fitCellSize({ availableWidth, availableHeight, rows, cols });
		expect(renderedBoardHeight(rows, cell)).toBeLessThanOrEqual(availableHeight);
		expect(cols * cell + (cols - 1) * 2 + 22).toBeLessThanOrEqual(availableWidth);
	});

	it("plafonne à la taille historique quand la place est immense", () => {
		expect(fitCellSize({ availableWidth: 4000, availableHeight: 4000, rows: 20, cols: 10 })).toBe(MAIN_CELL_MAX);
	});

	it("garde un plancher de lisibilité quand la zone est minuscule", () => {
		expect(fitCellSize({ availableWidth: 80, availableHeight: 60, rows: 20, cols: 10 })).toBe(MAIN_CELL_MIN);
	});

	it("est contraint par la plus petite des deux dimensions", () => {
		const wide = fitCellSize({ availableWidth: 2000, availableHeight: 500, rows: 20, cols: 10 });
		const tall = fitCellSize({ availableWidth: 200, availableHeight: 2000, rows: 20, cols: 10 });
		expect(wide).toBe(fitCellSize({ availableWidth: 500, availableHeight: 500, rows: 20, cols: 10 }));
		expect(tall).toBeLessThan(wide);
	});

	it("retombe sur la taille max si le plateau est vide (pas de division par zéro)", () => {
		expect(fitCellSize({ availableWidth: 500, availableHeight: 800, rows: 0, cols: 0 })).toBe(MAIN_CELL_MAX);
	});
});

describe("computeMiniCellSize", () => {
	it("conserve 10 px quand le plateau principal est à sa taille max", () => {
		expect(computeMiniCellSize(MAIN_CELL_MAX)).toBe(10);
	});

	it("suit la taille du plateau principal", () => {
		expect(computeMiniCellSize(20)).toBeLessThan(computeMiniCellSize(38));
	});

	it("garde un plancher visible", () => {
		expect(computeMiniCellSize(1)).toBeGreaterThanOrEqual(5);
	});
});
