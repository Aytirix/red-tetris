import {prisma} from "../config/prisma.js";

export async function findUserByUsername(username: string) : Promise<any> {
	return await prisma.user.findUnique({
		where: {username: username},
	});
}
