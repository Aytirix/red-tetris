import type { Socket } from "socket.io";
import { postUsername } from "../../../repositories/userRepositories.js";
import { checkUsernameAvailability } from "../../../services/userService.js";
import { isValidUsername } from "../../../utils/unsernameValidator.js";
import { emitError } from "../emitters/systemEmitters.js";
import { emitUsernameUnavailable } from "../emitters/userEmitters.js";
import { isUsernameTaken, userSocketStore } from "../userSocketStore.js";
import { checkAvatar, validateSocketEvent } from "../validators/validateSocketEvent.js";

export function registerUserSocket(socket: Socket): void {
	socket.on("user:CheckUsernameAvailable", async (msg) => {
		if (!validateSocketEvent(socket, "user:CheckUsernameAvailable", msg)) {
			emitError(socket, "user:CheckUsernameAvailable", "Invalid payload")
			console.log("Error: payload invalid")
			return
		}
		if (!isValidUsername(msg.username)) {
			emitUsernameUnavailable(socket, msg.username, "invalid")
			console.log(`Invalid username format: ${msg.username}`);
			return;
		}
		if (isUsernameTaken(userSocketStore, msg.username, socket)) {
			emitUsernameUnavailable(socket, msg.username, false)
			console.log(`Username already in use: ${msg.username}`);
			return;
		}
		try {
			await checkUsernameAvailability(socket, msg.username);
		} catch (error) {
			console.error("Database error in CheckUsernameAvailable:", error);
			emitError(socket, "user:CheckUsernameAvailable", "Username check failed")
			//envoyer au front l erreur
		}
	});
	socket.on("user:Register", async (msg) => {
		if (!validateSocketEvent(socket, "user:Register", msg)) {
			emitError(socket, "user:Register", "Invalid payload")
			console.log("Error: payload invalid")
			return
		}
		try {
			await postUsername(socket, msg.faction, msg.avatar);
			socket.emit("user:ResultRegister", {
				"isRegister": true,
				"message": null
			})
		} catch (error) {
			console.error("Database error in Register:", error);
			emitError(socket, "user:Register", "Registration failed")
		}
	})
}