import type { Socket } from "socket.io";
import type { StatsState } from "../../../types/statsTypes.js";

export function emitStatsState(socket: Socket, state: StatsState): void {
	socket.emit("stats:State", state);
}

export function emitStatsError(socket: Socket, message: string): void {
	socket.emit("stats:Error", { message });
}
