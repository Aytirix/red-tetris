import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { ioMock, fakeSocket } = vi.hoisted(() => {
	const fakeSocket = {
		on: vi.fn(),
		off: vi.fn(),
		emit: vi.fn(),
		connected: false,
	};
	return { ioMock: vi.fn(() => fakeSocket), fakeSocket };
});

vi.mock("socket.io-client", () => ({
	io: ioMock,
	Socket: class {},
}));

import { registerAllListeners, socket } from "./socket";

describe("socket (singleton)", () => {
	beforeEach(() => {
		fakeSocket.on.mockClear();
		vi.spyOn(console, "log").mockImplementation(() => {});
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	it("cree une seule connexion au chargement du module", () => {
		expect(ioMock).toHaveBeenCalledTimes(1);
		expect(socket).toBe(fakeSocket);
	});

	it("cible le backend sur l'hote courant avec autoConnect", () => {
		const [url, options] = ioMock.mock.calls[0] as unknown as [string, Record<string, unknown>];

		expect(url.startsWith(`${window.location.protocol}//${window.location.hostname}:`)).toBe(true);
		expect(url).toBe(
			`${window.location.protocol}//${window.location.hostname}:${import.meta.env.VITE_PORT}`,
		);
		expect(options).toEqual({ autoConnect: true });
	});

	it("registerAllListeners branche les listeners game, room et user", () => {
		registerAllListeners();

		const events = fakeSocket.on.mock.calls.map((call) => call[0]);
		expect(events).toEqual([
			"game:start",
			"game:update",
			"game:over",
			"room:joined",
			"room:left",
			"room:players",
		]);
	});

	it("est idempotent en terme de creation de socket", () => {
		registerAllListeners();
		registerAllListeners();
		expect(ioMock).toHaveBeenCalledTimes(1);
	});
});
