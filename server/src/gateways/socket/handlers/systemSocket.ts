import { Socket } from "socket.io";

export function registerSystemSocket(socket: Socket): void {
		socket.on("disconnect", () => {
			console.log("User disconnected: " + socket.id);
		});
}