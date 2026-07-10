import { socket } from "../socket";

// ─── Emitters shop (front -> back) ─────────────────────────────────────────────
// L'identité (username) est déduite côté serveur depuis la session socket,
// jamais envoyée par le client.

export function emitShopGet() {
	socket.emit("shop:Get");
}

export function emitShopBuy(themeId: string) {
	socket.emit("shop:Buy", { themeId });
}

export function emitShopEquip(themeId: string) {
	socket.emit("shop:Equip", { themeId });
}
