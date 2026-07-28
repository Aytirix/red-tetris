import type { PieceType } from "../types/game";

// ─── Thèmes de pièces (catalogue visuel côté frontend) ─────────────────────────
// Le PRIX est autoritatif côté serveur (config/shopThemes.ts). Ici on garde le
// rendu (recipe -> classe CSS) + la palette des 7 pièces + le libellé/desc.
// Le prix listé sert de repli d'affichage; le catalogue serveur (shop:State)
// prime toujours — garder les deux alignés évite d'afficher un prix périmé le temps
// que `shop:State` arrive.

export type ThemeRecipe = "neon" | "glass" | "minimal" | "synth" | "jewel";

export type PieceTheme = {
	id: string;
	name: string;
	description: string;
	recipe: ThemeRecipe;
	price: number;
	palette: Record<PieceType, string>;
};

export const DEFAULT_THEME_ID = "neon-gem";

export const PIECE_THEMES: PieceTheme[] = [
	{
		id: "neon-gem",
		name: "Neon Gem",
		description: "Gemmes translucides, biseau lumineux et halo coloré. Le style par défaut, façon Tetris Effect.",
		recipe: "neon",
		price: 0,
		palette: { I: "#22E6E6", J: "#3B5BFF", L: "#FF9F1C", O: "#FFD23F", S: "#2EE86E", T: "#B14BFF", Z: "#FF3B6B" },
	},
	{
		id: "daltonien",
		name: "Daltonien",
		description: "Palette Okabe-Ito distinguable en daltonisme. Accessible et parfaitement lisible.",
		recipe: "minimal",
		price: 12000,
		palette: { I: "#56B4E9", J: "#0072B2", L: "#E69F00", O: "#F0E442", S: "#009E73", T: "#CC79A7", Z: "#D55E00" },
	},
	{
		id: "soft-pastel",
		name: "Soft Pastel",
		description: "Flat doux premium, dégradé zénithal et coins arrondis. Épuré et reposant, façon Apple Arcade.",
		recipe: "minimal",
		price: 25000,
		palette: { I: "#38BDF8", J: "#5B8DEF", L: "#FB923C", O: "#FACC5A", S: "#4ADE80", T: "#B57EDC", Z: "#F87171" },
	},
	{
		id: "liquid-glass",
		name: "Verre Liquide",
		description: "Verre dépoli translucide, rim-light blanc et reflet spéculaire. Glassmorphism premium.",
		recipe: "glass",
		price: 40000,
		palette: { I: "#22D3EE", J: "#4F7CFF", L: "#FF9A3C", O: "#FFD84D", S: "#34E27A", T: "#B968FF", Z: "#FF5C7A" },
	},
	{
		id: "synthwave",
		name: "Synthwave",
		description: "Néon synthwave éclatant, cœur blanc et gros halo. Ambiance rétro-arcade Miami.",
		recipe: "synth",
		price: 50000,
		palette: { I: "#00E5FF", J: "#448AFF", L: "#FFAB40", O: "#FFEA00", S: "#39FF14", T: "#EA80FC", Z: "#FF2D6B" },
	},
	{
		id: "jewel",
		name: "Joyaux",
		description: "Cristaux sombres à cœur lumineux et facettes. Le thème le plus somptueux.",
		recipe: "jewel",
		price: 75000,
		palette: { I: "#22D3EE", J: "#4F7CFF", L: "#FF9A3C", O: "#FFD84D", S: "#34E27A", T: "#B968FF", Z: "#FF5C7A" },
	},
];

const byId = new Map(PIECE_THEMES.map((t) => [t.id, t]));

export function getPieceTheme(id: string): PieceTheme {
	return byId.get(id) ?? PIECE_THEMES[0];
}

export function isPieceThemeId(id: unknown): id is string {
	return typeof id === "string" && byId.has(id);
}

// Variables CSS (couleurs des 7 pièces + pénalité) à poser sur un conteneur.
export function themeCssVars(theme: PieceTheme): Record<string, string> {
	return {
		"--piece-i": theme.palette.I,
		"--piece-j": theme.palette.J,
		"--piece-l": theme.palette.L,
		"--piece-o": theme.palette.O,
		"--piece-s": theme.palette.S,
		"--piece-t": theme.palette.T,
		"--piece-z": theme.palette.Z,
		"--piece-penalty": "#2b3350",
	};
}
