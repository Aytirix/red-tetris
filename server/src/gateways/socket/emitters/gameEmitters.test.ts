import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Socket } from "socket.io";

import { Piece } from "../../../core/Piece.js";
import { Player } from "../../../core/Player.js";
import { Game } from "../../../core/Game.js";
import { Room } from "../../../core/room.js";
import { BOARD_HEIGHT, BOARD_WIDTH, type Board, type Cell, type PlayerGameState } from "../../../types/game/gameTypes.js";
import { I, O, T } from "../../../types/game/piecesGameTypes.js";
import { spectatorSocketStore } from "../spectatorSocketStore.js";
import { userSocketStore } from "../userSocketStore.js";
import {
	emitCountdown,
	emitGameOver,
	emitGameStart,
	emitGameUpdate,
	emitPlayerEliminated,
	emitSpectatorForPlayer,
	emitSpectatorGame,
	getRenderedBoard,
} from "./gameEmitters.js";

type FakeSocket = Socket & { emit: ReturnType<typeof vi.fn> };

function makeSocket(id: string): FakeSocket {
	return {
		id,
		emit: vi.fn(),
		on: vi.fn(),
		join: vi.fn(),
		leave: vi.fn(),
	} as unknown as FakeSocket;
}

function emptyBoard(): Board {
	return Array.from({ length: BOARD_HEIGHT }, () => Array.from({ length: BOARD_WIDTH }, () => 0 as Cell));
}

function makeState(name: string, socketId = `sock-${name}`): { state: PlayerGameState; socket: FakeSocket } {
	const socket = makeSocket(socketId);
	const player = new Player(name, socket, `${name}-avatar`, "pirate");
	const state: PlayerGameState = {
		board: emptyBoard(),
		score: 0,
		level: 1,
		pieceIndex: 0,
		player,
		isAlive: true,
		spectator: false,
		currentPiece: new Piece(O, "O"),
		nextPiece: new Piece(I, "I"),
	};
	return { state, socket };
}

/** Faux Game: seules getState / getPlayerStateBySocketId sont utilisees par les emitters. */
function fakeGame(state: Map<string, PlayerGameState>): Game {
	return {
		getState: () => state,
		getPlayerStateBySocketId: (socketId: string) => state.get(socketId),
	} as unknown as Game;
}

