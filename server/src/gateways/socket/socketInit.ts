import type { Server as HttpServer } from "node:http";
import { Server as SocketIOServer } from "socket.io";
import { socketConfig } from "../../config/socketConfig.js";
import { handlerDisconnect } from "./handlers/systemSocket.js";
import { registerUserSocket } from "./handlers/userSocket.js";
import { registerSocketHandlers } from "./registerSocketHandlers.js";
import { registerSocketMock } from "./SocketMock.js";
import { registerRoomSocket } from "./handlers/roomSocket.js";
import { registerShopSocket } from "./handlers/shopSocket.js";

const isDev = process.env.NODE_ENV === "development";

export function initSocket(server: HttpServer) : SocketIOServer {
	const io = new SocketIOServer(server, socketConfig);

	io.on("connection", (socket) => {
		if (isDev)
			registerSocketMock(socket);
		registerSocketHandlers(socket);
		registerUserSocket(socket);
		registerRoomSocket(socket)
		registerShopSocket(socket)
		handlerDisconnect(socket);
	});
	return io;
}