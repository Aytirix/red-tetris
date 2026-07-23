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
		})),
	}
	socket.emit("room:joined", payload)
	emitSubscrib()
}

export function emitSubscrib() : void {
	// Une room privee (dont les parties solo, forcees privees) n'apparait pas dans
	// la liste publique: elle reste joignable uniquement par son URL directe.
	const publicRooms = Array.from(roomSocketStore.values())
		.filter((room) => !room.getPrivate())
		.map((room) => ({
			roomId: room.name,
			playerCount: room.countPlayer(),
			maxPlayers: 4,
			mode: room.getMode(),
		}))
	for (const [, objet] of userSocketStore) {
		if (objet.subscribe) {
			objet.socket.emit("room:list", publicRooms);
		}
	}
}

export function emitPlayersRoom(players: Player[]) : void {
	const payload = players.map((player) => ({
		username: player.getName(),
		avatar: player.getAvatar(),
		faction: player.getFaction(),
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

// Refus d'entree dans une room: le client est redirige (ex: partie privee).
export function emitRoomDenied(socket: Socket, reason: "private") : void {
	socket.emit("room:denied", { reason })
}