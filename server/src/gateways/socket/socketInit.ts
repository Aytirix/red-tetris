import type { Server as HttpServer } from "node:http";
import { Server as SocketIOServer } from "socket.io";

export function initSocket(server: HttpServer) : SocketIOServer {
	const io = new SocketIOServer(server, {
		cors: {
			origin: "http://localhost:5173",
			methods: ["GET", "POST"],
		},
	});

	io.on("connection", (socket) => {
		console.log("A user connected: " + socket.id);

		socket.on("disconnect", () => {
			console.log("User disconnected: " + socket.id);
		});
	});
	return io;
}