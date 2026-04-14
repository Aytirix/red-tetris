import type { Server as HttpServer } from "node:http";
import { Server as SocketIOServer } from "socket.io";
import { registerSocketMock } from "./SocketMock.js";
import { socketConfig } from "../../config/socketConfig.js";
import { registerUserSocket } from "./handlers/userSocket.js";
import { registerSocketHandlers } from "./registerSocketHandlers.js";
import { registerSystemSocket } from "./handlers/systemSocket.js";


const isDev = process.env.NODE_ENV === "development";

export function initSocket(server: HttpServer) : SocketIOServer {
	const io = new SocketIOServer(server, socketConfig);

	io.on("connection", (socket) => {
		if (isDev) {
			registerSocketMock(socket);
		}
		registerSocketHandlers(socket);
		registerUserSocket(socket);
		registerSystemSocket(socket);
	});
	return io;
}