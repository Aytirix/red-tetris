import { socket } from "../socket";

// --- Emitters (appelables depuis n'importe quel composant) ---
// Les listeners de room sont branchés par `GamePage` / `DashboardPage`, qui possèdent
// l'état: il n'y a volontairement aucun listener global ici.

export function emitJoinRoom(roomId: string) {
	socket.emit("room:join", { roomId });
}

export function emitLeaveRoom() {
	socket.emit("room:leave");
}

export function emitKickPlayer(username: string) {
	socket.emit("room:kick", { username });
}

export function emitStartGame() {
	socket.emit("room:start");
}

// Relance une nouvelle partie dans la même room (bouton « Rejouer » du solo).
export function emitRestartGame() {
	socket.emit("room:restart");
}

export function emitSetGameMode(mode: string) {
	socket.emit("room:setMode", { mode });
}

export function emitSetPrivate(isPrivate: boolean) {
	socket.emit("room:setPrivate", { private: isPrivate });
}

export function emitSubscribeRooms() {
	socket.emit("room:subscribeList");
}

export function emitUnsubscribeRooms() {
	socket.emit("room:unsubscribeList");
}
