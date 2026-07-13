import React, { createContext, useContext, useEffect, useMemo, useState, useCallback } from "react";
import { useSocket } from "./SocketContext";
import { emitShopGet, emitShopBuy, emitShopEquip } from "../socket/events/shop";
import { normalizeShopState, normalizeShopError, type ShopState } from "../socket/shopState";
import { normalizeUsernameAvailability } from "../socket/userState";
import { DEFAULT_THEME_ID } from "../config/pieceThemes";

type ShopContextType = ShopState & {
	loaded: boolean;
	lastError: string | null;
	buy: (themeId: string) => void;
	equip: (themeId: string) => void;
	refresh: () => void;
	clearError: () => void;
};

const INITIAL: ShopState = {
	berrys: 0,
	owned: [DEFAULT_THEME_ID],
	equipped: DEFAULT_THEME_ID,
	catalog: [],
};

const ShopContext = createContext<ShopContextType | null>(null);

export function ShopProvider({ children }: { children: React.ReactNode }) {
	const { socket } = useSocket();
	const [state, setState] = useState<ShopState>(INITIAL);
	const [loaded, setLoaded] = useState(false);
	const [lastError, setLastError] = useState<string | null>(null);

	useEffect(() => {
		function onState(raw: unknown) {
			const next = normalizeShopState(raw);
			if (!next) return;
			setState(next);
			setLoaded(true);
			setLastError(null);
		}
		function onError(raw: unknown) {
			const message = normalizeShopError(raw);
			// "Non authentifié" arrive tant que le socket n'a pas encore de pseudo:
			// silencieux (le portefeuille sera récupéré après l'auth).
			if (message && message !== "Non authentifié") setLastError(message);
		}
		function onAuth(raw: unknown) {
			const result = normalizeUsernameAvailability(raw);
			if (result?.available) emitShopGet();
		}
		function onConnect() {
			emitShopGet();
		}

		socket.on("shop:State", onState);
		socket.on("shop:Error", onError);
		socket.on("user:ResultUsernameAvailable", onAuth);
		socket.on("connect", onConnect);
		emitShopGet();

		return () => {
			socket.off("shop:State", onState);
			socket.off("shop:Error", onError);
			socket.off("user:ResultUsernameAvailable", onAuth);
			socket.off("connect", onConnect);
		};
	}, [socket]);

	const buy = useCallback((themeId: string) => emitShopBuy(themeId), []);
	const equip = useCallback((themeId: string) => emitShopEquip(themeId), []);
	const refresh = useCallback(() => emitShopGet(), []);
	const clearError = useCallback(() => setLastError(null), []);

	const value = useMemo<ShopContextType>(
		() => ({ ...state, loaded, lastError, buy, equip, refresh, clearError }),
		[state, loaded, lastError, buy, equip, refresh, clearError],
	);

	return <ShopContext.Provider value={value}>{children}</ShopContext.Provider>;
}

export function useShop(): ShopContextType {
	const context = useContext(ShopContext);
	if (!context) throw new Error("useShop must be used within a ShopProvider");
	return context;
}
