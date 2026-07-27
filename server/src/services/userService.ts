import type { Socket } from "socket.io";
import { findUserByUsername } from "../repositories/userRepositories.js";
import { userSocketStore } from "../gateways/socket/userSocketStore.js";
import { emitUsernameAvailable } from "../gateways/socket/emitters/userEmitters.js";

export async function checkUsernameAvailability(socket: Socket, username: string): Promise<void> {
	const user = await findUserByUsername(username);
	  userSocketStore.set(socket.id, {
			username,
			subscribe: false,
			socket: socket,
		});

	if (!user)
		emitUsernameAvailable(socket, username, null)
	else
		emitUsernameAvailable(socket, username, user.faction)
}
