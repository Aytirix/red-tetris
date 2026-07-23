import { describe, expect, it } from "vitest";
import type { GameAction } from "./actions";
import {
	LM,
	MOTION_CIRCLE_MAX_RADIUS,
	MOTION_CIRCLE_MIN_RADIUS,
	MOTION_CIRCLE_REPEAT_BLOCK_MS,
	MOTION_SWIPE_MAX_DISTANCE,
	MOTION_SWIPE_MIN_DISTANCE,
	MOTION_SWIPE_REPEAT_BLOCK_MS,
	MOTION_SWIPE_WINDOW_MS,
	MOTION_TRACK_LOST_MS,
	MOTION_TWO_HAND_DROP_WINDOW_MS,
} from "./constants";
import type { Handedness, HandLandmarks, Point } from "./gestures";
import { createMotionState, detectMotionActions } from "./motion";
import type { MotionInputHand, MotionState } from "./motion";

// ─── Fabrique de mains ────────────────────────────────────────────────────────
// Les coordonnees sont celles que MediaPipe renvoie (image camera brute, non
// miroir). `palm` est le centre exact de paume que le detecteur recalculera:
// les cinq points de paume sont poses symetriquement autour de lui, et ecartes
// de `scale` pour que `estimateHandScale` renvoie exactement `scale`.

const DEFAULT_SCALE = 0.2;

function makeHand(
	handedness: Handedness,
	palm: Point,
	indexTip: Point = { x: palm.x, y: palm.y - 0.15 },
	scale = DEFAULT_SCALE,
): MotionInputHand {
	const s = scale / 2;
	const landmarks: HandLandmarks = Array.from({ length: 21 }, () => ({ x: 0.5, y: 0.5 }));
	landmarks[LM.WRIST] = { x: palm.x, y: palm.y + s };
	landmarks[LM.MIDDLE_MCP] = { x: palm.x, y: palm.y - s };
	landmarks[LM.INDEX_MCP] = { x: palm.x - s, y: palm.y };
	landmarks[LM.PINKY_MCP] = { x: palm.x + s, y: palm.y };
	landmarks[LM.RING_MCP] = { x: palm.x, y: palm.y };
	landmarks[LM.INDEX_TIP] = indexTip;
	return { handedness, landmarks };
}

type Frame = { at: number; hands: MotionInputHand[] };

/** Rejoue une suite de frames et retourne les actions frame par frame. */
function play(frames: Frame[], initial: MotionState = createMotionState()) {
	let state = initial;
	const perFrame: GameAction[][] = [];
	for (const frame of frames) {
		const { actions, next } = detectMotionActions(frame.hands, state, frame.at);
		perFrame.push(actions);
		state = next;
	}
	return { perFrame, actions: perFrame.flat(), state };
}

/** Deux frames: la paume glisse de `from` a `to` en `durationMs`. */
function swipeFrames(
	handedness: Handedness,
	from: Point,
	to: Point,
	options: { start?: number; durationMs?: number; scale?: number } = {},
): Frame[] {
	const start = options.start ?? 1000;
	const durationMs = options.durationMs ?? 100;
	const scale = options.scale ?? DEFAULT_SCALE;
	return [
		{ at: start, hands: [makeHand(handedness, from, undefined, scale)] },
		{ at: start + durationMs, hands: [makeHand(handedness, to, undefined, scale)] },
	];
}

const T0 = 5000;

// ─── Etat initial ─────────────────────────────────────────────────────────────

describe("createMotionState", () => {
	it("part d'un etat vide", () => {
		const state = createMotionState();
		expect(state.hands).toEqual({});
		expect(state.lastDownSwipeAt).toEqual({});
	});

	it("renvoie un etat neuf a chaque appel", () => {
		const a = createMotionState();
		const b = createMotionState();
		expect(a).not.toBe(b);
		expect(a.hands).not.toBe(b.hands);
	});
});

