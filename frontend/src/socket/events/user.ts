import { socket } from "../socket";
import type { Socket } from "socket.io-client";

// --- Listeners (enregistrés une seule fois au connect) ---

export function registerGameListeners(sock: Socket) {
	sock.on("game:start", (data) => {
		console.log("game:start", data); // TODO: mettre à jour le store / state
	});

	sock.on("game:update", (state) => {
		console.log("game:update", state); // TODO: mettre à jour le store / state
	});

	sock.on("game:over", (result) => {
		console.log("game:over", result); // TODO: mettre à jour le store / state
	});
}

// --- Emitters (appelables depuis n'importe quel composant) ---

export function emitGameMove(direction: "left" | "right" | "down") {
	socket.emit("user:checkUsernameAviable", { direction });
}