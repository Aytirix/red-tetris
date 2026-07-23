import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { Socket } from "socket.io";

type Handler = (payload: unknown) => void;
type FakeSocket = Socket & { emit: ReturnType<typeof vi.fn> };

function makeSocket(id = "s1"): { socket: FakeSocket; handlers: Map<string, Handler> } {
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

const DOCS = [
	{
		name: "test:schema",
		direction: "front-to-back",
		responseName: "test:schemaResult",
		// Schema "maison": cles non quotees, types nus, virgule finale.
		response: "{ id: string, ok: boolean, count: number, nothing: null, meta: object, items: array, }",
	},
	{
		name: "test:nested",
		direction: "front-to-back",
		responseName: "test:nestedResult",
		response: '{"list": ["__TYPE_string__", "__TYPE_number__"], "obj": {"deep": "__TYPE_boolean__"}, "weird": "__TYPE_zzz__", "fixe": 42}',
	},
	{
		name: "test:broken",
		direction: "front-to-back",
		responseName: "test:brokenResult",
		response: "{ pas du json ]",
	},
	{ name: "test:noResponse", direction: "front-to-back", responseName: "test:x" },
	{ name: "test:backToFront", direction: "back-to-front", responseName: "test:y", response: "{}" },
];

const EVENT = "__docsWs:emitMockResponse";

async function loadSocketMock(options: { docs?: unknown[]; exists?: boolean } = {}) {
	const { docs = DOCS, exists = true } = options;
	const writeFileSync = vi.fn();
	vi.resetModules();
	vi.doMock("node:fs", () => ({
		existsSync: vi.fn(() => exists),
		readFileSync: vi.fn(() => JSON.stringify(docs)),
		writeFileSync,
	}));
	const module = await import("./SocketMock.js");
	return { registerSocketMock: module.registerSocketMock, writeFileSync };
}

describe("SocketMock", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	afterEach(() => {
		vi.doUnmock("node:fs");
		vi.resetModules();
	});

	it("creates an empty documentation file when it is missing", async () => {
		const { writeFileSync } = await loadSocketMock({ exists: false });
		expect(writeFileSync).toHaveBeenCalledWith(expect.anything(), "[]", "utf-8");
	});

	it("does not rewrite the documentation file when it already exists", async () => {
		const { writeFileSync } = await loadSocketMock({ exists: true });
		expect(writeFileSync).not.toHaveBeenCalled();
	});

	it("registers the internal mock event", async () => {
		const { registerSocketMock } = await loadSocketMock();
		const { socket, handlers } = makeSocket();

		registerSocketMock(socket);

		expect(handlers.has(EVENT)).toBe(true);
	});

	describe("payload validation", () => {
		it("ignores a payload that is not an object", async () => {
			const { registerSocketMock } = await loadSocketMock();
			const { socket, handlers } = makeSocket();
			registerSocketMock(socket);

			handlers.get(EVENT)!("nope");
			handlers.get(EVENT)!(null);
			handlers.get(EVENT)!([1, 2]);

			expect(socket.emit).not.toHaveBeenCalled();
		});

		it("ignores a payload without a valid eventName or responseName", async () => {
			const { registerSocketMock } = await loadSocketMock();
			const { socket, handlers } = makeSocket();
			registerSocketMock(socket);

			handlers.get(EVENT)!({ responseName: "test:schemaResult" });
			handlers.get(EVENT)!({ eventName: 1, responseName: "test:schemaResult" });
			handlers.get(EVENT)!({ eventName: "test:schema" });
			handlers.get(EVENT)!({ eventName: "test:schema", responseName: 1 });

			expect(socket.emit).not.toHaveBeenCalled();
		});

		it("ignores an unknown event", async () => {
			const { registerSocketMock } = await loadSocketMock();
			const { socket, handlers } = makeSocket();
			registerSocketMock(socket);

			handlers.get(EVENT)!({ eventName: "test:inconnu", responseName: "test:x" });

			expect(socket.emit).not.toHaveBeenCalled();
		});

		it("ignores a documented event that is not mockable", async () => {
			const { registerSocketMock } = await loadSocketMock();
			const { socket, handlers } = makeSocket();
			registerSocketMock(socket);

			handlers.get(EVENT)!({ eventName: "test:noResponse", responseName: "test:x" });
			handlers.get(EVENT)!({ eventName: "test:backToFront", responseName: "test:y" });

			expect(socket.emit).not.toHaveBeenCalled();
		});

		it("ignores a responseName that does not match the documentation", async () => {
			const { registerSocketMock } = await loadSocketMock();
			const { socket, handlers } = makeSocket();
			registerSocketMock(socket);

			handlers.get(EVENT)!({ eventName: "test:schema", responseName: "autre:chose" });

			expect(socket.emit).not.toHaveBeenCalled();
		});
	});

	describe("explicit response", () => {
		it("emits the response given by the caller as-is", async () => {
			const { registerSocketMock } = await loadSocketMock();
			const { socket, handlers } = makeSocket();
			registerSocketMock(socket);

			handlers.get(EVENT)!({
				eventName: "test:schema",
				responseName: "test:schemaResult",
				response: { forced: true },
			});

			expect(socket.emit).toHaveBeenCalledWith("test:schemaResult", { forced: true });
		});
	});

	describe("generated response", () => {
		it("fills the typed schema from the request payload", async () => {
			const { registerSocketMock } = await loadSocketMock();
			const { socket, handlers } = makeSocket();
			registerSocketMock(socket);

			handlers.get(EVENT)!({
				eventName: "test:schema",
				responseName: "test:schemaResult",
				requestPayload: {
					id: "luffy",
					ok: true,
					count: 7,
					nothing: null,
					meta: { a: 1 },
					items: [1, 2],
				},
			});

			expect(socket.emit).toHaveBeenCalledWith("test:schemaResult", {
				id: "luffy",
				ok: true,
				count: 7,
				nothing: null,
				meta: { a: 1 },
				items: [1, 2],
			});
		});

		it("falls back to a default value for each wrong type", async () => {
			const { registerSocketMock } = await loadSocketMock();
			const { socket, handlers } = makeSocket();
			registerSocketMock(socket);

			handlers.get(EVENT)!({
				eventName: "test:schema",
				responseName: "test:schemaResult",
				requestPayload: {
					id: 1,
					ok: "oui",
					count: "sept",
					nothing: "pas null",
					meta: [],
					items: {},
				},
			});

			expect(socket.emit).toHaveBeenCalledWith("test:schemaResult", {
				id: "",
				ok: false,
				count: 0,
				nothing: null,
				meta: {},
				items: [],
			});
		});

		it("falls back to defaults when there is no request payload at all", async () => {
			const { registerSocketMock } = await loadSocketMock();
			const { socket, handlers } = makeSocket();
			registerSocketMock(socket);

			handlers.get(EVENT)!({ eventName: "test:schema", responseName: "test:schemaResult" });

			expect(socket.emit).toHaveBeenCalledWith("test:schemaResult", {
				id: "",
				ok: false,
				count: 0,
				nothing: null,
				meta: {},
				items: [],
			});
		});

		it("resolves arrays, nested objects, unknown types and constants", async () => {
			const { registerSocketMock } = await loadSocketMock();
			const { socket, handlers } = makeSocket();
			registerSocketMock(socket);

			handlers.get(EVENT)!({
				eventName: "test:nested",
				responseName: "test:nestedResult",
				requestPayload: { list: ["a", 2], obj: { deep: true }, weird: "x" },
			});

			expect(socket.emit).toHaveBeenCalledWith("test:nestedResult", {
				list: ["a", 2],
				obj: { deep: true },
				weird: null,
				fixe: 42,
			});
		});

		it("uses empty sources when the payload has the wrong shape", async () => {
			const { registerSocketMock } = await loadSocketMock();
			const { socket, handlers } = makeSocket();
			registerSocketMock(socket);

			handlers.get(EVENT)!({
				eventName: "test:nested",
				responseName: "test:nestedResult",
				requestPayload: { list: "pas un tableau", obj: "pas un objet" },
			});

			expect(socket.emit).toHaveBeenCalledWith("test:nestedResult", {
				list: ["", 0],
				obj: { deep: false },
				weird: null,
				fixe: 42,
			});
		});

		it("emits an empty object when the schema cannot be parsed", async () => {
			const { registerSocketMock } = await loadSocketMock();
			const { socket, handlers } = makeSocket();
			registerSocketMock(socket);

			handlers.get(EVENT)!({ eventName: "test:broken", responseName: "test:brokenResult" });

			expect(socket.emit).toHaveBeenCalledWith("test:brokenResult", {});
		});
	});
});
