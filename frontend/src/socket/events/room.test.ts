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
	emitJoinRoom,
	emitKickPlayer,
	emitLeaveRoom,
	emitSetGameMode,
	emitSetPrivate,
	emitStartGame,
	emitSubscribeRooms,
	emitUnsubscribeRooms,
	registerRoomListeners,
} from "./room";

describe("emitters room", () => {
	beforeEach(() => {
		fakeSocket.emit.mockClear();
	});

	it("emet room:join avec l'identifiant de room", () => {
		emitJoinRoom("room-42");
		expect(fakeSocket.emit).toHaveBeenCalledWith("room:join", { roomId: "room-42" });
	});

	it("emet room:leave sans payload", () => {
		emitLeaveRoom();
		expect(fakeSocket.emit).toHaveBeenCalledWith("room:leave");
	});

	it("emet room:kick avec le pseudo cible", () => {
		emitKickPlayer("zoro");
		expect(fakeSocket.emit).toHaveBeenCalledWith("room:kick", { username: "zoro" });
	});

	it("emet room:start sans payload", () => {
		emitStartGame();
		expect(fakeSocket.emit).toHaveBeenCalledWith("room:start");
	});

	it("emet room:setMode avec le mode", () => {
		emitSetGameMode("classic");
		expect(fakeSocket.emit).toHaveBeenCalledWith("room:setMode", { mode: "classic" });
	});

	it("emet room:setPrivate avec le booleen renomme en 'private'", () => {
		emitSetPrivate(true);
		expect(fakeSocket.emit).toHaveBeenCalledWith("room:setPrivate", { private: true });

		emitSetPrivate(false);
		expect(fakeSocket.emit).toHaveBeenCalledWith("room:setPrivate", { private: false });
	});

	it("emet l'abonnement et le desabonnement a la liste des rooms", () => {
		emitSubscribeRooms();
		expect(fakeSocket.emit).toHaveBeenCalledWith("room:subscribeList");

		emitUnsubscribeRooms();
		expect(fakeSocket.emit).toHaveBeenCalledWith("room:unsubscribeList");
	});
});

describe("registerRoomListeners", () => {
	let logSpy: ReturnType<typeof vi.spyOn>;

	beforeEach(() => {
		fakeSocket.on.mockClear();
		logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
	});

	afterEach(() => {
		logSpy.mockRestore();
	});

	it("branche les evenements de room", () => {
		registerRoomListeners(fakeSocket as unknown as Socket);

		const events = fakeSocket.on.mock.calls.map((call) => call[0]);
		expect(events).toEqual(["room:joined", "room:left", "room:players"]);
	});

	it("execute les handlers sans lever d'erreur", () => {
		registerRoomListeners(fakeSocket as unknown as Socket);

		const handlers = fakeSocket.on.mock.calls.map((call) => call[1] as (p?: unknown) => void);
		expect(() => handlers[0]({ id: "room-42" })).not.toThrow();
		expect(() => handlers[1]()).not.toThrow();
		expect(() => handlers[2](["luffy", "zoro"])).not.toThrow();
		expect(logSpy).toHaveBeenCalledTimes(3);
	});
});
