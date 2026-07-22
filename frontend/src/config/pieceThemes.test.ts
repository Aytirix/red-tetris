import { describe, expect, it } from "vitest";
import {
	DEFAULT_THEME_ID,
	PIECE_THEMES,
	getPieceTheme,
	isPieceThemeId,
	themeCssVars,
} from "./pieceThemes";
import type { PieceType } from "../types/game";

const PIECE_TYPES: PieceType[] = ["I", "J", "L", "O", "S", "T", "Z"];

describe("PIECE_THEMES", () => {
	it("contient le theme par defaut, gratuit", () => {
		const base = PIECE_THEMES.find((t) => t.id === DEFAULT_THEME_ID);
		expect(base).toBeDefined();
		expect(base?.price).toBe(0);
	});

	it("n'a pas d'identifiant duplique", () => {
		const ids = PIECE_THEMES.map((t) => t.id);
		expect(new Set(ids).size).toBe(ids.length);
	});

	it("declare une couleur pour chacune des 7 pieces", () => {
		for (const theme of PIECE_THEMES) {
			for (const type of PIECE_TYPES) {
				expect(theme.palette[type]).toMatch(/^#[0-9A-Fa-f]{6}$/);
			}
			expect(theme.name.length).toBeGreaterThan(0);
			expect(theme.description.length).toBeGreaterThan(0);
			expect(theme.price).toBeGreaterThanOrEqual(0);
		}
	});
});

describe("getPieceTheme", () => {
	it("retourne le theme demande quand il existe", () => {
		for (const theme of PIECE_THEMES) {
			expect(getPieceTheme(theme.id)).toBe(theme);
		}
	});

	it("retombe sur le premier theme pour un identifiant inconnu", () => {
		expect(getPieceTheme("theme-inexistant")).toBe(PIECE_THEMES[0]);
		expect(getPieceTheme("")).toBe(PIECE_THEMES[0]);
	});
});

describe("isPieceThemeId", () => {
	it("accepte les identifiants connus", () => {
		expect(isPieceThemeId(DEFAULT_THEME_ID)).toBe(true);
		expect(isPieceThemeId("synthwave")).toBe(true);
	});

	it("refuse les valeurs inconnues ou non textuelles", () => {
		expect(isPieceThemeId("nope")).toBe(false);
		expect(isPieceThemeId(null)).toBe(false);
		expect(isPieceThemeId(undefined)).toBe(false);
		expect(isPieceThemeId(42)).toBe(false);
		expect(isPieceThemeId({ id: "neon-gem" })).toBe(false);
	});
});

describe("themeCssVars", () => {
	it("mappe la palette sur les variables CSS des pieces", () => {
		const theme = getPieceTheme(DEFAULT_THEME_ID);
		const vars = themeCssVars(theme);

		expect(vars["--piece-i"]).toBe(theme.palette.I);
		expect(vars["--piece-j"]).toBe(theme.palette.J);
		expect(vars["--piece-l"]).toBe(theme.palette.L);
		expect(vars["--piece-o"]).toBe(theme.palette.O);
		expect(vars["--piece-s"]).toBe(theme.palette.S);
		expect(vars["--piece-t"]).toBe(theme.palette.T);
		expect(vars["--piece-z"]).toBe(theme.palette.Z);
	});

	it("ajoute une variable de penalite constante", () => {
		expect(themeCssVars(PIECE_THEMES[0])["--piece-penalty"]).toBe("#2b3350");
		expect(Object.keys(themeCssVars(PIECE_THEMES[1]))).toHaveLength(8);
	});
});
