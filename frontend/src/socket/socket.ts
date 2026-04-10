import { io, Socket } from "socket.io-client";
import { registerGameListeners } from "./events/game";
import { registerRoomListeners } from "./events/room";

const port = import.meta.env.VITE_PORT;
const BACKEND_URL = `${window.location.protocol}//${window.location.hostname}:${port}`;

export const socket: Socket = io(BACKEND_URL, {
	autoConnect: true,
});

export function registerAllListeners() {
	registerGameListeners(socket);
	registerRoomListeners(socket);
}
