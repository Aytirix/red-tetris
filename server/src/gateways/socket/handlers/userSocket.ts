import type { Socket } from "socket.io";
import { isValidUsername } from "../../../utils/unsernameValidator.js";
import { checkUsernameAvailability } from "../../../services/userService.js";
import { userSocketStore, isUsernameTaken } from "../userSocketStore.js";
import { validateSocketEvent } from "../validators/validateSocketEvent.js";
import { emitUsernameUnavailable } from "../emitters/userEmitters.js";
import { emitInvalidPayloadError } from "../emitters/systemEmitters.js";

export function registerUserSocket(socket: Socket): void {
	socket.on("user:CheckUsernameAvailable", async (msg) => {
		if (!validateSocketEvent(socket, "user:CheckUsernameAvailable", msg)) {
			emitInvalidPayloadError(socket, "user:CheckUsernameAvailable")
			console.log("Error: payload invalid")
			return
		}
		if (!isValidUsername(msg.username)) {
			emitUsernameUnavailable(socket, msg.username)
			console.log(`Invalid username format: ${msg.username}`);
			return;
		}
		if (isUsernameTaken(userSocketStore, msg.username, socket)) {
			emitUsernameUnavailable(socket, msg.username)
			console.log(`Username already in use: ${msg.username}`);
			return;
		}
		await checkUsernameAvailability(socket, msg.username);
	});
	socket.on("user:Register", async (msg) => {
		
	})
}