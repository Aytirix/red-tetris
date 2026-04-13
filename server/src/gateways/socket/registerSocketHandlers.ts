import { Socket } from "socket.io";

export function registerSocketHandlers(socket: Socket): void {
	console.log("A user connected: " + socket.id);
}