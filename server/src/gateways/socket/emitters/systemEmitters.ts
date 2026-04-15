import { Socket } from "socket.io";

export function emitError(socket: Socket, event: string, message: string): void {
	socket.emit("system:Error", {
		event,
		message: message,
	});
}