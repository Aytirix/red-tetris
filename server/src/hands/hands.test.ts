import { describe, it, expect } from "vitest";
import { analyzeHand, countCurledFingers, distance2D, estimateHandScale, isFingerCurled, isFist } from "./gestures.js";
import type { HandLandmarks } from "./gestures.js";
import { applyCooldowns } from "./actions.js";
import { createMotionState, detectMotionActions } from "./motion.js";
import { LM } from "./constants.js";

// Construit 21 landmarks. Paume centrée sur (px, py); poignet 0.1 sous la paume; MCP
// étalés horizontalement (échelle de main réaliste). Doigts étendus (au-dessus) ou
// repliés (ramenés sur le poignet) selon `fist`.
function hand(px: number, py: number, fist: boolean): HandLandmarks {
	const lm: { x: number; y: number }[] = Array.from({ length: 21 }, () => ({ x: px, y: py }));
	lm[LM.WRIST] = { x: px, y: py + 0.1 };
	lm[LM.INDEX_MCP] = { x: px - 0.03, y: py };
	lm[LM.MIDDLE_MCP] = { x: px, y: py };
	lm[LM.RING_MCP] = { x: px + 0.03, y: py };
	lm[LM.PINKY_MCP] = { x: px + 0.06, y: py };
	const tipY = fist ? py + 0.09 : py - 0.12; // replié = proche du poignet, étendu = loin
	lm[LM.INDEX_TIP] = { x: px - 0.03, y: tipY };
	lm[LM.MIDDLE_TIP] = { x: px, y: tipY };
	lm[LM.RING_TIP] = { x: px + 0.03, y: tipY };
	lm[LM.PINKY_TIP] = { x: px + 0.06, y: tipY };
	return lm;
}

describe("gestures", () => {
	it("distance2D calcule la distance euclidienne", () => {
		expect(distance2D({ x: 0, y: 0 }, { x: 3, y: 4 })).toBe(5);
	});

	it("estimateHandScale renvoie la plus grande dimension de la paume", () => {
		expect(estimateHandScale(hand(0.5, 0.5, false))).toBeCloseTo(0.1, 6);
	});

	it("isFingerCurled distingue un doigt replié d'un doigt étendu", () => {
		expect(isFingerCurled(hand(0.5, 0.5, true), LM.INDEX_TIP, LM.INDEX_MCP)).toBe(true);
		expect(isFingerCurled(hand(0.5, 0.5, false), LM.INDEX_TIP, LM.INDEX_MCP)).toBe(false);
	});

	it("isFingerCurled est faux si un landmark manque", () => {
		const partial = hand(0.5, 0.5, true);
		delete (partial as unknown as unknown[])[LM.INDEX_TIP];
		expect(isFingerCurled(partial, LM.INDEX_TIP, LM.INDEX_MCP)).toBe(false);
	});

	it("countCurledFingers et isFist détectent un poing fermé", () => {
		expect(countCurledFingers(hand(0.5, 0.5, true))).toBe(4);
		expect(isFist(hand(0.5, 0.5, true))).toBe(true);
		expect(countCurledFingers(hand(0.5, 0.5, false))).toBe(0);
		expect(isFist(hand(0.5, 0.5, false))).toBe(false);
	});

	it("analyzeHand renvoie la latéralité et l'état de poing", () => {
		expect(analyzeHand(hand(0.5, 0.5, true), "Left")).toEqual({ handedness: "Left", fist: true });
		expect(analyzeHand(hand(0.5, 0.5, false), "Right")).toEqual({ handedness: "Right", fist: false });
	});
});

describe("actions — applyCooldowns", () => {
	it("laisse passer une action jamais déclenchée", () => {
		const { fired } = applyCooldowns(["LEFT"], {}, 1000);
		expect(fired).toEqual(["LEFT"]);
	});

	it("bloque une action tant que son cooldown n'est pas écoulé", () => {
		const r1 = applyCooldowns(["LEFT"], {}, 1000);
		const r2 = applyCooldowns(["LEFT"], r1.lastFiredAt, 1050); // < 150ms
		expect(r2.fired).toEqual([]);
		const r3 = applyCooldowns(["LEFT"], r1.lastFiredAt, 1200); // >= 150ms
		expect(r3.fired).toEqual(["LEFT"]);
	});

	it("bloque toutes les actions sauf DROP juste après un DROP", () => {
		const afterDrop = applyCooldowns(["DROP"], {}, 1000);
		const blocked = applyCooldowns(["LEFT", "ROTATE"], afterDrop.lastFiredAt, 1100); // < 350ms
		expect(blocked.fired).toEqual([]);
	});
});

describe("motion — décision d'action côté serveur", () => {
	it("ROTATE au front montant main ouverte -> poing, une seule fois", () => {
		let state = createMotionState();
		// Main ouverte d'abord.
		let r = detectMotionActions([{ handedness: "Right", landmarks: hand(0.5, 0.5, false) }], state, 1000);
		state = r.next;
		expect(r.actions).not.toContain("ROTATE");
		// Poing fermé -> rotation.
		r = detectMotionActions([{ handedness: "Right", landmarks: hand(0.5, 0.5, true) }], state, 1050);
		state = r.next;
		expect(r.actions).toContain("ROTATE");
		// Toujours fermé -> pas de nouvelle rotation.
		r = detectMotionActions([{ handedness: "Right", landmarks: hand(0.5, 0.5, true) }], state, 1100);
		expect(r.actions).not.toContain("ROTATE");
	});

	it("un swipe horizontal déclenche un déplacement (mapping latéralité/miroir)", () => {
		let state = createMotionState();
		// Main gauche, x brut décroissant -> après miroir, mouvement vers la droite -> RIGHT.
		let r = detectMotionActions([{ handedness: "Left", landmarks: hand(0.75, 0.5, false) }], state, 2000);
		state = r.next;
		r = detectMotionActions([{ handedness: "Left", landmarks: hand(0.3, 0.5, false) }], state, 2150);
		expect(r.actions).toContain("RIGHT");
	});

	it("deux mains vers le bas simultanément -> DROP", () => {
		let state = createMotionState();
		// Warm-up avec les deux mains hautes.
		let r = detectMotionActions([
			{ handedness: "Left", landmarks: hand(0.4, 0.3, false) },
			{ handedness: "Right", landmarks: hand(0.6, 0.3, false) },
		], state, 3000);
		state = r.next;
		// Les deux descendent franchement.
		r = detectMotionActions([
			{ handedness: "Left", landmarks: hand(0.4, 0.75, false) },
			{ handedness: "Right", landmarks: hand(0.6, 0.75, false) },
		], state, 3150);
		expect(r.actions).toEqual(["DROP"]);
	});

	it("oublie une main non revue après le délai de perte de suivi", () => {
		let state = createMotionState();
		let r = detectMotionActions([{ handedness: "Left", landmarks: hand(0.5, 0.5, false) }], state, 4000);
		state = r.next;
		expect(state.hands.Left).toBeDefined();
		// Aucune main pendant > MOTION_TRACK_LOST_MS (350ms).
		r = detectMotionActions([], state, 4500);
		expect(r.next.hands.Left).toBeUndefined();
	});
});
