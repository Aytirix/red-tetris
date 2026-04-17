// Temporal stability gate: an action must appear for STABILITY_FRAMES_REQUIRED
// consecutive frames before it is confirmed and dispatched.
// This eliminates false positives caused by transient landmark positions.

import type { GameAction } from "./actions";
import { STABILITY_FRAMES_REQUIRED } from "./constants";

export type StabilityState = Partial<Record<GameAction, number>>;

// Pure: given the set of actions requested this frame and the previous frame
// counts, returns which actions are confirmed (stable for long enough) and
// the updated counts to pass to the next frame.
export function updateStability(
	requested: GameAction[],
	state: StabilityState,
	required = STABILITY_FRAMES_REQUIRED,
): { confirmed: GameAction[]; next: StabilityState } {
	const next: StabilityState = {};
	const confirmed: GameAction[] = [];
	const requestedSet = new Set(requested);

	// Increment count for gestures present this frame.
	for (const action of requestedSet) {
		const count = (state[action] ?? 0) + 1;
		next[action] = count;
		if (count >= required) confirmed.push(action);
	}
	// Gestures absent this frame are implicitly reset (not added to next).

	return { confirmed, next };
}
