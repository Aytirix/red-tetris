import { socket } from "../socket";
import type { Socket } from "socket.io-client";

// --- Listeners (enregistrés une seule fois au connect) ---

export function registerUserListeners(sock: Socket) {
	sock.on("user:ResultUsernameAvailable", (data) => {
		console.log("user:ResultUsernameAvailable", data);
		localStorage.setItem("username", data.available.toString());
	});
}

// --- Emitters (appelables depuis n'importe quel composant) ---

export function emitCheckUsernameAvailable(username: string) {
	socket.emit("user:CheckUsernameAvailable", { username });
}