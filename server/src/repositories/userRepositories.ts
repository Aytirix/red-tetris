import type { Socket } from "socket.io";
import {prisma} from "../config/prisma.js";
import type { User } from "../generated/prisma/client.js";
import type { Faction } from "../generated/prisma/enums.js";
import { userSocketStore } from "../gateways/socket/userSocketStore.js";
import { error } from "node:console";

export async function findUserByUsername(username: string) : Promise<User | null> {
	return await prisma.user.findUnique({
		where: {username: username},
	});
}

export async function postUsername(socket: Socket, faction: Faction, avatar: string) : Promise<User> {
	const session = userSocketStore.get(socket.id);
	if (!session || !session.username) {
		throw new Error("Username not found for this socket");
	}
	return await prisma.user.create({
	data: {
		username: session.username,
		faction,
		avatar,
	},
	});
}