// Helpers de détection de gestes, purs (aucune dépendance runtime).

import { FIST_MIN_CURLED_FINGERS, FIST_RATIO_THRESHOLD, LM } from "./constants.js";

export type Point = { x: number; y: number; z?: number };
export type HandLandmarks = Point[];
export type Handedness = "Left" | "Right";

export type HandGesture = {
	handedness: Handedness;
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

export function estimateHandScale(landmarks: HandLandmarks): number {
	const wrist = landmarks[LM.WRIST];
	const middleMcp = landmarks[LM.MIDDLE_MCP];
	const indexMcp = landmarks[LM.INDEX_MCP];
	const pinkyMcp = landmarks[LM.PINKY_MCP];
	const palmLength = wrist && middleMcp ? distance2D(wrist, middleMcp) : 0;
	const palmWidth = indexMcp && pinkyMcp ? distance2D(indexMcp, pinkyMcp) : 0;
	return Math.max(palmLength, palmWidth);
}

// Un doigt est "replié" quand son bout est plus proche (ou aussi proche) du poignet
// que son articulation MCP. Robuste à la rotation de la main (distances relatives).
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
	return { handedness, fist };
}
