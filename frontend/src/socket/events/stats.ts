import { socket } from "../socket";

// ─── Emitter stats (front -> back) ─────────────────────────────────────────────
// L'identité (username) est déduite côté serveur depuis la session socket.
export function emitStatsGet() {
	socket.emit("stats:Get");
}
