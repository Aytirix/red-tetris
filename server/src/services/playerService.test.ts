import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Socket } from "socket.io";

const findUnique = vi.fn();
vi.mock("../config/prisma.js", () => ({
	prisma: { user: { findUnique: (...args: unknown[]) => findUnique(...args) } },
}));

import { createPlayer } from "./playerService.js";
import { userSocketStore } from "../gateways/socket/userSocketStore.js";

function makeSocket(id: string): Socket {
	return { id, emit: vi.fn(), on: vi.fn() } as unknown as Socket;
}

describe("createPlayer", () => {
	beforeEach(() => {
		userSocketStore.clear();
		findUnique.mockReset();
	});

	it("builds a Player from the session name and the database row", async () => {
		const socket = makeSocket("s1");
		userSocketStore.set("s1", { username: "luffy", subscribe: false, socket });
		findUnique.mockResolvedValue({ username: "luffy", avatar: "luffy-avatar", faction: "pirate" });

		const player = await createPlayer(socket);

		expect(player).not.toBeNull();
		expect(player!.getName()).toBe("luffy");
		expect(player!.getSocketId()).toBe("s1");
		expect(player!.getAvatar()).toBe("luffy-avatar");
		expect(player!.getFaction()).toBe("pirate");
		expect(findUnique).toHaveBeenCalledWith({ where: { username: "luffy" } });
	});

	it("returns null when the socket has no username", async () => {
		const socket = makeSocket("s1");
		userSocketStore.set("s1", { username: null, subscribe: false, socket });

		expect(await createPlayer(socket)).toBeNull();
		expect(findUnique).not.toHaveBeenCalled();
	});

	it("returns null when the socket is not registered at all", async () => {
		expect(await createPlayer(makeSocket("inconnu"))).toBeNull();
		expect(findUnique).not.toHaveBeenCalled();
	});

	it("returns null when the user does not exist in database", async () => {
		const socket = makeSocket("s1");
		userSocketStore.set("s1", { username: "luffy", subscribe: false, socket });
		findUnique.mockResolvedValue(null);

		expect(await createPlayer(socket)).toBeNull();
	});

	it("returns null when the user has no faction", async () => {
		const socket = makeSocket("s1");
		userSocketStore.set("s1", { username: "luffy", subscribe: false, socket });
		findUnique.mockResolvedValue({ username: "luffy", avatar: "luffy-avatar", faction: null });

		expect(await createPlayer(socket)).toBeNull();
	});
});
