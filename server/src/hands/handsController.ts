// Contrôleur "mains" par joueur, côté serveur. Reçoit une image, détecte la main,
// décide l'action et l'applique DIRECTEMENT à la partie du joueur. C'est le serveur
// qui décide (gauche/droite/descente/chute/rotation), pas le client.

import type { Socket } from "socket.io";
import { detectHands } from "./handDetectionService.js";
import type { GameAction } from "./actions.js";
import { applyCooldowns } from "./actions.js";
import { createMotionState, detectMotionActions } from "./motion.js";
import type { MotionState } from "./motion.js";
import { getRoom } from "../services/roomService.js";

type HandsPlayerState = {
	motion: MotionState;
	cooldowns: Partial<Record<GameAction, number>>;
	// Anti-surcharge: le modèle WASM est unique, on saute les frames d'un joueur tant
	// que sa détection précédente n'est pas terminée.
	busy: boolean;
};

const players = new Map<string, HandsPlayerState>();

function getPlayerState(socketId: string): HandsPlayerState {
	let state = players.get(socketId);
	if (!state) {
		state = { motion: createMotionState(), cooldowns: {}, busy: false };
		players.set(socketId, state);
	}
	return state;
}

export function clearHandsController(socketId: string): void {
	players.delete(socketId);
}

// Applique une action de jeu au joueur via son moteur. move/rotate/drop revérifient
// eux-mêmes que le socket est bien un joueur vivant de la partie.
function applyAction(socket: Socket, action: GameAction): void {
	const room = getRoom(socket);
	const game = room?.getGame();
	if (!game) return;
	switch (action) {
		case "LEFT": game.move(socket.id, "left"); break;
		case "RIGHT": game.move(socket.id, "right"); break;
		case "DOWN": game.move(socket.id, "down"); break;
		case "ROTATE": game.rotate(socket.id); break;
		case "DROP": game.drop(socket.id); break;
	}
}

// Traite une frame RGB (HAND_INPUT_SIZE²·3 octets) envoyée par un joueur. `now` est
// injectable pour les tests (horloge déterministe); en production c'est Date.now().
export async function handleHandsFrame(socket: Socket, rgb: Uint8Array, now: number = Date.now()): Promise<void> {
	// Court-circuit rapide: pas de partie en cours pour ce socket -> rien à faire.
	const game = getRoom(socket)?.getGame();
	if (!game) return;

	const state = getPlayerState(socket.id);
	if (state.busy) return;
	state.busy = true;
	try {
		const detected = await detectHands(rgb);
		const { actions, next } = detectMotionActions(
			detected.map((h) => ({ handedness: h.handedness, landmarks: h.landmarks })),
			state.motion,
			now,
		);
		state.motion = next;
		const { fired, lastFiredAt } = applyCooldowns(actions, state.cooldowns, now);
		state.cooldowns = lastFiredAt;
		for (const action of fired)
			applyAction(socket, action);
	} catch {
		// Une frame ratée ne doit jamais casser la boucle: on ignore et on continue.
	} finally {
		state.busy = false;
	}
}
