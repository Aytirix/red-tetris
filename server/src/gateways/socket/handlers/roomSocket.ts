import type { Socket } from "socket.io";
import { handleRoomKick, handleRoomMode, handleRoomSetPrivate, handleRoomStart, handlerRoomJoin, handlerRoomLeave, handlerRoomSubscribe, handlerRoomUnsubscribe} from "./roomHandlers.js";


export function registerRoomSocket(socket: Socket) : void {
	socket.on("room:join", (msg) => {
		handlerRoomJoin(socket, msg)
	})
	socket.on("room:subscribeList", (msg) => {
		handlerRoomSubscribe(socket, msg)
	})
	socket.on("room:unsubscribeList", (msg) => {
		handlerRoomUnsubscribe(socket, msg)
	})
	socket.on("room:leave", (msg) => {
		handlerRoomLeave(socket, msg)
	})
	socket.on("room:kick", (msg) => {
		handleRoomKick(socket, msg)
	})
	socket.on("room:setMode", (msg) => {
		handleRoomMode(socket, msg)
	})
	socket.on("room:setPrivate", (msg) => {
		handleRoomSetPrivate(socket, msg)
	})
	socket.on("room:start", (msg) => {
		handleRoomStart(socket, msg)
	})
}