describe("detectMotionActions — hygiene", () => {
	it("ne declenche rien sans main", () => {
		const { actions, next } = detectMotionActions([], createMotionState(), T0);
		expect(actions).toEqual([]);
		expect(next.hands).toEqual({});
	});

	it("ne declenche rien sur une seule frame", () => {
		const { actions, next } = detectMotionActions(
			[makeHand("Left", { x: 0.5, y: 0.5 })],
			createMotionState(),
			T0,
		);
		expect(actions).toEqual([]);
		expect(next.hands.Left?.samples).toHaveLength(1);
	});

	it("ignore une main dont les reperes de paume manquent", () => {
		const { actions, next } = detectMotionActions(
			[{ handedness: "Left", landmarks: [] }],
			createMotionState(),
			T0,
		);
		expect(actions).toEqual([]);
		expect(next.hands.Left).toBeUndefined();
	});

	it("ignore une main sans bout d'index", () => {
		const hand = makeHand("Right", { x: 0.5, y: 0.5 });
		hand.landmarks[LM.INDEX_TIP] = undefined as unknown as Point;
		const { actions, next } = detectMotionActions([hand], createMotionState(), T0);
		expect(actions).toEqual([]);
		expect(next.hands.Right).toBeUndefined();
	});

	it("ne mute jamais l'etat recu", () => {
		const frames = swipeFrames("Left", { x: 0.7, y: 0.5 }, { x: 0.5, y: 0.5 }, { start: T0 });
		const state = createMotionState();
		const premier = detectMotionActions(frames[0].hands, state, frames[0].at);
		expect(state.hands).toEqual({});

		const avant = JSON.stringify(premier.next);
		const second = detectMotionActions(frames[1].hands, premier.next, frames[1].at);
		expect(JSON.stringify(premier.next)).toBe(avant);
		expect(second.next).not.toBe(premier.next);
		expect(second.next.hands).not.toBe(premier.next.hands);
	});

	it("suit les deux mains independamment", () => {
		const { state } = play([
			{
				at: T0,
				hands: [makeHand("Left", { x: 0.3, y: 0.5 }), makeHand("Right", { x: 0.7, y: 0.5 })],
			},
		]);
		expect(Object.keys(state.hands).sort()).toEqual(["Left", "Right"]);
	});
});

// ─── Swipes lateraux ──────────────────────────────────────────────────────────