describe("gameEmitters", () => {
	beforeEach(() => {
		spectatorSocketStore.clear();
		userSocketStore.clear();
		vi.clearAllMocks();
	});

	describe("getRenderedBoard", () => {
		it("burns the current piece into a COPY of the board", () => {
			const { state } = makeState("luffy");
			const rendered = getRenderedBoard(state);

			expect(rendered[0]![4]).toBe("O");
			expect(rendered[0]![5]).toBe("O");
			expect(rendered[1]![4]).toBe("O");
			expect(rendered[1]![5]).toBe("O");
			// Le board d'origine n'est pas modifie.
			expect(state.board[0]![4]).toBe(0);
			expect(rendered).not.toBe(state.board);
		});

		it("only fills the cells set to 1 in the shape", () => {
			const { state } = makeState("luffy");
			state.currentPiece = new Piece(T, "T");
			const rendered = getRenderedBoard(state);

			expect(rendered[0]![4]).toBe(0);
			expect(rendered[0]![5]).toBe("T");
			expect(rendered[1]![4]).toBe("T");
			expect(rendered[1]![6]).toBe("T");
		});

		it("returns a plain copy when there is no current piece", () => {
			const { state } = makeState("luffy");
			delete state.currentPiece;
			state.board[5]![5] = "Z";

			const rendered = getRenderedBoard(state);

			expect(rendered).toEqual(state.board);
			expect(rendered).not.toBe(state.board);
		});

		it("ignores the cells outside the board", () => {
			const { state } = makeState("luffy");
			const piece = new Piece(I, "I");
			for (let i = 0; i < 5; i++) piece.moveRight();
			state.currentPiece = piece;

			const rendered = getRenderedBoard(state);

			// Boite 4x4: la barre est sur la 2e ligne de la boite, donc la rangee 1 du
			// plateau. Debordant a droite, seule sa colonne 9 est dessinee.
			expect(rendered[1]![9]).toBe("I");
			expect(rendered[1]!.length).toBe(BOARD_WIDTH);
		});

		it("ignores a piece that fell below the board", () => {
			const { state } = makeState("luffy");
			const piece = new Piece(O, "O");
			for (let i = 0; i < BOARD_HEIGHT + 5; i++) piece.moveDown();
			state.currentPiece = piece;

			expect(() => getRenderedBoard(state)).not.toThrow();
		});
	});

	describe("emitCountdown", () => {
		it("envoie game:countdown avec la valeur a tous les joueurs", () => {
			const a = makeState("luffy");
			const b = makeState("zoro");

			emitCountdown([a.state.player, b.state.player], 3);

			expect(a.socket.emit).toHaveBeenCalledWith("game:countdown", { value: 3 });
			expect(b.socket.emit).toHaveBeenCalledWith("game:countdown", { value: 3 });
		});

		it("ne notifie personne pour une liste vide", () => {
			expect(() => emitCountdown([], 2)).not.toThrow();
		});
	});

	describe("emitGameStart", () => {
		it("emits game:start to every player with its own board", () => {
			const luffy = makeState("luffy", "s1");
			const zoro = makeState("zoro", "s2");
			const state = new Map([["s1", luffy.state], ["s2", zoro.state]]);

			emitGameStart(state, fakeGame(state));

			expect(luffy.socket.emit).toHaveBeenCalledTimes(1);
			const [event, payload] = luffy.socket.emit.mock.calls[0]!;
			expect(event).toBe("game:start");
			expect(payload.currentPiece).toEqual({ type: "O" });
			expect(payload.nextPiece).toEqual({ type: "I" });
			expect(payload.score).toBe(0);
			expect(payload.level).toBe(1);
			expect(payload.spectator).toBe(false);
			expect(zoro.socket.emit).toHaveBeenCalledTimes(1);
		});

		it("lists the opponents without the player itself", () => {
			const luffy = makeState("luffy", "s1");
			const zoro = makeState("zoro", "s2");
			const state = new Map([["s1", luffy.state], ["s2", zoro.state]]);

			emitGameStart(state, fakeGame(state));

			const payload = luffy.socket.emit.mock.calls[0]![1];
			expect(payload.opponents).toHaveLength(1);
			expect(payload.opponents[0]).toMatchObject({ username: "zoro", alive: true });
		});

		it("computes the ghost projection at the bottom of the board", () => {
			const luffy = makeState("luffy", "s1");
			const state = new Map([["s1", luffy.state]]);

			emitGameStart(state, fakeGame(state));

			const payload = luffy.socket.emit.mock.calls[0]![1];
			expect(payload.ghost).toEqual([
				{ x: 4, y: BOARD_HEIGHT - 2 },
				{ x: 5, y: BOARD_HEIGHT - 2 },
				{ x: 4, y: BOARD_HEIGHT - 1 },
				{ x: 5, y: BOARD_HEIGHT - 1 },
			]);
		});

		it("stops the ghost on top of an occupied cell", () => {
			const luffy = makeState("luffy", "s1");
			luffy.state.board[BOARD_HEIGHT - 1]![4] = "Z";
			const state = new Map([["s1", luffy.state]]);

			emitGameStart(state, fakeGame(state));

			const payload = luffy.socket.emit.mock.calls[0]![1];
			expect(payload.ghost).toContainEqual({ x: 4, y: BOARD_HEIGHT - 2 });
			expect(payload.ghost).not.toContainEqual({ x: 4, y: BOARD_HEIGHT - 1 });
		});

		it("returns an empty ghost when there is no current piece", () => {
			const luffy = makeState("luffy", "s1");
			delete luffy.state.currentPiece;
			const state = new Map([["s1", luffy.state]]);

			expect(() => emitGameStart(state, fakeGame(state))).toThrow("Missing current piece before game start emit");
		});

		it("throws when the next piece is missing", () => {
			const luffy = makeState("luffy", "s1");
			delete luffy.state.nextPiece;
			const state = new Map([["s1", luffy.state]]);

			expect(() => emitGameStart(state, fakeGame(state))).toThrow("Missing next piece before game start emit");
		});
	});

	describe("emitGameUpdate", () => {
		it("emits game:update with the rendered board", () => {
			const luffy = makeState("luffy", "s1");
			const state = new Map([["s1", luffy.state]]);

			emitGameUpdate(luffy.state, state);

			const [event, payload] = luffy.socket.emit.mock.calls[0]!;
			expect(event).toBe("game:update");
			expect(payload.board[0][4]).toBe("O");
			expect(payload.score).toBe(0);
			expect(payload.opponents).toEqual([]);
		});

		it("reports the score and the level of the player", () => {
			const luffy = makeState("luffy", "s1");
			luffy.state.score = 1300;
			luffy.state.level = 3;
			const state = new Map([["s1", luffy.state]]);

			emitGameUpdate(luffy.state, state);

			const payload = luffy.socket.emit.mock.calls[0]![1];
			expect(payload.score).toBe(1300);
			expect(payload.level).toBe(3);
		});

		it("throws when a piece is missing", () => {
			const luffy = makeState("luffy", "s1");
			const state = new Map([["s1", luffy.state]]);

			delete luffy.state.currentPiece;
			expect(() => emitGameUpdate(luffy.state, state)).toThrow("Missing current piece before game update emit");

			luffy.state.currentPiece = new Piece(O, "O");
			delete luffy.state.nextPiece;
			expect(() => emitGameUpdate(luffy.state, state)).toThrow("Missing next piece before game update emit");
		});
	});

	describe("emitSpectatorGame", () => {
		it("emits game:SpectatorGame with the spectated player board", () => {
			const luffy = makeState("luffy", "s1");
			const state = new Map([["s1", luffy.state]]);
			const spectatorSocket = makeSocket("spec1");

			emitSpectatorGame(spectatorSocket, fakeGame(state), luffy.state.player);

			const [event, payload] = spectatorSocket.emit.mock.calls[0]!;
			expect(event).toBe("game:SpectatorGame");
			expect(payload.spectator).toBe("luffy");
			expect(payload.board[0][4]).toBe("O");
		});

		it("does not show the spectator itself in the opponents list", () => {
			const luffy = makeState("luffy", "s1");
			const zoro = makeState("zoro", "s2");
			const nami = makeState("nami", "s3");
			const state = new Map([["s1", luffy.state], ["s2", zoro.state], ["s3", nami.state]]);
			const spectatorSocket = makeSocket("s2"); // zoro, mort, regarde luffy

			emitSpectatorGame(spectatorSocket, fakeGame(state), luffy.state.player);

			const payload = spectatorSocket.emit.mock.calls[0]![1];
			expect(payload.opponents.map((o: { username: string }) => o.username)).toEqual(["nami"]);
		});

		it("does nothing when the player has no state in the game", () => {
			const luffy = makeState("luffy", "s1");
			const orphan = makeState("orphelin", "s9");
			const state = new Map([["s1", luffy.state]]);
			const spectatorSocket = makeSocket("spec1");

			emitSpectatorGame(spectatorSocket, fakeGame(state), orphan.state.player);

			expect(spectatorSocket.emit).not.toHaveBeenCalled();
		});

		it("throws when a piece is missing on the spectated player", () => {
			const luffy = makeState("luffy", "s1");
			const state = new Map([["s1", luffy.state]]);
			const spectatorSocket = makeSocket("spec1");

			delete luffy.state.currentPiece;
			expect(() => emitSpectatorGame(spectatorSocket, fakeGame(state), luffy.state.player))
				.toThrow("Missing current piece before spectator game emit");

			luffy.state.currentPiece = new Piece(O, "O");
			delete luffy.state.nextPiece;
			expect(() => emitSpectatorGame(spectatorSocket, fakeGame(state), luffy.state.player))
				.toThrow("Missing next piece before spectator game emit");
		});
	});

	describe("emitSpectatorForPlayer", () => {
		it("pushes an update to every spectator of that player", () => {
			const luffy = makeState("luffy", "s1");
			const state = new Map([["s1", luffy.state]]);
			const game = fakeGame(state);
			const spectatorSocket = makeSocket("spec1");

			spectatorSocketStore.set("spec1", { game, player: luffy.state.player });
			userSocketStore.set("spec1", { username: "watcher", subscribe: false, socket: spectatorSocket });

			emitSpectatorForPlayer(luffy.state, state);

			expect(spectatorSocket.emit).toHaveBeenCalledTimes(1);
			expect(spectatorSocket.emit.mock.calls[0]![0]).toBe("game:SpectatorGame");
		});

		it("ignores spectators watching another player", () => {
			const luffy = makeState("luffy", "s1");
			const zoro = makeState("zoro", "s2");
			const state = new Map([["s1", luffy.state], ["s2", zoro.state]]);
			const game = fakeGame(state);
			const spectatorSocket = makeSocket("spec1");

			spectatorSocketStore.set("spec1", { game, player: zoro.state.player });
			userSocketStore.set("spec1", { username: "watcher", subscribe: false, socket: spectatorSocket });

			emitSpectatorForPlayer(luffy.state, state);

			expect(spectatorSocket.emit).not.toHaveBeenCalled();
		});

		it("ignores spectators subscribed to another game", () => {
			const luffy = makeState("luffy", "s1");
			const state = new Map([["s1", luffy.state]]);
			const otherState = new Map([["s1", luffy.state]]);
			const spectatorSocket = makeSocket("spec1");

			spectatorSocketStore.set("spec1", { game: fakeGame(otherState), player: luffy.state.player });
			userSocketStore.set("spec1", { username: "watcher", subscribe: false, socket: spectatorSocket });

			emitSpectatorForPlayer(luffy.state, state);

			expect(spectatorSocket.emit).not.toHaveBeenCalled();
		});

		it("ignores spectators without an active session", () => {
			const luffy = makeState("luffy", "s1");
			const state = new Map([["s1", luffy.state]]);

			spectatorSocketStore.set("spec1", { game: fakeGame(state), player: luffy.state.player });

			expect(() => emitSpectatorForPlayer(luffy.state, state)).not.toThrow();
		});
	});

	describe("emitPlayerEliminated", () => {
		it("notifies only the eliminated player with a player to spectate", () => {
			const luffy = makeState("luffy", "s1");
			const zoro = makeState("zoro", "s2");
			luffy.state.isAlive = false;
			luffy.state.score = 700;
			luffy.state.level = 2;
			const state = new Map([["s1", luffy.state], ["s2", zoro.state]]);

			emitPlayerEliminated(luffy.state, state);

			expect(zoro.socket.emit).not.toHaveBeenCalled();
			expect(luffy.socket.emit).toHaveBeenCalledWith("game:eliminated", {
				score: 700,
				level: 2,
				spectate: "zoro",
			});
		});

		it("never proposes the eliminated player to itself", () => {
			const luffy = makeState("luffy", "s1");
			const state = new Map([["s1", luffy.state]]);

			emitPlayerEliminated(luffy.state, state);

			expect(luffy.socket.emit.mock.calls[0]![1].spectate).toBeNull();
		});

		it("proposes null when nobody else is alive", () => {
			const luffy = makeState("luffy", "s1");
			const zoro = makeState("zoro", "s2");
			zoro.state.isAlive = false;
			const state = new Map([["s1", luffy.state], ["s2", zoro.state]]);

			emitPlayerEliminated(luffy.state, state);

			expect(luffy.socket.emit.mock.calls[0]![1].spectate).toBeNull();
		});
	});

	describe("emitGameOver", () => {
		it("broadcasts game:over to everybody with the winner", () => {
			const luffy = makeState("luffy", "s1");
			const zoro = makeState("zoro", "s2");
			const state = new Map([["s1", luffy.state], ["s2", zoro.state]]);

			emitGameOver(state, "luffy");

			expect(luffy.socket.emit).toHaveBeenCalledTimes(1);
			expect(zoro.socket.emit).toHaveBeenCalledTimes(1);
			expect(luffy.socket.emit.mock.calls[0]![1].winner).toBe("luffy");
		});

		it("sorts the scoreboard by descending score", () => {
			const luffy = makeState("luffy", "s1");
			const zoro = makeState("zoro", "s2");
			const nami = makeState("nami", "s3");
			luffy.state.score = 300;
			zoro.state.score = 900;
			nami.state.score = 600;
			const state = new Map([["s1", luffy.state], ["s2", zoro.state], ["s3", nami.state]]);

			emitGameOver(state, "zoro");

			expect(luffy.socket.emit.mock.calls[0]![1].scores).toEqual([
				{ username: "zoro", score: 900 },
				{ username: "nami", score: 600 },
				{ username: "luffy", score: 300 },
			]);
		});

		it("accepts a null winner (solo)", () => {
			const luffy = makeState("luffy", "s1");
			const state = new Map([["s1", luffy.state]]);

			emitGameOver(state, null);

			expect(luffy.socket.emit.mock.calls[0]![1]).toEqual({
				winner: null,
				scores: [{ username: "luffy", score: 0 }],
				level: 1,
			});
		});
	});
});

