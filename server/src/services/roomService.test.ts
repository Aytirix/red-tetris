import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { Socket } from "socket.io";

vi.mock("./playerService.js", () => ({ createPlayer: vi.fn() }));

import { createRoom, getRoom, removePlayer } from "./roomService.js";
import { createPlayer } from "./playerService.js";
import { Player } from "../core/Player.js";
import { Room } from "../core/room.js";
import { roomSocketStore } from "../gateways/socket/roomSocketStore.js";
import { userSocketStore } from "../gateways/socket/userSocketStore.js";

function makeSocket(id: string): Socket {
	return { id, emit: vi.fn(), on: vi.fn() } as unknown as Socket;
}

function makePlayer(name: string, socketId: string): Player {
	return new Player(name, makeSocket(socketId), `${name}-avatar`, "pirate");
}

describe("roomService", () => {
	beforeEach(() => {
		roomSocketStore.clear();
		userSocketStore.clear();
		vi.clearAllMocks();
		vi.spyOn(console, "log").mockImplementation(() => undefined);
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	describe("createRoom", () => {
		it("creates the room with the creator as host", async () => {
			const socket = makeSocket("s1");
			vi.mocked(createPlayer).mockResolvedValue(makePlayer("luffy", "s1"));

			const room = await createRoom(socket, "salle1");

			expect(room).not.toBeNull();
			expect(room!.name).toBe("salle1");
			expect(room!.countPlayer()).toBe(1);
			expect(room!.getHostId()).toBe("s1");
			expect(room!.getHostName()).toBe("luffy");
			expect(room!.getStatus()).toBe("waiting");
		});

		it("returns null when the player cannot be created", async () => {
			vi.mocked(createPlayer).mockResolvedValue(null);
			expect(await createRoom(makeSocket("s1"), "salle1")).toBeNull();
		});
	});

	describe("getRoom", () => {
		it("finds the room containing the socket", () => {
			const room = new Room("salle1");
			room.addPlayer(makePlayer("luffy", "s1"));
			roomSocketStore.set("salle1", room);

			expect(getRoom(makeSocket("s1"))).toBe(room);
		});

		it("returns null when the socket is in no room", () => {
			const room = new Room("salle1");
			room.addPlayer(makePlayer("luffy", "s1"));
			roomSocketStore.set("salle1", room);

			expect(getRoom(makeSocket("s2"))).toBeNull();
		});

		it("returns null when there is no room at all", () => {
			expect(getRoom(makeSocket("s1"))).toBeNull();
		});

		it("scans every room until it finds the right one", () => {
			const empty = new Room("vide");
			const target = new Room("salle2");
			target.addPlayer(makePlayer("zoro", "s2"));
			roomSocketStore.set("vide", empty);
			roomSocketStore.set("salle2", target);

			expect(getRoom(makeSocket("s2"))).toBe(target);
		});
	});

	describe("removePlayer", () => {
		it("removes the player from its room", () => {
			const socket = makeSocket("s1");
			userSocketStore.set("s1", { username: "luffy", subscribe: false, socket });
			const room = new Room("salle1");
			room.addPlayer(makePlayer("luffy", "s1"));
			roomSocketStore.set("salle1", room);

			removePlayer(socket);

			expect(room.countPlayer()).toBe(0);
		});

		it("does nothing when the socket has no session", () => {
			const room = new Room("salle1");
			room.addPlayer(makePlayer("luffy", "s1"));
			roomSocketStore.set("salle1", room);

			removePlayer(makeSocket("s1"));

			expect(room.countPlayer()).toBe(1);
		});

		it("does nothing when the player is in no room", () => {
			const socket = makeSocket("s1");
			userSocketStore.set("s1", { username: "luffy", subscribe: false, socket });
			const room = new Room("salle1");
			room.addPlayer(makePlayer("zoro", "s2"));
			roomSocketStore.set("salle1", room);

			expect(() => removePlayer(socket)).not.toThrow();
			expect(room.countPlayer()).toBe(1);
		});
	});
});
