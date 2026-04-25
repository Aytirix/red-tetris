import type { Socket } from "socket.io";
import type { Room } from "../../../core/room.js";
import type { RoomJoinedPayload } from "../../../types/socket/roomSocketTypes.js";
import { roomSocketStore } from "../roomSocketStore.js";
import { userSocketStore } from "../userSocketStore.js";
import { get } from "node:http";

export function emitRoomJoined(socket: Socket, room: Room) : void {
	const payload: RoomJoinedPayload = {
		roomId: room.name,
		players: room.getPlayers().map((player) => ({
			username: player.getName(),
			avatar: player.getAvatar(),
			faction: player.getFaction(),
		})),
	}
	socket.emit("room:joined", payload)
}

export function emitSubscrib() : void {
	for (const [socket, objet] of userSocketStore)
		if (objet.subscribe)
			objet.socket.emit("room:list", Array.from(roomSocketStore.values()).map((room) => ({
					roomId: room.name,
					playerCount: room.countPlayer(),
					maxPlayers: 4,
					mode: room.getMode(),
				}))
			);// checker dans room 
			
}