describe("detectMotionActions — swipes lateraux", () => {
	it("traduit un glissement de la main gauche en RIGHT", () => {
		const { actions } = play(swipeFrames("Left", { x: 0.7, y: 0.5 }, { x: 0.5, y: 0.5 }));
		expect(actions).toEqual(["RIGHT"]);
	});

	it("traduit le glissement oppose de la main droite en LEFT", () => {
		const { actions } = play(swipeFrames("Right", { x: 0.3, y: 0.5 }, { x: 0.5, y: 0.5 }));
		expect(actions).toEqual(["LEFT"]);
	});

	it("n'attribue pas a une main le swipe reserve a l'autre", () => {
		// Chaque main ne pilote qu'un seul sens lateral: l'autre est ignore.
		expect(play(swipeFrames("Left", { x: 0.3, y: 0.5 }, { x: 0.5, y: 0.5 })).actions).toEqual([]);
		expect(play(swipeFrames("Right", { x: 0.7, y: 0.5 }, { x: 0.5, y: 0.5 })).actions).toEqual([]);
	});

	it("lit l'image en miroir (vue selfie)", () => {
		// La main droite qui part vers les x croissants dans l'image camera est
		// lue comme un swipe vers la gauche a l'ecran, donc LEFT.
		const versXCroissants = play(swipeFrames("Right", { x: 0.3, y: 0.5 }, { x: 0.5, y: 0.5 }));
		expect(versXCroissants.actions).toEqual(["LEFT"]);
		const versXDecroissants = play(swipeFrames("Left", { x: 0.7, y: 0.5 }, { x: 0.5, y: 0.5 }));
		expect(versXDecroissants.actions).toEqual(["RIGHT"]);
	});

	it("ignore un geste trop court pour la taille de la main", () => {
		// Seuil = 0.2 * 0.8 = 0.16.
		expect(play(swipeFrames("Left", { x: 0.65, y: 0.5 }, { x: 0.5, y: 0.5 })).actions).toEqual([]);
		expect(play(swipeFrames("Left", { x: 0.67, y: 0.5 }, { x: 0.5, y: 0.5 })).actions)
			.toEqual(["RIGHT"]);
	});

	it("impose un plancher de distance meme pour une main minuscule", () => {
		// 0.05 * 0.8 = 0.04, mais le plancher est MOTION_SWIPE_MIN_DISTANCE.
		const petit = { scale: 0.05 };
		expect(MOTION_SWIPE_MIN_DISTANCE).toBeGreaterThan(0.05 * 0.8);
		expect(play(swipeFrames("Left", { x: 0.56, y: 0.5 }, { x: 0.5, y: 0.5 }, petit)).actions)
			.toEqual([]);
		expect(play(swipeFrames("Left", { x: 0.62, y: 0.5 }, { x: 0.5, y: 0.5 }, petit)).actions)
			.toEqual(["RIGHT"]);
	});

	it("impose un plafond de distance pour une main tres proche", () => {
		// 0.5 * 0.8 = 0.4 serait injouable: le seuil est plafonne a MAX_DISTANCE.
		const grand = { scale: 0.5 };
		expect(MOTION_SWIPE_MAX_DISTANCE).toBeLessThan(0.5 * 0.8);
		expect(play(swipeFrames("Left", { x: 0.7, y: 0.5 }, { x: 0.5, y: 0.5 }, grand)).actions)
			.toEqual([]);
		expect(play(swipeFrames("Left", { x: 0.8, y: 0.5 }, { x: 0.5, y: 0.5 }, grand)).actions)
			.toEqual(["RIGHT"]);
	});

	it("ignore un deplacement trop lent", () => {
		const petit = { scale: 0.05 };
		const lent = { ...petit, durationMs: MOTION_SWIPE_WINDOW_MS };
		const rapide = { ...petit, durationMs: 200 };
		expect(play(swipeFrames("Left", { x: 0.61, y: 0.5 }, { x: 0.5, y: 0.5 }, lent)).actions)
			.toEqual([]);
		expect(play(swipeFrames("Left", { x: 0.61, y: 0.5 }, { x: 0.5, y: 0.5 }, rapide)).actions)
			.toEqual(["RIGHT"]);
	});

	it("oublie un geste etale au-dela de la fenetre de swipe", () => {
		const horsFenetre = { durationMs: MOTION_SWIPE_WINDOW_MS + 40 };
		expect(
			play(swipeFrames("Left", { x: 0.7, y: 0.5 }, { x: 0.5, y: 0.5 }, horsFenetre)).actions,
		).toEqual([]);
		expect(
			play(swipeFrames("Left", { x: 0.7, y: 0.5 }, { x: 0.5, y: 0.5 }, { durationMs: MOTION_SWIPE_WINDOW_MS })).actions,
		).toEqual(["RIGHT"]);
	});

	it("ignore un geste en diagonale a 45 degres", () => {
		const { actions } = play(swipeFrames("Left", { x: 0.7, y: 0.3 }, { x: 0.5, y: 0.5 }));
		expect(actions).toEqual([]);
	});

	it("retient le plus grand deplacement de la fenetre", () => {
		// Trois positions de paume (miroir: 0.30 -> 0.42 -> 0.62 en x, 0.50 -> 0.75 en y).
		//   - le premier pas est trop court pour declencher quoi que ce soit;
		//   - le dernier pas seul serait lu comme une descente (0.32 de long);
		//   - le mouvement complet est plus long (0.41) et lateral: c'est lui qui gagne.
		const { perFrame } = play([
			{ at: T0, hands: [makeHand("Left", { x: 0.7, y: 0.5 })] },
			{ at: T0 + 100, hands: [makeHand("Left", { x: 0.58, y: 0.5 })] },
			{ at: T0 + 200, hands: [makeHand("Left", { x: 0.38, y: 0.75 })] },
		]);
		expect(perFrame[1]).toEqual([]);
		expect(perFrame[2]).toEqual(["RIGHT"]);
	});
});

