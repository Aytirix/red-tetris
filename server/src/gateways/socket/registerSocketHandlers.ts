import { Socket } from "socket.io";
import { userSocketStore } from "./userSocketStore.js";

export function registerSocketHandlers(socket: Socket): void {
	userSocketStore.set(socket.id, {username: null, subscribe: false, socket})
	console.log("A user connected: " + socket.id);
}