import type { Socket } from "socket.io";
import { userSocketStore } from "../userSocketStore.js";
import { getStatsState } from "../../../services/statsService.js";
import { emitStatsError, emitStatsState } from "../emitters/statsEmitters.js";

// Identité fiable côté serveur (jamais un username fourni par le client). null si le
// socket n'est pas encore authentifié : on renvoie quand même les stats globales.
function currentUsername(socket: Socket): string | null {
	return userSocketStore.get(socket.id)?.username ?? null;
}

export function registerStatsSocket(socket: Socket): void {
	socket.on("stats:Get", async () => {
		try {
			emitStatsState(socket, await getStatsState(currentUsername(socket)));
		} catch (err) {
			console.error("stats:Get error:", err);
			emitStatsError(socket, "Lecture des statistiques impossible");
		}
	});
}
