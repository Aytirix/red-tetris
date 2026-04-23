// Motion-based hand controls. Keeps temporal state outside React so the
// detection stays predictable and easy to tune.

import type { GameAction } from "./actions";
import {
	LM,
	MOTION_CIRCLE_CLOSE_RATIO,
	MOTION_CIRCLE_HISTORY_MS,
	MOTION_CIRCLE_MAX_RADIUS,
	MOTION_CIRCLE_MAX_RADIUS_VARIATION_RATIO,
	MOTION_CIRCLE_MIN_ANGLE,
	MOTION_CIRCLE_MIN_DURATION_MS,
	MOTION_CIRCLE_MIN_PATH_RATIO,
	MOTION_CIRCLE_MIN_RADIUS,
	MOTION_CIRCLE_MIN_SAMPLES,
	MOTION_CIRCLE_REPEAT_BLOCK_MS,
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
} from "./constants";
import { distance2D, estimateHandScale } from "./gestures";
import type { Handedness, HandLandmarks, Point } from "./gestures";

type SwipeDirection = "left" | "right" | "down";

export type MotionInputHand = {
	handedness: Handedness;
	landmarks: HandLandmarks;
};

type MotionSample = {
	time: number;
	palm: Point;
	indexTip: Point;
	handScale: number;
};

type TrackedHandMotion = {
	samples: MotionSample[];
	lastSeenAt: number;
	lastSwipeAt: number;
	lastCircleAt: number;
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
	return { x: 1 - point.x, y: point.y, z: point.z };
}

function averagePoints(points: Point[]): Point | null {
	if (points.length === 0) return null;
	let x = 0;
	let y = 0;
	let z = 0;
	let zCount = 0;
	for (const point of points) {
		x += point.x;
		y += point.y;
		if (typeof point.z === "number") {
			z += point.z;
			zCount++;
		}
	}
	return {
		x: x / points.length,
		y: y / points.length,
		z: zCount > 0 ? z / zCount : undefined,
	};
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
	const indexTip = hand.landmarks[LM.INDEX_TIP];
	if (!palm || !indexTip) return null;
	return {
		time: now,
		palm,
		indexTip: mirrorPoint(indexTip),
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

	const latest = recent[recent.length - 1];
	const threshold = swipeDistanceThreshold(latest.handScale);
	let bestDirection: SwipeDirection | null = null;
	let bestDistance = 0;

	for (let i = 0; i < recent.length - 1; i++) {
		const start = recent[i];
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

function normalizeAngleDelta(delta: number): number {
	let next = delta;
	while (next > Math.PI) next -= Math.PI * 2;
	while (next < -Math.PI) next += Math.PI * 2;
	return next;
}

function pathLength(points: Point[]): number {
	let total = 0;
	for (let i = 1; i < points.length; i++) {
		total += distance2D(points[i - 1], points[i]);
	}
	return total;
}

function circleCenter(points: Point[]): Point {
	let x = 0;
	let y = 0;
	for (const point of points) {
		x += point.x;
		y += point.y;
	}
	return { x: x / points.length, y: y / points.length };
}

function isCircleSegment(samples: MotionSample[]): boolean {
	if (samples.length < MOTION_CIRCLE_MIN_SAMPLES) return false;

	const duration = samples[samples.length - 1].time - samples[0].time;
	if (duration < MOTION_CIRCLE_MIN_DURATION_MS) return false;

	const points = samples.map(sample => sample.indexTip);
	const center = circleCenter(points);
	const radii = points.map(point => distance2D(point, center));
	const avgRadius = radii.reduce((sum, radius) => sum + radius, 0) / radii.length;
	if (avgRadius < MOTION_CIRCLE_MIN_RADIUS || avgRadius > MOTION_CIRCLE_MAX_RADIUS) {
		return false;
	}

	const maxRadius = Math.max(...radii);
	const minRadius = Math.min(...radii);
	if (maxRadius - minRadius > avgRadius * MOTION_CIRCLE_MAX_RADIUS_VARIATION_RATIO) {
		return false;
	}

	const first = points[0];
	const last = points[points.length - 1];
	if (distance2D(first, last) > avgRadius * MOTION_CIRCLE_CLOSE_RATIO) {
		return false;
	}

	let totalAngle = 0;
	let previousAngle = Math.atan2(first.y - center.y, first.x - center.x);
	for (let i = 1; i < points.length; i++) {
		const angle = Math.atan2(points[i].y - center.y, points[i].x - center.x);
		totalAngle += normalizeAngleDelta(angle - previousAngle);
		previousAngle = angle;
	}

	return (
		Math.abs(totalAngle) >= MOTION_CIRCLE_MIN_ANGLE &&
		pathLength(points) >= avgRadius * MOTION_CIRCLE_MIN_PATH_RATIO
	);
}

function detectIndexCircle(samples: MotionSample[], now: number): boolean {
	const recent = samples.filter(sample => now - sample.time <= MOTION_CIRCLE_HISTORY_MS);
	if (recent.length < MOTION_CIRCLE_MIN_SAMPLES) return false;

	for (let start = 0; start <= recent.length - MOTION_CIRCLE_MIN_SAMPLES; start++) {
		if (isCircleSegment(recent.slice(start))) return true;
	}
	return false;
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
			lastCircleAt: previous?.lastCircleAt ?? 0,
		};

		if (
			now - tracked.lastCircleAt >= MOTION_CIRCLE_REPEAT_BLOCK_MS &&
			detectIndexCircle(tracked.samples, now)
		) {
			addAction(actions, "ROTATE");
			tracked = {
				...tracked,
				samples: [sample],
				lastCircleAt: now,
			};
		}

		if (now - tracked.lastSwipeAt >= MOTION_SWIPE_REPEAT_BLOCK_MS) {
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
