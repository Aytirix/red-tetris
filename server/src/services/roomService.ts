import { Socket } from "socket.io";
import { Room } from "../core/room.js";
import { getNameById, userSocketStore } from "../gateways/socket/userSocketStore.js";
import { Player } from "../core/Player.js";
import { createPlayer } from "./playerService.js";
import { roomSocketStore } from "../gateways/socket/roomSocketStore.js";
import { userInfo } from "os";

export async function createRoom(socket: Socket, roomName: string): Promise <Room | null> {
	const newRoom = new Room(roomName);
	const newPlayer = await createPlayer(socket)
	if (!newPlayer)
		return null
	newRoom.addPlayer(newPlayer);
	newRoom.reassignHost(newPlayer);
	return newRoom;
}

export function removePlayer(socket: Socket): void {
	const user = userSocketStore.get(socket.id);
	console.log(user)
	if (!user)
		return;
	for (const room of roomSocketStore.values()) {
			if (room.removePlayerBySocketId(socket.id))
				return
	}
}