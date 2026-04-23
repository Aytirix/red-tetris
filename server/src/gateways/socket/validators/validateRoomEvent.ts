import type { RoomJoinPayload } from "../../../types/socket/roomSocketTypes.js";

const ROOM_ID_REGEX = /^[a-zA-Z0-9_]{1,15}$/;

export function isValidRoomName(roomId: string): boolean {
	return ROOM_ID_REGEX.test(roomId);
}

export function isValidRoomJoinPayload(payload: unknown): payload is RoomJoinPayload {
	const isValid =
		typeof payload === "object" &&
		payload !== null &&
		Object.keys(payload).length === 1 &&
		"roomId" in payload &&
		typeof payload.roomId === "string";

	if (!isValid)
		return false;
	return true;
}