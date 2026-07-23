// Contrôles à la main basés sur le mouvement. L'état temporel est gardé hors de toute
// structure de framework pour rester prévisible et facile à régler.
//
// Schéma de contrôle (décidé produit):
//   - main DROITE poussée vers la GAUCHE  -> pièce à gauche
//   - main GAUCHE poussée vers la DROITE  -> pièce à droite
//   - UNE main vers le bas                -> descente rapide (soft drop)
//   - DEUX mains vers le bas              -> chute directe (hard drop)
//   - POING fermé                         -> rotation (sur le front "ouvert -> poing")

import type { GameAction } from "./actions.js";
import {
	FIST_ROTATE_REPEAT_BLOCK_MS,
	MOTION_HISTORY_MS,
	MOTION_MIRROR_X,
	MOTION_SWIPE_DOMINANCE_RATIO,
	MOTION_SWIPE_HAND_SCALE_RATIO,
	MOTION_SWIPE_MAX_DISTANCE,
	MOTION_SWIPE_MIN_DISTANCE,
	MOTION_SWIPE_MIN_SPEED,
	MOTION_SWIPE_REPEAT_BLOCK_MS,
	MOTION_SWIPE_WINDOW_MS,
	MOTION_TRACK_LOST_MS,
	MOTION_TWO_HAND_DROP_WINDOW_MS,
	LM,
} from "./constants.js";
import { estimateHandScale, isFist } from "./gestures.js";
import type { Handedness, HandLandmarks, Point } from "./gestures.js";

type SwipeDirection = "left" | "right" | "down";

export type MotionInputHand = {
	handedness: Handedness;
	landmarks: HandLandmarks;
};

type MotionSample = {
	time: number;
	palm: Point;
	handScale: number;
};

type TrackedHandMotion = {
	samples: MotionSample[];
	lastSeenAt: number;
	lastSwipeAt: number;
	wasFist: boolean;
	lastFistRotateAt: number;
};

export type MotionState = {
	hands: Partial<Record<Handedness, TrackedHandMotion>>;
	lastDownSwipeAt: Partial<Record<Handedness, number>>;
};

export function createMotionState(): MotionState {
	return { hands: {}, lastDownSwipeAt: {} };
}

function clamp(value: number, min: number, max: number): number {
	return Math.min(max, Math.max(min, value));
}

function mirrorPoint(point: Point): Point {
	if (!MOTION_MIRROR_X) return point;
	// Logique 2D uniquement: z est ignoré (jamais utilisé en aval).
	return { x: 1 - point.x, y: point.y };
}

function averagePoints(points: Point[]): Point | null {
	if (points.length === 0) return null;
	let x = 0;
	let y = 0;
	for (const point of points) {
		x += point.x;
		y += point.y;
	}
	return { x: x / points.length, y: y / points.length };
}

function palmCenter(landmarks: HandLandmarks): Point | null {
	const points = [
		landmarks[LM.WRIST],
		landmarks[LM.INDEX_MCP],
		landmarks[LM.MIDDLE_MCP],
		landmarks[LM.RING_MCP],
		landmarks[LM.PINKY_MCP],
	].filter((point): point is Point => Boolean(point));
	const center = averagePoints(points);
	return center ? mirrorPoint(center) : null;
}

function sampleHand(hand: MotionInputHand, now: number): MotionSample | null {
	const palm = palmCenter(hand.landmarks);
	if (!palm) return null;
	return {
		time: now,
		palm,
		handScale: estimateHandScale(hand.landmarks),
	};
}

function trimSamples(samples: MotionSample[], now: number): MotionSample[] {
	return samples.filter(sample => now - sample.time <= MOTION_HISTORY_MS);
}

function swipeDistanceThreshold(handScale: number): number {
	return clamp(
		handScale * MOTION_SWIPE_HAND_SCALE_RATIO,
		MOTION_SWIPE_MIN_DISTANCE,
		MOTION_SWIPE_MAX_DISTANCE,
	);
}

