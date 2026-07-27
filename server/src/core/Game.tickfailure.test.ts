import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { Socket } from "socket.io";

// B3: un throw depuis le callback de setInterval n'a aucun appelant pour le
// rattraper -> uncaughtException -> process tue -> TOUTES les parties simultanees
// tombent. On force donc un emitter a lever et on verifie que la panne reste
// confinee a la partie fautive.
vi.mock("../gateways/socket/emitters/gameEmitters.js", async (importOriginal) => {
	const actual = await importOriginal<typeof import("../gateways/socket/emitters/gameEmitters.js")>();
	return {
		...actual,
		emitGameStart: vi.fn(),
		emitGameUpdate: vi.fn(),
		emitGameOver: vi.fn(),
		emitPlayerEliminated: vi.fn(),
		emitSpectatorForPlayer: vi.fn(),
	};
});

vi.mock("../services/shopService.js", () => ({
	settleGameRewards: vi.fn(async () => undefined),
}));

import { Game } from "./Game.js";
import { Player } from "./Player.js";
import { Room } from "./room.js";
import { emitGameOver, emitGameUpdate } from "../gateways/socket/emitters/gameEmitters.js";
import { spectatorSocketStore } from "../gateways/socket/spectatorSocketStore.js";

function makeSocket(id: string): Socket {
	return {
		id,
		emit: vi.fn(),
		on: vi.fn(),
		join: vi.fn(),
		leave: vi.fn(),
	} as unknown as Socket;
}

// `prefix` isole les socketId d'une partie a l'autre: deux parties simultanees ne
// doivent PAS partager d'identifiants, sinon le test de confinement ci-dessous ne
// distinguerait pas la partie fautive de la partie saine.
function makeGame(playerCount = 2, prefix = "sock") {
	const room = new Room(`salle-${prefix}`);
	const players = Array.from(
		{ length: playerCount },
		(_v, i) => new Player(`joueur${prefix}${i}`, makeSocket(`${prefix}${i}`), "avatar", "pirate"),
	);
	for (const player of players) room.addPlayer(player);
	const game = new Game("classique", players, room);
	room.setGame(game);
	room.setStatus("playing");
	return { game, room, players };
}

describe("Game — resilience du tick (B3)", () => {
	beforeEach(() => {
		vi.useFakeTimers();
		vi.clearAllMocks();
		spectatorSocketStore.clear();
		vi.spyOn(console, "error").mockImplementation(() => undefined);
	});

	afterEach(() => {
		vi.useRealTimers();
		vi.restoreAllMocks();
		spectatorSocketStore.clear();
	});

	it("ne laisse PAS une exception de tick remonter hors de l'interval", () => {
		const { game } = makeGame();
		vi.mocked(emitGameUpdate).mockImplementation(() => {
			throw new Error("Missing current piece before game update emit");
		});
		game.start();

		// Le seul moyen de reproduire fidelement le bug: laisser l'interval reel
		// declencher le callback. Sans try/catch, cet appel propage l'exception.
		expect(() => vi.advanceTimersByTime(1000)).not.toThrow();
	});

	it("coupe la gravite de la partie fautive au lieu de relever a chaque tick", () => {
		const { game } = makeGame();
		vi.mocked(emitGameUpdate).mockImplementation(() => {
			throw new Error("boom");
		});
		game.start();

		vi.advanceTimersByTime(1000);
		const callsAfterFirstFailure = vi.mocked(emitGameUpdate).mock.calls.length;
		vi.advanceTimersByTime(5000);

		expect(vi.mocked(emitGameUpdate).mock.calls.length).toBe(callsAfterFirstFailure);
	});

	it("rouvre la room et la detache de la partie morte", () => {
		const { game, room } = makeGame();
		vi.mocked(emitGameUpdate).mockImplementation(() => {
			throw new Error("boom");
		});
		game.start();
		vi.advanceTimersByTime(1000);

		expect(room.getStatus()).toBe("waiting");
		expect(room.getGame()).toBeNull();
	});

	it("previent les joueurs par un game:over sans vainqueur", () => {
		const { game } = makeGame();
		vi.mocked(emitGameUpdate).mockImplementation(() => {
			throw new Error("boom");
		});
		game.start();
		vi.advanceTimersByTime(1000);

		expect(emitGameOver).toHaveBeenCalledWith(expect.anything(), null);
	});

	// Regression: checkGameOver() emet le bon game:over (avec vainqueur) puis LEVE
	// dans son try/finally sans catch. L'exception remontait jusqu'au catch du tick,
	// qui reemettait un game:over sans vainqueur: le recap « X gagne » deja affiche
	// etait ecrase, alors que les berrys avaient bien ete credites a X.
	it("ne reemet PAS de game:over quand la partie etait deja terminee", () => {
		const { game, players } = makeGame();
		// P1 mort: le verrouillage de P0 termine la partie -> checkGameOver s'execute.
		const p1State = game.getPlayerStateBySocketId(players[1]!.getSocketId())!;
		vi.mocked(emitGameOver).mockImplementation(() => {
			throw new Error("emission cassee");
		});
		game.start();
		p1State.isAlive = false;
		const p0State = game.getPlayerStateBySocketId(players[0]!.getSocketId())!;
		p0State.currentPiece = null;

		vi.advanceTimersByTime(1000);

		expect(vi.mocked(emitGameOver).mock.calls).toHaveLength(1);
	});

	// Regression (BAA it.2): la purge etait faite AVANT l'emission (via stop()), or
	// emitGameOver itere spectatorSocketStore pour notifier les spectateurs PURS
	// (jamais presents dans game.state). Vide, ils ne recevaient plus rien et restaient
	// geles sur un plateau mort. L'ordre correct est emettre PUIS purger.
	it("notifie les spectateurs purs AVANT de purger leurs abonnements", () => {
		const { game, players } = makeGame();
		let spectateursAuMomentDeLEmission = -1;
		vi.mocked(emitGameUpdate).mockImplementation(() => {
			throw new Error("boom");
		});
		vi.mocked(emitGameOver).mockImplementation(() => {
			spectateursAuMomentDeLEmission = spectatorSocketStore.size;
		});
		spectatorSocketStore.set("spectateur-pur", { game, player: players[0]! });
		game.start();

		vi.advanceTimersByTime(1000);

		expect(spectateursAuMomentDeLEmission).toBe(1);
		expect(spectatorSocketStore.has("spectateur-pur")).toBe(false);
	});

	it("purge les abonnements spectateur meme si l'emission du game:over leve aussi", () => {
		const { game, players } = makeGame();
		vi.mocked(emitGameUpdate).mockImplementation(() => {
			throw new Error("boom");
		});
		vi.mocked(emitGameOver).mockImplementation(() => {
			throw new Error("boom aussi");
		});
		spectatorSocketStore.set("spectateur", { game, player: players[0]! });
		game.start();

		expect(() => vi.advanceTimersByTime(1000)).not.toThrow();
		expect(spectatorSocketStore.has("spectateur")).toBe(false);
	});

	it("laisse intactes les AUTRES parties en cours", () => {
		const saine = makeGame(2, "saine");
		const fautive = makeGame(2, "fautive");
		// Seule la partie fautive fait lever l'emitter.
		vi.mocked(emitGameUpdate).mockImplementation((playerState) => {
			if (fautive.game.getState().has(playerState.player.getSocketId()))
				throw new Error("boom");
		});
		saine.game.start();
		fautive.game.start();

		vi.advanceTimersByTime(1000);

		expect(saine.room.getStatus()).toBe("playing");
		expect(saine.room.getGame()).toBe(saine.game);
	});
});
