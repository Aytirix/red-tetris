import type { ShopCatalogEntry } from "../types/shopTypes.js";

// Catalogue AUTORITATIF des thèmes de pièces.
// Le prix vit ici (serveur) — le frontend ne fait que l'afficher, l'achat est
// toujours validé côté serveur contre ce catalogue.
// Le rendu visuel (recipe + palette) est défini côté frontend (pieceThemes.ts).

export const DEFAULT_THEME_ID = "neon-gem";

// Prix ×5 par rapport au barème d'origine : le score (converti en berrys en fin de
// partie) suit désormais le barème Tetris Guideline, multiplié par le niveau en solo,
// soit ~5× les gains d'avant sur une bonne partie. Sans ce rattrapage, le catalogue
// entier se débloquait en deux parties. Repère : le thème le plus cher vaut environ
// quatre bonnes parties solo, comme avant.
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
