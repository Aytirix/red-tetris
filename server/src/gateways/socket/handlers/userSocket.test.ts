import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { Socket } from "socket.io";

vi.mock("../../../repositories/userRepositories.js", () => ({
	findUserByUsername: vi.fn(),
	postUsername: vi.fn(),
}));

import { registerUserSocket } from "./userSocket.js";
import { findUserByUsername, postUsername } from "../../../repositories/userRepositories.js";
import { userSocketStore } from "../userSocketStore.js";

type Handler = (payload: unknown) => unknown;
type FakeSocket = Socket & { emit: ReturnType<typeof vi.fn> };

function makeSocket(id: string): { socket: FakeSocket; handlers: Map<string, Handler> } {
	const handlers = new Map<string, Handler>();
	const socket = {
		id,
		emit: vi.fn(),
		on: vi.fn((event: string, callback: Handler) => {
			handlers.set(event, callback);
			return socket;
		}),
		join: vi.fn(),
		leave: vi.fn(),
	};
	return { socket: socket as unknown as FakeSocket, handlers };
}

describe("registerUserSocket", () => {
	beforeEach(() => {
		userSocketStore.clear();
		vi.clearAllMocks();
		vi.spyOn(console, "log").mockImplementation(() => undefined);
		vi.spyOn(console, "error").mockImplementation(() => undefined);
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	it("registers the two user events", () => {
		const { socket, handlers } = makeSocket("s1");
		registerUserSocket(socket);
		expect([...handlers.keys()]).toEqual(["user:CheckUsernameAvailable", "user:Register"]);
	});

	describe("user:CheckUsernameAvailable", () => {
		it("refuses an invalid payload", async () => {
			const { socket, handlers } = makeSocket("s1");
			registerUserSocket(socket);

			await handlers.get("user:CheckUsernameAvailable")!({ wrong: true });

			expect(socket.emit).toHaveBeenCalledWith("system:Error", {
				event: "user:CheckUsernameAvailable",
				message: "Invalid payload",
			});
		});

		it("refuses an invalid username format", async () => {
			const { socket, handlers } = makeSocket("s1");
			registerUserSocket(socket);

			await handlers.get("user:CheckUsernameAvailable")!({ username: "lu ffy!" });

			expect(socket.emit).toHaveBeenCalledWith("user:ResultUsernameAvailable", {
				available: "invalid",
				user_faction: null,
				username: "lu ffy!",
			});
		});

		it("refuses a username already used by another socket", async () => {
			const other = makeSocket("s2");
			userSocketStore.set("s2", { username: "luffy", subscribe: false, socket: other.socket });
			const { socket, handlers } = makeSocket("s1");
			registerUserSocket(socket);

			await handlers.get("user:CheckUsernameAvailable")!({ username: "luffy" });

			expect(socket.emit).toHaveBeenCalledWith("user:ResultUsernameAvailable", {
				available: false,
				user_faction: null,
				username: "luffy",
			});
		});

		it("answers available for a free username", async () => {
			vi.mocked(findUserByUsername).mockResolvedValue(null);
			const { socket, handlers } = makeSocket("s1");
			registerUserSocket(socket);

			await handlers.get("user:CheckUsernameAvailable")!({ username: "luffy" });

			expect(socket.emit).toHaveBeenCalledWith("user:ResultUsernameAvailable", {
				available: true,
				user_faction: null,
				username: "luffy",
			});
			expect(userSocketStore.get("s1")!.username).toBe("luffy");
		});

		it("returns the known faction for a registered username", async () => {
			vi.mocked(findUserByUsername).mockResolvedValue({ username: "luffy", faction: "pirate" } as never);
			const { socket, handlers } = makeSocket("s1");
			registerUserSocket(socket);

			await handlers.get("user:CheckUsernameAvailable")!({ username: "luffy" });

			expect(socket.emit).toHaveBeenCalledWith("user:ResultUsernameAvailable", {
				available: true,
				user_faction: "pirate",
				username: "luffy",
			});
		});

		it("reports a database failure", async () => {
			vi.mocked(findUserByUsername).mockRejectedValue(new Error("db down"));
			const { socket, handlers } = makeSocket("s1");
			registerUserSocket(socket);

			await handlers.get("user:CheckUsernameAvailable")!({ username: "luffy" });

			expect(socket.emit).toHaveBeenCalledWith("system:Error", {
				event: "user:CheckUsernameAvailable",
				message: "Username check failed",
			});
		});
	});

	describe("user:Register", () => {
		it("refuses an invalid payload", async () => {
			const { socket, handlers } = makeSocket("s1");
			registerUserSocket(socket);

			await handlers.get("user:Register")!({ faction: "pirate", avatar: "garp" });

			expect(socket.emit).toHaveBeenCalledWith("system:Error", {
				event: "user:Register",
				message: "Invalid payload",
			});
			expect(postUsername).not.toHaveBeenCalled();
		});

		it("registers the user and confirms it", async () => {
			vi.mocked(postUsername).mockResolvedValue({ username: "luffy" } as never);
			const { socket, handlers } = makeSocket("s1");
			registerUserSocket(socket);

			await handlers.get("user:Register")!({ faction: "pirate", avatar: "luffy" });

			expect(postUsername).toHaveBeenCalledWith(socket, "pirate", "luffy");
			expect(socket.emit).toHaveBeenCalledWith("user:ResultRegister", {
				isRegister: true,
				message: null,
			});
		});

		it("reports a database failure", async () => {
			vi.mocked(postUsername).mockRejectedValue(new Error("db down"));
			const { socket, handlers } = makeSocket("s1");
			registerUserSocket(socket);

			await handlers.get("user:Register")!({ faction: "marine", avatar: "garp" });

			expect(socket.emit).toHaveBeenCalledWith("system:Error", {
				event: "user:Register",
				message: "Registration failed",
			});
		});
	});
});
