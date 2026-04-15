import type { Socket } from "socket.io";

export const userSocketStore = new Map<string, string | null>();

export function isUsernameTaken(
	userSocketStore: Map<string, string | null>,
	username: string,
	socket: Socket
): boolean {
	for (const [socketId, storedName] of userSocketStore) {
		if (socketId !== socket.id && storedName === username) {
			return true;
		}
	}
	return false;
}