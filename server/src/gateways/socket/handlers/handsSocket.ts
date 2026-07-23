import type { Socket } from "socket.io";
import { HAND_INPUT_SIZE } from "../../../hands/handDetectionService.js";
import { clearHandsController, handleHandsFrame } from "../../../hands/handsController.js";
import { ensureHandDetector } from "../../../hands/handDetectionService.js";
import { getRoom } from "../../../services/roomService.js";
import { emitPlayersRoom } from "../emitters/roomEmitters.js";

const FRAME_BYTES = HAND_INPUT_SIZE * HAND_INPUT_SIZE * 3;

function toUint8(data: unknown): Uint8Array | null {
	if (data instanceof ArrayBuffer)
		return new Uint8Array(data);
	if (data instanceof Uint8Array)
		return data;
	if (Buffer.isBuffer(data))
		return new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
	return null;
}

export function registerHandsSocket(socket: Socket): void {
	// Le client active/désactive sa caméra. On met à jour l'état "prêt" du joueur (visible
	// dans le lobby) et on rediffuse la liste. Quand il devient prêt, on précharge le
	// modèle pour absorber son temps de chargement avant la partie.
	socket.on("hands:setReady", (data: unknown) => {
		const ready = typeof data === "object" && data !== null && (data as { ready?: unknown }).ready === true;
		const room = getRoom(socket);
		if (!room)
			return;
		const player = room.getPlayers().find((p) => p.getSocketId() === socket.id);
		if (!player)
			return;
		player.setCameraReady(ready);
		if (ready)
			void ensureHandDetector().catch(() => undefined);
		emitPlayersRoom(room.getPlayers());
	});

	// Une image de la webcam (RGB, HAND_INPUT_SIZE²·3 octets). Le serveur détecte la
	// main, décide l'action et l'applique à la partie.
	socket.on("hands:frame", (data: unknown) => {
		const rgb = toUint8(data);
		if (!rgb || rgb.byteLength !== FRAME_BYTES)
			return;
		void handleHandsFrame(socket, rgb);
	});

	socket.on("disconnect", () => {
		clearHandsController(socket.id);
	});
}