// ─── Swipes verticaux ─────────────────────────────────────────────────────────

describe("detectMotionActions — descente", () => {
	it("traduit un glissement vers le bas en DOWN, quelle que soit la main", () => {
		for (const handedness of ["Left", "Right"] as const) {
			const { actions } = play(swipeFrames(handedness, { x: 0.5, y: 0.3 }, { x: 0.5, y: 0.5 }));
			expect(actions).toEqual(["DOWN"]);
		}
	});

	it("ignore un geste vers le haut", () => {
		const { actions } = play(swipeFrames("Left", { x: 0.5, y: 0.5 }, { x: 0.5, y: 0.3 }));
		expect(actions).toEqual([]);
	});

	it("memorise l'instant de la descente pour le drop a deux mains", () => {
		const { state } = play(swipeFrames("Left", { x: 0.5, y: 0.3 }, { x: 0.5, y: 0.5 }));
		expect(state.lastDownSwipeAt.Left).toBe(1100);
		expect(state.lastDownSwipeAt.Right).toBeUndefined();
	});

	it("combine une descente d'une main et un lateral de l'autre", () => {
		const { actions } = play([
			{
				at: T0,
				hands: [makeHand("Left", { x: 0.7, y: 0.5 }), makeHand("Right", { x: 0.5, y: 0.3 })],
			},
			{
				at: T0 + 100,
				hands: [makeHand("Left", { x: 0.5, y: 0.5 }), makeHand("Right", { x: 0.5, y: 0.5 })],
			},
		]);
		expect(actions).toEqual(["RIGHT", "DOWN"]);
	});

	it("oublie une descente isolee passee la fenetre du drop", () => {
		const { state } = play([
			{ at: T0, hands: [makeHand("Left", { x: 0.5, y: 0.3 })] },
			{ at: T0 + 100, hands: [makeHand("Left", { x: 0.5, y: 0.5 })] },
			{
				at: T0 + 100 + MOTION_TWO_HAND_DROP_WINDOW_MS + 1,
				hands: [makeHand("Left", { x: 0.5, y: 0.5 })],
			},
		]);
		expect(state.lastDownSwipeAt.Left).toBeUndefined();
	});
});

// ─── Drop a deux mains ────────────────────────────────────────────────────────

describe("detectMotionActions — drop a deux mains", () => {
	it("declenche DROP quand les deux paumes descendent ensemble", () => {
		const { perFrame, state } = play([
			{
				at: T0,
				hands: [makeHand("Left", { x: 0.4, y: 0.3 }), makeHand("Right", { x: 0.6, y: 0.3 })],
			},
			{
				at: T0 + 100,
				hands: [makeHand("Left", { x: 0.4, y: 0.5 }), makeHand("Right", { x: 0.6, y: 0.5 })],
			},
		]);
		// DROP remplace le DOWN: une seule action est remontee.
		expect(perFrame[1]).toEqual(["DROP"]);
		// Les instants sont consommes pour ne pas re-declencher le drop.
		expect(state.lastDownSwipeAt).toEqual({});
	});

	it("accepte un leger decalage entre les deux mains", () => {
		const gaucheFixe = makeHand("Left", { x: 0.4, y: 0.5 });
		const { perFrame } = play([
			{
				at: T0,
				hands: [makeHand("Left", { x: 0.4, y: 0.3 }), makeHand("Right", { x: 0.6, y: 0.3 })],
			},
			{
				at: T0 + 100,
				hands: [gaucheFixe, makeHand("Right", { x: 0.6, y: 0.3 })],
			},
			{
				at: T0 + 100 + MOTION_TWO_HAND_DROP_WINDOW_MS,
				hands: [gaucheFixe, makeHand("Right", { x: 0.6, y: 0.5 })],
			},
		]);
		expect(perFrame[1]).toEqual(["DOWN"]);
		expect(perFrame[2]).toEqual(["DROP"]);
	});

	it("refuse un decalage trop grand entre les deux mains", () => {
		const gaucheFixe = makeHand("Left", { x: 0.4, y: 0.5 });
		const { perFrame } = play([
			{
				at: T0,
				hands: [makeHand("Left", { x: 0.4, y: 0.3 }), makeHand("Right", { x: 0.6, y: 0.3 })],
			},
			{
				at: T0 + 100,
				hands: [gaucheFixe, makeHand("Right", { x: 0.6, y: 0.3 })],
			},
			{
				at: T0 + 101 + MOTION_TWO_HAND_DROP_WINDOW_MS,
				hands: [gaucheFixe, makeHand("Right", { x: 0.6, y: 0.5 })],
			},
		]);
		expect(perFrame[1]).toEqual(["DOWN"]);
		expect(perFrame[2]).toEqual(["DOWN"]);
	});
});

