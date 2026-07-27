import { describe, it, expect, vi } from "vitest";
import type { Socket } from "socket.io";
import { checkAvatar, validateCheckUsername, validateRegister, validateSocketEvent } from "./validateSocketEvent.js";

function makeSocket(id = "socket-1"): Socket {
	return { id, emit: vi.fn(), on: vi.fn() } as unknown as Socket;
}

describe("validateSocketEvent", () => {
	describe("checkAvatar", () => {
		it("accepts every marine avatar", () => {
			const marines = [
				"garp", "smoker", "tashigi", "koby", "aokiji",
				"kizaru", "akainu", "fujitora", "sengoku", "ryokugyu",
			];
			for (const avatar of marines) expect(checkAvatar("marine", avatar)).toBe(true);
		});

		it("accepts every pirate avatar", () => {
			const pirates = [
				"luffy", "zoro", "nami", "usopp", "sanji",
				"chopper", "robin", "franky", "brook", "jinbei",
			];
			for (const avatar of pirates) expect(checkAvatar("pirate", avatar)).toBe(true);
		});

		it("refuses an avatar from the wrong faction", () => {
			expect(checkAvatar("marine", "luffy")).toBe(false);
			expect(checkAvatar("pirate", "garp")).toBe(false);
		});

		it("refuses an unknown faction", () => {
			expect(checkAvatar("revolutionnaire", "luffy")).toBe(false);
			expect(checkAvatar("", "luffy")).toBe(false);
		});

		it("refuses an unknown avatar", () => {
			expect(checkAvatar("pirate", "shanks")).toBe(false);
			expect(checkAvatar("marine", "")).toBe(false);
		});
	});

	describe("validateRegister", () => {
		it("accepts a coherent faction/avatar pair", () => {
			expect(validateRegister({ faction: "pirate", avatar: "luffy" })).toBe(true);
			expect(validateRegister({ faction: "marine", avatar: "garp" })).toBe(true);
		});

		it("refuses an incoherent faction/avatar pair", () => {
			expect(validateRegister({ faction: "pirate", avatar: "garp" })).toBe(false);
		});

		it("refuses a wrong shape", () => {
			expect(validateRegister(null)).toBe(false);
			expect(validateRegister("pirate")).toBe(false);
			expect(validateRegister({})).toBe(false);
			expect(validateRegister({ faction: "pirate" })).toBe(false);
			expect(validateRegister({ faction: 1, avatar: "luffy" })).toBe(false);
			expect(validateRegister({ faction: "pirate", avatar: 1 })).toBe(false);
		});

		it("refuses extra keys", () => {
			expect(validateRegister({ faction: "pirate", avatar: "luffy", username: "x" })).toBe(false);
		});
	});

	describe("validateCheckUsername", () => {
		it("accepts { username }", () => {
			expect(validateCheckUsername({ username: "luffy" })).toBe(true);
		});

		it("refuses a wrong shape", () => {
			expect(validateCheckUsername(null)).toBe(false);
			expect(validateCheckUsername("luffy")).toBe(false);
			expect(validateCheckUsername({})).toBe(false);
			expect(validateCheckUsername({ user: "luffy" })).toBe(false);
			expect(validateCheckUsername({ username: "luffy", extra: 1 })).toBe(false);
		});

		// B14: seule la PRESENCE de la cle etait verifiee. isValidUsername() teste une
		// RegExp, qui coercit son argument en chaine -> `{username: 12345}` passait la
		// validation de format et atteignait la requete Prisma et le userSocketStore.
		it("refuses a username that is not a string", () => {
			expect(validateCheckUsername({ username: 12345 })).toBe(false);
			expect(validateCheckUsername({ username: null })).toBe(false);
			expect(validateCheckUsername({ username: undefined })).toBe(false);
			expect(validateCheckUsername({ username: true })).toBe(false);
			expect(validateCheckUsername({ username: ["luffy"] })).toBe(false);
			expect(validateCheckUsername({ username: { toString: () => "luffy" } })).toBe(false);
		});
	});

	describe("validateSocketEvent", () => {
		it("dispatches to the validator of the event", () => {
			const socket = makeSocket();
			expect(validateSocketEvent(socket, "user:CheckUsernameAvailable", { username: "luffy" })).toBe(true);
			expect(validateSocketEvent(socket, "user:CheckUsernameAvailable", {})).toBe(false);
			expect(validateSocketEvent(socket, "user:Register", { faction: "pirate", avatar: "luffy" })).toBe(true);
			expect(validateSocketEvent(socket, "user:Register", { faction: "pirate", avatar: "garp" })).toBe(false);
		});

		it("refuses an event without validator", () => {
			expect(validateSocketEvent(makeSocket(), "user:Unknown", {})).toBe(false);
			expect(validateSocketEvent(makeSocket(), "", {})).toBe(false);
		});
	});
});
