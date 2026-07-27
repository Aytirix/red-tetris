import { beforeEach, describe, expect, it, vi } from "vitest";

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
