import { describe, it, expect, vi } from "vitest";
import type { Socket } from "socket.io";
import { emitShopError, emitShopState } from "./shopEmitters.js";
import { emitError } from "./systemEmitters.js";
import { emitUsernameAvailable, emitUsernameUnavailable } from "./userEmitters.js";
import type { WalletState } from "../../../types/shopTypes.js";

type FakeSocket = Socket & { emit: ReturnType<typeof vi.fn> };

function makeSocket(id = "s1"): FakeSocket {
	return { id, emit: vi.fn(), on: vi.fn() } as unknown as FakeSocket;
}

describe("shopEmitters", () => {
	it("emitShopState sends the wallet state", () => {
		const socket = makeSocket();
		const state: WalletState = {
			berrys: 1200,
			equipped: "neon-gem",
			owned: ["neon-gem"],
			catalog: [{ id: "neon-gem", price: 0 }],
		};

		emitShopState(socket, state);

		expect(socket.emit).toHaveBeenCalledWith("shop:State", state);
	});

	it("emitShopError sends the error message", () => {
		const socket = makeSocket();
		emitShopError(socket, "Butin insuffisant");
		expect(socket.emit).toHaveBeenCalledWith("shop:Error", { message: "Butin insuffisant" });
	});
});

describe("systemEmitters", () => {
	it("emitError sends the faulty event and the message", () => {
		const socket = makeSocket();
		emitError(socket, "room:join", "Invalid payload");
		expect(socket.emit).toHaveBeenCalledWith("system:Error", {
			event: "room:join",
			message: "Invalid payload",
		});
	});
});

describe("userEmitters", () => {
	it("emitUsernameAvailable reports the username as available", () => {
		const socket = makeSocket();
		emitUsernameAvailable(socket, "luffy", "pirate");
		expect(socket.emit).toHaveBeenCalledWith("user:ResultUsernameAvailable", {
			available: true,
			user_faction: "pirate",
			username: "luffy",
		});
	});

	it("emitUsernameAvailable accepts a user without faction", () => {
		const socket = makeSocket();
		emitUsernameAvailable(socket, "luffy", null);
		expect(socket.emit.mock.calls[0]![1].user_faction).toBeNull();
	});

	it("emitUsernameUnavailable reports an invalid username", () => {
		const socket = makeSocket();
		emitUsernameUnavailable(socket, "lu ffy", "invalid");
		expect(socket.emit).toHaveBeenCalledWith("user:ResultUsernameAvailable", {
			available: "invalid",
			user_faction: null,
			username: "lu ffy",
		});
	});

	it("emitUsernameUnavailable reports a username already taken", () => {
		const socket = makeSocket();
		emitUsernameUnavailable(socket, "luffy", false);
		expect(socket.emit.mock.calls[0]![1].available).toBe(false);
	});
});
