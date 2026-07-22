import { describe, expect, it } from "vitest";
import { FIST_RATIO_THRESHOLD, LM } from "./constants";
import {
	analyzeHand,
	countCurledFingers,
	distance2D,
	estimateHandScale,
	isFingerCurled,
	isFist,
} from "./gestures";
import type { HandLandmarks, Point } from "./gestures";

// ─── Fabrique de mains ────────────────────────────────────────────────────────
// Un doigt est decrit par son "ratio" = distance(tip, poignet) / distance(mcp, poignet).
// La fabrique place les points pour que ce ratio soit exact, ce qui permet de
// tester le seuil de repli au chouia pres.

const WRIST: Point = { x: 0.5, y: 0.9 };
const MCP_DIST = 0.2;

type Finger = "index" | "middle" | "ring" | "pinky";

const FINGER_DX: Record<Finger, number> = {
	index: -0.06,
	middle: -0.02,
	ring: 0.02,
	pinky: 0.06,
};

const FINGER_LM: Record<Finger, { tip: number; mcp: number }> = {
	index: { tip: LM.INDEX_TIP, mcp: LM.INDEX_MCP },
	middle: { tip: LM.MIDDLE_TIP, mcp: LM.MIDDLE_MCP },
	ring: { tip: LM.RING_TIP, mcp: LM.RING_MCP },
	pinky: { tip: LM.PINKY_TIP, mcp: LM.PINKY_MCP },
};

/** Point situe a `dist` du poignet, decale horizontalement de `dx`. */
function pointAtDistance(dx: number, dist: number): Point {
	return { x: WRIST.x + dx, y: WRIST.y - Math.sqrt(dist * dist - dx * dx) };
}

const EXTENDED = 1.9;
const CURLED = 0.5;

function buildHand(ratios: Partial<Record<Finger, number>> = {}): HandLandmarks {
	const landmarks: HandLandmarks = Array.from({ length: 21 }, () => ({ x: 0.5, y: 0.5 }));
	landmarks[LM.WRIST] = { ...WRIST };
	for (const finger of Object.keys(FINGER_LM) as Finger[]) {
		const dx = FINGER_DX[finger];
		const ratio = ratios[finger] ?? EXTENDED;
		landmarks[FINGER_LM[finger].mcp] = pointAtDistance(dx, MCP_DIST);
		landmarks[FINGER_LM[finger].tip] = pointAtDistance(dx, MCP_DIST * ratio);
	}
	return landmarks;
}

const ALL_FINGERS: Finger[] = ["index", "middle", "ring", "pinky"];

/** Main a laquelle il manque un repere (MediaPipe peut renvoyer une liste courte). */
function withoutLandmark(landmarks: HandLandmarks, index: number): HandLandmarks {
	const copy = [...landmarks];
	copy[index] = undefined as unknown as Point;
	return copy;
}

function fistHand(curledCount: number): HandLandmarks {
	const ratios: Partial<Record<Finger, number>> = {};
	for (let i = 0; i < curledCount; i++) ratios[ALL_FINGERS[i]] = CURLED;
	return buildHand(ratios);
}

// ─── distance2D ───────────────────────────────────────────────────────────────

describe("distance2D", () => {
	it("mesure la distance euclidienne dans le plan", () => {
		expect(distance2D({ x: 0, y: 0 }, { x: 3, y: 4 })).toBeCloseTo(5, 12);
		expect(distance2D({ x: 0.2, y: 0.7 }, { x: 0.2, y: 0.7 })).toBe(0);
	});

	it("est symetrique", () => {
		const a = { x: 0.1, y: 0.9 };
		const b = { x: 0.8, y: 0.25 };
		expect(distance2D(a, b)).toBeCloseTo(distance2D(b, a), 12);
	});

	it("ignore la profondeur z fournie par MediaPipe", () => {
		const plat = distance2D({ x: 0, y: 0 }, { x: 1, y: 0 });
		const profond = distance2D({ x: 0, y: 0, z: -5 }, { x: 1, y: 0, z: 12 });
		expect(profond).toBeCloseTo(plat, 12);
	});
});

// ─── estimateHandScale ────────────────────────────────────────────────────────

describe("estimateHandScale", () => {
	it("retient la plus grande des deux mesures de paume", () => {
		const landmarks = buildHand();
		const longueurPaume = distance2D(landmarks[LM.WRIST], landmarks[LM.MIDDLE_MCP]);
		const largeurPaume = distance2D(landmarks[LM.INDEX_MCP], landmarks[LM.PINKY_MCP]);
		expect(longueurPaume).toBeCloseTo(MCP_DIST, 12);
		expect(largeurPaume).toBeLessThan(longueurPaume);
		expect(estimateHandScale(landmarks)).toBeCloseTo(longueurPaume, 12);
	});

	it("bascule sur la largeur quand la paume est vue de profil", () => {
		const landmarks = buildHand();
		// Poignet colle au majeur: la longueur de paume s'effondre, la largeur reste.
		landmarks[LM.WRIST] = { ...landmarks[LM.MIDDLE_MCP] };
		const largeurPaume = distance2D(landmarks[LM.INDEX_MCP], landmarks[LM.PINKY_MCP]);
		expect(estimateHandScale(landmarks)).toBeCloseTo(largeurPaume, 12);
		expect(estimateHandScale(landmarks)).toBeGreaterThan(0);
	});

	it("suit l'echelle de la main a l'ecran", () => {
		const proche = buildHand();
		const loin = proche.map(point => ({ x: 0.5 + (point.x - 0.5) / 4, y: 0.9 + (point.y - 0.9) / 4 }));
		expect(estimateHandScale(loin)).toBeCloseTo(estimateHandScale(proche) / 4, 12);
	});

	it("renvoie 0 quand les reperes de paume manquent", () => {
		expect(estimateHandScale([])).toBe(0);
	});
});

