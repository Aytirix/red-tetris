import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Socket } from "socket.io";
import { getNameById, isUsernameTaken, userSocketStore } from "./userSocketStore.js";

function makeSocket(id: string): Socket {
	return { id, emit: vi.fn(), on: vi.fn() } as unknown as Socket;
}

describe("userSocketStore", () => {
	beforeEach(() => {
		userSocketStore.clear();
	});

	describe("isUsernameTaken", () => {
		it("returns true when ANOTHER socket already holds the username", () => {
			const owner = makeSocket("s1");
			userSocketStore.set("s1", { username: "luffy", subscribe: false, socket: owner });

			expect(isUsernameTaken(userSocketStore, "luffy", makeSocket("s2"))).toBe(true);
		});

		it("returns false when the username belongs to the SAME socket", () => {
			const owner = makeSocket("s1");
			userSocketStore.set("s1", { username: "luffy", subscribe: false, socket: owner });

			expect(isUsernameTaken(userSocketStore, "luffy", owner)).toBe(false);
		});

		it("returns false when nobody holds the username", () => {
			userSocketStore.set("s1", { username: "zoro", subscribe: false, socket: makeSocket("s1") });
			expect(isUsernameTaken(userSocketStore, "luffy", makeSocket("s2"))).toBe(false);
		});

		it("returns false on an empty store", () => {
			expect(isUsernameTaken(userSocketStore, "luffy", makeSocket("s1"))).toBe(false);
		});
	});

	describe("getNameById", () => {
		it("returns the username registered for the socket", () => {
			const socket = makeSocket("s1");
			userSocketStore.set("s1", { username: "luffy", subscribe: false, socket });
			expect(getNameById(socket)).toBe("luffy");
		});

		it("returns null when the socket is unknown", () => {
			expect(getNameById(makeSocket("inconnu"))).toBeNull();
		});

		it("returns null when the session has no username yet", () => {
			const socket = makeSocket("s1");
			userSocketStore.set("s1", { username: null, subscribe: false, socket });
			expect(getNameById(socket)).toBeNull();
		});
	});
});
