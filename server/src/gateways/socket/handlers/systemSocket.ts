import { Socket } from "socket.io";
import { userSocketStore } from "../userSocketStore.js";

export function handlerDisconnect(socket: Socket): void {
		socket.on("disconnect", () => {
			console.log("User disconnected: " + socket.id);
			userSocketStore.delete(socket.id)
		});
}