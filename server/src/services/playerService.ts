import type { Socket } from "socket.io";
import { prisma } from "../config/prisma.js";
import { getNameById } from "../gateways/socket/userSocketStore.js";
import { Player } from "../core/Player.js";
import { resolveEquippedTheme } from "./shopService.js";

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
	// Le cosmetique est fige a la creation du Player: il accompagne son plateau et
	// s'affiche tel quel chez ses spectateurs.
	const newPlayer = new Player(name, socket, user.avatar, user.faction, resolveEquippedTheme(user));
	return newPlayer
}