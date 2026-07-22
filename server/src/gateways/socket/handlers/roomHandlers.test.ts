import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { Socket } from "socket.io";

vi.mock("../../../config/prisma.js", () => ({ prisma: {} }));
vi.mock("../../../services/playerService.js", () => ({ createPlayer: vi.fn() }));
vi.mock("../../../services/shopService.js", () => ({ settleGameRewards: vi.fn(async () => undefined) }));

import {
	handleDrop,
	handleMove,
	handleRoomKick,
	handleRoomMode,
	handleRoomSetPrivate,
	handleRoomStart,
	handleRotate,
	handleSubscribeSpectator,
	handleUnsubscribeSpectator,
	handlerRoomJoin,
	handlerRoomLeave,
	handlerRoomSubscribe,
	handlerRoomUnsubscribe,
} from "./roomHandlers.js";
import { createPlayer } from "../../../services/playerService.js";
import { Player } from "../../../core/Player.js";
import { Room } from "../../../core/room.js";
import { Game } from "../../../core/Game.js";
import { roomSocketStore } from "../roomSocketStore.js";
import { userSocketStore } from "../userSocketStore.js";
import { spectatorSocketStore } from "../spectatorSocketStore.js";

type FakeSocket = Socket & { emit: ReturnType<typeof vi.fn> };

function makeSocket(id: string): FakeSocket {
	return { id, emit: vi.fn(), on: vi.fn(), join: vi.fn(), leave: vi.fn() } as unknown as FakeSocket;
}

function makePlayer(name: string, socket: Socket): Player {
	return new Player(name, socket, `${name}-avatar`, "pirate");
}

/** Session complete: store utilisateur + Player rattache a une room. */
function seedRoom(roomName: string, names: string[]): { room: Room; sockets: Map<string, FakeSocket> } {
	const room = new Room(roomName);
	const sockets = new Map<string, FakeSocket>();
	for (const name of names) {
		const socket = makeSocket(`sock-${name}`);
		sockets.set(name, socket);
		userSocketStore.set(socket.id, { username: name, subscribe: false, socket });
		room.addPlayer(makePlayer(name, socket));
	}
	roomSocketStore.set(roomName, room);
	return { room, sockets };
}

function lastEmit(socket: FakeSocket, event: string): unknown[] | undefined {
	const calls = socket.emit.mock.calls.filter((call) => call[0] === event);
	return calls[calls.length - 1];
}

