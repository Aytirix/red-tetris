import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { Socket } from "socket.io";

vi.mock("../../../config/prisma.js", () => ({ prisma: {} }));
vi.mock("../../../services/playerService.js", () => ({ createPlayer: vi.fn() }));
vi.mock("../../../services/shopService.js", () => ({ settleGameRewards: vi.fn(async () => undefined) }));

import {
	handleRoomKick,
	handleRoomMode,
	handleRoomSetPrivate,
	handleRoomStart,
	handleSubscribeSpectator,
	handlerRoomJoin,
	handlerRoomLeave,
} from "./roomHandlers.js";
import { handlerDisconnect } from "./systemSocket.js";
import { createPlayer } from "../../../services/playerService.js";
import { Player } from "../../../core/Player.js";
import { Room } from "../../../core/room.js";
import { Game } from "../../../core/Game.js";
import { roomSocketStore } from "../roomSocketStore.js";
import { userSocketStore } from "../userSocketStore.js";
import { spectatorSocketStore } from "../spectatorSocketStore.js";

type FakeSocket = Socket & { emit: ReturnType<typeof vi.fn>; on: ReturnType<typeof vi.fn> };

function makeSocket(id: string): FakeSocket {
	return { id, emit: vi.fn(), on: vi.fn(), join: vi.fn(), leave: vi.fn() } as unknown as FakeSocket;
}

function makePlayer(name: string, socket: Socket): Player {
	return new Player(name, socket, `${name}-avatar`, "pirate");
}

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

/** Demarre une vraie partie sur la room (etat "playing" + Game attachee). */
function startGame(room: Room): Game {
	const game = new Game(room.getMode(), room.getPlayers(), room);
	room.setStatus("playing");
	room.setGame(game);
	game.start();
	return game;
}

function errorsOf(socket: FakeSocket): string[] {
	return socket.emit.mock.calls
		.filter((call) => call[0] === "system:Error")
		.map((call) => (call[1] as { message: string }).message);
}

