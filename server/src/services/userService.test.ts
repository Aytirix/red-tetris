import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { Socket } from "socket.io";

vi.mock("../repositories/userRepositories.js", () => ({
	findUserByUsername: vi.fn(),
}));

import { checkUsernameAvailability } from "./userService.js";
import { findUserByUsername } from "../repositories/userRepositories.js";
import { userSocketStore } from "../gateways/socket/userSocketStore.js";

type FakeSocket = Socket & { emit: ReturnType<typeof vi.fn> };

function makeSocket(id: string): FakeSocket {
	return { id, emit: vi.fn(), on: vi.fn() } as unknown as FakeSocket;
}

describe("checkUsernameAvailability", () => {
	beforeEach(() => {
		userSocketStore.clear();
		vi.clearAllMocks();
		vi.spyOn(console, "log").mockImplementation(() => undefined);
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	it("registers the username on the socket session", async () => {
		const socket = makeSocket("s1");
		vi.mocked(findUserByUsername).mockResolvedValue(null);

		await checkUsernameAvailability(socket, "luffy");

		expect(userSocketStore.get("s1")).toEqual({ username: "luffy", subscribe: false, socket });
	});

	it("reports an available username without faction when unknown in database", async () => {
		const socket = makeSocket("s1");
		vi.mocked(findUserByUsername).mockResolvedValue(null);

		await checkUsernameAvailability(socket, "luffy");

		expect(socket.emit).toHaveBeenCalledWith("user:ResultUsernameAvailable", {
			available: true,
			user_faction: null,
			username: "luffy",
		});
	});

	it("returns the stored faction for a known username", async () => {
		const socket = makeSocket("s1");
		vi.mocked(findUserByUsername).mockResolvedValue({
			username: "luffy",
			faction: "pirate",
		} as never);

		await checkUsernameAvailability(socket, "luffy");

		expect(socket.emit).toHaveBeenCalledWith("user:ResultUsernameAvailable", {
			available: true,
			user_faction: "pirate",
			username: "luffy",
		});
	});

	it("propagates a database error", async () => {
		const socket = makeSocket("s1");
		vi.mocked(findUserByUsername).mockRejectedValue(new Error("db down"));

		await expect(checkUsernameAvailability(socket, "luffy")).rejects.toThrow("db down");
	});
});