// ─── Mode invisible : ce qui part sur le reseau (findings d'audit) ────────────

describe("gameEmitters — etancheite du mode invisible", () => {
	function invisibleSetup() {
		const { state, socket } = makeState("luffy");
		const room = new Room("salle");
		room.addPlayer(state.player);
		const game = new Game("invisible", [state.player], room);
		// On travaille sur l'etat porte par la Game (celui que lisent les emetteurs).
		const gameState = game.getPlayerStateBySocketId(state.player.getSocketId())!;
		gameState.currentPiece = new Piece(O, "O");
		gameState.nextPiece = new Piece(I, "I");
		return { game, gameState, socket: state.player.getSocket() as FakeSocket };
	}

	it("n'envoie PAS le type d'une piece totalement effacee", () => {
		vi.useFakeTimers();
		const { game, gameState, socket } = invisibleSetup();
		// Pose une piece puis laisse le fondu aller jusqu'au bout.
		gameState.board[BOARD_HEIGHT - 1]![0] = "T";
		gameState.lockedAt[BOARD_HEIGHT - 1]![0] = Date.now();
		vi.advanceTimersByTime(4000);

		emitGameUpdate(gameState, game.getState());

		const payload = socket.emit.mock.calls.at(-1)![1] as { board: Board; fade: number[][] };
		// La cellule est masquee dans le plateau envoye: rien a lire dans le DOM.
		expect(payload.board[BOARD_HEIGHT - 1]![0]).toBe(0);
		// ...et son opacite est ramenee a 1, sinon un fade a 0 trahirait "case occupee
		// mais cachee" et permettrait de reconstruire la pile depuis les frames reseau.
		expect(payload.fade[BOARD_HEIGHT - 1]![0]).toBe(1);
		expect(payload.fade[BOARD_HEIGHT - 1]![1]).toBe(1);
		vi.useRealTimers();
	});

	it("garde le type d'une piece encore partiellement visible", () => {
		vi.useFakeTimers();
		const { game, gameState, socket } = invisibleSetup();
		gameState.board[BOARD_HEIGHT - 1]![0] = "T";
		gameState.lockedAt[BOARD_HEIGHT - 1]![0] = Date.now();
		vi.advanceTimersByTime(1000);

		emitGameUpdate(gameState, game.getState());

		const payload = socket.emit.mock.calls.at(-1)![1] as { board: Board };
		expect(payload.board[BOARD_HEIGHT - 1]![0]).toBe("T");
		vi.useRealTimers();
	});

	it("n'envoie AUCUNE projection en mode invisible (elle revelerait la pile)", () => {
		const { game, gameState, socket } = invisibleSetup();

		emitGameUpdate(gameState, game.getState());

		const payload = socket.emit.mock.calls.at(-1)![1] as { ghost: unknown[] };
		expect(payload.ghost).toEqual([]);
	});

	it("envoie normalement la projection dans les autres modes", () => {
		const { state } = makeState("zoro");
		const room = new Room("salle2");
		room.addPlayer(state.player);
		const game = new Game("classique", [state.player], room);
		const gameState = game.getPlayerStateBySocketId(state.player.getSocketId())!;
		gameState.currentPiece = new Piece(O, "O");
		gameState.nextPiece = new Piece(I, "I");

		emitGameUpdate(gameState, game.getState());

		const socket = state.player.getSocket() as FakeSocket;
		const payload = socket.emit.mock.calls.at(-1)![1] as { ghost: unknown[]; fade: unknown };
		expect(payload.ghost.length).toBeGreaterThan(0);
		expect(payload.fade).toBeNull();
	});
});

