// Temporal stability gate: an action must appear for the configured number of
// consecutive frames before it is confirmed and dispatched.
// This eliminates false positives caused by transient landmark positions.

import type { GameAction } from "./actions";
import {
	STABILITY_FRAMES_REQUIRED,
	STABILITY_FRAMES_REQUIRED_BY_ACTION,
} from "./constants";

export type StabilityState = Partial<Record<GameAction, number>>;
export type StabilityRequirement = number | Partial<Record<GameAction, number>>;

function requiredFramesForAction(
	action: GameAction,
	required: StabilityRequirement,
): number {
	const value =
		typeof required === "number"
			? required
			: required[action] ?? STABILITY_FRAMES_REQUIRED;
	return Math.max(1, value);
}

// Pure: given the set of actions requested this frame and the previous frame
// counts, returns which actions are confirmed (stable for long enough) and
// the updated counts to pass to the next frame.
export function updateStability(
	requested: GameAction[],
	state: StabilityState,
	required: StabilityRequirement = STABILITY_FRAMES_REQUIRED_BY_ACTION,
): { confirmed: GameAction[]; next: StabilityState } {
	const next: StabilityState = {};
	const confirmed: GameAction[] = [];
	const requestedSet = new Set(requested);

	// Increment count for gestures present this frame.
	for (const action of requestedSet) {
		const count = (state[action] ?? 0) + 1;
		next[action] = count;
		if (count >= requiredFramesForAction(action, required)) confirmed.push(action);
	}
	// Gestures absent this frame are implicitly reset (not added to next).

	return { confirmed, next };
}
