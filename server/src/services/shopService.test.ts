import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { Socket } from "socket.io";

vi.mock("../repositories/userRepositories.js", () => ({
	creditBerrys: vi.fn(),
	getWalletRow: vi.fn(),
	purchaseThemeTx: vi.fn(),
	setEquippedTheme: vi.fn(),
}));

// L'enregistrement des stats est testé à part (statsService.test) : ici on le neutralise
// pour isoler la logique portefeuille et éviter tout accès à Prisma.
vi.mock("./statsService.js", () => ({ recordGameResults: vi.fn() }));

import { buyThemeForUser, equipThemeForUser, getWalletState, resolveEquippedTheme, settleGameRewards, type GameSettlementEntry } from "./shopService.js";
import { creditBerrys, getWalletRow, purchaseThemeTx, setEquippedTheme } from "../repositories/userRepositories.js";
import { recordGameResults } from "./statsService.js";
import { DEFAULT_THEME_ID, SHOP_THEMES } from "../config/shopThemes.js";

type FakeSocket = Socket & { emit: ReturnType<typeof vi.fn> };

function makeSocket(id = "s1"): FakeSocket {
	return { id, emit: vi.fn(), on: vi.fn() } as unknown as FakeSocket;
}

// Entrée de règlement complète (les stats prennent des valeurs neutres par défaut).
function settleEntry(
	username: string,
	score: number,
	socket: FakeSocket,
	extra: Partial<GameSettlementEntry> = {},
): GameSettlementEntry {
	return {
		username, score, socket,
		faction: "pirate", mode: "classique", lines: 0, tetris: 0, level: 1,
		won: false, hadWinner: false, durationMs: 0,
		...extra,
	};
}

