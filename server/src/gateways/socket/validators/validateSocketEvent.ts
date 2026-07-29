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
	&& Object.keys(payload).length === 2
	&& "faction" in payload
	&& "avatar" in payload
	&& typeof payload.faction === "string"
	&& typeof payload.avatar === "string"
	&& checkAvatar(payload.faction, payload.avatar);
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
		&& typeof payload.username === "string"
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

export function checkAvatar(faction: string, avatar: string) : boolean {
	if (faction === "marine") {
		const isMarineValid = 
			avatar === "garp" || avatar === "smoker" || avatar === "tashigi" ||
			avatar === "koby" || avatar === "aokiji" || avatar === "kizaru" ||
			avatar === "akainu" || avatar === "fujitora" || avatar === "sengoku" ||
			avatar === "ryokugyu";
		return isMarineValid;
	} else if (faction === "pirate") {
		const isPirateValid = 
			avatar === "luffy" || avatar === "zoro" || avatar === "nami" ||
			avatar === "usopp" || avatar === "sanji" || avatar === "chopper" ||
			avatar === "robin" || avatar === "franky" || avatar === "brook" ||
			avatar === "jinbei";
		return isPirateValid;
	}
	return false;
}