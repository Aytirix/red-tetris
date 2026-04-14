import { Socket } from "socket.io";
import { isValidUsername } from "../../../utils/unsernameValidator.js";
import { checkUsernameAvailability } from "../../../services/userService.js";

export function registerUserSocket(socket: Socket): void {
	socket.on("user:CheckUsernameAvailable", async (msg) => {
		if (!isValidUsername(msg.username)) {
			socket.emit("user:ResultUsernameAvailable", { 
				"available": "invalid",
				"user_faction": null,
				"username": msg.username
			});
			console.log(`Invalid username attempt: ${msg.username}`);
			return;
		}
		else {
			await checkUsernameAvailability(socket, msg.username);
		}
	});
}