import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { Socket } from "socket.io";

vi.mock("../../../services/shopService.js", () => ({
	getWalletState: vi.fn(),
	buyThemeForUser: vi.fn(),
	equipThemeForUser: vi.fn(),
}));

import { registerShopSocket } from "./shopSocket.js";
import { buyThemeForUser, equipThemeForUser, getWalletState } from "../../../services/shopService.js";
import { userSocketStore } from "../userSocketStore.js";
import type { WalletState } from "../../../types/shopTypes.js";

type Handler = (payload?: unknown) => unknown;
type FakeSocket = Socket & { emit: ReturnType<typeof vi.fn> };

function makeSocket(id: string): { socket: FakeSocket; handlers: Map<string, Handler> } {
	const handlers = new Map<string, Handler>();
	const socket = {
		id,
		emit: vi.fn(),
		on: vi.fn((event: string, callback: Handler) => {
			handlers.set(event, callback);
			return socket;
		}),
	};
	return { socket: socket as unknown as FakeSocket, handlers };
}

const wallet: WalletState = {
	berrys: 1000,
	equipped: "neon-gem",
	owned: ["neon-gem"],
	catalog: [{ id: "neon-gem", price: 0 }],
};

function authenticated(id = "s1") {
	const made = makeSocket(id);
	userSocketStore.set(id, { username: "luffy", subscribe: false, socket: made.socket });
	registerShopSocket(made.socket);
	return made;
}

describe("registerShopSocket", () => {
	beforeEach(() => {
		userSocketStore.clear();
		vi.clearAllMocks();
		vi.spyOn(console, "error").mockImplementation(() => undefined);
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	it("registers the three shop events", () => {
		const { socket, handlers } = makeSocket("s1");
		registerShopSocket(socket);
		expect([...handlers.keys()]).toEqual(["shop:Get", "shop:Buy", "shop:Equip"]);
	});

	describe("shop:Get", () => {
		it("sends the wallet of the authenticated user", async () => {
			vi.mocked(getWalletState).mockResolvedValue(wallet);
			const { socket, handlers } = authenticated();

			await handlers.get("shop:Get")!();

			expect(getWalletState).toHaveBeenCalledWith("luffy");
			expect(socket.emit).toHaveBeenCalledWith("shop:State", wallet);
		});

		it("refuses an unauthenticated socket", async () => {
			const { socket, handlers } = makeSocket("s1");
			registerShopSocket(socket);

			await handlers.get("shop:Get")!();

			expect(socket.emit).toHaveBeenCalledWith("shop:Error", { message: "Non authentifié" });
			expect(getWalletState).not.toHaveBeenCalled();
		});

		it("refuses a session without username", async () => {
			const made = makeSocket("s1");
			userSocketStore.set("s1", { username: null, subscribe: false, socket: made.socket });
			registerShopSocket(made.socket);

			await made.handlers.get("shop:Get")!();

			expect(made.socket.emit).toHaveBeenCalledWith("shop:Error", { message: "Non authentifié" });
		});

		it("reports a read failure", async () => {
			vi.mocked(getWalletState).mockRejectedValue(new Error("db down"));
			const { socket, handlers } = authenticated();

			await handlers.get("shop:Get")!();

			expect(socket.emit).toHaveBeenCalledWith("shop:Error", {
				message: "Lecture du portefeuille impossible",
			});
		});
	});

	describe("shop:Buy", () => {
		it("buys the theme and returns the new wallet", async () => {
			vi.mocked(buyThemeForUser).mockResolvedValue(wallet);
			const { socket, handlers } = authenticated();

			await handlers.get("shop:Buy")!({ themeId: "jewel" });

			expect(buyThemeForUser).toHaveBeenCalledWith("luffy", "jewel");
			expect(socket.emit).toHaveBeenCalledWith("shop:State", wallet);
		});

		it("refuses an unauthenticated socket", async () => {
			const { socket, handlers } = makeSocket("s1");
			registerShopSocket(socket);

			await handlers.get("shop:Buy")!({ themeId: "jewel" });

			expect(socket.emit).toHaveBeenCalledWith("shop:Error", { message: "Non authentifié" });
		});

		it("refuses an invalid themeId", async () => {
			const { socket, handlers } = authenticated();

			await handlers.get("shop:Buy")!({ themeId: "" });
			await handlers.get("shop:Buy")!({ themeId: 42 });
			await handlers.get("shop:Buy")!({ themeId: "x".repeat(41) });
			await handlers.get("shop:Buy")!({});
			await handlers.get("shop:Buy")!(null);
			await handlers.get("shop:Buy")!("jewel");

			expect(socket.emit).toHaveBeenCalledTimes(6);
			for (const call of socket.emit.mock.calls)
				expect(call).toEqual(["shop:Error", { message: "Thème invalide" }]);
			expect(buyThemeForUser).not.toHaveBeenCalled();
		});

		it("translates every business error", async () => {
			const { socket, handlers } = authenticated();
			const cases: [string, string][] = [
				["INSUFFICIENT_FUNDS", "Butin insuffisant"],
				["ALREADY_OWNED", "Thème déjà possédé"],
				["NOT_OWNED", "Thème non possédé"],
				["NOT_PURCHASABLE", "Thème non achetable"],
				["UNKNOWN_THEME", "Thème inconnu"],
				["USER_NOT_FOUND", "Utilisateur introuvable"],
				["BOOM", "Opération impossible"],
			];

			for (const [code, message] of cases) {
				socket.emit.mockClear();
				vi.mocked(buyThemeForUser).mockRejectedValueOnce(new Error(code));
				await handlers.get("shop:Buy")!({ themeId: "jewel" });
				expect(socket.emit).toHaveBeenCalledWith("shop:Error", { message });
			}
		});

		it("falls back on a generic message for a non-Error rejection", async () => {
			vi.mocked(buyThemeForUser).mockRejectedValue("boom");
			const { socket, handlers } = authenticated();

			await handlers.get("shop:Buy")!({ themeId: "jewel" });

			expect(socket.emit).toHaveBeenCalledWith("shop:Error", { message: "Opération impossible" });
		});
	});

	describe("shop:Equip", () => {
		it("equips the theme and returns the new wallet", async () => {
			vi.mocked(equipThemeForUser).mockResolvedValue(wallet);
			const { socket, handlers } = authenticated();

			await handlers.get("shop:Equip")!({ themeId: "neon-gem" });

			expect(equipThemeForUser).toHaveBeenCalledWith("luffy", "neon-gem");
			expect(socket.emit).toHaveBeenCalledWith("shop:State", wallet);
		});

		it("refuses an unauthenticated socket", async () => {
			const { socket, handlers } = makeSocket("s1");
			registerShopSocket(socket);

			await handlers.get("shop:Equip")!({ themeId: "neon-gem" });

			expect(socket.emit).toHaveBeenCalledWith("shop:Error", { message: "Non authentifié" });
		});

		it("refuses an invalid themeId", async () => {
			const { socket, handlers } = authenticated();

			await handlers.get("shop:Equip")!({});

			expect(socket.emit).toHaveBeenCalledWith("shop:Error", { message: "Thème invalide" });
		});

		it("translates the business error", async () => {
			vi.mocked(equipThemeForUser).mockRejectedValue(new Error("NOT_OWNED"));
			const { socket, handlers } = authenticated();

			await handlers.get("shop:Equip")!({ themeId: "jewel" });

			expect(socket.emit).toHaveBeenCalledWith("shop:Error", { message: "Thème non possédé" });
		});
	});
});
