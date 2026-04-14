import { Socket } from "socket.io";
import { userSocketStore } from "./userSocketStore.js";

export function registerSocketHandlers(socket: Socket): void {
	userSocketStore.set(socket.id, null)
	console.log("A user connected: " + socket.id);
	console.log("test")
}