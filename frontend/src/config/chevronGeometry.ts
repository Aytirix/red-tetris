// Geometrie du chevron de la poignee de bord (page d'accueil), transcrite depuis le
// SVG d'origine que le sujet interdit desormais: viewBox 24x24 rendu en 38px (facteur
// 38/24), trace "M10 5 L17 12 L10 19" (pirate) et "M14 5 L7 12 L14 19" (marine), avec
// strokeLinecap et strokeLinejoin "round", en deux epaisseurs (7 et 3.8).
//
// Chaque couche est rendue par un carre tourne a 45deg dont seuls deux bords sont
// peints (les deux bras), plus un disque de diametre = epaisseur centre sur chaque
// extremite. Le disque est la transcription exacte d'un linecap rond: un simple
// border-radius de coin donne un quart de rond asymetrique, pas un demi-disque centre
// sur la ligne mediane.
//
// Module pur et sans etat: c'est ce qui rend la geometrie verifiable par des tests.

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

// La couleur est OPAQUE et l'alpha porte par `opacity` sur le groupe de la couche:
// un trace SVG est peint d'un seul tenant, alors qu'ici une couche est faite de trois
// elements (le carre des deux bras + un disque de linecap a chaque extremite). Avec une
// couleur semi-transparente, la moitie de chaque disque qui recouvre le bras cumulerait
// son alpha (0.52 -> 1-(1-0.52)^2 = 0.77) et produirait deux demi-lunes plus sombres.
export const CHEVRON_LAYERS = [
	{ color: "rgb(7, 12, 22)", opacity: 0.52, thickness: 7 * CHEVRON_SCALE },
	{ color: "rgb(255, 252, 247)", opacity: 1, thickness: 3.8 * CHEVRON_SCALE },
];

/**
 * Carre porteur des deux bras d'une couche.
 *
 * Le cote vaut `bras + epaisseur/2`: la mediane du bord peint s'arrete alors pile sur
 * l'extremite du trace, et le disque de linecap prend le relais au-dela. Le centre est
 * recale de `(racine(2)/2)(bras - epaisseur/2)` pour que le sommet du chevron retombe
 * exactement sur `apexX`, quelle que soit l'epaisseur de la couche.
 */
export function getChevronArm(thickness: number, isPirate: boolean): { size: number; centerX: number } {
	const geometry = isPirate ? CHEVRON_GEOMETRY.pirate : CHEVRON_GEOMETRY.marine;
	const size = CHEVRON_ARM + thickness / 2;
	const apexOffset = (Math.SQRT2 / 2) * (CHEVRON_ARM - thickness / 2);
	return { size, centerX: geometry.apexX + geometry.sign * apexOffset };
}
