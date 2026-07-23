// Mappe les gestes détectés vers des actions de jeu, avec un cooldown par action.

import {
	COOLDOWN_HARD_DROP_MS,
	COOLDOWN_MOVE_MS,
	COOLDOWN_RELEASE_BLOCK_MS,
	COOLDOWN_ROTATE_MS,
	COOLDOWN_SOFT_DROP_MS,
} from "./constants.js";

export type GameAction = "LEFT" | "RIGHT" | "DOWN" | "ROTATE" | "DROP";

export type Cooldowns = Record<GameAction, number>;

export const COOLDOWN_MS: Cooldowns = {
	LEFT: COOLDOWN_MOVE_MS,
	RIGHT: COOLDOWN_MOVE_MS,
	DOWN: COOLDOWN_SOFT_DROP_MS,
	ROTATE: COOLDOWN_ROTATE_MS,
	DROP: COOLDOWN_HARD_DROP_MS,
};

// Pur: filtre les actions par cooldown. Renvoie les actions déclenchées + les
// nouveaux timestamps. Après un DROP, toutes les actions non-DROP sont bloquées
// pendant COOLDOWN_RELEASE_BLOCK_MS.
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
