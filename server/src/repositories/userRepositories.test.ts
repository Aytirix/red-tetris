import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Socket } from "socket.io";

const findUnique = vi.fn();
const create = vi.fn();
const update = vi.fn();
const transaction = vi.fn();

vi.mock("../config/prisma.js", () => ({
	prisma: {
		user: {
			findUnique: (...args: unknown[]) => findUnique(...args),
			create: (...args: unknown[]) => create(...args),
			update: (...args: unknown[]) => update(...args),
		},
		$transaction: (...args: unknown[]) => transaction(...args),
	},
}));

import {
	creditBerrys,
	findUserByUsername,
	getWalletRow,
	postUsername,
	purchaseThemeTx,
	setEquippedTheme,
} from "./userRepositories.js";
import { userSocketStore } from "../gateways/socket/userSocketStore.js";

function makeSocket(id: string): Socket {
	return { id, emit: vi.fn(), on: vi.fn() } as unknown as Socket;
}

describe("userRepositories", () => {
	beforeEach(() => {
		userSocketStore.clear();
		findUnique.mockReset();
		create.mockReset();
		update.mockReset();
		transaction.mockReset();
	});

	describe("findUserByUsername", () => {
		it("queries the user by username", async () => {
			findUnique.mockResolvedValue({ username: "luffy" });

			const user = await findUserByUsername("luffy");

			expect(findUnique).toHaveBeenCalledWith({ where: { username: "luffy" } });
			expect(user).toEqual({ username: "luffy" });
		});

		it("returns null when the user does not exist", async () => {
			findUnique.mockResolvedValue(null);
			expect(await findUserByUsername("inconnu")).toBeNull();
		});
	});

	describe("postUsername", () => {
		it("creates the user with the session username", async () => {
			const socket = makeSocket("s1");
			userSocketStore.set("s1", { username: "luffy", subscribe: false, socket });
			create.mockResolvedValue({ username: "luffy", faction: "pirate", avatar: "luffy" });

			const user = await postUsername(socket, "pirate", "luffy");

			expect(create).toHaveBeenCalledWith({
				data: { username: "luffy", faction: "pirate", avatar: "luffy" },
			});
			expect(user.username).toBe("luffy");
		});

		it("throws when the socket has no session", async () => {
			await expect(postUsername(makeSocket("s1"), "pirate", "luffy"))
				.rejects.toThrow("Username not found for this socket");
			expect(create).not.toHaveBeenCalled();
		});

		it("throws when the session has no username", async () => {
			const socket = makeSocket("s1");
			userSocketStore.set("s1", { username: null, subscribe: false, socket });

			await expect(postUsername(socket, "pirate", "luffy"))
				.rejects.toThrow("Username not found for this socket");
		});
	});

	describe("creditBerrys", () => {
		it("increments the balance atomically", async () => {
			update.mockResolvedValue({});

			await creditBerrys("luffy", 1500);

			expect(update).toHaveBeenCalledWith({
				where: { username: "luffy" },
				data: { berrys: { increment: 1500 } },
			});
		});
	});

	describe("getWalletRow", () => {
		it("reads only the wallet columns", async () => {
			findUnique.mockResolvedValue({ berrys: 10, ownedThemes: [], equippedTheme: "neon-gem" });

			const row = await getWalletRow("luffy");

			expect(findUnique).toHaveBeenCalledWith({
				where: { username: "luffy" },
				select: { berrys: true, ownedThemes: true, equippedTheme: true },
			});
			expect(row).toEqual({ berrys: 10, ownedThemes: [], equippedTheme: "neon-gem" });
		});
	});

	describe("setEquippedTheme", () => {
		it("updates the equipped theme", async () => {
			update.mockResolvedValue({});

			await setEquippedTheme("luffy", "jewel");

			expect(update).toHaveBeenCalledWith({
				where: { username: "luffy" },
				data: { equippedTheme: "jewel" },
			});
		});
	});

	describe("purchaseThemeTx", () => {
		function runTransaction(txUser: unknown) {
			const txFindUnique = vi.fn().mockResolvedValue(txUser);
			const txUpdate = vi.fn().mockResolvedValue({
				berrys: 0,
				ownedThemes: ["jewel"],
				equippedTheme: "jewel",
			});
			transaction.mockImplementation((callback: (tx: unknown) => unknown) =>
				callback({ user: { findUnique: txFindUnique, update: txUpdate } }),
			);
			return { txFindUnique, txUpdate };
		}

		it("debits the balance, pushes the theme and equips it", async () => {
			const { txUpdate } = runTransaction({ berrys: 20000, ownedThemes: [], equippedTheme: "neon-gem" });

			const row = await purchaseThemeTx("luffy", "jewel", 15000);

			expect(txUpdate).toHaveBeenCalledWith({
				where: { username: "luffy" },
				data: {
					berrys: { decrement: 15000 },
					ownedThemes: { push: "jewel" },
					equippedTheme: "jewel",
				},
				select: { berrys: true, ownedThemes: true, equippedTheme: true },
			});
			expect(row.equippedTheme).toBe("jewel");
		});

		it("refuses an unknown user", async () => {
			runTransaction(null);
			await expect(purchaseThemeTx("luffy", "jewel", 15000)).rejects.toThrow("USER_NOT_FOUND");
		});

		it("refuses a theme already owned", async () => {
			runTransaction({ berrys: 99999, ownedThemes: ["jewel"], equippedTheme: "neon-gem" });
			await expect(purchaseThemeTx("luffy", "jewel", 15000)).rejects.toThrow("ALREADY_OWNED");
		});

		it("refuses when the balance is too low", async () => {
			runTransaction({ berrys: 10, ownedThemes: [], equippedTheme: "neon-gem" });
			await expect(purchaseThemeTx("luffy", "jewel", 15000)).rejects.toThrow("INSUFFICIENT_FUNDS");
		});
	});
});
