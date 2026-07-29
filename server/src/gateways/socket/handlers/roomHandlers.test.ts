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
	handleRoomRestart,
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
import { MAX_PLAYERS_PER_ROOM, Room } from "../../../core/room.js";
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
		it("signale l'erreur sur une room existante quand le joueur ne peut pas etre cree", async () => {
			const { room } = seedRoom("salle1", ["luffy"]);
			const socket = makeSocket("s2");

			await handlerRoomJoin(socket, { roomId: "salle1" });

			expect(room.countPlayer()).toBe(1);
			expect(socket.emit).toHaveBeenCalledWith("system:Error", {
				event: "room:join",
				message: "Failed to join room",
			});
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

		it("refuse un non-membre qui force l'URL d'une room privee", async () => {
			const { room, sockets } = seedRoom("salle1", ["luffy"]);
			room.setPrivate(true, sockets.get("luffy")!);
			const intrus = makeSocket("s2");
			userSocketStore.set("s2", { username: "zoro", subscribe: false, socket: intrus });

			await handlerRoomJoin(intrus, { roomId: "salle1" });

			expect(room.countPlayer()).toBe(1);
			expect(lastEmit(intrus, "room:denied")).toEqual(["room:denied", { reason: "private" }]);
			expect(lastEmit(intrus, "room:joined")).toBeUndefined();
		});

		// B5: la capacite annoncee par room:list n'etait appliquee nulle part.
		it("refuse un joueur de plus une fois la room complete", async () => {
			const { room } = seedRoom("salle1", ["luffy", "zoro", "nami", "usopp"]);
			expect(room.countPlayer()).toBe(MAX_PLAYERS_PER_ROOM);
			const detrop = makeSocket("s5");
			userSocketStore.set("s5", { username: "sanji", subscribe: false, socket: detrop });

			await handlerRoomJoin(detrop, { roomId: "salle1" });

			expect(room.countPlayer()).toBe(MAX_PLAYERS_PER_ROOM);
			expect(lastEmit(detrop, "room:denied")).toEqual(["room:denied", { reason: "full" }]);
			expect(lastEmit(detrop, "room:joined")).toBeUndefined();
		});
		it("laisse revenir un membre dont l'ancien socket occupe encore sa place", async () => {
			const { room } = seedRoom("salle1", ["luffy", "zoro", "nami", "usopp"]);
			const ancienSocketId = room.findPlayerByName("usopp")!.getSocketId();
			// Reconnexion: meme pseudo, nouveau socket.id (c'est ce que fait un refresh).
			const revenant = makeSocket("sock-usopp-2");
			userSocketStore.set(revenant.id, { username: "usopp", subscribe: false, socket: revenant });

			await handlerRoomJoin(revenant, { roomId: "salle1" });

			expect(lastEmit(revenant, "room:denied")).toBeUndefined();
			expect(lastEmit(revenant, "room:joined")![1]).toMatchObject({ joined: true });
			// Le fantome a cede sa place: l'effectif ne depasse pas la capacite.
			expect(room.countPlayer()).toBe(MAX_PLAYERS_PER_ROOM);
			const socketIds = room.getPlayers().map((player) => player.getSocketId());
			expect(socketIds).toContain(revenant.id);
			expect(socketIds).not.toContain(ancienSocketId);
		});

		it("laisse entrer tant que la room n'est pas complete", async () => {
			const { room } = seedRoom("salle1", ["luffy", "zoro", "nami"]);
			const dernier = makeSocket("s4");
			userSocketStore.set("s4", { username: "usopp", subscribe: false, socket: dernier });

			await handlerRoomJoin(dernier, { roomId: "salle1" });

			expect(room.countPlayer()).toBe(MAX_PLAYERS_PER_ROOM);
			expect(lastEmit(dernier, "room:denied")).toBeUndefined();
			expect(lastEmit(dernier, "room:joined")![1]).toMatchObject({ joined: true });
		});

		// Une room COMPLETE mais deja lancee garde son chemin existant: le nouvel
		// arrivant devient spectateur, il ne doit pas etre refuse.
		it("bascule en spectateur (et non en refus) sur une room complete deja lancee", async () => {
			const { room } = seedRoom("salle1", ["luffy", "zoro", "nami", "usopp"]);
			room.setStatus("playing");
			const tardif = makeSocket("s5");
			userSocketStore.set("s5", { username: "sanji", subscribe: false, socket: tardif });

			await handlerRoomJoin(tardif, { roomId: "salle1" });

			expect(lastEmit(tardif, "room:denied")).toBeUndefined();
			expect(lastEmit(tardif, "room:joined")![1]).toMatchObject({ joined: false });
		});

		it("refuse un non-membre qui force l'URL d'une partie solo", async () => {
			const { room } = seedRoom("sologame_luffy", ["luffy"]);
			expect(room.getPrivate()).toBe(true);
			const intrus = makeSocket("s2");
			userSocketStore.set("s2", { username: "zoro", subscribe: false, socket: intrus });

			await handlerRoomJoin(intrus, { roomId: "sologame_luffy" });

			expect(room.countPlayer()).toBe(1);
			expect(lastEmit(intrus, "room:denied")).toEqual(["room:denied", { reason: "private" }]);
		});

		it("laisse un membre existant rejoindre sa room privee (idempotent)", async () => {
			const { room, sockets } = seedRoom("salle1", ["luffy"]);
			room.setPrivate(true, sockets.get("luffy")!);

			await handlerRoomJoin(sockets.get("luffy")!, { roomId: "salle1" });

			expect(lastEmit(sockets.get("luffy")!, "room:denied")).toBeUndefined();
			expect(lastEmit(sockets.get("luffy")!, "room:joined")).toBeDefined();
		});

		it("laisse un membre revenir dans une room privee apres reconnexion (nouveau socket)", async () => {
			const { room, sockets } = seedRoom("salle1", ["luffy", "zoro"]);
			room.setPrivate(true, sockets.get("luffy")!);
			// zoro se deconnecte (refresh): son slot est libere mais la room survit (luffy reste).
			room.removePlayerBySocketId(sockets.get("zoro")!.id);
			expect(room.countPlayer()).toBe(1);
			// zoro revient avec un NOUVEAU socket.id mais le meme pseudo.
			const zoroReco = makeSocket("s-zoro-2");
			userSocketStore.set("s-zoro-2", { username: "zoro", subscribe: false, socket: zoroReco });

			await handlerRoomJoin(zoroReco, { roomId: "salle1" });

			expect(lastEmit(zoroReco, "room:denied")).toBeUndefined();
			expect(lastEmit(zoroReco, "room:joined")).toBeDefined();
			expect(room.countPlayer()).toBe(2);
		});

		it("refuse l'auto-kick (sinon la room privee devient injoignable a vie)", async () => {
			const { room, sockets } = seedRoom("salle1", ["luffy"]);
			room.setPrivate(true, sockets.get("luffy")!);

			handleRoomKick(sockets.get("luffy")!, { username: "luffy" });

			// L'hote reste en place ET reste membre: il peut toujours revenir.
			expect(room.countPlayer()).toBe(1);
			expect(room.isMember("luffy")).toBe(true);
			expect(lastEmit(sockets.get("luffy")!, "system:Error")![1]).toEqual({
				event: "room:kick",
				message: "Cannot kick yourself",
			});
		});

		it("refuse un membre EXPULSE de revenir dans une room privee", async () => {
			const { room, sockets } = seedRoom("salle1", ["luffy", "zoro"]);
			room.setPrivate(true, sockets.get("luffy")!);
			// L'hote expulse zoro: le kick revoque son appartenance.
			handleRoomKick(sockets.get("luffy")!, { username: "zoro" });
			expect(room.isMember("zoro")).toBe(false);
			// zoro tente de revenir (nouveau socket, meme pseudo): il est desormais un inconnu.
			const zoroReco = makeSocket("s-zoro-2");
			userSocketStore.set("s-zoro-2", { username: "zoro", subscribe: false, socket: zoroReco });

			await handlerRoomJoin(zoroReco, { roomId: "salle1" });

			expect(lastEmit(zoroReco, "room:denied")).toEqual(["room:denied", { reason: "private" }]);
			expect(lastEmit(zoroReco, "room:joined")).toBeUndefined();
			expect(room.countPlayer()).toBe(1);
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
		it("lets the host set the classique mode and broadcasts the settings", () => {
			const { room, sockets } = seedRoom("salle1", ["luffy", "zoro"]);

			handleRoomMode(sockets.get("luffy")!, { mode: "classique" });

			expect(room.getMode()).toBe("classique");
			expect(lastEmit(sockets.get("zoro")!, "room:settings")![1]).toEqual({ mode: "classique", private: false });
		});

		it("applique un mode alternatif et le diffuse", () => {
			const { room, sockets } = seedRoom("salle1", ["luffy", "zoro"]);

			handleRoomMode(sockets.get("luffy")!, { mode: "invisible" });

			expect(room.getMode()).toBe("invisible");
			expect(lastEmit(sockets.get("zoro")!, "room:settings")![1]).toEqual({ mode: "invisible", private: false });
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
			handleRoomMode(sockets.get("zoro")!, { mode: "classique" });
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

		it("re-pousse la liste publique aux abonnes quand la room devient privee", () => {
			const { sockets } = seedRoom("salle1", ["luffy"]);
			const watcher = makeSocket("watcher");
			userSocketStore.set("watcher", { username: "watcher", subscribe: true, socket: watcher });

			handleRoomSetPrivate(sockets.get("luffy")!, { private: true });

			// La derniere room:list poussee au watcher ne contient plus salle1 (privee).
			const list = lastEmit(watcher, "room:list")![1] as { roomId: string }[];
			expect(list.map((r) => r.roomId)).not.toContain("salle1");
		});

		it("refuse de rendre publique une partie solo (forcee privee)", () => {
			const { room, sockets } = seedRoom("sologame_abc", ["luffy"]);
			expect(room.getPrivate()).toBe(true);

			handleRoomSetPrivate(sockets.get("luffy")!, { private: false });

			expect(room.getPrivate()).toBe(true);
			expect(lastEmit(sockets.get("luffy")!, "system:Error")![1]).toMatchObject({
				message: "only host can change visibility",
			});
		});
	});

	describe("handleRoomStart", () => {
		it("diffuse un decompte 3-2-1 puis demarre la partie", () => {
			const { room, sockets } = seedRoom("salle1", ["luffy", "zoro"]);

			handleRoomStart(sockets.get("luffy")!, undefined);

			// Verrou immediat, mais la Game n'existe pas encore: on affiche d'abord "3".
			expect(room.getStatus()).toBe("playing");
			expect(room.getGame()).toBeNull();
			expect(lastEmit(sockets.get("luffy")!, "game:countdown")).toEqual(["game:countdown", { value: 3 }]);
			expect(lastEmit(sockets.get("zoro")!, "game:countdown")).toEqual(["game:countdown", { value: 3 }]);
			expect(lastEmit(sockets.get("luffy")!, "game:start")).toBeUndefined();

			vi.advanceTimersByTime(1000);
			expect(lastEmit(sockets.get("luffy")!, "game:countdown")).toEqual(["game:countdown", { value: 2 }]);
			vi.advanceTimersByTime(1000);
			expect(lastEmit(sockets.get("luffy")!, "game:countdown")).toEqual(["game:countdown", { value: 1 }]);

			// A 3s, la partie demarre reellement.
			vi.advanceTimersByTime(1000);
			expect(room.getGame()).toBeInstanceOf(Game);
			expect(lastEmit(sockets.get("luffy")!, "game:start")).toBeDefined();
			expect(lastEmit(sockets.get("zoro")!, "game:start")).toBeDefined();
		});

		it("does not start the game for a non-host", () => {
			const { room, sockets } = seedRoom("salle1", ["luffy", "zoro"]);

			handleRoomStart(sockets.get("zoro")!, undefined);
			vi.advanceTimersByTime(3000);

			expect(room.getStatus()).toBe("waiting");
			expect(room.getGame()).toBeNull();
			expect(lastEmit(sockets.get("zoro")!, "game:countdown")).toBeUndefined();
			expect(lastEmit(sockets.get("zoro")!, "game:start")).toBeUndefined();
		});

		it("annule le decompte si la room se vide avant le demarrage", () => {
			const { room, sockets } = seedRoom("salle1", ["luffy", "zoro"]);

			handleRoomStart(sockets.get("luffy")!, undefined);
			vi.advanceTimersByTime(1000);
			handlerRoomLeave(sockets.get("luffy")!, undefined);
			handlerRoomLeave(sockets.get("zoro")!, undefined);

			// Aucune Game ne doit apparaitre apres coup, la room est supprimee.
			vi.advanceTimersByTime(5000);
			expect(roomSocketStore.has("salle1")).toBe(false);
			expect(room.getGame()).toBeNull();
		});

		it("does nothing when the socket is in no room", () => {
			expect(() => handleRoomStart(makeSocket("s9"), undefined)).not.toThrow();
		});

		// Regression: la Game etait construite AVANT le controle d'hote, et son
		// constructeur rattache tous les joueurs (setGame).
		it("leaves every player untouched when a non-host asks for the start", () => {
			const { room, sockets } = seedRoom("salle1", ["luffy", "zoro"]);

			handleRoomStart(sockets.get("zoro")!, undefined);

			for (const player of room.getPlayers()) {
				expect(player.getGame()).toBeUndefined();
			}
		});

		// Regression: un second start creait une seconde Game (et un second setInterval)
		// sans nettoyer la premiere.
		it("ignores a second start while the game is already running", () => {
			const { room, sockets } = seedRoom("salle1", ["luffy", "zoro"]);

			handleRoomStart(sockets.get("luffy")!, undefined);
			vi.advanceTimersByTime(3000);
			const firstGame = room.getGame();
			expect(firstGame).toBeInstanceOf(Game);
			handleRoomStart(sockets.get("luffy")!, undefined);
			vi.advanceTimersByTime(3000);

			expect(room.getGame()).toBe(firstGame);
			expect(room.getStatus()).toBe("playing");
		});

		it("ignores a second start pendant le decompte (avant le demarrage)", () => {
			const { room, sockets } = seedRoom("salle1", ["luffy", "zoro"]);

			handleRoomStart(sockets.get("luffy")!, undefined);
			// Pendant le decompte le status est deja "playing": un second start est ignore
			// et ne lance pas un deuxieme decompte.
			handleRoomStart(sockets.get("luffy")!, undefined);
			sockets.get("luffy")!.emit.mockClear();
			vi.advanceTimersByTime(3000);

			expect(room.getGame()).toBeInstanceOf(Game);
			const startCalls = sockets.get("luffy")!.emit.mock.calls.filter((c) => c[0] === "game:start");
			expect(startCalls).toHaveLength(1);
		});

		it("ignores the call when a payload is given", () => {
			const { room, sockets } = seedRoom("salle1", ["luffy"]);
			handleRoomStart(sockets.get("luffy")!, { anything: true });
			expect(room.getStatus()).toBe("waiting");
		});

		it("refuse de lancer Sprint a moins de 2 joueurs et signale l'erreur", () => {
			const { room, sockets } = seedRoom("salle1", ["luffy"]);
			handleRoomMode(sockets.get("luffy")!, { mode: "sprint" });

			handleRoomStart(sockets.get("luffy")!, undefined);
			vi.advanceTimersByTime(3000);

			expect(room.getStatus()).toBe("waiting");
			expect(room.getGame()).toBeNull();
			expect(lastEmit(sockets.get("luffy")!, "system:Error")![1]).toMatchObject({
				message: "Le mode Sprint nécessite au moins 2 joueurs",
			});
		});

		it("autorise Sprint des 2 joueurs", () => {
			const { room, sockets } = seedRoom("salle1", ["luffy", "zoro"]);
			handleRoomMode(sockets.get("luffy")!, { mode: "sprint" });

			handleRoomStart(sockets.get("luffy")!, undefined);

			expect(room.getStatus()).toBe("playing");
		});
	});

	describe("handleRoomRestart", () => {
		it("relance une NOUVELLE partie dans la meme room (stoppe l'ancienne)", () => {
			const { room, sockets } = seedRoom("solo", ["luffy"]);
			handleRoomStart(sockets.get("luffy")!, undefined);
			vi.advanceTimersByTime(3000);
			const firstGame = room.getGame();
			expect(firstGame).toBeInstanceOf(Game);

			handleRoomRestart(sockets.get("luffy")!, undefined);
			// Décompte 3-2-1 relancé, puis une nouvelle Game (instance différente).
			vi.advanceTimersByTime(3000);
			const secondGame = room.getGame();
			expect(secondGame).toBeInstanceOf(Game);
			expect(secondGame).not.toBe(firstGame);
			expect(room.getStatus()).toBe("playing");
		});
		it("purge les abonnements spectateur de l'ancienne partie", () => {
			const { room, sockets } = seedRoom("salle1", ["luffy", "zoro"]);
			handleRoomStart(sockets.get("luffy")!, undefined);
			vi.advanceTimersByTime(3000);
			const firstGame = room.getGame()!;
			const elimine = sockets.get("zoro")!;
			spectatorSocketStore.set(elimine.id, {
				game: firstGame,
				player: room.findPlayerByName("zoro")!,
			});

			handleRoomRestart(sockets.get("luffy")!, undefined);

			expect(spectatorSocketStore.has(elimine.id)).toBe(false);
		});

		it("relance aussi une partie deja terminee (room en attente)", () => {
			const { room, sockets } = seedRoom("solo", ["luffy"]);
			expect(room.getStatus()).toBe("waiting");

			handleRoomRestart(sockets.get("luffy")!, undefined);
			vi.advanceTimersByTime(3000);

			expect(room.getGame()).toBeInstanceOf(Game);
			expect(room.getStatus()).toBe("playing");
		});

		it("ignore un non-hote", () => {
			const { room, sockets } = seedRoom("salle1", ["luffy", "zoro"]);
			handleRoomStart(sockets.get("luffy")!, undefined);
			vi.advanceTimersByTime(3000);
			const game = room.getGame();

			handleRoomRestart(sockets.get("zoro")!, undefined);
			vi.advanceTimersByTime(3000);

			// La partie n'a pas ete relancee par le non-hote.
			expect(room.getGame()).toBe(game);
		});

		it("refuse de relancer Sprint a moins de 2 joueurs", () => {
			const { room, sockets } = seedRoom("solo", ["luffy"]);
			handleRoomMode(sockets.get("luffy")!, { mode: "sprint" });

			handleRoomRestart(sockets.get("luffy")!, undefined);
			vi.advanceTimersByTime(3000);

			expect(room.getGame()).toBeNull();
			expect(lastEmit(sockets.get("luffy")!, "system:Error")![1]).toMatchObject({
				message: "Le mode Sprint nécessite au moins 2 joueurs",
			});
		});

		it("ignore un payload non vide", () => {
			const { room, sockets } = seedRoom("solo", ["luffy"]);
			handleRoomRestart(sockets.get("luffy")!, { anything: true });
			vi.advanceTimersByTime(3000);
			expect(room.getGame()).toBeNull();
		});
	});

	describe("handleMove / handleRotate / handleDrop", () => {
		function startedRoom() {
			const seeded = seedRoom("salle1", ["luffy", "zoro"]);
			handleRoomStart(seeded.sockets.get("luffy")!, undefined);
			vi.advanceTimersByTime(3000);
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
			vi.advanceTimersByTime(3000);
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

		it("refuse un spectateur exterieur sur une room privee (message neutre)", () => {
			const seeded = seedRoom("salle1", ["luffy", "zoro"]);
			seeded.room.setPrivate(true, seeded.sockets.get("luffy")!);
			handleRoomStart(seeded.sockets.get("luffy")!, undefined);
			vi.advanceTimersByTime(3000);
			const intrus = makeSocket("spec-intrus");
			userSocketStore.set("spec-intrus", { username: "nami", subscribe: false, socket: intrus });

			handleSubscribeSpectator(intrus, { roomId: "salle1", user: "zoro" });

			// Message neutre "Room not found": on ne divulgue pas l'existence de la room privee.
			expect(lastEmit(intrus, "system:Error")![1]).toMatchObject({ message: "Room not found" });
			expect(spectatorSocketStore.has("spec-intrus")).toBe(false);
			expect(lastEmit(intrus, "game:SpectatorGame")).toBeUndefined();
		});

		it("laisse un membre elimine spectater sa room privee", () => {
			const seeded = seedRoom("salle1", ["luffy", "zoro"]);
			seeded.room.setPrivate(true, seeded.sockets.get("luffy")!);
			handleRoomStart(seeded.sockets.get("luffy")!, undefined);
			vi.advanceTimersByTime(3000);
			// zoro est elimine mais reste membre (pseudo enregistre a l'ajout).
			seeded.room.getGame()!.getPlayerStateBySocketId("sock-zoro")!.isAlive = false;

			handleSubscribeSpectator(seeded.sockets.get("zoro")!, { roomId: "salle1", user: "luffy" });

			expect(spectatorSocketStore.get("sock-zoro")!.player.getName()).toBe("luffy");
			expect(lastEmit(seeded.sockets.get("zoro")!, "game:SpectatorGame")).toBeDefined();
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
