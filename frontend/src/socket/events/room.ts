import { socket } from "../socket";
import type { Socket } from "socket.io-client";

// --- Listeners (enregistrés une seule fois au connect) ---

export function registerRoomListeners(sock: Socket) {
	sock.on("room:joined", (room) => {
		console.log("room:joined", room); // TODO: mettre à jour le store / state
	});

	sock.on("room:left", () => {
		console.log("room:left"); // TODO: mettre à jour le store / state
	});

	sock.on("room:players", (players) => {
		console.log("room:players", players); // TODO: mettre à jour le store / state
	});
}

// --- Emitters (appelables depuis n'importe quel composant) ---

export function emitJoinRoom(roomId: string, playerName: string) {
	socket.emit("room:join", { roomId, playerName });
}

export function emitLeaveRoom() {
	socket.emit("room:leave");
}
