import {prisma} from "../config/prisma.js";
import type { User } from "../generated/prisma/client.js";
import type { Faction } from "../generated/prisma/enums.js";

export async function findUserByUsername(username: string) : Promise<User | null> {
	return await prisma.user.findUnique({
		where: {username: username},
	});
}

export async function postUsername(username: string, faction: Faction, avatar: string) : Promise<User> {
	return await prisma.user.create({
		data: {
			username: username,
			faction: faction,
			avatar: avatar
		}
	})
}