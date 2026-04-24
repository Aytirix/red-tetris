import type { Socket } from "socket.io";
import { handlerRoomJoin, handlerRoomSubscribe } from "./roomHandlers.js";


export function registerRoomSocket(socket: Socket) : void {
	socket.on("room:join", (msg) => {
		handlerRoomJoin(socket, msg)
	})
	socket.on("room:subscribeList", (msg) => {
		handlerRoomSubscribe(socket, msg)
	})
	// socket.on("room:leave")
	// socket.on("room:kick")
	// socket.on("room:setMode")
	// socket.on("room:setPrivate")
	// socket.on("room:start")
	// socket.on("room:unsubscribeList")
}

