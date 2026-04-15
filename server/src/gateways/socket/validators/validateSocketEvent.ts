import type { Socket } from "socket.io";
import type { CheckUsernamePayload, SocketValidatorMap } from "../../../types/socket/userSocketTypes.js";

const validators: SocketValidatorMap = {
	"user:CheckUsernameAvailable": validateCheckUsername,
};

export function validateCheckUsername(
	socket: Socket,
	payload: unknown,
): payload is CheckUsernamePayload {
	const isValid =
		typeof payload === "object"
		&& payload !== null
		&& Object.keys(payload).length === 1
		&& "username" in payload
		&& typeof payload.username === "string";
	if (!isValid)
		return false;
	return true;
}

export function validateSocketEvent(socket: Socket, eventName: string, payload: unknown)  : boolean {
	const validator = validators[eventName]
	if (!validator)
		return false
	return validator(socket, payload)
}