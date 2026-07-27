import type { Socket } from "socket.io";
import { handleDrop, handleJoker, handleMove, handleRoomKick, handleRoomMode, handleRoomRestart, handleRoomSetPrivate, handleRoomStart, handleRotate, handleSubscribeSpectator, handleUnsubscribeSpectator, handlerRoomJoin, handlerRoomLeave, handlerRoomSubscribe, handlerRoomUnsubscribe} from "./roomHandlers.js";
import { emitError } from "../emitters/systemEmitters.js";


export function registerRoomSocket(socket: Socket) : void {
	// SEUL handler asynchrone du domaine (acces Prisma via createPlayer). Sans ce
	// .catch, une base indisponible produit un rejet non gere: le client n'obtient ni
	// room:joined ni system:Error et reste bloque a vie sur « Connexion a la room… ».
	// On repond donc explicitement, comme le font deja user/shop/stats.
	socket.on("room:join", (msg) => {
		handlerRoomJoin(socket, msg).catch((error) => {
			console.error("room:join failed:", error)
			emitError(socket, "room:join", "Failed to join room")
		})
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
