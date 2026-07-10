import { socket } from "../socket";
import type { Socket } from "socket.io-client";

// --- Listeners (enregistrés une seule fois au connect) ---

export function registerGameListeners(sock: Socket) {
	sock.on("game:start", (data) => {
		if (import.meta.env.DEV) console.log("game:start", data); // TODO: mettre à jour le store / state
	});

	sock.on("game:update", (state) => {
		if (import.meta.env.DEV) console.log("game:update", state); // TODO: mettre à jour le store / state
	});

	sock.on("game:over", (result) => {
		if (import.meta.env.DEV) console.log("game:over", result); // TODO: mettre à jour le store / state
	});
}

// --- Emitters (appelables depuis n'importe quel composant) ---

export function emitGameMove(direction: "left" | "right" | "down") {
	socket.emit("game:move", { direction });
}

export function emitGameRotate() {
	socket.emit("game:rotate");
}

export function emitGameDrop() {
	socket.emit("game:drop");
}

export function emitSubscribeSpectator(roomId: string, user: string | null) {
	socket.emit("game:subscribeSpectatorGame", { roomId, user });
}

export function emitUnsubscribeSpectator() {
	socket.emit("game:unsubscribeSpectatorGame", {});
}
