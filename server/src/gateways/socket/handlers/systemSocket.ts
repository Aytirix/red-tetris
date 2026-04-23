import { Socket } from "socket.io";
import { userSocketStore } from "../userSocketStore.js";
import { roomSocketStore } from "../roomSocketStore.js";
import { removePlayer } from "../../../services/roomService.js";

export function handlerDisconnect(socket: Socket): void {
		socket.on("disconnect", () => {
			console.log("User disconnected: " + socket.id);
			removePlayer(socket)
			userSocketStore.delete(socket.id)
		});
}