// ─── Re-armement des swipes ───────────────────────────────────────────────────

describe("detectMotionActions — re-armement des swipes", () => {
	it("bloque un second swipe trop rapproche puis le laisse repasser", () => {
		const gauche = (x: number, at: number): Frame => ({
			at,
			hands: [makeHand("Left", { x, y: 0.5 })],
		});
		const bloque = play([
			gauche(0.7, T0),
			gauche(0.5, T0 + 100),
			gauche(0.7, T0 + 200),
			gauche(0.5, T0 + 300),
		]);
		expect(bloque.actions).toEqual(["RIGHT"]);

		const relance = play([
			gauche(0.7, T0),
			gauche(0.5, T0 + 100),
			gauche(0.7, T0 + 100 + MOTION_SWIPE_REPEAT_BLOCK_MS),
			gauche(0.5, T0 + 200 + MOTION_SWIPE_REPEAT_BLOCK_MS),
		]);
		expect(relance.actions).toEqual(["RIGHT", "RIGHT"]);
	});
});

// ─── Perte de suivi ───────────────────────────────────────────────────────────

describe("detectMotionActions — perte de suivi", () => {
	it("garde la main quelques frames apres sa disparition", () => {
		const { state } = play([
			{ at: T0, hands: [makeHand("Left", { x: 0.5, y: 0.5 })] },
			{ at: T0 + MOTION_TRACK_LOST_MS, hands: [] },
		]);
		expect(state.hands.Left).toBeDefined();
	});

	it("oublie la main quand elle reste absente trop longtemps", () => {
		const { state } = play([
			{ at: T0, hands: [makeHand("Left", { x: 0.5, y: 0.5 })] },
			{ at: T0 + MOTION_TRACK_LOST_MS + 1, hands: [] },
		]);
		expect(state.hands.Left).toBeUndefined();
	});

	it("ne purge pas une main toujours visible", () => {
		const { state } = play([
			{ at: T0, hands: [makeHand("Left", { x: 0.5, y: 0.5 })] },
			{ at: T0 + 10_000, hands: [makeHand("Left", { x: 0.5, y: 0.5 })] },
		]);
		expect(state.hands.Left).toBeDefined();
		// L'historique est purge des echantillons trop vieux.
		expect(state.hands.Left?.samples).toHaveLength(1);
	});
});

// ─── Cercle d'index → ROTATE ──────────────────────────────────────────────────

/** Points d'une ellipse parcourue dans le sens horaire, `count` echantillons. */
function ellipseFrames(options: {
	rx: number;
	ry?: number;
	count: number;
	stepMs: number;
	sweep?: number;
	center?: Point;
	start?: number;
}): Frame[] {
	const { rx, count, stepMs } = options;
	const ry = options.ry ?? rx;
	const sweep = options.sweep ?? (Math.PI * 2 * (count - 1)) / count;
	const center = options.center ?? { x: 0.5, y: 0.35 };
	const start = options.start ?? T0;
	const palm = { x: 0.5, y: 0.6 };
	return Array.from({ length: count }, (_, i) => {
		const angle = (sweep * i) / (count - 1);
		const tip = { x: center.x + rx * Math.cos(angle), y: center.y + ry * Math.sin(angle) };
		return { at: start + i * stepMs, hands: [makeHand("Left", palm, tip)] };
	});
}

