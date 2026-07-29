import type { ShopCatalogEntry } from "../types/shopTypes.js";

export const DEFAULT_THEME_ID = "neon-gem";
export const SHOP_THEMES: ShopCatalogEntry[] = [
	{ id: "neon-gem", price: 0 }, // défaut, possédé par tout le monde
	{ id: "daltonien", price: 12000 },
	{ id: "soft-pastel", price: 25000 },
	{ id: "liquid-glass", price: 40000 },
	{ id: "synthwave", price: 50000 },
	{ id: "jewel", price: 75000 },
];

const byId = new Map(SHOP_THEMES.map((t) => [t.id, t]));

export function getShopTheme(id: string): ShopCatalogEntry | undefined {
	return byId.get(id);
}

export function isShopThemeId(id: unknown): id is string {
	return typeof id === "string" && byId.has(id);
}
