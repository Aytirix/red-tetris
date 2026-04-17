import type { Socket } from "socket.io";

export function emitUsernameUnavailable(socket: Socket, username: string, reason: string): void {
	socket.emit("user:ResultUsernameAvailable", {
		available: reason, // ou invalid ne pas oublier
		user_faction: null,
		username,
	});
}

export function emitUsernameAvailable(
	socket: Socket,
	username: string,
	userFaction: string | null,
): void {
	socket.emit("user:ResultUsernameAvailable", {
		available: true,
		user_faction: userFaction,
		username,
	});
}