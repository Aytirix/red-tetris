import type { Socket } from "socket.io";
import { userSocketStore } from "../userSocketStore.js";
import { buyThemeForUser, equipThemeForUser, getWalletState } from "../../../services/shopService.js";
import { emitShopError, emitShopState } from "../emitters/shopEmitters.js";

// Identité FIABLE côté serveur (jamais un username fourni par le client).
function currentUsername(socket: Socket): string | null {
	return userSocketStore.get(socket.id)?.username ?? null;
}

function readThemeId(msg: unknown): string | null {
	if (msg && typeof msg === "object" && "themeId" in msg) {
		const id = (msg as { themeId?: unknown }).themeId;
		if (typeof id === "string" && id.length > 0 && id.length <= 40) return id;
	}
	return null;
}

function mapShopError(err: unknown): string {
	const code = err instanceof Error ? err.message : "";
	switch (code) {
		case "INSUFFICIENT_FUNDS": return "Butin insuffisant";
		case "ALREADY_OWNED": return "Thème déjà possédé";
		case "NOT_OWNED": return "Thème non possédé";
		case "NOT_PURCHASABLE": return "Thème non achetable";
		case "UNKNOWN_THEME": return "Thème inconnu";
		case "USER_NOT_FOUND": return "Utilisateur introuvable";
		default: return "Opération impossible";
	}
}

export function registerShopSocket(socket: Socket): void {
	socket.on("shop:Get", async () => {
		const username = currentUsername(socket);
		if (!username) return emitShopError(socket, "Non authentifié");
		try {
			emitShopState(socket, await getWalletState(username));
		} catch (err) {
			console.error("shop:Get error:", err);
			emitShopError(socket, "Lecture du portefeuille impossible");
		}
	});

	socket.on("shop:Buy", async (msg) => {
		const username = currentUsername(socket);
		if (!username) return emitShopError(socket, "Non authentifié");
		const themeId = readThemeId(msg);
		if (!themeId) return emitShopError(socket, "Thème invalide");
		try {
			emitShopState(socket, await buyThemeForUser(username, themeId));
		} catch (err) {
			emitShopError(socket, mapShopError(err));
		}
	});

	socket.on("shop:Equip", async (msg) => {
		const username = currentUsername(socket);
		if (!username) return emitShopError(socket, "Non authentifié");
		const themeId = readThemeId(msg);
		if (!themeId) return emitShopError(socket, "Thème invalide");
		try {
			emitShopState(socket, await equipThemeForUser(username, themeId));
		} catch (err) {
			emitShopError(socket, mapShopError(err));
		}
	});
}
