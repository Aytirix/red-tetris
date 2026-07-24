import { io, Socket } from "socket.io-client";
import { registerGameListeners } from "./events/game";
import { registerRoomListeners } from "./events/room";
import { registerUserListeners } from "./events/user";

// En DEV, le front (Vite, ex. :5173) et le back (:3000) sont sur des origines
// différentes : on cible explicitement le port du backend (VITE_PORT).
// En PROD, le backend sert la SPA ET le socket sur la MÊME origine (derrière le reverse
// proxy du domaine) : on se connecte en same-origin, sans port figé — sinon on taperait
// un :3000 non exposé publiquement et le socket ne se connecterait jamais.
const BACKEND_URL = import.meta.env.DEV
	? `${window.location.protocol}//${window.location.hostname}:${import.meta.env.VITE_PORT}`
	: window.location.origin;

export const socket: Socket = io(BACKEND_URL, {
	autoConnect: true,
});

export function registerAllListeners() {
	registerGameListeners(socket);
	registerRoomListeners(socket);
	registerUserListeners(socket);
}
