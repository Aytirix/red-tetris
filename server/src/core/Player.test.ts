import { describe, it, expect, vi } from "vitest";
import type { Socket } from "socket.io";
import { Player } from "./Player.js";
import type { Game } from "./Game.js";
import { DEFAULT_THEME_ID } from "../config/shopThemes.js";

function makeSocket(id: string): Socket {
	return {
		id,
		emit: vi.fn(),
		on: vi.fn(),
		join: vi.fn(),
		leave: vi.fn(),
	} as unknown as Socket;
}

describe("Player", () => {
	it("exposes the values given at construction", () => {
		const socket = makeSocket("socket-1");
		const player = new Player("luffy", socket, "luffy-avatar", "pirate");

		expect(player.getName()).toBe("luffy");
		expect(player.getSocketId()).toBe("socket-1");
		expect(player.getSocket()).toBe(socket);
		expect(player.getAvatar()).toBe("luffy-avatar");
		expect(player.getFaction()).toBe("pirate");
	});

	it("derives the socket id from the socket", () => {
		const player = new Player("garp", makeSocket("abc"), "garp", "marine");
		expect(player.getSocketId()).toBe("abc");
	});

	it("starts outside of any game", () => {
		const player = new Player("zoro", makeSocket("s"), "zoro", "pirate");
		expect(player.getGame()).toBeUndefined();
	});

	it("setGame / getGame stores the game reference", () => {
		const player = new Player("nami", makeSocket("s"), "nami", "pirate");
		const fakeGame = { mode: "classique" } as unknown as Game;
		player.setGame(fakeGame);
		expect(player.getGame()).toBe(fakeGame);
	});

});

describe("Player — cosmetique", () => {
	it("retombe sur le theme par defaut sans precision", () => {
		const player = new Player("luffy", makeSocket("s1"), "luffy", "pirate");
		expect(player.getTheme()).toBe(DEFAULT_THEME_ID);
	});

	it("porte le theme equipe, vu par les spectateurs de son plateau", () => {
		const player = new Player("luffy", makeSocket("s1"), "luffy", "pirate", "synthwave");
		expect(player.getTheme()).toBe("synthwave");
	});
});
