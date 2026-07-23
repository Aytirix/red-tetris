import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { Socket } from "socket.io";
import type { DetectedHand } from "./handDetectionService.js";
import { LM } from "./constants.js";

// Le service de détection (tfjs) et la localisation de room sont mockés: on teste que
// le contrôleur enchaîne détection -> gestes -> application au jeu, sans charger tfjs.
const detectHands = vi.hoisted(() => vi.fn<[], Promise<DetectedHand[]>>());
const getRoom = vi.hoisted(() => vi.fn());

vi.mock("./handDetectionService.js", () => ({ HAND_INPUT_SIZE: 256, detectHands }));
vi.mock("../services/roomService.js", () => ({ getRoom }));

import { clearHandsController, handleHandsFrame } from "./handsController.js";

function makeSocket(id: string): Socket {
	return { id } as unknown as Socket;
}

function openHand(px: number): DetectedHand {
	const landmarks = Array.from({ length: 21 }, () => ({ x: px, y: 0.5 }));
	landmarks[LM.WRIST] = { x: px, y: 0.6 };
	landmarks[LM.INDEX_MCP] = { x: px - 0.03, y: 0.5 };
	landmarks[LM.MIDDLE_MCP] = { x: px, y: 0.5 };
	landmarks[LM.RING_MCP] = { x: px + 0.03, y: 0.5 };
	landmarks[LM.PINKY_MCP] = { x: px + 0.06, y: 0.5 };
	for (const tip of [LM.INDEX_TIP, LM.MIDDLE_TIP, LM.RING_TIP, LM.PINKY_TIP])
		landmarks[tip] = { x: px, y: 0.38 };
	return { handedness: "Left", score: 0.9, landmarks };
}

const FRAME = new Uint8Array(256 * 256 * 3);

describe("handsController", () => {
	let game: { move: ReturnType<typeof vi.fn>; rotate: ReturnType<typeof vi.fn>; drop: ReturnType<typeof vi.fn> };

	beforeEach(() => {
		vi.clearAllMocks();
		game = { move: vi.fn(), rotate: vi.fn(), drop: vi.fn() };
		getRoom.mockReturnValue({ getGame: () => game });
	});
	afterEach(() => {
		clearHandsController("p1");
		vi.restoreAllMocks();
	});

	it("n'applique rien s'il n'y a pas de partie en cours", async () => {
		getRoom.mockReturnValue({ getGame: () => null });
		await handleHandsFrame(makeSocket("p1"), FRAME);
		expect(detectHands).not.toHaveBeenCalled();
	});

	it("détecte un swipe et applique un déplacement au bon joueur", async () => {
		const socket = makeSocket("p1");
		// Main gauche, x brut décroissant -> après miroir, va vers la droite -> move("right").
		// Horloge explicite: 150ms entre les deux frames pour un swipe net et déterministe.
		detectHands.mockResolvedValueOnce([openHand(0.75)]);
		await handleHandsFrame(socket, FRAME, 5000);
		detectHands.mockResolvedValueOnce([openHand(0.3)]);
		await handleHandsFrame(socket, FRAME, 5150);

		expect(game.move).toHaveBeenCalledWith("p1", "right");
	});

	it("garde l'état de mouvement par joueur entre deux frames", async () => {
		const socket = makeSocket("p1");
		detectHands.mockResolvedValue([openHand(0.5)]);
		await handleHandsFrame(socket, FRAME, 6000);
		await handleHandsFrame(socket, FRAME, 6150);
		// Aucune action franche ici, mais aucun crash: l'état est réutilisé.
		expect(game.move).not.toHaveBeenCalledWith("p1", "left");
	});

	it("ne casse pas la boucle si la détection échoue", async () => {
		detectHands.mockRejectedValueOnce(new Error("inference failed"));
		await expect(handleHandsFrame(makeSocket("p1"), FRAME, 7000)).resolves.toBeUndefined();
	});

	it("clearHandsController réinitialise l'état d'un joueur", async () => {
		const socket = makeSocket("p1");
		detectHands.mockResolvedValue([openHand(0.5)]);
		await handleHandsFrame(socket, FRAME, 8000);
		clearHandsController("p1");
		// Reprise propre après purge.
		await expect(handleHandsFrame(socket, FRAME, 8200)).resolves.toBeUndefined();
	});
});