describe("roomHandlers", () => {
	beforeEach(() => {
		vi.useFakeTimers();
		roomSocketStore.clear();
		userSocketStore.clear();
		spectatorSocketStore.clear();
		vi.clearAllMocks();
		vi.spyOn(console, "log").mockImplementation(() => undefined);
		vi.mocked(createPlayer).mockImplementation(async (socket: Socket) => {
			const username = userSocketStore.get(socket.id)?.username ?? null;
			if (!username) return null;
			return makePlayer(username, socket);
		});
	});

	afterEach(() => {
		vi.useRealTimers();
		vi.restoreAllMocks();
	});

	describe("handlerRoomJoin", () => {
		it("refuses an invalid payload", async () => {
			const socket = makeSocket("s1");
			await handlerRoomJoin(socket, { wrong: true });
			expect(socket.emit).toHaveBeenCalledWith("system:Error", {
				event: "room:join",
				message: "Invalid payload",
			});
		});

		it("refuses an invalid room name", async () => {
			const socket = makeSocket("s1");
			await handlerRoomJoin(socket, { roomId: "salle invalide !" });
			expect(socket.emit).toHaveBeenCalledWith("system:Error", {
				event: "room:join",
				message: "Invalid roomId",
			});
		});

		it("creates the room when it does not exist yet", async () => {
			const socket = makeSocket("s1");
			userSocketStore.set("s1", { username: "luffy", subscribe: false, socket });

			await handlerRoomJoin(socket, { roomId: "salle1" });

			const room = roomSocketStore.get("salle1");
			expect(room).toBeDefined();
			expect(room!.getHostName()).toBe("luffy");
			expect(lastEmit(socket, "room:joined")).toBeDefined();
			expect(lastEmit(socket, "room:players")).toBeDefined();
		});

		it("reports an error when the player cannot be created", async () => {
			const socket = makeSocket("s1");

			await handlerRoomJoin(socket, { roomId: "salle1" });

			expect(socket.emit).toHaveBeenCalledWith("system:Error", {
				event: "room:join",
				message: "Failed to create room",
			});
			expect(roomSocketStore.has("salle1")).toBe(false);
		});

		it("adds the player to an existing room", async () => {
			seedRoom("salle1", ["luffy"]);
			const socket = makeSocket("s2");
			userSocketStore.set("s2", { username: "zoro", subscribe: false, socket });

			await handlerRoomJoin(socket, { roomId: "salle1" });

			expect(roomSocketStore.get("salle1")!.countPlayer()).toBe(2);
			expect(lastEmit(socket, "room:joined")).toBeDefined();
		});

		it("does nothing on an existing room when the player cannot be created", async () => {
			const { room } = seedRoom("salle1", ["luffy"]);
			const socket = makeSocket("s2");

			await handlerRoomJoin(socket, { roomId: "salle1" });

			expect(room.countPlayer()).toBe(1);
			expect(socket.emit).not.toHaveBeenCalled();
		});

		it("answers joined=false (spectator) when the game is already running", async () => {
			const { room } = seedRoom("salle1", ["luffy"]);
			room.setStatus("playing");
			const socket = makeSocket("s2");
			userSocketStore.set("s2", { username: "zoro", subscribe: false, socket });

			await handlerRoomJoin(socket, { roomId: "salle1" });

			expect(room.countPlayer()).toBe(1);
			expect(lastEmit(socket, "room:joined")![1]).toMatchObject({ joined: false });
		});
	});

	describe("handlerRoomSubscribe / handlerRoomUnsubscribe", () => {
		it("subscribes the session then pushes the room list", () => {
			const socket = makeSocket("s1");
			userSocketStore.set("s1", { username: "luffy", subscribe: false, socket });

			handlerRoomSubscribe(socket, undefined);

			expect(userSocketStore.get("s1")!.subscribe).toBe(true);
			expect(lastEmit(socket, "room:list")).toBeDefined();
		});

		it("ignores a subscribe call carrying a payload", () => {
			const socket = makeSocket("s1");
			userSocketStore.set("s1", { username: "luffy", subscribe: false, socket });

			handlerRoomSubscribe(socket, { anything: true });

			expect(userSocketStore.get("s1")!.subscribe).toBe(false);
		});

		it("does not crash for an unknown session", () => {
			expect(() => handlerRoomSubscribe(makeSocket("inconnu"), undefined)).not.toThrow();
			expect(() => handlerRoomUnsubscribe(makeSocket("inconnu"), undefined)).not.toThrow();
		});

		it("unsubscribes the session", () => {
			const socket = makeSocket("s1");
			userSocketStore.set("s1", { username: "luffy", subscribe: true, socket });

			handlerRoomUnsubscribe(socket, undefined);

			expect(userSocketStore.get("s1")!.subscribe).toBe(false);
		});

		it("ignores an unsubscribe call carrying a payload", () => {
			const socket = makeSocket("s1");
			userSocketStore.set("s1", { username: "luffy", subscribe: true, socket });

			handlerRoomUnsubscribe(socket, { anything: true });

			expect(userSocketStore.get("s1")!.subscribe).toBe(true);
		});
	});

	describe("handlerRoomLeave", () => {
		it("removes the player and notifies the ones left", () => {
			const { room, sockets } = seedRoom("salle1", ["luffy", "zoro"]);
			const leaving = sockets.get("zoro")!;

			handlerRoomLeave(leaving, undefined);

			expect(room.countPlayer()).toBe(1);
			expect(leaving.emit).toHaveBeenCalledWith("room:left");
			expect(lastEmit(sockets.get("luffy")!, "room:players")).toBeDefined();
		});

		it("deletes the room when the last player leaves", () => {
			const { sockets } = seedRoom("salle1", ["luffy"]);

			handlerRoomLeave(sockets.get("luffy")!, undefined);

			expect(roomSocketStore.has("salle1")).toBe(false);
		});

		it("does nothing when the socket is in no room", () => {
			const socket = makeSocket("s9");
			handlerRoomLeave(socket, undefined);
			expect(socket.emit).not.toHaveBeenCalled();
		});

		it("ignores the call when a payload is given", () => {
			const { room, sockets } = seedRoom("salle1", ["luffy"]);
			handlerRoomLeave(sockets.get("luffy")!, { anything: true });
			expect(room.countPlayer()).toBe(1);
		});
	});

	describe("handleRoomKick", () => {
		it("lets the host kick a player", () => {
			const { room, sockets } = seedRoom("salle1", ["luffy", "zoro"]);

			handleRoomKick(sockets.get("luffy")!, { username: "zoro" });

			expect(room.countPlayer()).toBe(1);
			expect(sockets.get("zoro")!.emit).toHaveBeenCalledWith("room:kicked");
			expect(lastEmit(sockets.get("luffy")!, "room:players")).toBeDefined();
		});

		it("refuses an invalid payload", () => {
			const socket = makeSocket("s1");
			handleRoomKick(socket, { user: "zoro" });
			expect(socket.emit).toHaveBeenCalledWith("system:Error", {
				event: "room:kick",
				message: "Invalid payload",
			});
		});

		it("does nothing when the socket is in no room", () => {
			const socket = makeSocket("s9");
			handleRoomKick(socket, { username: "zoro" });
			expect(socket.emit).not.toHaveBeenCalled();
		});

		it("refuses an unknown username", () => {
			const { sockets } = seedRoom("salle1", ["luffy"]);
			handleRoomKick(sockets.get("luffy")!, { username: "shanks" });
			expect(lastEmit(sockets.get("luffy")!, "system:Error")![1]).toMatchObject({ message: "Invalid username" });
		});

		it("refuses a non-host", () => {
			const { room, sockets } = seedRoom("salle1", ["luffy", "zoro"]);

			handleRoomKick(sockets.get("zoro")!, { username: "luffy" });

			expect(room.countPlayer()).toBe(2);
			expect(lastEmit(sockets.get("zoro")!, "system:Error")![1]).toMatchObject({
				message: "Only host can kick players",
			});
		});
	});

	describe("handleRoomMode", () => {
		it("lets the host change the mode and broadcasts the settings", () => {
			const { room, sockets } = seedRoom("salle1", ["luffy", "zoro"]);

			handleRoomMode(sockets.get("luffy")!, { mode: "ultra" });

			expect(room.getMode()).toBe("ultra");
			expect(lastEmit(sockets.get("zoro")!, "room:settings")![1]).toEqual({ mode: "ultra", private: false });
		});

		it("refuses an invalid payload", () => {
			const socket = makeSocket("s1");
			handleRoomMode(socket, {});
			expect(socket.emit).toHaveBeenCalledWith("system:Error", {
				event: "room:setMode",
				message: "Invalid payload",
			});
		});

		it("does nothing when the socket is in no room", () => {
			const socket = makeSocket("s9");
			handleRoomMode(socket, { mode: "ultra" });
			expect(socket.emit).not.toHaveBeenCalled();
		});

		it("refuses an unknown mode", () => {
			const { room, sockets } = seedRoom("salle1", ["luffy"]);

			handleRoomMode(sockets.get("luffy")!, { mode: "hardcore" });

			expect(room.getMode()).toBe("classique");
			expect(lastEmit(sockets.get("luffy")!, "system:Error")![1]).toMatchObject({
				message: "Invalid Mode or Not Host",
			});
		});

		it("refuses a non-host", () => {
			const { room, sockets } = seedRoom("salle1", ["luffy", "zoro"]);
			handleRoomMode(sockets.get("zoro")!, { mode: "ultra" });
			expect(room.getMode()).toBe("classique");
		});
	});

	describe("handleRoomSetPrivate", () => {
		it("lets the host toggle the visibility", () => {
			const { room, sockets } = seedRoom("salle1", ["luffy"]);

			handleRoomSetPrivate(sockets.get("luffy")!, { private: true });

			expect(room.getPrivate()).toBe(true);
			expect(lastEmit(sockets.get("luffy")!, "room:settings")![1]).toEqual({ mode: "classique", private: true });
		});

		it("refuses an invalid payload", () => {
			const socket = makeSocket("s1");
			handleRoomSetPrivate(socket, { private: "oui" });
			expect(socket.emit).toHaveBeenCalledWith("system:Error", {
				event: "room:setPrivate",
				message: "Invalid payload",
			});
		});

		it("does nothing when the socket is in no room", () => {
			const socket = makeSocket("s9");
			handleRoomSetPrivate(socket, { private: true });
			expect(socket.emit).not.toHaveBeenCalled();
		});

		it("refuses a non-host", () => {
			const { room, sockets } = seedRoom("salle1", ["luffy", "zoro"]);

			handleRoomSetPrivate(sockets.get("zoro")!, { private: true });

			expect(room.getPrivate()).toBe(false);
			expect(lastEmit(sockets.get("zoro")!, "system:Error")![1]).toMatchObject({
				message: "only host can change visibility",
			});
		});
	});

	describe("handleRoomStart", () => {
		it("starts the game when the host asks for it", () => {
			const { room, sockets } = seedRoom("salle1", ["luffy", "zoro"]);

			handleRoomStart(sockets.get("luffy")!, undefined);

			expect(room.getStatus()).toBe("playing");
			expect(room.getGame()).toBeInstanceOf(Game);
			expect(lastEmit(sockets.get("luffy")!, "game:start")).toBeDefined();
			expect(lastEmit(sockets.get("zoro")!, "game:start")).toBeDefined();
		});

		it("does not start the game for a non-host", () => {
			const { room, sockets } = seedRoom("salle1", ["luffy", "zoro"]);

			handleRoomStart(sockets.get("zoro")!, undefined);

			expect(room.getStatus()).toBe("waiting");
			expect(room.getGame()).toBeNull();
			expect(lastEmit(sockets.get("zoro")!, "game:start")).toBeUndefined();
		});

		it("does nothing when the socket is in no room", () => {
			expect(() => handleRoomStart(makeSocket("s9"), undefined)).not.toThrow();
		});

		// Regression: la Game etait construite AVANT le controle d'hote, et son
		// constructeur rattache tous les joueurs (setGame/setInGame).
		it("leaves every player untouched when a non-host asks for the start", () => {
			const { room, sockets } = seedRoom("salle1", ["luffy", "zoro"]);

			handleRoomStart(sockets.get("zoro")!, undefined);

			for (const player of room.getPlayers()) {
				expect(player.getInGame()).toBe(false);
				expect(player.getGame()).toBeUndefined();
			}
		});

		// Regression: un second start creait une seconde Game (et un second setInterval)
		// sans nettoyer la premiere.
		it("ignores a second start while the game is already running", () => {
			const { room, sockets } = seedRoom("salle1", ["luffy", "zoro"]);

			handleRoomStart(sockets.get("luffy")!, undefined);
			const firstGame = room.getGame();
			handleRoomStart(sockets.get("luffy")!, undefined);

			expect(room.getGame()).toBe(firstGame);
			expect(room.getStatus()).toBe("playing");
		});

		it("ignores the call when a payload is given", () => {
			const { room, sockets } = seedRoom("salle1", ["luffy"]);
			handleRoomStart(sockets.get("luffy")!, { anything: true });
			expect(room.getStatus()).toBe("waiting");
		});
	});

	describe("handleMove / handleRotate / handleDrop", () => {
		function startedRoom() {
			const seeded = seedRoom("salle1", ["luffy", "zoro"]);
			handleRoomStart(seeded.sockets.get("luffy")!, undefined);
			for (const socket of seeded.sockets.values()) socket.emit.mockClear();
			return seeded;
		}

		it("moves the piece of the player", () => {
			const { room, sockets } = startedRoom();
			const game = room.getGame()!;
			const state = game.getPlayerStateBySocketId("sock-luffy")!;
			const before = state.currentPiece!.getX();

			handleMove(sockets.get("luffy")!, { direction: "left" });

			expect(state.currentPiece!.getX()).toBe(before - 1);
		});

		it("refuses an invalid direction", () => {
			const { sockets } = startedRoom();
			handleMove(sockets.get("luffy")!, { direction: "up" });
			expect(lastEmit(sockets.get("luffy")!, "system:Error")![1]).toMatchObject({ message: "Invalid payload" });
		});

		it("refuses a missing payload", () => {
			const { sockets } = startedRoom();
			handleMove(sockets.get("luffy")!, undefined);
			expect(lastEmit(sockets.get("luffy")!, "system:Error")).toBeDefined();
		});

		it("refuses a payload without direction", () => {
			const { sockets } = startedRoom();
			handleMove(sockets.get("luffy")!, { dir: "left" });
			expect(lastEmit(sockets.get("luffy")!, "system:Error")).toBeDefined();
		});

		it("ignores a spectator", () => {
			const { room, sockets } = startedRoom();
			const game = room.getGame()!;
			const state = game.getPlayerStateBySocketId("sock-luffy")!;
			spectatorSocketStore.set("sock-luffy", { game, player: state.player });
			const before = state.currentPiece!.getX();

			handleMove(sockets.get("luffy")!, { direction: "left" });
			handleRotate(sockets.get("luffy")!, undefined);
			handleDrop(sockets.get("luffy")!, undefined);

			expect(state.currentPiece!.getX()).toBe(before);
			expect(sockets.get("luffy")!.emit).not.toHaveBeenCalled();
		});

		it("does nothing when the socket is in no room", () => {
			const orphan = makeSocket("s9");
			handleMove(orphan, { direction: "left" });
			handleRotate(orphan, undefined);
			handleDrop(orphan, undefined);
			expect(orphan.emit).not.toHaveBeenCalled();
		});

		it("does nothing when the room has no running game", () => {
			const { sockets } = seedRoom("salle1", ["luffy"]);
			const socket = sockets.get("luffy")!;

			handleMove(socket, { direction: "left" });
			handleRotate(socket, undefined);
			handleDrop(socket, undefined);

			expect(lastEmit(socket, "game:update")).toBeUndefined();
		});

		it("rotates the piece", () => {
			const { room, sockets } = startedRoom();
			const state = room.getGame()!.getPlayerStateBySocketId("sock-luffy")!;
			state.currentPiece!.shape = [[1, 1, 1, 1]];

			handleRotate(sockets.get("luffy")!, undefined);

			expect(state.currentPiece!.shape).toEqual([[1], [1], [1], [1]]);
		});

		it("ignores a rotate carrying a payload", () => {
			const { room, sockets } = startedRoom();
			const state = room.getGame()!.getPlayerStateBySocketId("sock-luffy")!;
			state.currentPiece!.shape = [[1, 1, 1, 1]];

			handleRotate(sockets.get("luffy")!, { anything: true });

			expect(state.currentPiece!.shape).toEqual([[1, 1, 1, 1]]);
		});

		it("hard drops the piece to the bottom", () => {
			const { room, sockets } = startedRoom();
			const state = room.getGame()!.getPlayerStateBySocketId("sock-luffy")!;

			handleDrop(sockets.get("luffy")!, undefined);

			expect(state.pieceIndex).toBe(1);
			expect(state.board.some((row) => row.some((cell) => cell !== 0))).toBe(true);
		});

		it("ignores a drop carrying a payload", () => {
			const { room, sockets } = startedRoom();
			const state = room.getGame()!.getPlayerStateBySocketId("sock-luffy")!;

			handleDrop(sockets.get("luffy")!, { anything: true });

			expect(state.pieceIndex).toBe(0);
		});
	});

	describe("handleSubscribeSpectator / handleUnsubscribeSpectator", () => {
		function startedRoom() {
			const seeded = seedRoom("salle1", ["luffy", "zoro"]);
			handleRoomStart(seeded.sockets.get("luffy")!, undefined);
			return seeded;
		}

		it("subscribes a spectator to a named player", () => {
			const { sockets } = startedRoom();
			const spectator = makeSocket("spec1");

			handleSubscribeSpectator(spectator, { roomId: "salle1", user: "zoro" });

			expect(spectatorSocketStore.get("spec1")!.player.getName()).toBe("zoro");
			expect(lastEmit(spectator, "game:SpectatorGame")).toBeDefined();
			expect(sockets.get("zoro")).toBeDefined();
		});

		it("falls back to the first player when user is null", () => {
			startedRoom();
			const spectator = makeSocket("spec1");

			handleSubscribeSpectator(spectator, { roomId: "salle1", user: null });

			expect(spectatorSocketStore.get("spec1")!.player.getName()).toBe("luffy");
		});

		it("refuses an invalid payload", () => {
			const spectator = makeSocket("spec1");
			handleSubscribeSpectator(spectator, { roomId: "salle1" });
			expect(lastEmit(spectator, "system:Error")![1]).toMatchObject({ message: "Invalid payload" });
		});

		it("refuses an unknown room", () => {
			const spectator = makeSocket("spec1");
			handleSubscribeSpectator(spectator, { roomId: "inconnue", user: null });
			expect(lastEmit(spectator, "system:Error")![1]).toMatchObject({ message: "Room not found" });
		});

		it("refuses a room that is not playing", () => {
			seedRoom("salle1", ["luffy"]);
			const spectator = makeSocket("spec1");

			handleSubscribeSpectator(spectator, { roomId: "salle1", user: null });

			expect(lastEmit(spectator, "system:Error")![1]).toMatchObject({ message: "Game not found" });
		});

		it("refuses a room playing without game attached", () => {
			const { room } = seedRoom("salle1", ["luffy"]);
			room.setStatus("playing");
			const spectator = makeSocket("spec1");

			handleSubscribeSpectator(spectator, { roomId: "salle1", user: null });

			expect(lastEmit(spectator, "system:Error")![1]).toMatchObject({ message: "Game not found" });
		});

		it("refuses an unknown player", () => {
			startedRoom();
			const spectator = makeSocket("spec1");

			handleSubscribeSpectator(spectator, { roomId: "salle1", user: "shanks" });

			expect(lastEmit(spectator, "system:Error")![1]).toMatchObject({ message: "Player not found" });
		});

		it("refuses an empty username", () => {
			startedRoom();
			const spectator = makeSocket("spec1");

			handleSubscribeSpectator(spectator, { roomId: "salle1", user: "" });

			expect(lastEmit(spectator, "system:Error")![1]).toMatchObject({ message: "Player not found" });
		});

		it("unsubscribes the spectator", () => {
			startedRoom();
			const spectator = makeSocket("spec1");
			handleSubscribeSpectator(spectator, { roomId: "salle1", user: null });

			handleUnsubscribeSpectator(spectator, undefined);

			expect(spectatorSocketStore.has("spec1")).toBe(false);
		});

		it("ignores an unsubscribe carrying a payload", () => {
			startedRoom();
			const spectator = makeSocket("spec1");
			handleSubscribeSpectator(spectator, { roomId: "salle1", user: null });

			handleUnsubscribeSpectator(spectator, { anything: true });

			expect(spectatorSocketStore.has("spec1")).toBe(true);
		});
	});
});
