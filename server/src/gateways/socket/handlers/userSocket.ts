import { Socket } from "socket.io";
import { isValidUsername } from "../../../utils/unsernameValidator.js";
import { checkUsernameAvailability } from "../../../services/userService.js";
import { userSocketStore, isUsernameTaken } from "../userSocketStore.js";

export function registerUserSocket(socket: Socket): void {
	socket.on("user:CheckUsernameAvailable", async (msg) => {
		if (!isValidUsername(msg.username) || isUsernameTaken(userSocketStore, msg.username, socket)) {
			socket.emit("user:ResultUsernameAvailable", {
				"available": false,
				"user_faction": null,
				"username": msg.username
			});
			console.log(`Invalid username attempt: ${msg.username}`);
			return;
		}
		await checkUsernameAvailability(socket, msg.username);
	});
}