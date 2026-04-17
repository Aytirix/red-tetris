// Pure gesture-detection helpers. No React, no DOM, no `this`.

import {
	FINGER_TOUCH_DISTANCE,
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

export function fingersTouching(
	landmarks: HandLandmarks,
	tipA: number,
	tipB: number,
	threshold = FINGER_TOUCH_DISTANCE,
): boolean {
	return distance2D(landmarks[tipA], landmarks[tipB]) < threshold;
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
	const tipToWrist = distance2D(landmarks[tipIdx], wrist);
	const mcpToWrist = distance2D(landmarks[mcpIdx], wrist);
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
	// Pre-emption: as soon as ≥ SEMI_FIST_THRESHOLD fingers start curling,
	// kill all pinch detections to prevent false positives during transition.
	const semiClosed = curled >= SEMI_FIST_THRESHOLD;
	const thumbIndex = !semiClosed && fingersTouching(landmarks, LM.THUMB_TIP, LM.INDEX_TIP);
	const thumbMiddle = !semiClosed && fingersTouching(landmarks, LM.THUMB_TIP, LM.MIDDLE_TIP);
	const thumbPinky = !semiClosed && fingersTouching(landmarks, LM.THUMB_TIP, LM.PINKY_TIP);
	return { handedness, thumbIndex, thumbMiddle, thumbPinky, fist };
}
