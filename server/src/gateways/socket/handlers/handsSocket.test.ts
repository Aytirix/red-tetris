import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { Socket } from "socket.io";

// On ne charge JAMAIS tfjs dans les tests: le service de détection et le contrôleur
// sont mockés. On teste ici uniquement le câblage socket (état "prêt" + diffusion).
// vi.hoisted: les mocks sont remontés en tête de fichier, les vars doivent l'être aussi.
const { ensureHandDetector, handleHandsFrame, clearHandsController } = vi.hoisted(() => ({
	ensureHandDetector: vi.fn(async () => undefined),
	handleHandsFrame: vi.fn(async () => undefined),
	clearHandsController: vi.fn(),
}));

vi.mock("../../../hands/handDetectionService.js", () => ({
	HAND_INPUT_SIZE: 256,
	ensureHandDetector,
}));
vi.mock("../../../hands/handsController.js", () => ({
	handleHandsFrame,
	clearHandsController,
}));

import { registerHandsSocket } from "./handsSocket.js";
import { Player } from "../../../core/Player.js";
import { Room } from "../../../core/room.js";
import { roomSocketStore } from "../roomSocketStore.js";

type FakeSocket = Socket & { emit: ReturnType<typeof vi.fn>; on: ReturnType<typeof vi.fn> };
type Handler = (data: unknown) => void;

function makeSocket(id: string): FakeSocket {
	return { id, emit: vi.fn(), on: vi.fn(), join: vi.fn(), leave: vi.fn() } as unknown as FakeSocket;
}

/** Récupère le handler enregistré pour un event donné. */
function handlerFor(socket: FakeSocket, event: string): Handler {
	const call = socket.on.mock.calls.find((c) => c[0] === event);
	return call![1] as Handler;
}

function seedRoom(name: string, ids: string[]): { room: Room; sockets: Map<string, FakeSocket> } {
	const room = new Room(name);
	const sockets = new Map<string, FakeSocket>();
	for (const id of ids) {
		const socket = makeSocket(id);
		sockets.set(id, socket);
		room.addPlayer(new Player(id, socket, `${id}-avatar`, "pirate"));
	}
	roomSocketStore.set(name, room);
	return { room, sockets };
}

describe("handsSocket", () => {
	beforeEach(() => {
		roomSocketStore.clear();
		vi.clearAllMocks();
	});
	afterEach(() => { vi.restoreAllMocks(); });

	describe("hands:setReady", () => {
		it("marque le joueur prêt, précharge le modèle et rediffuse la liste", () => {
			const { room, sockets } = seedRoom("arene", ["luffy", "zoro"]);
			const luffy = sockets.get("luffy")!;
			registerHandsSocket(luffy);

			handlerFor(luffy, "hands:setReady")({ ready: true });

			expect(room.findPlayerByName("luffy")!.getCameraReady()).toBe(true);
			expect(ensureHandDetector).toHaveBeenCalledTimes(1);
			// Rediffusion à tous les joueurs de la room.
			for (const socket of sockets.values()) {
				const call = socket.emit.mock.calls.find((c) => c[0] === "room:players");
				expect(call).toBeDefined();
				expect(call![1]).toContainEqual(
					expect.objectContaining({ username: "luffy", ready: true }),
				);
			}
		});

		it("permet de repasser non prêt sans charger le modèle", () => {
			const { room, sockets } = seedRoom("arene", ["luffy"]);
			const luffy = sockets.get("luffy")!;
			luffy.emit.mockClear();
			registerHandsSocket(luffy);
			room.findPlayerByName("luffy")!.setCameraReady(true);

			handlerFor(luffy, "hands:setReady")({ ready: false });

			expect(room.findPlayerByName("luffy")!.getCameraReady()).toBe(false);
			expect(ensureHandDetector).not.toHaveBeenCalled();
		});

		it("ignore un socket qui n'est dans aucune room", () => {
			const stray = makeSocket("stray");
			registerHandsSocket(stray);
			expect(() => handlerFor(stray, "hands:setReady")({ ready: true })).not.toThrow();
		});
	});

	describe("hands:frame", () => {
		it("ignore une frame de mauvaise taille", () => {
			const { sockets } = seedRoom("arene", ["luffy"]);
			const luffy = sockets.get("luffy")!;
			registerHandsSocket(luffy);

			handlerFor(luffy, "hands:frame")(new Uint8Array(10));

			expect(handleHandsFrame).not.toHaveBeenCalled();
		});

		it("transmet une frame de la bonne taille au contrôleur", () => {
			const { sockets } = seedRoom("arene", ["luffy"]);
			const luffy = sockets.get("luffy")!;
			registerHandsSocket(luffy);

			handlerFor(luffy, "hands:frame")(new Uint8Array(256 * 256 * 3));

			expect(handleHandsFrame).toHaveBeenCalledTimes(1);
		});
	});

	it("purge le contrôleur à la déconnexion", () => {
		const stray = makeSocket("stray");
		registerHandsSocket(stray);
		handlerFor(stray, "disconnect")(undefined);
		expect(clearHandsController).toHaveBeenCalledWith("stray");
	});
});
