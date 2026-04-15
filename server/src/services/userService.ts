import type { Socket } from "socket.io";
import { findUserByUsername } from "../repositories/userRepositories.js";
import { userSocketStore } from "../gateways/socket/userSocketStore.js";
import { emitUsernameAvailable } from "../gateways/socket/emitters/userEmitters.js";

export async function checkUsernameAvailability(socket: Socket, username: string): Promise<void> {
	const user = await findUserByUsername(username);
	userSocketStore.set(socket.id, username);

	if (!user) {
		emitUsernameAvailable(socket, username, null)
		console.log(`Username available: ${username}`);
	}
	else {
		emitUsernameAvailable(socket, username, user.user_faction)
		console.log(`Known username found in database: ${user.username}`);
	}
}