describe("shopService", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		vi.spyOn(console, "error").mockImplementation(() => undefined);
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	describe("getWalletState", () => {
		it("returns an empty wallet with the default theme for an unknown user", async () => {
			vi.mocked(getWalletRow).mockResolvedValue(null);

			const state = await getWalletState("luffy");

			expect(state.berrys).toBe(0);
			expect(state.equipped).toBe(DEFAULT_THEME_ID);
			expect(state.owned).toEqual([DEFAULT_THEME_ID]);
			expect(state.catalog).toEqual(SHOP_THEMES.map((theme) => ({ id: theme.id, price: theme.price })));
		});

		it("always adds the default theme to the owned list", async () => {
			vi.mocked(getWalletRow).mockResolvedValue({
				berrys: 4200,
				ownedThemes: ["synthwave"],
				equippedTheme: "synthwave",
			});

			const state = await getWalletState("luffy");

			expect(state.berrys).toBe(4200);
			expect(state.equipped).toBe("synthwave");
			expect(state.owned).toContain(DEFAULT_THEME_ID);
			expect(state.owned).toContain("synthwave");
		});

		it("never duplicates the default theme", async () => {
			vi.mocked(getWalletRow).mockResolvedValue({
				berrys: 0,
				ownedThemes: [DEFAULT_THEME_ID, DEFAULT_THEME_ID],
				equippedTheme: DEFAULT_THEME_ID,
			});

			const state = await getWalletState("luffy");

			expect(state.owned).toEqual([DEFAULT_THEME_ID]);
		});

		it("falls back to the default theme when the equipped one is not owned", async () => {
			vi.mocked(getWalletRow).mockResolvedValue({
				berrys: 100,
				ownedThemes: [],
				equippedTheme: "jewel",
			});

			expect((await getWalletState("luffy")).equipped).toBe(DEFAULT_THEME_ID);
		});
	});

	describe("buyThemeForUser", () => {
		it("purchases a theme and returns the updated wallet", async () => {
			vi.mocked(purchaseThemeTx).mockResolvedValue({
				berrys: 0,
				ownedThemes: ["daltonien"],
				equippedTheme: "daltonien",
			});

			const state = await buyThemeForUser("luffy", "daltonien");

			expect(purchaseThemeTx).toHaveBeenCalledWith("luffy", "daltonien", 2500);
			expect(state.equipped).toBe("daltonien");
		});

		it("refuses an unknown theme", async () => {
			await expect(buyThemeForUser("luffy", "inconnu")).rejects.toThrow("UNKNOWN_THEME");
			expect(purchaseThemeTx).not.toHaveBeenCalled();
		});

		it("refuses to buy the free default theme", async () => {
			await expect(buyThemeForUser("luffy", DEFAULT_THEME_ID)).rejects.toThrow("NOT_PURCHASABLE");
			expect(purchaseThemeTx).not.toHaveBeenCalled();
		});

		it("propagates the repository error (funds, already owned...)", async () => {
			vi.mocked(purchaseThemeTx).mockRejectedValue(new Error("INSUFFICIENT_FUNDS"));
			await expect(buyThemeForUser("luffy", "jewel")).rejects.toThrow("INSUFFICIENT_FUNDS");
		});
	});

	describe("equipThemeForUser", () => {
		it("equips an owned theme", async () => {
			// 1er appel: verification de possession. 2e appel: relecture apres ecriture.
			vi.mocked(getWalletRow)
				.mockResolvedValueOnce({ berrys: 10, ownedThemes: ["synthwave"], equippedTheme: DEFAULT_THEME_ID })
				.mockResolvedValueOnce({ berrys: 10, ownedThemes: ["synthwave"], equippedTheme: "synthwave" });

			const state = await equipThemeForUser("luffy", "synthwave");

			expect(setEquippedTheme).toHaveBeenCalledWith("luffy", "synthwave");
			expect(state.equipped).toBe("synthwave");
		});

		it("equips the default theme without any ownership check", async () => {
			vi.mocked(getWalletRow).mockResolvedValue({
				berrys: 10,
				ownedThemes: [],
				equippedTheme: "jewel",
			});

			await equipThemeForUser("luffy", DEFAULT_THEME_ID);

			expect(setEquippedTheme).toHaveBeenCalledWith("luffy", DEFAULT_THEME_ID);
		});

		it("refuses an unknown theme", async () => {
			await expect(equipThemeForUser("luffy", "inconnu")).rejects.toThrow("UNKNOWN_THEME");
			expect(setEquippedTheme).not.toHaveBeenCalled();
		});

		it("refuses a theme that is not owned", async () => {
			vi.mocked(getWalletRow).mockResolvedValue({
				berrys: 10,
				ownedThemes: ["daltonien"],
				equippedTheme: "daltonien",
			});

			await expect(equipThemeForUser("luffy", "jewel")).rejects.toThrow("NOT_OWNED");
			expect(setEquippedTheme).not.toHaveBeenCalled();
		});

		it("refuses when the user has no wallet row", async () => {
			vi.mocked(getWalletRow).mockResolvedValue(null);
			await expect(equipThemeForUser("luffy", "jewel")).rejects.toThrow("NOT_OWNED");
		});
	});

	describe("settleGameRewards", () => {
		it("credits every player with a positive score then pushes its wallet", async () => {
			vi.mocked(getWalletRow).mockResolvedValue({
				berrys: 900,
				ownedThemes: [],
				equippedTheme: DEFAULT_THEME_ID,
			});
			const luffySocket = makeSocket("s1");
			const zoroSocket = makeSocket("s2");

			await settleGameRewards([
				settleEntry("luffy", 900, luffySocket),
				settleEntry("zoro", 300, zoroSocket),
			]);

			expect(creditBerrys).toHaveBeenCalledWith("luffy", 900);
			expect(creditBerrys).toHaveBeenCalledWith("zoro", 300);
			expect(luffySocket.emit).toHaveBeenCalledWith("shop:State", expect.objectContaining({ berrys: 900 }));
			expect(zoroSocket.emit).toHaveBeenCalledWith("shop:State", expect.anything());
			// Les résultats sont transmis à l'enregistrement des stats (sans le socket exploité).
			expect(recordGameResults).toHaveBeenCalledTimes(1);
			expect(vi.mocked(recordGameResults).mock.calls[0]![0]).toEqual([
				expect.objectContaining({ username: "luffy", score: 900 }),
				expect.objectContaining({ username: "zoro", score: 300 }),
			]);
		});

		it("does not credit a score of 0 but still pushes the wallet", async () => {
			vi.mocked(getWalletRow).mockResolvedValue(null);
			const socket = makeSocket("s1");

			await settleGameRewards([settleEntry("luffy", 0, socket)]);

			expect(creditBerrys).not.toHaveBeenCalled();
			expect(socket.emit).toHaveBeenCalledWith("shop:State", expect.objectContaining({ berrys: 0 }));
		});

		it("swallows the error of one player and keeps going for the others", async () => {
			vi.mocked(getWalletRow).mockResolvedValue(null);
			vi.mocked(creditBerrys).mockRejectedValueOnce(new Error("db down"));
			const luffySocket = makeSocket("s1");
			const zoroSocket = makeSocket("s2");

			await expect(settleGameRewards([
				settleEntry("luffy", 100, luffySocket),
				settleEntry("zoro", 200, zoroSocket),
			])).resolves.toBeUndefined();

			expect(luffySocket.emit).not.toHaveBeenCalled();
			expect(zoroSocket.emit).toHaveBeenCalled();
			expect(console.error).toHaveBeenCalled();
		});

		it("accepts an empty list", async () => {
			await expect(settleGameRewards([])).resolves.toBeUndefined();
		});
	});
});

describe("resolveEquippedTheme", () => {
	it("retombe sur le defaut sans ligne ou sans theme equipe", () => {
		expect(resolveEquippedTheme(null)).toBe(DEFAULT_THEME_ID);
		expect(resolveEquippedTheme({ equippedTheme: null, ownedThemes: [] })).toBe(DEFAULT_THEME_ID);
	});

	it("renvoie le theme equipe quand il est possede", () => {
		expect(resolveEquippedTheme({ equippedTheme: "synthwave", ownedThemes: ["synthwave"] })).toBe("synthwave");
	});

	it("refuse un theme NON possede (donnees incoherentes) et retombe sur le defaut", () => {
		expect(resolveEquippedTheme({ equippedTheme: "synthwave", ownedThemes: [] })).toBe(DEFAULT_THEME_ID);
	});

	it("considere le theme par defaut comme toujours possede", () => {
		expect(resolveEquippedTheme({ equippedTheme: DEFAULT_THEME_ID, ownedThemes: [] })).toBe(DEFAULT_THEME_ID);
	});
});
