import { socket } from "../socket";

// --- Emitters (appelables depuis n'importe quel composant) ---
// Les listeners de partie sont branchés par `GamePage`, qui possède l'état: il n'y a
// volontairement aucun listener global ici.

export function emitGameMove(direction: "left" | "right" | "down") {
	socket.emit("game:move", { direction });
}

export function emitGameRotate() {
	socket.emit("game:rotate");
}

export function emitGameDrop() {
	socket.emit("game:drop");
}

// Joker du mode invisible: révèle le plateau quelques secondes (nombre limité).
export function emitGameJoker() {
	socket.emit("game:joker");
}

export function emitSubscribeSpectator(roomId: string, user: string | null) {
	socket.emit("game:subscribeSpectatorGame", { roomId, user });
}

export function emitUnsubscribeSpectator() {
	socket.emit("game:unsubscribeSpectatorGame", {});
}
