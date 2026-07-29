import { socket } from "../socket";

export function emitShopGet() {
	socket.emit("shop:Get");
}

export function emitShopBuy(themeId: string) {
	socket.emit("shop:Buy", { themeId });
}

export function emitShopEquip(themeId: string) {
	socket.emit("shop:Equip", { themeId });
}
