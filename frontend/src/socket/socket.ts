import { io, Socket } from "socket.io-client";
import { getBackendUrl } from "../config/backendUrl";
export const socket: Socket = io(getBackendUrl(), {
	autoConnect: true,
});
