import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Socket } from "socket.io-client";

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

import {
	emitGameDrop,
	emitGameMove,
	emitGameRotate,
	emitSubscribeSpectator,
	emitUnsubscribeSpectator,
	registerGameListeners,
} from "./game";

describe("emitters game", () => {
	beforeEach(() => {
		fakeSocket.emit.mockClear();
		fakeSocket.on.mockClear();
	});

	it("emet game:move avec la direction demandee", () => {
		emitGameMove("left");
		emitGameMove("right");
		emitGameMove("down");

		expect(fakeSocket.emit).toHaveBeenCalledTimes(3);
		expect(fakeSocket.emit).toHaveBeenNthCalledWith(1, "game:move", { direction: "left" });
		expect(fakeSocket.emit).toHaveBeenNthCalledWith(2, "game:move", { direction: "right" });
		expect(fakeSocket.emit).toHaveBeenNthCalledWith(3, "game:move", { direction: "down" });
	});

	it("emet game:rotate sans payload", () => {
		emitGameRotate();
		expect(fakeSocket.emit).toHaveBeenCalledWith("game:rotate");
	});

	it("emet game:drop sans payload", () => {
		emitGameDrop();
		expect(fakeSocket.emit).toHaveBeenCalledWith("game:drop");
	});

	it("emet game:subscribeSpectatorGame avec la room et la cible", () => {
		emitSubscribeSpectator("room-42", "luffy");
		expect(fakeSocket.emit).toHaveBeenCalledWith("game:subscribeSpectatorGame", {
			roomId: "room-42",
			user: "luffy",
		});
	});

	it("accepte une cible nulle pour l'abonnement spectateur", () => {
		emitSubscribeSpectator("room-42", null);
		expect(fakeSocket.emit).toHaveBeenCalledWith("game:subscribeSpectatorGame", {
			roomId: "room-42",
			user: null,
		});
	});

	it("emet game:unsubscribeSpectatorGame avec un payload vide", () => {
		emitUnsubscribeSpectator();
		expect(fakeSocket.emit).toHaveBeenCalledWith("game:unsubscribeSpectatorGame", {});
	});
});

describe("registerGameListeners", () => {
	let logSpy: ReturnType<typeof vi.spyOn>;

	beforeEach(() => {
		fakeSocket.on.mockClear();
		logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
	});

	afterEach(() => {
		logSpy.mockRestore();
	});

	it("branche les trois evenements de partie", () => {
		registerGameListeners(fakeSocket as unknown as Socket);

		const events = fakeSocket.on.mock.calls.map((call) => call[0]);
		expect(events).toEqual(["game:start", "game:update", "game:over"]);
	});

	it("execute les handlers sans lever d'erreur", () => {
		registerGameListeners(fakeSocket as unknown as Socket);

		const handlers = fakeSocket.on.mock.calls.map((call) => call[1] as (p: unknown) => void);
		expect(handlers).toHaveLength(3);
		for (const handler of handlers) {
			expect(() => handler({ any: "payload" })).not.toThrow();
		}
	});
});
