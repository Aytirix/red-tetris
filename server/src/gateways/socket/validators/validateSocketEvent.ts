import type { Socket } from "socket.io";
import type { CheckUsernamePayload, SocketValidatorMap, userRegisterPayload } from "../../../types/socket/userSocketTypes.js";

const validators: SocketValidatorMap = {
	"user:CheckUsernameAvailable": validateCheckUsername,
	"user:Register": validateRegister,
};

export function validateRegister(
	payload: unknown,
) : payload is userRegisterPayload {
	const isValid =
	typeof payload === "object"
	&& payload !== null
	&& Object.keys(payload).length === 3
	&& "username" in payload
	&& "faction" in payload
	&& "avatar" in payload
	if (!isValid)
		return false
	return true
}

export function validateCheckUsername(
	payload: unknown,
): payload is CheckUsernamePayload {
	const isValid =
		typeof payload === "object"
		&& payload !== null
		&& Object.keys(payload).length === 1
		&& "username" in payload
	if (!isValid)
		return false;
	return true;
}

export function validateSocketEvent(socket: Socket, eventName: string, payload: unknown)  : boolean {
	const validator = validators[eventName]
	if (!validator)
		return false
	return validator(payload)
}