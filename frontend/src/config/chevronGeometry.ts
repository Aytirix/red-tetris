
export const CHEVRON_SCALE = 38 / 24;

/** Longueur d'un bras: le segment (7, 7) du viewBox, mis a l'echelle. */
export const CHEVRON_ARM = Math.SQRT2 * 7 * CHEVRON_SCALE;

/** Ordonnee du sommet, commune aux deux factions. */
export const CHEVRON_MID_Y = 12 * CHEVRON_SCALE;

/** Ordonnees des deux extremites du trace. */
export const CHEVRON_END_Y = [5 * CHEVRON_SCALE, 19 * CHEVRON_SCALE];

export const CHEVRON_GEOMETRY = {
	pirate: { apexX: 17 * CHEVRON_SCALE, endX: 10 * CHEVRON_SCALE, sign: -1 },
	marine: { apexX: 7 * CHEVRON_SCALE, endX: 14 * CHEVRON_SCALE, sign: 1 },
};
export const CHEVRON_LAYERS = [
	{ color: "rgb(7, 12, 22)", opacity: 0.52, thickness: 7 * CHEVRON_SCALE },
	{ color: "rgb(255, 252, 247)", opacity: 1, thickness: 3.8 * CHEVRON_SCALE },
];

/** Carre porteur des deux bras d'une couche. */
export function getChevronArm(thickness: number, isPirate: boolean): { size: number; centerX: number } {
	const geometry = isPirate ? CHEVRON_GEOMETRY.pirate : CHEVRON_GEOMETRY.marine;
	const size = CHEVRON_ARM + thickness / 2;
	const apexOffset = (Math.SQRT2 / 2) * (CHEVRON_ARM - thickness / 2);
	return { size, centerX: geometry.apexX + geometry.sign * apexOffset };
}
