import type { Socket } from "socket.io";
import type { Room } from "../../../core/room.js";
import type { RoomJoinedPayload } from "../../../types/socket/roomSocketTypes.js";
import { Player } from "../../../core/Player.js";
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