import type { Socket } from "socket.io";
import type { Room } from "../../../core/room.js";
import type { RoomJoinedPayload } from "../../../types/socket/roomSocketTypes.js";
import { roomSocketStore } from "../roomSocketStore.js";
import { userSocketStore } from "../userSocketStore.js";
import type { Player } from "../../../core/Player.js";

export function emitRoomJoined(socket: Socket, room: Room) : void {
	const payload: RoomJoinedPayload = {
		roomId: room.name,
		joined: room.getStatus() !== "playing",
		players: room.getPlayers().map((player) => ({
			username: player.getName(),
			avatar: player.getAvatar(),
			faction: player.getFaction(),
			ready: player.getCameraReady(),
		})),
	}
	socket.emit("room:joined", payload)
	emitSubscrib()
}

export function emitSubscrib() : void {
	for (const [socket, objet] of userSocketStore) {
		if (objet.subscribe) {
			const roomList = Array.from(roomSocketStore.values()).map((room) => ({
					roomId: room.name,
					playerCount: room.countPlayer(),
					maxPlayers: 4,
					mode: room.getMode(),
				}))
			objet.socket.emit("room:list", roomList);// checker dans room 
		}
	}
}

export function emitPlayersRoom(players: Player[]) : void {
	const payload = players.map((player) => ({
		username: player.getName(),
		avatar: player.getAvatar(),
		faction: player.getFaction(),
		ready: player.getCameraReady(),
	}))
	for (const player of players) {
		const socket = player.getSocket()
		socket.emit("room:players", payload)
	}
}

export function emitRoomSettings(room: Room) : void {
	const statRoom = room.getPrivate()
	const mode = room.getMode()
	const players = room.getPlayers()
	for (const player of players) {
		player.getSocket().emit("room:settings", {
			"mode": mode,
			"private": statRoom
		})
	}
}

export function emitKickedRoom(socket: Socket) : void {
	socket.emit("room:kicked")
}