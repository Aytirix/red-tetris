import { Socket } from "socket.io";

export function emitInvalidPayloadError(socket: Socket, event: string): void {
	socket.emit("system:Error", {
		event,
		message: "Invalid payload",
	});
}