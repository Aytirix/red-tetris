import { describe, it, expect } from "vitest";
import { DEFAULT_THEME_ID, SHOP_THEMES, getShopTheme, isShopThemeId } from "./shopThemes.js";

describe("shopThemes", () => {
	describe("catalogue", () => {
		it("contains the default theme, free", () => {
			const defaultTheme = SHOP_THEMES.find((theme) => theme.id === DEFAULT_THEME_ID);
			expect(defaultTheme).toBeDefined();
			expect(defaultTheme!.price).toBe(0);
		});

		it("has unique ids and non-negative prices", () => {
			const ids = SHOP_THEMES.map((theme) => theme.id);
			expect(new Set(ids).size).toBe(ids.length);
			for (const theme of SHOP_THEMES) expect(theme.price).toBeGreaterThanOrEqual(0);
		});
	});

	describe("getShopTheme", () => {
		it("returns the catalogue entry of a known theme", () => {
			expect(getShopTheme("daltonien")).toEqual({ id: "daltonien", price: 2500 });
		});

		it("returns undefined for an unknown theme", () => {
			expect(getShopTheme("theme-pirate")).toBeUndefined();
		});
	});

	describe("isShopThemeId", () => {
		it("accepts every catalogue id", () => {
			for (const theme of SHOP_THEMES) expect(isShopThemeId(theme.id)).toBe(true);
		});

		it("refuses an unknown id", () => {
			expect(isShopThemeId("inconnu")).toBe(false);
		});

		it("refuses non-string values", () => {
			expect(isShopThemeId(null)).toBe(false);
			expect(isShopThemeId(undefined)).toBe(false);
			expect(isShopThemeId(42)).toBe(false);
			expect(isShopThemeId({ id: "neon-gem" })).toBe(false);
		});
	});
});
