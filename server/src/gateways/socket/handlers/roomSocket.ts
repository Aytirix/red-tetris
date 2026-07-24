import type { Socket } from "socket.io";
import { handleDrop, handleJoker, handleMove, handleRoomKick, handleRoomMode, handleRoomRestart, handleRoomSetPrivate, handleRoomStart, handleRotate, handleSubscribeSpectator, handleUnsubscribeSpectator, handlerRoomJoin, handlerRoomLeave, handlerRoomSubscribe, handlerRoomUnsubscribe} from "./roomHandlers.js";


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
	socket.on("room:restart", (msg) => {
		handleRoomRestart(socket, msg)
	})
	socket.on("game:move", (msg) => {
		handleMove(socket, msg)
	})
	socket.on("game:rotate", (msg)=> {
		handleRotate(socket, msg)
	})
	socket.on("game:drop", (msg) => {
		handleDrop(socket, msg)
	})
	socket.on("game:joker", (msg) => {
		handleJoker(socket, msg)
	})
	socket.on("game:subscribeSpectatorGame", (msg) => {
		handleSubscribeSpectator(socket, msg)
	})
	socket.on("game:unsubscribeSpectatorGame", (msg) => {
		handleUnsubscribeSpectator(socket, msg)
	})
}