// ─── isFingerCurled ───────────────────────────────────────────────────────────

describe("isFingerCurled", () => {
	it("declare replie un doigt dont le bout se rapproche du poignet", () => {
		const landmarks = buildHand({ index: 0.5 });
		expect(isFingerCurled(landmarks, LM.INDEX_TIP, LM.INDEX_MCP)).toBe(true);
	});

	it("declare tendu un doigt dont le bout depasse le MCP", () => {
		const landmarks = buildHand({ index: 1.9 });
		expect(isFingerCurled(landmarks, LM.INDEX_TIP, LM.INDEX_MCP)).toBe(false);
	});

	it("respecte le seuil au chouia pres", () => {
		const juste = 0.001;
		const sous = buildHand({ index: FIST_RATIO_THRESHOLD - juste });
		const dessus = buildHand({ index: FIST_RATIO_THRESHOLD + juste });
		const pile = buildHand({ index: FIST_RATIO_THRESHOLD });
		expect(isFingerCurled(sous, LM.INDEX_TIP, LM.INDEX_MCP)).toBe(true);
		expect(isFingerCurled(dessus, LM.INDEX_TIP, LM.INDEX_MCP)).toBe(false);
		// Comparaison stricte: pile sur le seuil, le doigt n'est pas replie.
		expect(isFingerCurled(pile, LM.INDEX_TIP, LM.INDEX_MCP)).toBe(false);
	});

	it("accepte un seuil personnalise", () => {
		const landmarks = buildHand({ index: 1.2 });
		expect(isFingerCurled(landmarks, LM.INDEX_TIP, LM.INDEX_MCP)).toBe(false);
		expect(isFingerCurled(landmarks, LM.INDEX_TIP, LM.INDEX_MCP, 1.5)).toBe(true);
		expect(isFingerCurled(landmarks, LM.INDEX_TIP, LM.INDEX_MCP, 1.0)).toBe(false);
	});

	it("est insensible a la rotation de la main", () => {
		const landmarks = buildHand({ index: 0.5 });
		const tournee = landmarks.map(point => {
			const dx = point.x - WRIST.x;
			const dy = point.y - WRIST.y;
			// Rotation de 90 degres autour du poignet.
			return { x: WRIST.x - dy, y: WRIST.y + dx };
		});
		expect(isFingerCurled(tournee, LM.INDEX_TIP, LM.INDEX_MCP)).toBe(true);
	});

	it("refuse de conclure quand un repere manque", () => {
		const landmarks = buildHand({ index: 0.5 });
		expect(isFingerCurled(landmarks, LM.INDEX_TIP, LM.INDEX_MCP)).toBe(true);
		for (const manquant of [LM.WRIST, LM.INDEX_TIP, LM.INDEX_MCP]) {
			expect(isFingerCurled(withoutLandmark(landmarks, manquant), LM.INDEX_TIP, LM.INDEX_MCP))
				.toBe(false);
		}
	});

	it("evite la division par zero quand le MCP est sur le poignet", () => {
		const landmarks = buildHand({ index: 0.5 });
		landmarks[LM.INDEX_MCP] = { ...landmarks[LM.WRIST] };
		expect(isFingerCurled(landmarks, LM.INDEX_TIP, LM.INDEX_MCP)).toBe(false);
	});
});

// ─── countCurledFingers / isFist ──────────────────────────────────────────────

describe("countCurledFingers", () => {
	it("compte exactement les doigts replies", () => {
		for (let n = 0; n <= 4; n++) {
			expect(countCurledFingers(fistHand(n))).toBe(n);
		}
	});

	it("ignore le pouce", () => {
		const landmarks = buildHand();
		// Pouce (tip 4, mcp 2) totalement replie sur le poignet.
		landmarks[4] = { ...WRIST };
		landmarks[2] = pointAtDistance(0, MCP_DIST);
		expect(countCurledFingers(landmarks)).toBe(0);
	});

	it("prend en compte chacun des quatre doigts", () => {
		for (const finger of ALL_FINGERS) {
			const ratios: Partial<Record<Finger, number>> = {};
			ratios[finger] = CURLED;
			expect(countCurledFingers(buildHand(ratios))).toBe(1);
		}
	});
});

describe("isFist", () => {
	it("reconnait un poing ferme", () => {
		expect(isFist(fistHand(4))).toBe(true);
	});

	it("refuse une main a laquelle il reste un doigt tendu", () => {
		expect(isFist(fistHand(3))).toBe(false);
	});

	it("refuse une main ouverte", () => {
		expect(isFist(fistHand(0))).toBe(false);
	});
});

// ─── analyzeHand ──────────────────────────────────────────────────────────────

describe("analyzeHand", () => {
	it("reporte la lateralite telle quelle", () => {
		expect(analyzeHand(fistHand(0), "Left").handedness).toBe("Left");
		expect(analyzeHand(fistHand(0), "Right").handedness).toBe("Right");
	});

	it("s'accorde avec isFist", () => {
		for (let n = 0; n <= 4; n++) {
			const landmarks = fistHand(n);
			expect(analyzeHand(landmarks, "Left").fist).toBe(isFist(landmarks));
		}
		expect(analyzeHand(fistHand(4), "Left").fist).toBe(true);
		expect(analyzeHand(fistHand(3), "Left").fist).toBe(false);
	});
});
