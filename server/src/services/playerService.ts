import type { Socket } from "socket.io";
import { prisma } from "../config/prisma.js";
import { getNameById } from "../gateways/socket/userSocketStore.js";
import { Player } from "../core/Player.js";

export async function createPlayer(socket: Socket) : Promise<Player | null> {
	const name = getNameById(socket);
	if (!name) 
		return null;
	const user = await prisma.user.findUnique({
		where: {
			username: name
		}
	})
	if (!user || !user.faction)
		return null
	const newPlayer = new Player(name, socket, user.avatar, user.faction);
	return newPlayer
}