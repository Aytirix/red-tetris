// Map detected gestures to Tetris actions with per-action cooldowns.

import {
	COOLDOWN_HARD_DROP_MS,
	COOLDOWN_MOVE_MS,
	COOLDOWN_RELEASE_BLOCK_MS,
	COOLDOWN_ROTATE_MS,
	COOLDOWN_SOFT_DROP_MS,
} from "./constants";
import type { HandGesture } from "./gestures";

export type GameAction = "LEFT" | "RIGHT" | "DOWN" | "ROTATE" | "DROP";

export type Cooldowns = Record<GameAction, number>;

export const COOLDOWN_MS: Cooldowns = {
	LEFT: COOLDOWN_MOVE_MS,
	RIGHT: COOLDOWN_MOVE_MS,
	DOWN: COOLDOWN_SOFT_DROP_MS,
	ROTATE: COOLDOWN_ROTATE_MS,
	DROP: COOLDOWN_HARD_DROP_MS,
};

// Pure: decides which actions the current frame *wants* to trigger.
// Rules:
//  - priority absolute to hard drop if both hands are fists
//  - otherwise, per-hand gestures: thumb+middle → left/right (by handedness),
//    thumb+index → rotate, thumb+pinky → soft drop
//  - conflicting left+right on same frame cancels both
export function gesturesToActions(hands: HandGesture[]): GameAction[] {
	if (hands.length === 0) return [];

	// Both hands pinky+thumb simultaneously → hard drop.
	const pinkyCount = hands.filter(h => h.thumbPinky).length;
	if (pinkyCount >= 2) return ["DROP"];

	const actions = new Set<GameAction>();

	for (const h of hands) {
		if (h.thumbMiddle) {
			actions.add(h.handedness === "Right" ? "RIGHT" : "LEFT");
		}
		if (h.thumbIndex) actions.add("ROTATE");
		if (h.thumbPinky) actions.add("DOWN");
	}

	// Cancel conflicting horizontal moves triggered on the same frame.
	if (actions.has("LEFT") && actions.has("RIGHT")) {
		actions.delete("LEFT");
		actions.delete("RIGHT");
	}

	return Array.from(actions);
}

// Pure: filter actions by cooldowns. Returns fired actions + updated timestamps.
// After a DROP, all non-DROP actions are blocked for COOLDOWN_RELEASE_BLOCK_MS.
export function applyCooldowns(
	requested: GameAction[],
	lastFiredAt: Partial<Record<GameAction, number>>,
	now: number,
): { fired: GameAction[]; lastFiredAt: Partial<Record<GameAction, number>> } {
	const fired: GameAction[] = [];
	const next: Partial<Record<GameAction, number>> = { ...lastFiredAt };

	const lastDrop = next["DROP"] ?? 0;
	const dropBlocking = now - lastDrop < COOLDOWN_RELEASE_BLOCK_MS;

	for (const a of requested) {
		if (dropBlocking && a !== "DROP") continue;
		const last = next[a] ?? 0;
		if (now - last >= COOLDOWN_MS[a]) {
			fired.push(a);
			next[a] = now;
		}
	}
	return { fired, lastFiredAt: next };
}
