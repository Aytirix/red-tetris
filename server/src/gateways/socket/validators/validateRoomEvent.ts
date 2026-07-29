import type { RoomJoinPayload, RoomKickPayload, RoomModePayload, RoomSetPrivatePayload, SubscribeSpectatorPayload } from "../../../types/socket/roomSocketTypes.js";

const ROOM_ID_REGEX = /^[a-zA-Z0-9_]{1,15}$/;

export function isValidRoomName(roomId: string): boolean {
	return ROOM_ID_REGEX.test(roomId);
}

/**
 * Evenements SANS argument (room:start, room:leave, game:rotate, game:drop...).
 *
 * Le client les emet sans rien passer, mais un `socket.emit("room:start", {})` est tout
 * aussi legitime cote protocole: un simple `if (!payload)` le rejetait silencieusement,
 * puisqu'un objet vide est truthy. On accepte donc les trois formes reellement vides
 * (absente, nulle, objet sans cle) et on continue de refuser tout payload porteur de
 * donnees — c'est ce refus qui garantit qu'un client ne pilote pas un evenement avec
 * des champs que le serveur n'a jamais valides.
 */
export function isEmptyPayload(payload: unknown) : boolean {
	if (payload === undefined || payload === null)
		return true;
	if (typeof payload !== "object" || Array.isArray(payload))
		return false;
	return Object.keys(payload).length === 0;
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
