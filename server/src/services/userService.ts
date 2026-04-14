import { Socket } from "socket.io";
import { findUserByUsername } from "../repositories/userRepositories.js";
import { userSocketStore } from "../gateways/socket/userSocketStore.js";

export async function checkUsernameAvailability(socket: Socket, username: string): Promise<void> {
	const user = await findUserByUsername(username);
	userSocketStore.set(socket.id, username);

	if (!user) {
		socket.emit("user:ResultUsernameAvailable", {
			available: true,
			user_faction: null,
			username: username,
		})
		console.log(`Username available: ${username}`);
	}
	else {
		socket.emit("user:ResultUsernameAvailable", {
			available: true,
			user_faction: user.user_faction,
			username: user.username
		})
		console.log(`Known username found in database: ${user.username}`);
	}
}
