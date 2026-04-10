import { socket } from "../socket";
import type { Socket } from "socket.io-client";

// --- Listeners (enregistrés une seule fois au connect) ---

export function registerUserListeners(sock: Socket) {
}

// --- Emitters (appelables depuis n'importe quel composant) ---

export function emitCheckUsernameAvailable(username: string) {
	socket.emit("user:CheckUsernameAvailable", { username });
}