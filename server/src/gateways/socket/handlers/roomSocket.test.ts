import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Socket } from "socket.io";

vi.mock("../../../config/prisma.js", () => ({ prisma: {} }));
vi.mock("./roomHandlers.js", () => ({
	// Seul handler asynchrone: le routeur enchaine un .catch dessus, le mock DOIT
	// donc renvoyer une promesse.
	handlerRoomJoin: vi.fn(async () => undefined),
	handlerRoomSubscribe: vi.fn(),
	handlerRoomUnsubscribe: vi.fn(),
	handlerRoomLeave: vi.fn(),
	handleRoomKick: vi.fn(),
	handleRoomMode: vi.fn(),
	handleRoomSetPrivate: vi.fn(),
	handleRoomStart: vi.fn(),
	handleRoomRestart: vi.fn(),
	handleMove: vi.fn(),
	handleRotate: vi.fn(),
	handleDrop: vi.fn(),
	handleJoker: vi.fn(),
	handleSubscribeSpectator: vi.fn(),
	handleUnsubscribeSpectator: vi.fn(),
}));

import { registerRoomSocket } from "./roomSocket.js";
import * as handlers from "./roomHandlers.js";

type Handler = (payload: unknown) => unknown;

function makeSocket(id: string): { socket: Socket; events: Map<string, Handler> } {
	const events = new Map<string, Handler>();
	const socket = {
		id,
		emit: vi.fn(),
		on: vi.fn((event: string, callback: Handler) => {
			events.set(event, callback);
			return socket;
		}),
	};
	return { socket: socket as unknown as Socket, events };
}

const ROUTES: [string, keyof typeof handlers][] = [
	["room:join", "handlerRoomJoin"],
	["room:subscribeList", "handlerRoomSubscribe"],
	["room:unsubscribeList", "handlerRoomUnsubscribe"],
	["room:leave", "handlerRoomLeave"],
	["room:kick", "handleRoomKick"],
	["room:setMode", "handleRoomMode"],
	["room:setPrivate", "handleRoomSetPrivate"],
	["room:start", "handleRoomStart"],
	["room:restart", "handleRoomRestart"],
	["game:move", "handleMove"],
	["game:rotate", "handleRotate"],
	["game:drop", "handleDrop"],
	["game:joker", "handleJoker"],
	["game:subscribeSpectatorGame", "handleSubscribeSpectator"],
	["game:unsubscribeSpectatorGame", "handleUnsubscribeSpectator"],
];

describe("registerRoomSocket", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("registers every room and game event", () => {
		const { socket, events } = makeSocket("s1");
		registerRoomSocket(socket);
		expect([...events.keys()]).toEqual(ROUTES.map(([event]) => event));
	});

	it.each(ROUTES)("routes %s to its handler", (event, handlerName) => {
		const { socket, events } = makeSocket("s1");
		registerRoomSocket(socket);
		const payload = { any: "payload" };

		events.get(event)!(payload);

		expect(handlers[handlerName]).toHaveBeenCalledWith(socket, payload);
	});

	// Regression: handlerRoomJoin est async et n'etait ni attendu ni rattrape. Une
	// base indisponible produisait un rejet non gere -> le client n'obtenait NI
	// room:joined NI system:Error et restait bloque a vie sur « Connexion a la room… ».
	it("repond system:Error quand room:join rejette", async () => {
		const { socket, events } = makeSocket("s1");
		vi.spyOn(console, "error").mockImplementation(() => undefined);
		vi.mocked(handlers.handlerRoomJoin).mockRejectedValueOnce(new Error("db down"));
		registerRoomSocket(socket);

		events.get("room:join")!({ roomId: "salle1" });
		// Laisse la micro-tache du .catch se resoudre.
		await Promise.resolve();
		await Promise.resolve();

		expect(socket.emit).toHaveBeenCalledWith("system:Error", {
			event: "room:join",
			message: "Failed to join room",
		});
	});

	it("ne perturbe pas le chemin nominal de room:join", async () => {
		const { socket, events } = makeSocket("s1");
		registerRoomSocket(socket);

		events.get("room:join")!({ roomId: "salle1" });
		await Promise.resolve();

		expect(socket.emit).not.toHaveBeenCalled();
	});
});
