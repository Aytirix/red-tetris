import { describe, expect, it } from "vitest";
import {
	CHEVRON_ARM,
	CHEVRON_END_Y,
	CHEVRON_GEOMETRY,
	CHEVRON_LAYERS,
	CHEVRON_MID_Y,
	CHEVRON_SCALE,
	getChevronArm,
} from "./chevronGeometry";

// Reference: le SVG d'origine, avant sa suppression (le sujet interdit SVG).
//   pirate : <path d="M10 5 L17 12 L10 19" stroke-width="7" puis "3.8"
//   marine : <path d="M14 5 L7 12 L14 19" ... />
//   viewBox 0 0 24 24, rendu dans une boite de 38px, linecap/linejoin "round".
// Les valeurs attendues ci-dessous sont derivees a la main de ce trace, jamais du
// code teste: si la geometrie derive, ces tests tombent.
const S = 38 / 24;
const PIRATE_APEX = { x: 17 * S, y: 12 * S };
const MARINE_APEX = { x: 7 * S, y: 12 * S };
const PIRATE_ENDS = [{ x: 10 * S, y: 5 * S }, { x: 10 * S, y: 19 * S }];
const MARINE_ENDS = [{ x: 14 * S, y: 5 * S }, { x: 14 * S, y: 19 * S }];

/** Sommet reellement peint = intersection des medianes du carre tourne a 45deg. */
function renderedApexX(thickness: number, isPirate: boolean): number {
	const { size, centerX } = getChevronArm(thickness, isPirate);
	const halfDiagonal = (Math.SQRT2 / 2) * (size - thickness);
	return isPirate ? centerX + halfDiagonal : centerX - halfDiagonal;
}

/** Extremite libre du bras = bord plat du bord peint, avant le disque de linecap. */
function renderedArmLength(thickness: number, isPirate: boolean): number {
	return getChevronArm(thickness, isPirate).size - thickness / 2;
}

describe("chevronGeometry — fidelite au trace SVG d'origine", () => {
	it("place le sommet exactement sur le point du trace, quelle que soit l'epaisseur", () => {
		for (const layer of CHEVRON_LAYERS) {
			expect(renderedApexX(layer.thickness, true)).toBeCloseTo(PIRATE_APEX.x, 6);
			expect(renderedApexX(layer.thickness, false)).toBeCloseTo(MARINE_APEX.x, 6);
		}
	});

	it("donne des bras de la longueur du segment d'origine", () => {
		// |(17,12) - (10,5)| = 7*racine(2), mis a l'echelle.
		expect(CHEVRON_ARM).toBeCloseTo(Math.hypot(7, 7) * S, 6);
		for (const layer of CHEVRON_LAYERS)
			for (const isPirate of [true, false])
				expect(renderedArmLength(layer.thickness, isPirate)).toBeCloseTo(CHEVRON_ARM, 6);
	});

	it("pose les disques de linecap sur les extremites du trace", () => {
		expect(CHEVRON_MID_Y).toBeCloseTo(PIRATE_APEX.y, 6);
		expect(CHEVRON_GEOMETRY.pirate.endX).toBeCloseTo(PIRATE_ENDS[0].x, 6);
		expect(CHEVRON_GEOMETRY.marine.endX).toBeCloseTo(MARINE_ENDS[0].x, 6);
		expect(CHEVRON_END_Y[0]).toBeCloseTo(PIRATE_ENDS[0].y, 6);
		expect(CHEVRON_END_Y[1]).toBeCloseTo(PIRATE_ENDS[1].y, 6);
		// Les extremites sont symetriques autour du sommet.
		expect(CHEVRON_END_Y[0] + CHEVRON_END_Y[1]).toBeCloseTo(2 * CHEVRON_MID_Y, 6);
	});

	it("reproduit les deux epaisseurs de trait du SVG (7 et 3.8)", () => {
		expect(CHEVRON_LAYERS).toHaveLength(2);
		expect(CHEVRON_LAYERS[0].thickness).toBeCloseTo(7 * S, 6);
		expect(CHEVRON_LAYERS[1].thickness).toBeCloseTo(3.8 * S, 6);
		// L'ordre compte: le liseré sombre et epais est peint SOUS le trait clair.
		expect(CHEVRON_LAYERS[0].thickness).toBeGreaterThan(CHEVRON_LAYERS[1].thickness);
		expect(CHEVRON_LAYERS[0].color).toContain("7, 12, 22");
		expect(CHEVRON_LAYERS[0].opacity).toBeCloseTo(0.52, 6);
		expect(CHEVRON_LAYERS[1].color).toContain("255, 252, 247");
		expect(CHEVRON_LAYERS[1].opacity).toBe(1);
		// Couleurs opaques obligatoires: l alpha est porte par le groupe, pas par la couleur.
		for (const layer of CHEVRON_LAYERS)
			expect(layer.color.startsWith("rgb(")).toBe(true);
	});

	it("oriente les deux factions en miroir", () => {
		expect(CHEVRON_GEOMETRY.pirate.sign).toBe(-1);
		expect(CHEVRON_GEOMETRY.marine.sign).toBe(1);
		for (const layer of CHEVRON_LAYERS) {
			const pirate = getChevronArm(layer.thickness, true);
			const marine = getChevronArm(layer.thickness, false);
			expect(pirate.size).toBeCloseTo(marine.size, 6);
			// Le carre porteur est decale du sommet du meme ecart, en sens oppose.
			expect(PIRATE_APEX.x - pirate.centerX).toBeCloseTo(marine.centerX - MARINE_APEX.x, 6);
		}
	});

	it("garde le carre plus grand que son epaisseur (bras non degenere)", () => {
		for (const layer of CHEVRON_LAYERS)
			for (const isPirate of [true, false])
				expect(getChevronArm(layer.thickness, isPirate).size).toBeGreaterThan(layer.thickness);
	});

	it("expose l'echelle du viewBox d'origine", () => {
		expect(CHEVRON_SCALE).toBeCloseTo(38 / 24, 12);
	});
});
