import type { Socket } from "socket.io";

export const userSocketStore = new Map<string, {username: string | null, subscribe: boolean}>();

export function isUsernameTaken(
	userSocketStore: Map<string, {username: string | null; subscribe: boolean}>,
	username: string,
	socket: Socket
): boolean {
	for (const [socketId, storedName] of userSocketStore) {
		if (socketId !== socket.id && storedName.username === username) {
			return true;
		}
	}
	return false;
}

export function getNameById(socket: Socket) : string | null {
	for (const [socketId, storedName] of userSocketStore) {
		if (socket.id === socketId)
			return storedName.username
	}
	return null
}