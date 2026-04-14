import { Socket } from "socket.io";
import { findUserByUsername } from "../repositories/userRepositories.js";
import { userSocketStore } from "../gateways/socket/socketInit.js";

export async function checkUsernameAvailability(socket: Socket, username: string): Promise<void> {
	const user = await findUserByUsername(username);
	console.log(`Checking username availability: ${user}`);
	if (!user) {
		socket.emit("user:ResultUsernameAvailable", {
			available: true,
			user_faction: null,
			username: username,
		})
		userSocketStore.set(socket.id, username);
		console.log(`Username available: ${username}`);
	}
}
