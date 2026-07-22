import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { Server as HttpServer } from "node:http";
import type { Socket } from "socket.io";

const { createdServers } = vi.hoisted(() => ({
	createdServers: [] as { httpServer: unknown; options: unknown; handlers: Map<string, (socket: Socket) => void> }[],
}));

vi.mock("socket.io", () => {
	class Server {
		public handlers = new Map<string, (socket: Socket) => void>();
		constructor(public httpServer: unknown, public options: unknown) {
			createdServers.push(this);
		}
		on(event: string, callback: (socket: Socket) => void) {
			this.handlers.set(event, callback);
			return this;
		}
	}
	class FakeSocket {}
	return { Server, Socket: FakeSocket };
});

vi.mock("../../config/prisma.js", () => ({ prisma: {} }));

import { socketConfig } from "../../config/socketConfig.js";
import { userSocketStore } from "./userSocketStore.js";
import { registerSocketHandlers } from "./registerSocketHandlers.js";

type FakeSocket = Socket & { on: ReturnType<typeof vi.fn> };

function makeSocket(id = "s1"): FakeSocket {
	const socket = {
		id,
		emit: vi.fn(),
		on: vi.fn(() => socket),
		join: vi.fn(),
		leave: vi.fn(),
	};
	return socket as unknown as FakeSocket;
}

async function loadInitSocket(nodeEnv: string) {
	vi.stubEnv("NODE_ENV", nodeEnv);
	vi.resetModules();
	createdServers.length = 0;
	const module = await import("./socketInit.js");
	return module.initSocket;
}

describe("registerSocketHandlers", () => {
	beforeEach(() => {
		userSocketStore.clear();
		vi.spyOn(console, "log").mockImplementation(() => undefined);
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	it("opens an empty session for the connected socket", () => {
		const socket = makeSocket("s1");

		registerSocketHandlers(socket);

		expect(userSocketStore.get("s1")).toEqual({ username: null, subscribe: false, socket });
	});
});

describe("initSocket", () => {
	beforeEach(() => {
		userSocketStore.clear();
		vi.clearAllMocks();
		vi.spyOn(console, "log").mockImplementation(() => undefined);
	});

	afterEach(() => {
		vi.unstubAllEnvs();
		vi.restoreAllMocks();
		vi.resetModules();
	});

	it("creates the socket.io server with the CORS configuration", async () => {
		const initSocket = await loadInitSocket("production");
		const httpServer = {} as HttpServer;

		const io = initSocket(httpServer);

		expect(createdServers).toHaveLength(1);
		expect(createdServers[0]!.httpServer).toBe(httpServer);
		expect(createdServers[0]!.options).toEqual(socketConfig);
		expect(io).toBe(createdServers[0]);
	});

	it("registers every feature on a new connection", async () => {
		const initSocket = await loadInitSocket("production");
		initSocket({} as HttpServer);
		const socket = makeSocket("s1");

		createdServers[0]!.handlers.get("connection")!(socket);

		const events = socket.on.mock.calls.map((call) => call[0]);
		expect(events).toContain("user:CheckUsernameAvailable");
		expect(events).toContain("user:Register");
		expect(events).toContain("room:join");
		expect(events).toContain("game:move");
		expect(events).toContain("shop:Get");
		expect(events).toContain("disconnect");
	});

	it("does NOT register the documentation mock outside of development", async () => {
		const initSocket = await loadInitSocket("production");
		initSocket({} as HttpServer);
		const socket = makeSocket("s1");

		createdServers[0]!.handlers.get("connection")!(socket);

		const events = socket.on.mock.calls.map((call) => call[0]);
		expect(events).not.toContain("__docsWs:emitMockResponse");
	});

	it("registers the documentation mock in development", async () => {
		const initSocket = await loadInitSocket("development");
		initSocket({} as HttpServer);
		const socket = makeSocket("s1");

		createdServers[0]!.handlers.get("connection")!(socket);

		const events = socket.on.mock.calls.map((call) => call[0]);
		expect(events).toContain("__docsWs:emitMockResponse");
	});
});
