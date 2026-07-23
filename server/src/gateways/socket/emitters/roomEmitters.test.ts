import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Socket } from "socket.io";

vi.mock("../../../config/prisma.js", () => ({ prisma: {} }));

import { Player } from "../../../core/Player.js";
import { Room } from "../../../core/room.js";
import { roomSocketStore } from "../roomSocketStore.js";
import { userSocketStore } from "../userSocketStore.js";
import {
	emitKickedRoom,
	emitPlayersRoom,
	emitRoomJoined,
	emitRoomSettings,
	emitSubscrib,
} from "./roomEmitters.js";

type FakeSocket = Socket & { emit: ReturnType<typeof vi.fn> };

function makeSocket(id: string): FakeSocket {
	return { id, emit: vi.fn(), on: vi.fn(), join: vi.fn(), leave: vi.fn() } as unknown as FakeSocket;
}

function makePlayer(name: string, socketId = `sock-${name}`): { player: Player; socket: FakeSocket } {
	const socket = makeSocket(socketId);
	return { player: new Player(name, socket, `${name}-avatar`, "pirate"), socket };
}

describe("roomEmitters", () => {
	beforeEach(() => {
		roomSocketStore.clear();
		userSocketStore.clear();
		vi.clearAllMocks();
	});

	describe("emitRoomJoined", () => {
		it("emits room:joined with the room and its players", () => {
			const room = new Room("salle1");
			const luffy = makePlayer("luffy", "s1");
			const zoro = makePlayer("zoro", "s2");
			room.addPlayer(luffy.player);
			room.addPlayer(zoro.player);

			emitRoomJoined(luffy.socket, room);

			expect(luffy.socket.emit).toHaveBeenCalledWith("room:joined", {
				roomId: "salle1",
				joined: true,
				players: [
					{ username: "luffy", avatar: "luffy-avatar", faction: "pirate", ready: false },
					{ username: "zoro", avatar: "zoro-avatar", faction: "pirate", ready: false },
				],
			});
		});

		it("sets joined=false when the game is already running (spectator)", () => {
			const room = new Room("salle1");
			const luffy = makePlayer("luffy", "s1");
			room.addPlayer(luffy.player);
			room.setStatus("playing");

			emitRoomJoined(luffy.socket, room);

			expect(luffy.socket.emit.mock.calls[0]![1].joined).toBe(false);
		});

		it("keeps joined=true when the room is finished", () => {
			const room = new Room("salle1");
			const luffy = makePlayer("luffy", "s1");
			room.addPlayer(luffy.player);
			room.setStatus("finished");

			emitRoomJoined(luffy.socket, room);

			expect(luffy.socket.emit.mock.calls[0]![1].joined).toBe(true);
		});
	});

	describe("emitSubscrib", () => {
		it("sends room:list only to subscribed sessions", () => {
			const room = new Room("salle1");
			room.addPlayer(makePlayer("luffy", "s1").player);
			room.addPlayer(makePlayer("zoro", "s2").player);
			roomSocketStore.set("salle1", room);

			const subscribed = makeSocket("watcher");
			const silent = makeSocket("silent");
			userSocketStore.set("watcher", { username: "watcher", subscribe: true, socket: subscribed });
			userSocketStore.set("silent", { username: "silent", subscribe: false, socket: silent });

			emitSubscrib();

			expect(subscribed.emit).toHaveBeenCalledWith("room:list", [
				{ roomId: "salle1", playerCount: 2, maxPlayers: 4, mode: "classique" },
			]);
			expect(silent.emit).not.toHaveBeenCalled();
		});

		it("sends an empty list when no room exists", () => {
			const subscribed = makeSocket("watcher");
			userSocketStore.set("watcher", { username: "watcher", subscribe: true, socket: subscribed });

			emitSubscrib();

			expect(subscribed.emit).toHaveBeenCalledWith("room:list", []);
		});

		it("reports the mode of each room", () => {
			const room = new Room("salle1");
			const host = makePlayer("luffy", "s1");
			room.addPlayer(host.player);
			room.setMode("sprint", host.socket);
			roomSocketStore.set("salle1", room);

			const subscribed = makeSocket("watcher");
			userSocketStore.set("watcher", { username: "watcher", subscribe: true, socket: subscribed });

			emitSubscrib();

			expect(subscribed.emit.mock.calls[0]![1][0].mode).toBe("sprint");
		});
	});

	describe("emitPlayersRoom", () => {
		it("sends the player list to every player of the room", () => {
			const luffy = makePlayer("luffy", "s1");
			const zoro = makePlayer("zoro", "s2");

			emitPlayersRoom([luffy.player, zoro.player]);

			const expected = [
				{ username: "luffy", avatar: "luffy-avatar", faction: "pirate", ready: false },
				{ username: "zoro", avatar: "zoro-avatar", faction: "pirate", ready: false },
			];
			expect(luffy.socket.emit).toHaveBeenCalledWith("room:players", expected);
			expect(zoro.socket.emit).toHaveBeenCalledWith("room:players", expected);
		});

		it("does nothing on an empty room", () => {
			expect(() => emitPlayersRoom([])).not.toThrow();
		});
	});

	describe("emitRoomSettings", () => {
		it("broadcasts the mode and the visibility to every player", () => {
			const room = new Room("salle1");
			const host = makePlayer("luffy", "s1");
			const guest = makePlayer("zoro", "s2");
			room.addPlayer(host.player);
			room.addPlayer(guest.player);
			room.setMode("ultra", host.socket);
			room.setPrivate(true, host.socket);

			emitRoomSettings(room);

			expect(host.socket.emit).toHaveBeenCalledWith("room:settings", { mode: "ultra", private: true });
			expect(guest.socket.emit).toHaveBeenCalledWith("room:settings", { mode: "ultra", private: true });
		});
	});

	describe("emitKickedRoom", () => {
		it("notifies the kicked player", () => {
			const socket = makeSocket("s1");
			emitKickedRoom(socket);
			expect(socket.emit).toHaveBeenCalledWith("room:kicked");
		});
	});
});
