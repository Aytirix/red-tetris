import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { Socket } from "socket.io";

vi.mock("../../../services/statsService.js", () => ({
	getStatsState: vi.fn(),
}));

import { registerStatsSocket } from "./statsSocket.js";
import { getStatsState } from "../../../services/statsService.js";
import { userSocketStore } from "../userSocketStore.js";
import type { StatsState } from "../../../types/statsTypes.js";

type Handler = (payload?: unknown) => unknown;
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
	};
	return { socket: socket as unknown as FakeSocket, handlers };
}

const STATE: StatsState = {
	me: null,
	leaderboards: { topScore: [], topWins: [], topTetris: [], topLines: [] },
	factions: { factions: [], leader: null },
	modes: [],
};

describe("registerStatsSocket", () => {
	beforeEach(() => {
		userSocketStore.clear();
		vi.clearAllMocks();
		vi.spyOn(console, "error").mockImplementation(() => undefined);
	});

	afterEach(() => vi.restoreAllMocks());

	it("enregistre l'événement stats:Get", () => {
		const { socket, handlers } = makeSocket("s1");
		registerStatsSocket(socket);
		expect([...handlers.keys()]).toEqual(["stats:Get"]);
	});

	it("répond avec l'état des stats du joueur authentifié", async () => {
		const { socket, handlers } = makeSocket("s1");
		userSocketStore.set("s1", { username: "luffy", subscribe: false, socket });
		vi.mocked(getStatsState).mockResolvedValue(STATE);
		registerStatsSocket(socket);

		await handlers.get("stats:Get")!();

		expect(getStatsState).toHaveBeenCalledWith("luffy");
		expect(socket.emit).toHaveBeenCalledWith("stats:State", STATE);
	});

	it("passe username=null quand le socket n'est pas authentifié", async () => {
		const { socket, handlers } = makeSocket("s2");
		vi.mocked(getStatsState).mockResolvedValue(STATE);
		registerStatsSocket(socket);

		await handlers.get("stats:Get")!();

		expect(getStatsState).toHaveBeenCalledWith(null);
	});

	it("émet une erreur si la lecture échoue", async () => {
		const { socket, handlers } = makeSocket("s3");
		vi.mocked(getStatsState).mockRejectedValue(new Error("db down"));
		registerStatsSocket(socket);

		await handlers.get("stats:Get")!();

		expect(socket.emit).toHaveBeenCalledWith("stats:Error", {
			message: "Lecture des statistiques impossible",
		});
	});
});
