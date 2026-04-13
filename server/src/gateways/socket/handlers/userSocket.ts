import { Socket } from "socket.io";
import { isValidUsername } from "../../../utils/unserNameValidator.js";
import { checkUsernameAvailability } from "../../../services/userService.js";

export function registerUserSocket(socket: Socket): void {
	socket.on("user:CheckUsernameAvailable", (msg) => {
		if (!isValidUsername(msg.username)) {
			socket.emit("user:UsernameInvalid", { username: msg.username });
			console.log(`Invalid username attempt: ${msg.username}`);
			return;
		}
		else {
			checkUsernameAvailability(socket, msg.username);
		}
	});
}