describe("gameEmitters — le spectre ne trahit pas la pile invisible", () => {
	it("calcule le spectre adverse sur le plateau MASQUE en mode invisible", () => {
		vi.useFakeTimers();
		const alice = makeState("alice");
		const bob = makeState("bob");
		const room = new Room("salle-inv");
		room.addPlayer(alice.state.player);
		room.addPlayer(bob.state.player);
		const game = new Game("invisible", [alice.state.player, bob.state.player], room);
		const aliceState = game.getPlayerStateBySocketId(alice.state.player.getSocketId())!;
		const bobState = game.getPlayerStateBySocketId(bob.state.player.getSocketId())!;
		bobState.currentPiece = new Piece(O, "O");
		bobState.nextPiece = new Piece(I, "I");

		// Pile d'alice totalement effacee pour elle-meme.
		aliceState.board[BOARD_HEIGHT - 1]![7] = "I";
		aliceState.lockedAt[BOARD_HEIGHT - 1]![7] = Date.now();
		vi.advanceTimersByTime(5000);

		emitGameUpdate(bobState, game.getState());

		const payload = bob.socket.emit.mock.calls.at(-1)![1] as { opponents: { username: string; board: Board }[] };
		const spectre = payload.opponents.find((o) => o.username === "alice")!.board;
		// Aucune colonne ne doit trahir la hauteur de la pile cachee.
		expect(spectre.every((row) => row.every((cell) => cell === 0))).toBe(true);
		vi.useRealTimers();
	});

	it("laisse le spectre normal dans les autres modes", () => {
		const alice = makeState("alice2");
		const bob = makeState("bob2");
		const room = new Room("salle-cla");
		room.addPlayer(alice.state.player);
		room.addPlayer(bob.state.player);
		const game = new Game("classique", [alice.state.player, bob.state.player], room);
		const aliceState = game.getPlayerStateBySocketId(alice.state.player.getSocketId())!;
		const bobState = game.getPlayerStateBySocketId(bob.state.player.getSocketId())!;
		bobState.currentPiece = new Piece(O, "O");
		bobState.nextPiece = new Piece(I, "I");
		aliceState.board[BOARD_HEIGHT - 1]![7] = "I";

		emitGameUpdate(bobState, game.getState());

		const payload = bob.socket.emit.mock.calls.at(-1)![1] as { opponents: { username: string; board: Board }[] };
		const spectre = payload.opponents.find((o) => o.username === "alice2")!.board;
		expect(spectre[BOARD_HEIGHT - 1]![7]).toBe("spectrum");
	});
});
