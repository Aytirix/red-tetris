import type { Socket } from "socket.io";
import { Room } from "../../core/room.js";
import { createRoom } from "../../services/roomService.js";

export const roomSocketStore = new Map<string, Room>();

export async function addRoomToStore(socket: Socket, roomName: string): Promise <Room | null> {
	const newRoom = await createRoom(socket, roomName);
	if (newRoom) {
		roomSocketStore.set(roomName, newRoom);
	}
	return newRoom;
}