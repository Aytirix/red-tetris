import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Socket } from "socket.io";
import { Room } from "./room.js";
import { Player } from "./Player.js";
import type { Game } from "./Game.js";

function makeSocket(id: string): Socket {
	return {
		id,
		emit: vi.fn(),
		on: vi.fn(),
		join: vi.fn(),
		leave: vi.fn(),
	} as unknown as Socket;
}

function makePlayer(name: string, socketId = `sock-${name}`): Player {
	return new Player(name, makeSocket(socketId), `${name}-avatar`, "pirate");
}

describe("Room", () => {
	let room: Room;

	beforeEach(() => {
		room = new Room("salle1");
	});

	describe("constructor", () => {
		it("initialises an empty waiting room in classique mode, public, without game", () => {
			expect(room.name).toBe("salle1");
			expect(room.getPlayers()).toEqual([]);
			expect(room.countPlayer()).toBe(0);
			expect(room.getStatus()).toBe("waiting");
			expect(room.getMode()).toBe("classique");
			expect(room.getPrivate()).toBe(false);
			expect(room.getGame()).toBeNull();
			expect(room.getHostId()).toBeNull();
			expect(room.getHostName()).toBeNull();
		});
	});

	describe("addPlayer", () => {
		it("adds the player and returns true", () => {
			const player = makePlayer("luffy");
			expect(room.addPlayer(player)).toBe(true);
			expect(room.getPlayers()).toEqual([player]);
			expect(room.countPlayer()).toBe(1);
		});

		it("makes the FIRST player the host", () => {
			const first = makePlayer("luffy", "s1");
			const second = makePlayer("zoro", "s2");
			room.addPlayer(first);
			room.addPlayer(second);

			expect(room.getHostId()).toBe("s1");
			expect(room.getHostName()).toBe("luffy");
		});

		it("does not change the host when other players join", () => {
			room.addPlayer(makePlayer("luffy", "s1"));
			room.addPlayer(makePlayer("zoro", "s2"));
			room.addPlayer(makePlayer("nami", "s3"));
			expect(room.getHostId()).toBe("s1");
		});

		it("refuses a new player when the game is playing", () => {
			room.setStatus("playing");
			expect(room.addPlayer(makePlayer("luffy"))).toBe(false);
			expect(room.countPlayer()).toBe(0);
		});

		it("refuses a new player when the room is finished", () => {
			room.setStatus("finished");
			expect(room.addPlayer(makePlayer("luffy"))).toBe(false);
			expect(room.countPlayer()).toBe(0);
		});
	});

	describe("canJoin", () => {
		it("returns true while waiting", () => {
			expect(room.canJoin()).toBe(true);
		});

		it("returns false once the game is launched", () => {
			room.setStatus("playing");
			expect(room.canJoin()).toBe(false);
		});

		it("returns false when the room is finished", () => {
			room.setStatus("finished");
			expect(room.canJoin()).toBe(false);
		});
	});

	describe("setStatus / getStatus", () => {
		it("stores every possible status", () => {
			room.setStatus("playing");
			expect(room.getStatus()).toBe("playing");
			room.setStatus("finished");
			expect(room.getStatus()).toBe("finished");
			room.setStatus("waiting");
			expect(room.getStatus()).toBe("waiting");
		});
	});

	describe("setMode", () => {
		beforeEach(() => {
			room.addPlayer(makePlayer("luffy", "host"));
			room.addPlayer(makePlayer("zoro", "guest"));
		});

		it("lets the host change the mode", () => {
			expect(room.setMode("ultra", makeSocket("host"))).toBe(true);
			expect(room.getMode()).toBe("ultra");
			expect(room.setMode("sprint", makeSocket("host"))).toBe(true);
			expect(room.getMode()).toBe("sprint");
			expect(room.setMode("classique", makeSocket("host"))).toBe(true);
			expect(room.getMode()).toBe("classique");
		});

		it("refuses a non-host", () => {
			expect(room.setMode("ultra", makeSocket("guest"))).toBe(false);
			expect(room.getMode()).toBe("classique");
		});

		it("refuses an unknown mode even for the host", () => {
			expect(room.setMode("hardcore", makeSocket("host"))).toBe(false);
			expect(room.getMode()).toBe("classique");
		});
	});

	describe("setPrivate / getPrivate", () => {
		beforeEach(() => {
			room.addPlayer(makePlayer("luffy", "host"));
			room.addPlayer(makePlayer("zoro", "guest"));
		});

		it("lets the host make the room private then public again", () => {
			expect(room.setPrivate(true, makeSocket("host"))).toBe(true);
			expect(room.getPrivate()).toBe(true);
			expect(room.setPrivate(false, makeSocket("host"))).toBe(true);
			expect(room.getPrivate()).toBe(false);
		});

		it("refuses a non-host", () => {
			expect(room.setPrivate(true, makeSocket("guest"))).toBe(false);
			expect(room.getPrivate()).toBe(false);
		});
	});

	describe("setGame / getGame", () => {
		it("stores then detaches the game", () => {
			const fakeGame = { mode: "classique" } as unknown as Game;
			room.setGame(fakeGame);
			expect(room.getGame()).toBe(fakeGame);
			room.setGame(null);
			expect(room.getGame()).toBeNull();
		});
	});

	describe("removePlayer", () => {
		it("removes the player and returns true", () => {
			const luffy = makePlayer("luffy", "s1");
			const zoro = makePlayer("zoro", "s2");
			room.addPlayer(luffy);
			room.addPlayer(zoro);

			expect(room.removePlayer(luffy)).toBe(true);
			expect(room.getPlayers()).toEqual([zoro]);
		});

		it("returns false when the player is not in the room", () => {
			room.addPlayer(makePlayer("luffy", "s1"));
			expect(room.removePlayer(makePlayer("inconnu", "s99"))).toBe(false);
			expect(room.countPlayer()).toBe(1);
		});

		it("reassigns the host to the next player when the host leaves", () => {
			const luffy = makePlayer("luffy", "s1");
			room.addPlayer(luffy);
			room.addPlayer(makePlayer("zoro", "s2"));
			room.addPlayer(makePlayer("nami", "s3"));

			room.removePlayer(luffy);

			expect(room.getHostId()).toBe("s2");
			expect(room.getHostName()).toBe("zoro");
		});

		it("clears the host when the last player leaves", () => {
			const luffy = makePlayer("luffy", "s1");
			room.addPlayer(luffy);
			room.removePlayer(luffy);

			expect(room.getHostId()).toBeNull();
			expect(room.getHostName()).toBeNull();
			expect(room.countPlayer()).toBe(0);
		});

		it("keeps the host when a non-host leaves", () => {
			const zoro = makePlayer("zoro", "s2");
			room.addPlayer(makePlayer("luffy", "s1"));
			room.addPlayer(zoro);

			room.removePlayer(zoro);

			expect(room.getHostId()).toBe("s1");
		});
	});

	describe("removePlayerBySocketId", () => {
		it("removes the matching player", () => {
			room.addPlayer(makePlayer("luffy", "s1"));
			expect(room.removePlayerBySocketId("s1")).toBe(true);
			expect(room.countPlayer()).toBe(0);
		});

		it("returns false for an unknown socket id", () => {
			room.addPlayer(makePlayer("luffy", "s1"));
			expect(room.removePlayerBySocketId("nope")).toBe(false);
			expect(room.countPlayer()).toBe(1);
		});
	});

	describe("removePlayerByName (kick)", () => {
		beforeEach(() => {
			room.addPlayer(makePlayer("luffy", "host"));
			room.addPlayer(makePlayer("zoro", "guest"));
		});

		it("lets the host kick another player", () => {
			expect(room.removePlayerByName("host", "zoro")).toBe(true);
			expect(room.countPlayer()).toBe(1);
			expect(room.searchName("zoro")).toBe(false);
		});

		it("refuses when the requester is not the host", () => {
			expect(room.removePlayerByName("guest", "luffy")).toBe(false);
			expect(room.countPlayer()).toBe(2);
		});

		it("returns false when the username is not in the room", () => {
			expect(room.removePlayerByName("host", "inconnu")).toBe(false);
			expect(room.countPlayer()).toBe(2);
		});
	});

	describe("reassignHost", () => {
		it("forces a new host", () => {
			const zoro = makePlayer("zoro", "s2");
			room.addPlayer(makePlayer("luffy", "s1"));
			room.addPlayer(zoro);

			room.reassignHost(zoro);

			expect(room.getHostId()).toBe("s2");
			expect(room.getHostName()).toBe("zoro");
		});
	});

	describe("getHostName", () => {
		it("returns null when the host id no longer matches a player", () => {
			const luffy = makePlayer("luffy", "s1");
			room.addPlayer(luffy);
			room.getPlayers().splice(0, 1);
			expect(room.getHostName()).toBeNull();
		});
	});

	describe("searchName / findPlayerByName", () => {
		it("finds an existing player", () => {
			const luffy = makePlayer("luffy", "s1");
			room.addPlayer(luffy);
			expect(room.searchName("luffy")).toBe(true);
			expect(room.findPlayerByName("luffy")).toBe(luffy);
		});

		it("does not find a missing player", () => {
			room.addPlayer(makePlayer("luffy", "s1"));
			expect(room.searchName("shanks")).toBe(false);
			expect(room.findPlayerByName("shanks")).toBeUndefined();
		});
	});

	describe("startGame", () => {
		it("is callable (currently a no-op)", () => {
			expect(() => room.startGame()).not.toThrow();
		});
	});
});