describe("detectMotionActions — cercle d'index", () => {
	it("declenche ROTATE sur un cercle complet et lent", () => {
		const { actions } = play(ellipseFrames({ rx: 0.06, count: 12, stepMs: 40 }));
		expect(actions).toEqual(["ROTATE"]);
	});

	it("ne declenche rien sur une ligne droite", () => {
		const palm = { x: 0.5, y: 0.6 };
		const frames = Array.from({ length: 12 }, (_, i) => ({
			at: T0 + i * 40,
			hands: [makeHand("Left", palm, { x: 0.44 + i * 0.012, y: 0.35 })],
		}));
		expect(play(frames).actions).toEqual([]);
	});

	it("ne declenche rien sur un aller-retour le long d'un arc", () => {
		const palm = { x: 0.5, y: 0.6 };
		const angles = [
			...Array.from({ length: 13 }, (_, i) => (Math.PI * i) / 12),
			...Array.from({ length: 12 }, (_, i) => (Math.PI * (11 - i)) / 12),
		];
		const frames = angles.map((angle, i) => ({
			at: T0 + i * 40,
			hands: [
				makeHand("Left", palm, {
					x: 0.5 + 0.06 * Math.cos(angle),
					y: 0.35 + 0.06 * Math.sin(angle),
				}),
			],
		}));
		expect(play(frames).actions).toEqual([]);
	});

	it("ne declenche rien sur un cercle trop petit", () => {
		expect(MOTION_CIRCLE_MIN_RADIUS).toBeGreaterThan(0.01);
		expect(play(ellipseFrames({ rx: 0.01, count: 12, stepMs: 40 })).actions).toEqual([]);
	});

	it("ne declenche rien sur un cercle trop grand", () => {
		expect(MOTION_CIRCLE_MAX_RADIUS).toBeLessThan(0.25);
		expect(play(ellipseFrames({ rx: 0.25, count: 12, stepMs: 40 })).actions).toEqual([]);
	});

	it("ne declenche rien sur un ovale trop aplati", () => {
		expect(play(ellipseFrames({ rx: 0.12, ry: 0.03, count: 12, stepMs: 40 })).actions).toEqual([]);
	});

	it("ne declenche rien sur un cercle trace trop vite", () => {
		expect(play(ellipseFrames({ rx: 0.06, count: 12, stepMs: 20 })).actions).toEqual([]);
	});

	it("ne declenche rien sur un demi-tour", () => {
		expect(play(ellipseFrames({ rx: 0.06, count: 12, stepMs: 40, sweep: Math.PI })).actions)
			.toEqual([]);
	});

	it("espace deux rotations d'au moins le temps de re-armement", () => {
		const frames = Array.from({ length: 60 }, (_, i) => {
			const angle = (Math.PI * 2 * i) / 12;
			return {
				at: T0 + i * 40,
				hands: [
					makeHand(
						"Left",
						{ x: 0.5, y: 0.6 },
						{ x: 0.5 + 0.06 * Math.cos(angle), y: 0.35 + 0.06 * Math.sin(angle) },
					),
				],
			};
		});
		const { perFrame } = play(frames);
		const instants = frames
			.map((frame, i) => (perFrame[i].includes("ROTATE") ? frame.at : null))
			.filter((at): at is number => at !== null);

		expect(instants.length).toBeGreaterThanOrEqual(2);
		for (let i = 1; i < instants.length; i++) {
			expect(instants[i] - instants[i - 1]).toBeGreaterThanOrEqual(MOTION_CIRCLE_REPEAT_BLOCK_MS);
		}
		// La rotation ne doit pas non plus etre remontee plusieurs fois d'affilee.
		for (const actions of perFrame) {
			expect(actions.filter(a => a === "ROTATE")).toHaveLength(actions.includes("ROTATE") ? 1 : 0);
		}
	});
});
