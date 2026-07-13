import type { Socket } from "socket.io";
import type { WalletState } from "../../../types/shopTypes.js";

export function emitShopState(socket: Socket, state: WalletState): void {
	socket.emit("shop:State", state);
}

export function emitShopError(socket: Socket, message: string): void {
	socket.emit("shop:Error", { message });
}