function detectPalmSwipe(samples: MotionSample[], now: number): SwipeDirection | null {
	const recent = samples.filter(sample => now - sample.time <= MOTION_SWIPE_WINDOW_MS);
	if (recent.length < 2) return null;

	const latest = recent[recent.length - 1]!;
	const threshold = swipeDistanceThreshold(latest.handScale);
	let bestDirection: SwipeDirection | null = null;
	let bestDistance = 0;

	for (let i = 0; i < recent.length - 1; i++) {
		const start = recent[i]!;
		const dt = (latest.time - start.time) / 1000;
		if (dt <= 0) continue;

		const dx = latest.palm.x - start.palm.x;
		const dy = latest.palm.y - start.palm.y;
		const absX = Math.abs(dx);
		const absY = Math.abs(dy);
		const distance = Math.sqrt(dx * dx + dy * dy);
		const speed = distance / dt;
		if (distance <= bestDistance || distance < threshold || speed < MOTION_SWIPE_MIN_SPEED) {
			continue;
		}

		if (absX >= absY * MOTION_SWIPE_DOMINANCE_RATIO) {
			bestDirection = dx > 0 ? "right" : "left";
			bestDistance = distance;
		} else if (dy > 0 && absY >= absX * MOTION_SWIPE_DOMINANCE_RATIO) {
			bestDirection = "down";
			bestDistance = distance;
		}
	}

	return bestDirection;
}

function swipeToAction(handedness: Handedness, direction: SwipeDirection): GameAction | null {
	if (direction === "down") return "DOWN";
	if (handedness === "Left" && direction === "right") return "RIGHT";
	if (handedness === "Right" && direction === "left") return "LEFT";
	return null;
}

function addAction(actions: GameAction[], action: GameAction): void {
	if (!actions.includes(action)) actions.push(action);
}

export function detectMotionActions(
	hands: MotionInputHand[],
	state: MotionState,
	now: number,
): { actions: GameAction[]; next: MotionState } {
	const actions: GameAction[] = [];
	const downSwipes: Handedness[] = [];
	const next: MotionState = {
		hands: { ...state.hands },
		lastDownSwipeAt: { ...state.lastDownSwipeAt },
	};
	const seen = new Set<Handedness>();

	for (const hand of hands) {
		const sample = sampleHand(hand, now);
		if (!sample) continue;

		seen.add(hand.handedness);
		const previous = next.hands[hand.handedness];
		const samples = trimSamples([...(previous?.samples ?? []), sample], now);
		let tracked: TrackedHandMotion = {
			samples,
			lastSeenAt: now,
			lastSwipeAt: previous?.lastSwipeAt ?? 0,
			wasFist: previous?.wasFist ?? false,
			lastFistRotateAt: previous?.lastFistRotateAt ?? 0,
		};

		// Rotation: front montant "main ouverte -> poing". On ne tourne qu'au moment où
		// le poing se ferme, pas tant qu'il reste fermé (sinon rotation en boucle).
		const fistNow = isFist(hand.landmarks);
		if (
			fistNow &&
			!tracked.wasFist &&
			now - tracked.lastFistRotateAt >= FIST_ROTATE_REPEAT_BLOCK_MS
		) {
			addAction(actions, "ROTATE");
			tracked = { ...tracked, lastFistRotateAt: now };
		}
		tracked = { ...tracked, wasFist: fistNow };

		// Un poing fermé ne swipe pas (on ne veut pas déplacer en tournant).
		if (!fistNow && now - tracked.lastSwipeAt >= MOTION_SWIPE_REPEAT_BLOCK_MS) {
			const swipe = detectPalmSwipe(tracked.samples, now);
			if (swipe) {
				const action = swipeToAction(hand.handedness, swipe);
				if (action === "DOWN") {
					downSwipes.push(hand.handedness);
					next.lastDownSwipeAt[hand.handedness] = now;
				} else if (action) {
					addAction(actions, action);
				}
				tracked = {
					...tracked,
					samples: [sample],
					lastSwipeAt: now,
				};
			}
		}

		next.hands[hand.handedness] = tracked;
	}

	for (const handedness of ["Left", "Right"] as const) {
		const tracked = next.hands[handedness];
		if (tracked && !seen.has(handedness) && now - tracked.lastSeenAt > MOTION_TRACK_LOST_MS) {
			delete next.hands[handedness];
		}
		const lastDown = next.lastDownSwipeAt[handedness] ?? 0;
		if (lastDown > 0 && now - lastDown > MOTION_TWO_HAND_DROP_WINDOW_MS) {
			delete next.lastDownSwipeAt[handedness];
		}
	}

	const leftDownAt = next.lastDownSwipeAt.Left ?? 0;
	const rightDownAt = next.lastDownSwipeAt.Right ?? 0;
	const twoHandDown =
		leftDownAt > 0 &&
		rightDownAt > 0 &&
		Math.abs(leftDownAt - rightDownAt) <= MOTION_TWO_HAND_DROP_WINDOW_MS;

	if (twoHandDown) {
		return {
			actions: ["DROP"],
			next: {
				...next,
				lastDownSwipeAt: {},
			},
		};
	}

	if (downSwipes.length > 0) addAction(actions, "DOWN");
	return { actions, next };
}
