import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { createFakeSocket, type FakeSocket } from "../../test/fakeSocket";
import { DEFAULT_THEME_ID } from "../config/pieceThemes";

const ctx = vi.hoisted(() => ({ socket: null as unknown as FakeSocket }));

const shopEvents = vi.hoisted(() => ({
	emitShopGet: vi.fn(),
	emitShopBuy: vi.fn(),
	emitShopEquip: vi.fn(),
}));

vi.mock("../socket/events/shop", () => shopEvents);
vi.mock("./SocketContext", () => ({
	useSocket: () => ({ socket: ctx.socket, isConnected: true }),
}));

import { ShopProvider, useShop } from "./ShopContext";

function wrapper({ children }: { children: ReactNode }) {
	return <ShopProvider>{children}</ShopProvider>;
}

function renderShop() {
	return renderHook(() => useShop(), { wrapper });
}

beforeEach(() => {
	ctx.socket = createFakeSocket();
	for (const fn of Object.values(shopEvents)) fn.mockClear();
});

afterEach(cleanup);

describe("ShopContext", () => {
	it("demande l'etat de la boutique au montage", () => {
		renderShop();

		expect(shopEvents.emitShopGet).toHaveBeenCalledTimes(1);
	});

	it("part sur un portefeuille vide avec le theme par defaut", () => {
		const { result } = renderShop();

		expect(result.current.berrys).toBe(0);
		expect(result.current.owned).toEqual([DEFAULT_THEME_ID]);
		expect(result.current.equipped).toBe(DEFAULT_THEME_ID);
		expect(result.current.loaded).toBe(false);
	});

	it("expose l'etat renvoye par le serveur", () => {
		const { result } = renderShop();

		act(() => {
			ctx.socket.receive("shop:State", {
				berrys: 1500,
				owned: [DEFAULT_THEME_ID, "jewel"],
				equipped: "jewel",
				catalog: [{ id: "jewel", price: 900 }],
			});
		});

		expect(result.current.berrys).toBe(1500);
		expect(result.current.equipped).toBe("jewel");
		expect(result.current.catalog).toEqual([{ id: "jewel", price: 900 }]);
		expect(result.current.loaded).toBe(true);
	});

	it("ignore un etat de boutique invalide", () => {
		const { result } = renderShop();

		act(() => { ctx.socket.receive("shop:State", "nope"); });

		expect(result.current.loaded).toBe(false);
	});

	it("remonte les erreurs de la boutique et permet de les effacer", () => {
		const { result } = renderShop();

		act(() => { ctx.socket.receive("shop:Error", { message: "Fonds insuffisants" }); });
		expect(result.current.lastError).toBe("Fonds insuffisants");

		act(() => { result.current.clearError(); });
		expect(result.current.lastError).toBeNull();
	});

	it("tait l'erreur d'authentification qui precede la connexion du pseudo", () => {
		const { result } = renderShop();

		act(() => { ctx.socket.receive("shop:Error", { message: "Non authentifié" }); });

		expect(result.current.lastError).toBeNull();
	});

	it("recharge la boutique une fois le pseudo authentifie", () => {
		renderShop();
		shopEvents.emitShopGet.mockClear();

		act(() => {
			ctx.socket.receive("user:ResultUsernameAvailable", {
				available: true, user_faction: "pirate", username: "luffy",
			});
		});

		expect(shopEvents.emitShopGet).toHaveBeenCalledTimes(1);
	});

	it("ne recharge pas la boutique pour un pseudo indisponible", () => {
		renderShop();
		shopEvents.emitShopGet.mockClear();

		act(() => {
			ctx.socket.receive("user:ResultUsernameAvailable", {
				available: false, user_faction: null, username: "luffy",
			});
		});

		expect(shopEvents.emitShopGet).not.toHaveBeenCalled();
	});

	it("recharge la boutique a la reconnexion du socket", () => {
		renderShop();
		shopEvents.emitShopGet.mockClear();

		act(() => { ctx.socket.receive("connect"); });

		expect(shopEvents.emitShopGet).toHaveBeenCalledTimes(1);
	});

	it("relaie l'achat, l'equipement et le rafraichissement", () => {
		const { result } = renderShop();
		shopEvents.emitShopGet.mockClear();

		act(() => { result.current.buy("jewel"); });
		act(() => { result.current.equip("jewel"); });
		act(() => { result.current.refresh(); });

		expect(shopEvents.emitShopBuy).toHaveBeenCalledWith("jewel");
		expect(shopEvents.emitShopEquip).toHaveBeenCalledWith("jewel");
		expect(shopEvents.emitShopGet).toHaveBeenCalledTimes(1);
	});

	it("retire tous ses listeners au demontage", () => {
		const { unmount } = renderShop();
		unmount();

		for (const event of ["shop:State", "shop:Error", "user:ResultUsernameAvailable", "connect"]) {
			expect(ctx.socket.listenerCount(event)).toBe(0);
		}
	});

	it("refuse d'etre utilise hors du provider", () => {
		expect(() => renderHook(() => useShop())).toThrowError(
			"useShop must be used within a ShopProvider",
		);
	});
});
