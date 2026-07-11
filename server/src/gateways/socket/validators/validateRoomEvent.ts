import type { RoomJoinPayload, RoomKickPayload, RoomModePayload, RoomSetPrivatePayload, SubscribeSpectatorPayload } from "../../../types/socket/roomSocketTypes.js";

const ROOM_ID_REGEX = /^[a-zA-Z0-9_]{1,15}$/;

export function isValidRoomName(roomId: string): boolean {
	return ROOM_ID_REGEX.test(roomId);
}

export function isValidRoomJoinPayload(payload: unknown) : payload is RoomJoinPayload {
	return (
		typeof payload === "object" &&
		payload !== null &&
		Object.keys(payload).length === 1 &&
		"roomId" in payload &&
		typeof payload.roomId === "string"
	);
}

export function isValidRoomKickPayload(payload: unknown) : payload is RoomKickPayload {
	return ( 
		typeof payload === "object" &&
		payload !== null &&
		Object.keys(payload).length === 1 &&
		"username" in payload &&
		typeof payload.username === "string"
	);
}

export function isValidRoomModePayload(payload: unknown) : payload is RoomModePayload {
	return (
		typeof payload === "object" &&
		payload !== null &&
		Object.keys(payload).length === 1 &&
		"mode" in payload &&
		typeof payload.mode === "string"
	)
}

export function isValidRoomSetPrivatePayload(payload: unknown) : payload is RoomSetPrivatePayload {
	return (
		typeof payload === "object" &&
		payload !== null &&
		Object.keys(payload).length === 1 &&
		"private" in payload &&
		typeof payload.private === "boolean"
	)
}

export function isValidSubscribeSpectatorPayload(payload: unknown) : payload is SubscribeSpectatorPayload {
	return (
		typeof payload === "object" &&
		payload !== null &&
		Object.keys(payload).length === 2 &&
		"roomId" in payload &&
		"user" in payload &&
		typeof payload.roomId === "string" &&
		(payload.user === null || typeof payload.user === "string")
	)
}
