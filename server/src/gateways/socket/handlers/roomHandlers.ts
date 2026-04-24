import type { Socket } from "socket.io";
import { isValidRoomJoinPayload, isValidRoomName } from "../validators/validateRoomEvent.js";
import { emitError } from "../emitters/systemEmitters.js";
import { roomSocketStore } from "../roomSocketStore.js";
import { createRoom } from "../../../services/roomService.js";
import { emitRoomJoined } from "../emitters/roomEmitters.js";

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