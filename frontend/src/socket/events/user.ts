import { socket } from "../socket";

// --- Emitters (appelables depuis n'importe quel composant) ---

export function emitCheckUsernameAvailable(username: string) {
	socket.emit("user:CheckUsernameAvailable", { username });
}