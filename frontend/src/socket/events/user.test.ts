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

import { emitCheckUsernameAvailable } from "./user";

describe("emitters user", () => {
	beforeEach(() => {
		fakeSocket.emit.mockClear();
		fakeSocket.on.mockClear();
	});

	it("emet user:CheckUsernameAvailable avec le pseudo", () => {
		emitCheckUsernameAvailable("luffy");
		expect(fakeSocket.emit).toHaveBeenCalledWith("user:CheckUsernameAvailable", {
			username: "luffy",
		});
	});

	it("transmet le pseudo tel quel, meme vide", () => {
		emitCheckUsernameAvailable("");
		expect(fakeSocket.emit).toHaveBeenCalledWith("user:CheckUsernameAvailable", { username: "" });
	});
});
