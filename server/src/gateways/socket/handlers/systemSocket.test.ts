import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { Socket } from "socket.io";

vi.mock("../../../config/prisma.js", () => ({ prisma: {} }));

import { handlerDisconnect } from "./systemSocket.js";
import { Player } from "../../../core/Player.js";
import { Room } from "../../../core/room.js";
import type { Game } from "../../../core/Game.js";
import { roomSocketStore } from "../roomSocketStore.js";
import { spectatorSocketStore } from "../spectatorSocketStore.js";
import { userSocketStore } from "../userSocketStore.js";

type Handler = () => void;
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

function makePlayer(name: string, socket: Socket): Player {
	return new Player(name, socket, `${name}-avatar`, "pirate");
}

describe("handlerDisconnect", () => {
	beforeEach(() => {
		roomSocketStore.clear();
		userSocketStore.clear();
		spectatorSocketStore.clear();
		vi.clearAllMocks();
		vi.spyOn(console, "log").mockImplementation(() => undefined);
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	it("registers a disconnect listener", () => {
		const { socket, handlers } = makeSocket("s1");
		handlerDisconnect(socket);
		expect(handlers.has("disconnect")).toBe(true);
	});

	it("removes the player from its room and warns the others", () => {
		const leaving = makeSocket("s1");
		const staying = makeSocket("s2");
		const room = new Room("salle1");
		room.addPlayer(makePlayer("luffy", leaving.socket));
		room.addPlayer(makePlayer("zoro", staying.socket));
		roomSocketStore.set("salle1", room);

		handlerDisconnect(leaving.socket);
		leaving.handlers.get("disconnect")!();

		expect(room.countPlayer()).toBe(1);
		expect(staying.socket.emit).toHaveBeenCalledWith("room:players", [
			{ username: "zoro", avatar: "zoro-avatar", faction: "pirate", ready: false },
		]);
	});

	it("deletes the room when the last player disconnects", () => {
		const leaving = makeSocket("s1");
		const room = new Room("salle1");
		room.addPlayer(makePlayer("luffy", leaving.socket));
		roomSocketStore.set("salle1", room);

		handlerDisconnect(leaving.socket);
		leaving.handlers.get("disconnect")!();

		expect(roomSocketStore.has("salle1")).toBe(false);
	});

	it("scans every room until it finds the right one", () => {
		const leaving = makeSocket("s2");
		const other = new Room("autre");
		other.addPlayer(makePlayer("nami", makeSocket("s9").socket));
		const target = new Room("salle1");
		target.addPlayer(makePlayer("zoro", leaving.socket));
		roomSocketStore.set("autre", other);
		roomSocketStore.set("salle1", target);

		handlerDisconnect(leaving.socket);
		leaving.handlers.get("disconnect")!();

		expect(roomSocketStore.has("salle1")).toBe(false);
		expect(other.countPlayer()).toBe(1);
	});

	it("cleans the spectator and user stores", () => {
		const { socket, handlers } = makeSocket("s1");
		userSocketStore.set("s1", { username: "luffy", subscribe: false, socket });
		spectatorSocketStore.set("s1", { game: {} as Game, player: makePlayer("luffy", socket) });

		handlerDisconnect(socket);
		handlers.get("disconnect")!();

		expect(userSocketStore.has("s1")).toBe(false);
		expect(spectatorSocketStore.has("s1")).toBe(false);
	});

	it("does not crash when the socket belongs to no room", () => {
		const { socket, handlers } = makeSocket("s1");
		handlerDisconnect(socket);
		expect(() => handlers.get("disconnect")!()).not.toThrow();
	});
});
