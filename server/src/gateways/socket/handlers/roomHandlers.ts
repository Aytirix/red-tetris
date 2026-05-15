import type { Socket } from "socket.io";
import { isValidRoomJoinPayload, isValidRoomKickPayload, isValidRoomModePayload, isValidRoomName, isValidRoomSetPrivatePayload } from "../validators/validateRoomEvent.js";
import { emitError } from "../emitters/systemEmitters.js";
import { roomSocketStore } from "../roomSocketStore.js";
import { createRoom, getRoom } from "../../../services/roomService.js";
import { emitPlayersRoom, emitRoomJoined, emitRoomSettings, emitSubscrib } from "../emitters/roomEmitters.js";
import { userSocketStore } from "../userSocketStore.js";
import { Game } from "../../../core/Game.js";

export async function handlerRoomJoin(socket: Socket, payload: unknown): Promise<void> {
	if (!isValidRoomJoinPayload(payload)) {
		emitError(socket, "room:join", "Invalid payload");
		console.log("Error: payload invalid");
		return;
	}
	if (!isValidRoomName(payload.roomId)) {
		emitError(socket, "room:join", "Invalid roomId");
		console.log("Error: roomId invalid");
		return;
	}
	const room = roomSocketStore.get(payload.roomId)
	if (!room) {
		const newRoom = await createRoom(socket, payload.roomId)
		if (!newRoom) {
			emitError(socket, "room:join", "Failed to create room");
			return;
		}
		console.log("Room created: ", newRoom.name)
		roomSocketStore.set(payload.roomId, newRoom)
		emitRoomJoined(socket, newRoom)
	}
	else {
		emitRoomJoined(socket, room)
	}
}

export function handlerRoomSubscribe(socket: Socket, payload: unknown) : void {
	if (!payload) {
		const session = userSocketStore.get(socket.id)
		if (session)
			session.subscribe = true;
		emitSubscrib();
	}
}

export function handlerRoomUnsubscribe(socket: Socket, payload: unknown) : void {
	if (!payload) {
		const session = userSocketStore.get(socket.id)
		if (session)
			session.subscribe = false
	}
}

export function handlerRoomLeave(socket: Socket, payload: unknown) : void {
	if (!payload) {
		const room = getRoom(socket)
		if (!room)
			return
		const removed = room.removePlayerBySocketId(socket.id)
		if (!removed)
			return
		if (room.countPlayer() === 0)
			roomSocketStore.delete(room.name)
		socket.emit("room:left")
		emitSubscrib()
	}
}

export function handleRoomKick(socket: Socket, payload: unknown) : void {
	if (!isValidRoomKickPayload(payload)) {
		emitError(socket, "room:kick", "Invalid payload");
		console.log("Error: payload invalid");
		return;
	}
	const username = payload.username
	const room = getRoom(socket)
	if (!room)
		return
	if (!room.searchName(username)) {
		emitError(socket, "room:kick", "Invalid username");
		console.log("Error: username invalid for kick");
		return;
	}
	if (!room.removePlayerByName(socket.id, username)) {
		emitError(socket, "room:kick", "Only host can kick players");
		console.log("Error: Only host can kick players");
		return;
	}
	emitPlayersRoom(room.getPlayers())
}

export function handleRoomMode(socket: Socket, payload: unknown) : void {
	if (!isValidRoomModePayload(payload)) {
		emitError(socket, "room:setMode", "Invalid payload");
		console.log("Error: payload invalid");
		return;
	}
	const mode = payload.mode
	const room = getRoom(socket)
	if (!room)
		return
	if (!room.setMode(mode, socket)) {
		emitError(socket, "room:setMode", "Invalid Mode or Not Host");
		console.log("Error: Invalid Mode or Not Host");
		return;
	}
	emitRoomSettings(room)
}

export function handleRoomSetPrivate(socket: Socket, payload: unknown) : void {
	if (!isValidRoomSetPrivatePayload(payload)) {
		emitError(socket, "room:setPrivate", "Invalid payload");
		console.log("Error: payload invalid");
		return;
	}
	const room = getRoom(socket)
	const visibility = payload.private
	if (!room)
		return
	if (!room.setPrivate(visibility, socket)) {
		emitError(socket, "room:setPrivate", "only host can change visibility");
		console.log("Error: Invalid Mode or only host can change visibility");
		return;
	}
	emitRoomSettings(room)
}

export function handleRoomStart(socket: Socket, payload: unknown) : void {
	if (!payload) {
		const room = getRoom(socket)
		if (!room)
			return
		const mode = room.getMode()
		const players = room.getPlayers()
		const game = new Game(mode, players)
		if (socket.id === room.getHostId()) {
			room.setStatus("playing")
			room.setGame(game)
			game.start()
		}
	}
}

export function handleMove(socket: Socket, payload: unknown) : void {
	if (
		!payload ||
		typeof payload !== "object" ||
		!("direction" in payload) ||
		(payload.direction !== "left" && payload.direction !== "right" && payload.direction !== "down")
	) {
		emitError(socket, "game:move", "Invalid payload");
		return
	}

	const room = getRoom(socket)
	if (!room)
		return
	const game = room.getGame()
	if (!game)
		return
	game.move(socket.id, payload.direction)
}

export function handleRotate(socket: Socket, payload: unknown) : void {
	if (!payload) {
		const room = getRoom(socket)
		if (!room)
			return
		const game = room.getGame()
		if (!game)
			return
		game.rotate(socket.id)
	}
}

export function handleDrop(socket: Socket, payload: unknown) : void {
	if (!payload) {
		const room = getRoom(socket)
		if (!room)
			return
		const game = room.getGame()
		if (!game)
			return
		game.drop(socket.id)
	}
}