describe("garde-fous d'integrite de partie", () => {
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

	// --- Le spectre du sujet ne doit pas etre contournable ---------------------
	describe("game:subscribeSpectatorGame", () => {
		it("refuse l'abonnement d'un joueur encore vivant de la partie", () => {
			const { room, sockets } = seedRoom("arene", ["luffy", "zoro"]);
			startGame(room);
			const luffy = sockets.get("luffy")!;
			luffy.emit.mockClear();

			handleSubscribeSpectator(luffy, { roomId: "arene", user: "zoro" });

			expect(errorsOf(luffy)).toContain("Alive players cannot spectate");
			expect(spectatorSocketStore.has(luffy.id)).toBe(false);
			const frames = luffy.emit.mock.calls.filter((call) => call[0] === "game:SpectatorGame");
			expect(frames).toHaveLength(0);
		});

		it("autorise un joueur elimine a spectater", () => {
			const { room, sockets } = seedRoom("arene", ["luffy", "zoro"]);
			const game = startGame(room);
			const luffy = sockets.get("luffy")!;
			game.getPlayerStateBySocketId(luffy.id)!.isAlive = false;
			luffy.emit.mockClear();

			handleSubscribeSpectator(luffy, { roomId: "arene", user: "zoro" });

			expect(errorsOf(luffy)).toHaveLength(0);
			expect(spectatorSocketStore.has(luffy.id)).toBe(true);
		});

		it("autorise un socket exterieur a la partie a spectater", () => {
			const { room } = seedRoom("arene", ["luffy", "zoro"]);
			startGame(room);
			const visiteur = makeSocket("sock-visiteur");
			userSocketStore.set(visiteur.id, { username: "nami", subscribe: false, socket: visiteur });

			handleSubscribeSpectator(visiteur, { roomId: "arene", user: null });

			expect(errorsOf(visiteur)).toHaveLength(0);
			expect(spectatorSocketStore.has(visiteur.id)).toBe(true);
		});
	});

	// --- Une partie en cours ne doit plus etre alterable par la room -----------
	describe("mutations de room pendant une partie", () => {
		it("refuse room:kick tant que la partie tourne", () => {
			const { room, sockets } = seedRoom("arene", ["luffy", "zoro"]);
			startGame(room);
			const host = sockets.get("luffy")!;
			host.emit.mockClear();

			handleRoomKick(host, { username: "zoro" });

			expect(errorsOf(host)).toContain("Cannot kick during a running game");
			expect(room.getPlayers().map((player) => player.getName())).toEqual(["luffy", "zoro"]);
		});

		it("autorise toujours room:kick dans le lobby", () => {
			const { room, sockets } = seedRoom("arene", ["luffy", "zoro"]);
			const host = sockets.get("luffy")!;

			handleRoomKick(host, { username: "zoro" });

			expect(room.getPlayers().map((player) => player.getName())).toEqual(["luffy"]);
		});

		it("refuse room:setMode et room:setPrivate pendant une partie", () => {
			const { room, sockets } = seedRoom("arene", ["luffy", "zoro"]);
			startGame(room);
			const host = sockets.get("luffy")!;
			host.emit.mockClear();

			handleRoomMode(host, { mode: "sprint" });
			handleRoomSetPrivate(host, { private: true });

			expect(room.getMode()).toBe("classique");
			expect(room.getPrivate()).toBe(false);
			expect(errorsOf(host)).toEqual([
				"Cannot change mode during a running game",
				"Cannot change visibility during a running game",
			]);
		});
	});

	// --- Mode "mains": caméra obligatoire avant de lancer ----------------------
	describe("mode mains — caméra obligatoire", () => {
		beforeEach(() => { vi.useFakeTimers(); });

		it("refuse le lancement tant qu'un joueur n'a pas activé sa caméra", () => {
			const { room, sockets } = seedRoom("arene", ["luffy", "zoro"]);
			const host = sockets.get("luffy")!;
			handleRoomMode(host, { mode: "mains" });
			room.findPlayerByName("luffy")!.setCameraReady(true);
			// zoro n'est pas prêt.
			host.emit.mockClear();

			handleRoomStart(host, undefined);
			vi.advanceTimersByTime(3000);

			expect(errorsOf(host)).toContain("All players must enable their camera");
			expect(room.getStatus()).toBe("waiting");
			expect(room.getGame()).toBeNull();
		});

		it("lance quand TOUS les joueurs sont prêts", () => {
			const { room, sockets } = seedRoom("arene", ["luffy", "zoro"]);
			const host = sockets.get("luffy")!;
			handleRoomMode(host, { mode: "mains" });
			for (const player of room.getPlayers()) player.setCameraReady(true);

			handleRoomStart(host, undefined);
			vi.advanceTimersByTime(3000);

			expect(room.getStatus()).toBe("playing");
			expect(room.getGame()).toBeInstanceOf(Game);
		});

		it("les autres modes ne sont pas concernés par la caméra", () => {
			const { room, sockets } = seedRoom("arene", ["luffy", "zoro"]);
			const host = sockets.get("luffy")!;
			handleRoomMode(host, { mode: "sprint" });
			// Personne n'est prêt, mais le mode n'est pas "mains".

			handleRoomStart(host, undefined);
			vi.advanceTimersByTime(3000);

			expect(room.getStatus()).toBe("playing");
			expect(room.getGame()).toBeInstanceOf(Game);
		});
	});

	// --- Un meme socket ne doit jamais compter deux fois -----------------------
	describe("room:join en double", () => {
		it("ne duplique pas le joueur et renvoie simplement room:joined", async () => {
			const socket = makeSocket("sock-luffy");
			userSocketStore.set(socket.id, { username: "luffy", subscribe: false, socket });

			await handlerRoomJoin(socket, { roomId: "arene" });
			await handlerRoomJoin(socket, { roomId: "arene" });

			const room = roomSocketStore.get("arene")!;
			expect(room.countPlayer()).toBe(1);
			expect(errorsOf(socket)).toHaveLength(0);
		});

		it("quitte l'ancienne room avant d'en rejoindre une autre", async () => {
			const socket = makeSocket("sock-luffy");
			userSocketStore.set(socket.id, { username: "luffy", subscribe: false, socket });

			await handlerRoomJoin(socket, { roomId: "arene" });
			await handlerRoomJoin(socket, { roomId: "autre" });

			expect(errorsOf(socket)).toHaveLength(0);
			// L'ancienne room est vide donc supprimee, et le joueur n'apparait qu'une fois.
			expect(roomSocketStore.has("arene")).toBe(false);
			expect(roomSocketStore.get("autre")!.countPlayer()).toBe(1);
			const rooms = [...roomSocketStore.values()].filter((room) =>
				room.getPlayers().some((player) => player.getSocketId() === socket.id),
			);
			expect(rooms).toHaveLength(1);
		});

		it("laisse l'ancienne room vivante si d'autres joueurs y restent", async () => {
			const { sockets } = seedRoom("arene", ["luffy", "zoro"]);
			const luffy = sockets.get("luffy")!;

			await handlerRoomJoin(luffy, { roomId: "autre" });

			expect(roomSocketStore.get("arene")!.getPlayers().map((p) => p.getName())).toEqual(["zoro"]);
			expect(roomSocketStore.get("autre")!.countPlayer()).toBe(1);
		});

		it("Room.addPlayer refuse un socketId deja present", () => {
			const room = new Room("arene");
			const socket = makeSocket("sock-luffy");
			expect(room.addPlayer(makePlayer("luffy", socket))).toBe(true);
			expect(room.addPlayer(makePlayer("luffy", socket))).toBe(false);
			expect(room.countPlayer()).toBe(1);
		});
	});

	// --- Quitter en pleine partie ne doit pas laisser la boucle tourner --------
	describe("depart d'un joueur pendant la partie", () => {
		it("room:leave termine la partie et arrete la boucle de gravite", () => {
			const { room, sockets } = seedRoom("arene", ["luffy", "zoro"]);
			const game = startGame(room);
			const zoro = sockets.get("zoro")!;
			const luffy = sockets.get("luffy")!;
			luffy.emit.mockClear();

			handlerRoomLeave(zoro, undefined);

			expect(game.getPlayerStateBySocketId(zoro.id)!.isAlive).toBe(false);
			expect(room.getStatus()).toBe("waiting");
			expect(room.getGame()).toBeNull();
			expect(luffy.emit.mock.calls.some((call) => call[0] === "game:over")).toBe(true);

			// Plus aucune frame apres coup: l'interval a bien ete nettoye.
			luffy.emit.mockClear();
			vi.advanceTimersByTime(5000);
			expect(luffy.emit).not.toHaveBeenCalled();
		});

		it("la deconnexion produit le meme nettoyage", () => {
			const { room, sockets } = seedRoom("arene", ["luffy", "zoro"]);
			const game = startGame(room);
			const zoro = sockets.get("zoro")!;
			handlerDisconnect(zoro);
			const disconnectHandler = zoro.on.mock.calls.find((call) => call[0] === "disconnect")![1] as () => void;

			disconnectHandler();

			expect(game.getPlayerStateBySocketId(zoro.id)!.isAlive).toBe(false);
			expect(room.getStatus()).toBe("waiting");
			expect(room.getGame()).toBeNull();
		});

		it("ne touche pas a la partie quand le socket n'appartient pas a la room", () => {
			const { room } = seedRoom("arene", ["luffy", "zoro"]);
			const game = startGame(room);
			const etranger = makeSocket("sock-etranger");

			handlerDisconnect(etranger);
			const disconnectHandler = etranger.on.mock.calls.find((call) => call[0] === "disconnect")![1] as () => void;
			disconnectHandler();

			expect(room.getStatus()).toBe("playing");
			expect([...game.getState().values()].every((state) => state.isAlive)).toBe(true);
		});
	});

	// --- Les abonnements spectateur ne doivent pas survivre a la partie --------
	it("purge les abonnements spectateur a la fin de la partie", () => {
		const { room, sockets } = seedRoom("arene", ["luffy", "zoro"]);
		const game = startGame(room);
		const luffy = sockets.get("luffy")!;
		game.getPlayerStateBySocketId(luffy.id)!.isAlive = false;
		handleSubscribeSpectator(luffy, { roomId: "arene", user: "zoro" });
		expect(spectatorSocketStore.has(luffy.id)).toBe(true);

		game.getPlayerStateBySocketId(sockets.get("zoro")!.id)!.isAlive = false;
		game.checkGameOver();

		expect(spectatorSocketStore.has(luffy.id)).toBe(false);
	});
});
