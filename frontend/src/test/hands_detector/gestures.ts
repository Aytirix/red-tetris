// Pure gesture-detection helpers. No React, no DOM, no `this`.

import {
	FINGER_TOUCH_DISTANCE,
	FINGER_TOUCH_HAND_SCALE_RATIO,
	FINGER_TOUCH_MAX_DISTANCE,
	FINGER_TOUCH_MIN_DISTANCE,
	FINGER_TOUCH_SEMI_CLOSED_RATIO,
	FINGER_TOUCH_Z_WEIGHT,
	FIST_MIN_CURLED_FINGERS,
	FIST_RATIO_THRESHOLD,
	LM,
	SEMI_FIST_THRESHOLD,
} from "./constants";

export type Point = { x: number; y: number; z?: number };
export type HandLandmarks = Point[];
export type Handedness = "Left" | "Right";

export type HandGesture = {
	handedness: Handedness;
	thumbIndex: boolean;
	thumbMiddle: boolean;
	thumbPinky: boolean;
	fist: boolean;
};

export function distance2D(a: Point, b: Point): number {
	const dx = a.x - b.x;
	const dy = a.y - b.y;
	return Math.sqrt(dx * dx + dy * dy);
}

function distance2DSquared(a: Point, b: Point): number {
	const dx = a.x - b.x;
	const dy = a.y - b.y;
	return dx * dx + dy * dy;
}

function distance3DSquared(a: Point, b: Point): number {
	const dx = a.x - b.x;
	const dy = a.y - b.y;
	const dz =
		typeof a.z === "number" && typeof b.z === "number"
			? (a.z - b.z) * FINGER_TOUCH_Z_WEIGHT
			: 0;
	return dx * dx + dy * dy + dz * dz;
}

function clamp(value: number, min: number, max: number): number {
	return Math.min(max, Math.max(min, value));
}

export function estimateHandScale(landmarks: HandLandmarks): number {
	const wrist = landmarks[LM.WRIST];
	const middleMcp = landmarks[LM.MIDDLE_MCP];
	const indexMcp = landmarks[LM.INDEX_MCP];
	const pinkyMcp = landmarks[LM.PINKY_MCP];
	const palmLength = wrist && middleMcp ? distance2D(wrist, middleMcp) : 0;
	const palmWidth = indexMcp && pinkyMcp ? distance2D(indexMcp, pinkyMcp) : 0;
	return Math.max(palmLength, palmWidth);
}

export function touchThresholdForHand(
	landmarks: HandLandmarks,
	fallback = FINGER_TOUCH_DISTANCE,
): number {
	const scale = estimateHandScale(landmarks);
	if (scale <= 0) return fallback;
	return clamp(
		scale * FINGER_TOUCH_HAND_SCALE_RATIO,
		FINGER_TOUCH_MIN_DISTANCE,
		FINGER_TOUCH_MAX_DISTANCE,
	);
}

export function fingersTouching(
	landmarks: HandLandmarks,
	tipA: number,
	tipB: number,
	threshold = touchThresholdForHand(landmarks),
): boolean {
	const a = landmarks[tipA];
	const b = landmarks[tipB];
	if (!a || !b) return false;
	return distance3DSquared(a, b) < threshold * threshold;
}

// A finger counts as "curled" when its tip is closer (or equal) to the wrist
// than its MCP joint. Robust to hand rotation since we use relative distances.
export function isFingerCurled(
	landmarks: HandLandmarks,
	tipIdx: number,
	mcpIdx: number,
	ratioThreshold = FIST_RATIO_THRESHOLD,
): boolean {
	const wrist = landmarks[LM.WRIST];
	const tip = landmarks[tipIdx];
	const mcp = landmarks[mcpIdx];
	if (!wrist || !tip || !mcp) return false;
	const tipToWrist = Math.sqrt(distance2DSquared(tip, wrist));
	const mcpToWrist = Math.sqrt(distance2DSquared(mcp, wrist));
	if (mcpToWrist === 0) return false;
	return tipToWrist / mcpToWrist < ratioThreshold;
}

const NON_THUMB_FINGERS: Array<[number, number]> = [
	[LM.INDEX_TIP, LM.INDEX_MCP],
	[LM.MIDDLE_TIP, LM.MIDDLE_MCP],
	[LM.RING_TIP, LM.RING_MCP],
	[LM.PINKY_TIP, LM.PINKY_MCP],
];

export function countCurledFingers(landmarks: HandLandmarks): number {
	let count = 0;
	for (const [tip, mcp] of NON_THUMB_FINGERS) {
		if (isFingerCurled(landmarks, tip, mcp)) count++;
	}
	return count;
}

export function isFist(landmarks: HandLandmarks): boolean {
	return countCurledFingers(landmarks) >= FIST_MIN_CURLED_FINGERS;
}

export function analyzeHand(
	landmarks: HandLandmarks,
	handedness: Handedness,
): HandGesture {
	const curled = countCurledFingers(landmarks);
	const fist = curled >= FIST_MIN_CURLED_FINGERS;
	const semiClosed = curled >= SEMI_FIST_THRESHOLD;
	const touchThreshold = touchThresholdForHand(landmarks);
	const pinchThreshold = semiClosed
		? touchThreshold * FINGER_TOUCH_SEMI_CLOSED_RATIO
		: touchThreshold;
	const canDetectPinch = !fist;
	const thumbIndex =
		canDetectPinch && fingersTouching(landmarks, LM.THUMB_TIP, LM.INDEX_TIP, pinchThreshold);
	const thumbMiddle =
		canDetectPinch && fingersTouching(landmarks, LM.THUMB_TIP, LM.MIDDLE_TIP, pinchThreshold);
	const thumbPinky =
		canDetectPinch && fingersTouching(landmarks, LM.THUMB_TIP, LM.PINKY_TIP, pinchThreshold);
	return { handedness, thumbIndex, thumbMiddle, thumbPinky, fist };
}
