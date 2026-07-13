import type { ShopCatalogEntry } from "../types/shopTypes.js";

// Catalogue AUTORITATIF des thèmes de pièces.
// Le prix vit ici (serveur) — le frontend ne fait que l'afficher, l'achat est
// toujours validé côté serveur contre ce catalogue.
// Le rendu visuel (recipe + palette) est défini côté frontend (pieceThemes.ts).

export const DEFAULT_THEME_ID = "neon-gem";

export const SHOP_THEMES: ShopCatalogEntry[] = [
	{ id: "neon-gem", price: 0 }, // défaut, possédé par tout le monde
	{ id: "daltonien", price: 2500 },
	{ id: "soft-pastel", price: 5000 },
	{ id: "liquid-glass", price: 8000 },
	{ id: "synthwave", price: 10000 },
	{ id: "jewel", price: 15000 },
];

const byId = new Map(SHOP_THEMES.map((t) => [t.id, t]));

export function getShopTheme(id: string): ShopCatalogEntry | undefined {
	return byId.get(id);
}

export function isShopThemeId(id: unknown): id is string {
	return typeof id === "string" && byId.has(id);
}
