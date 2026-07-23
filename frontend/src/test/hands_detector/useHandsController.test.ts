import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, renderHook } from "@testing-library/react";
import type { HandLandmarkerResult } from "@mediapipe/tasks-vision";

import type { GameAction } from "./actions";
import { HAND_DEBUG_RENDER_FPS, HAND_DETECTION_FPS, LM } from "./constants";
import type { HandLandmarks, Handedness, Point } from "./gestures";
import { useHandsController } from "./useHandsController";

// La camera et le SDK MediaPipe sont remplaces par des doublures: le hook est
// pilote frame par frame via un requestAnimationFrame manuel.
const mocks = vi.hoisted(() => ({
	startWebcam: vi.fn(),
	stopWebcam: vi.fn(),
	createHandLandmarker: vi.fn(),
}));

vi.mock("./webcam", () => ({
	startWebcam: mocks.startWebcam,
	stopWebcam: mocks.stopWebcam,
}));

vi.mock("./landmarker", () => ({
	createHandLandmarker: mocks.createHandLandmarker,
}));

const DETECTION_INTERVAL_MS = 1000 / HAND_DETECTION_FPS;
const DEBUG_INTERVAL_MS = 1000 / HAND_DEBUG_RENDER_FPS;

// ─── Harnais de frames ────────────────────────────────────────────────────────

let pendingFrames = new Map<number, FrameRequestCallback>();
let nextFrameId = 1;

function runFrame(now: number): void {
	const callbacks = [...pendingFrames.values()];
	pendingFrames = new Map();
	act(() => {
		for (const callback of callbacks) callback(now);
	});
}

// ─── Doublures ────────────────────────────────────────────────────────────────

function makeVideo() {
	return { readyState: 4, currentTime: 0 } as unknown as HTMLVideoElement;
}

const STREAM = { getTracks: () => [] } as unknown as MediaStream;

function makeLandmarker() {
	return {
		detectForVideo: vi.fn<(video: unknown, now: number) => HandLandmarkerResult>(
			() => ({ landmarks: [], handednesses: [], worldLandmarks: [], handedness: [] }) as unknown as HandLandmarkerResult,
		),
		close: vi.fn(),
	};
}

/** Main normalisee: paume centree sur `palm`, ecartement fixe de 0.2. */
function handLandmarks(palm: Point, indexTip?: Point): HandLandmarks {
	const s = 0.1;
	const landmarks: HandLandmarks = Array.from({ length: 21 }, () => ({ x: 0.5, y: 0.5 }));
	landmarks[LM.WRIST] = { x: palm.x, y: palm.y + s };
	landmarks[LM.MIDDLE_MCP] = { x: palm.x, y: palm.y - s };
	landmarks[LM.INDEX_MCP] = { x: palm.x - s, y: palm.y };
	landmarks[LM.PINKY_MCP] = { x: palm.x + s, y: palm.y };
	landmarks[LM.RING_MCP] = { x: palm.x, y: palm.y };
	landmarks[LM.INDEX_TIP] = indexTip ?? { x: palm.x, y: palm.y - 0.15 };
	return landmarks;
}

function result(hands: Array<{ handedness?: Handedness; landmarks: HandLandmarks }>) {
	return {
		landmarks: hands.map(hand => hand.landmarks),
		handednesses: hands.map(hand =>
			hand.handedness ? [{ categoryName: hand.handedness }] : [],
		),
	} as unknown as HandLandmarkerResult;
}

// ─── Cycle de vie ─────────────────────────────────────────────────────────────

let landmarker: ReturnType<typeof makeLandmarker>;

beforeEach(() => {
	pendingFrames = new Map();
	nextFrameId = 1;
	vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
		const id = nextFrameId++;
		pendingFrames.set(id, callback);
		return id;
	});
	vi.stubGlobal("cancelAnimationFrame", (id: number) => {
		pendingFrames.delete(id);
	});

	landmarker = makeLandmarker();
	mocks.startWebcam.mockReset().mockResolvedValue(STREAM);
	mocks.stopWebcam.mockReset();
	mocks.createHandLandmarker.mockReset().mockResolvedValue(landmarker);
});

afterEach(() => {
	cleanup();
	vi.unstubAllGlobals();
});

type Props = {
	enabled: boolean;
	videoRef: { current: HTMLVideoElement | null };
	onAction: (action: GameAction) => void;
};

async function mount(props: Partial<Props> = {}) {
	const initialProps: Props = {
		enabled: true,
		videoRef: { current: makeVideo() },
		onAction: vi.fn(),
		...props,
	};
	const rendu = renderHook((p: Props) => useHandsController(p), { initialProps });
	// Laisse startWebcam puis createHandLandmarker se resoudre.
	await act(async () => {});
	return { ...rendu, props: initialProps };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("useHandsController — activation", () => {
	it("ne touche pas a la camera tant qu'il est desactive", async () => {
		const { result: hook } = await mount({ enabled: false });

		expect(mocks.startWebcam).not.toHaveBeenCalled();
		expect(mocks.createHandLandmarker).not.toHaveBeenCalled();
		expect(hook.current.status).toBe("idle");
		expect(hook.current.hands).toEqual([]);
		expect(hook.current.error).toBeNull();
	});

	it("passe par loading avant running", async () => {
		let ouvrirCamera = (stream: MediaStream) => { void stream; };
		mocks.startWebcam.mockImplementation(
			() => new Promise<MediaStream>(resolve => { ouvrirCamera = resolve; }),
		);

		const rendu = renderHook((p: Props) => useHandsController(p), {
			initialProps: {
				enabled: true,
				videoRef: { current: makeVideo() },
				onAction: vi.fn(),
			} as Props,
		});
		expect(rendu.result.current.status).toBe("loading");

		await act(async () => { ouvrirCamera(STREAM); });
		expect(rendu.result.current.status).toBe("running");
		expect(mocks.startWebcam).toHaveBeenCalledTimes(1);
		expect(mocks.createHandLandmarker).toHaveBeenCalledTimes(1);
	});

	it("demarre la camera sur la video referencee", async () => {
		const video = makeVideo();
		await mount({ videoRef: { current: video } });
		expect(mocks.startWebcam).toHaveBeenCalledWith(video);
	});
});

describe("useHandsController — erreurs", () => {
	it("signale l'absence de balise video", async () => {
		const { result: hook } = await mount({ videoRef: { current: null } });

		expect(hook.current.status).toBe("error");
		expect(hook.current.error).toBe("video element not mounted");
		expect(mocks.startWebcam).not.toHaveBeenCalled();
	});

	it("remonte le message d'un refus de camera", async () => {
		mocks.startWebcam.mockRejectedValue(new Error("Permission denied"));
		const { result: hook } = await mount();

		expect(hook.current.status).toBe("error");
		expect(hook.current.error).toBe("Permission denied");
		expect(mocks.createHandLandmarker).not.toHaveBeenCalled();
	});

	it("remonte aussi une panne qui n'est pas une Error", async () => {
		mocks.createHandLandmarker.mockRejectedValue("wasm introuvable");
		const { result: hook } = await mount();

		expect(hook.current.status).toBe("error");
		expect(hook.current.error).toBe("wasm introuvable");
	});

	it("n'ouvre pas de boucle de detection apres une erreur", async () => {
		mocks.startWebcam.mockRejectedValue(new Error("boom"));
		await mount();
		expect(pendingFrames.size).toBe(0);
	});
});

describe("useHandsController — boucle de detection", () => {
	it("attend que la video ait des donnees avant d'analyser", async () => {
		const video = { readyState: 1, currentTime: 0 } as unknown as HTMLVideoElement;
		await mount({ videoRef: { current: video } });

		runFrame(1000);

		expect(landmarker.detectForVideo).not.toHaveBeenCalled();
		// La boucle continue malgre tout de se replanifier.
		expect(pendingFrames.size).toBe(1);
	});

	it("analyse la video et se replanifie", async () => {
		const video = makeVideo();
		await mount({ videoRef: { current: video } });

		video.currentTime = 0.1;
		runFrame(1000);

		expect(landmarker.detectForVideo).toHaveBeenCalledTimes(1);
		expect(landmarker.detectForVideo).toHaveBeenCalledWith(video, 1000);
		expect(pendingFrames.size).toBe(1);
	});

	it("respecte la cadence de detection", async () => {
		const video = makeVideo();
		await mount({ videoRef: { current: video } });

		video.currentTime = 0.1;
		runFrame(1000);
		video.currentTime = 0.2;
		runFrame(1000 + DETECTION_INTERVAL_MS - 1);
		expect(landmarker.detectForVideo).toHaveBeenCalledTimes(1);

		runFrame(1000 + DETECTION_INTERVAL_MS);
		expect(landmarker.detectForVideo).toHaveBeenCalledTimes(2);
	});

	it("ne reanalyse pas deux fois la meme image", async () => {
		const video = makeVideo();
		await mount({ videoRef: { current: video } });

		video.currentTime = 0.1;
		runFrame(1000);
		runFrame(2000);
		expect(landmarker.detectForVideo).toHaveBeenCalledTimes(1);

		video.currentTime = 0.2;
		runFrame(3000);
		expect(landmarker.detectForVideo).toHaveBeenCalledTimes(2);
	});
});

describe("useHandsController — mains detectees", () => {
	it("expose les mains avec leur lateralite et leur geste", async () => {
		landmarker.detectForVideo.mockReturnValue(
			result([{ handedness: "Left", landmarks: handLandmarks({ x: 0.4, y: 0.5 }) }]),
		);
		const video = makeVideo();
		const { result: hook } = await mount({ videoRef: { current: video } });

		video.currentTime = 0.1;
		runFrame(1000);

		expect(hook.current.hands).toHaveLength(1);
		expect(hook.current.hands[0].handedness).toBe("Left");
		expect(hook.current.hands[0].gesture).toEqual({ handedness: "Left", fist: false });
		expect(hook.current.hands[0].landmarks).toHaveLength(21);
	});

	it("suppose la main droite quand MediaPipe ne se prononce pas", async () => {
		landmarker.detectForVideo.mockReturnValue(
			result([{ landmarks: handLandmarks({ x: 0.4, y: 0.5 }) }]),
		);
		const video = makeVideo();
		const { result: hook } = await mount({ videoRef: { current: video } });

		video.currentTime = 0.1;
		runFrame(1000);

		expect(hook.current.hands[0].handedness).toBe("Right");
	});

	it("tolere un resultat MediaPipe vide", async () => {
		landmarker.detectForVideo.mockReturnValue({} as unknown as HandLandmarkerResult);
		const video = makeVideo();
		const { result: hook } = await mount({ videoRef: { current: video } });

		video.currentTime = 0.1;
		runFrame(1000);

		expect(hook.current.hands).toEqual([]);
	});

	it("limite le rafraichissement de l'affichage de debug", async () => {
		const video = makeVideo();
		const { result: hook } = await mount({ videoRef: { current: video } });

		landmarker.detectForVideo.mockReturnValue(
			result([{ handedness: "Left", landmarks: handLandmarks({ x: 0.4, y: 0.5 }) }]),
		);
		video.currentTime = 0.1;
		runFrame(1000);
		expect(hook.current.hands).toHaveLength(1);

		// 50 ms plus tard: la detection tourne (cadence respectee) mais l'affichage
		// de debug est encore gele.
		expect(50).toBeGreaterThanOrEqual(DETECTION_INTERVAL_MS);
		expect(50).toBeLessThan(DEBUG_INTERVAL_MS);
		landmarker.detectForVideo.mockReturnValue(result([]));
		video.currentTime = 0.2;
		runFrame(1050);
		expect(landmarker.detectForVideo).toHaveBeenCalledTimes(2);
		expect(hook.current.hands).toHaveLength(1);

		expect(100).toBeGreaterThanOrEqual(DEBUG_INTERVAL_MS);
		video.currentTime = 0.3;
		runFrame(1100);
		expect(landmarker.detectForVideo).toHaveBeenCalledTimes(3);
		expect(hook.current.hands).toHaveLength(0);
	});
});

describe("useHandsController — actions", () => {
	it("remonte une descente de paume comme action DOWN", async () => {
		const onAction = vi.fn();
		const video = makeVideo();
		await mount({ videoRef: { current: video }, onAction });

		landmarker.detectForVideo.mockReturnValue(
			result([{ handedness: "Left", landmarks: handLandmarks({ x: 0.5, y: 0.3 }) }]),
		);
		video.currentTime = 0.1;
		runFrame(1000);
		expect(onAction).not.toHaveBeenCalled();

		landmarker.detectForVideo.mockReturnValue(
			result([{ handedness: "Left", landmarks: handLandmarks({ x: 0.5, y: 0.5 }) }]),
		);
		video.currentTime = 0.2;
		runFrame(1100);

		expect(onAction).toHaveBeenCalledTimes(1);
		expect(onAction).toHaveBeenCalledWith("DOWN");
	});

	it("ne remonte rien quand la main ne bouge pas", async () => {
		const onAction = vi.fn();
		const video = makeVideo();
		await mount({ videoRef: { current: video }, onAction });

		landmarker.detectForVideo.mockReturnValue(
			result([{ handedness: "Left", landmarks: handLandmarks({ x: 0.5, y: 0.5 }) }]),
		);
		for (let i = 0; i < 6; i++) {
			video.currentTime = 0.1 * (i + 1);
			runFrame(1000 + i * 100);
		}
		expect(onAction).not.toHaveBeenCalled();
	});

	it("utilise toujours le dernier callback fourni sans relancer la camera", async () => {
		const premier = vi.fn();
		const second = vi.fn();
		const video = makeVideo();
		const videoRef = { current: video };
		const rendu = await mount({ videoRef, onAction: premier });

		rendu.rerender({ enabled: true, videoRef, onAction: second });
		expect(mocks.startWebcam).toHaveBeenCalledTimes(1);

		landmarker.detectForVideo.mockReturnValue(
			result([{ handedness: "Left", landmarks: handLandmarks({ x: 0.5, y: 0.3 }) }]),
		);
		video.currentTime = 0.1;
		runFrame(1000);
		landmarker.detectForVideo.mockReturnValue(
			result([{ handedness: "Left", landmarks: handLandmarks({ x: 0.5, y: 0.5 }) }]),
		);
		video.currentTime = 0.2;
		runFrame(1100);

		expect(premier).not.toHaveBeenCalled();
		expect(second).toHaveBeenCalledWith("DOWN");
	});
});

describe("useHandsController — nettoyage", () => {
	it("libere camera, detecteur et boucle au demontage", async () => {
		const video = makeVideo();
		const videoRef = { current: video };
		const rendu = await mount({ videoRef });

		video.currentTime = 0.1;
		runFrame(1000);
		expect(pendingFrames.size).toBe(1);

		rendu.unmount();

		expect(pendingFrames.size).toBe(0);
		expect(landmarker.close).toHaveBeenCalledTimes(1);
		expect(mocks.stopWebcam).toHaveBeenCalledWith(video, STREAM);
	});

	it("nettoie quand meme si le detecteur refuse de se fermer", async () => {
		landmarker.close.mockImplementation(() => {
			throw new Error("deja ferme");
		});
		const rendu = await mount();

		expect(() => rendu.unmount()).not.toThrow();
		expect(mocks.stopWebcam).toHaveBeenCalledTimes(1);
	});

	it("revient au repos quand on le desactive", async () => {
		const videoRef = { current: makeVideo() };
		const rendu = await mount({ videoRef });
		expect(rendu.result.current.status).toBe("running");

		rendu.rerender({ enabled: false, videoRef, onAction: vi.fn() });

		expect(rendu.result.current.status).toBe("idle");
		expect(rendu.result.current.hands).toEqual([]);
		expect(mocks.stopWebcam).toHaveBeenCalledTimes(1);
	});

	it("abandonne un demarrage encore en cours", async () => {
		let ouvrirCamera = (stream: MediaStream) => { void stream; };
		mocks.startWebcam.mockImplementation(
			() => new Promise<MediaStream>(resolve => { ouvrirCamera = resolve; }),
		);
		const rendu = renderHook((p: Props) => useHandsController(p), {
			initialProps: {
				enabled: true,
				videoRef: { current: makeVideo() },
				onAction: vi.fn(),
			} as Props,
		});

		rendu.unmount();
		await act(async () => { ouvrirCamera(STREAM); });

		expect(mocks.createHandLandmarker).not.toHaveBeenCalled();
		expect(pendingFrames.size).toBe(0);
	});

	it("n'ouvre pas la boucle si le demontage arrive pendant le chargement du modele", async () => {
		let chargerModele = (value: unknown) => { void value; };
		mocks.createHandLandmarker.mockImplementation(
			() => new Promise(resolve => { chargerModele = resolve; }),
		);
		const rendu = renderHook((p: Props) => useHandsController(p), {
			initialProps: {
				enabled: true,
				videoRef: { current: makeVideo() },
				onAction: vi.fn(),
			} as Props,
		});
		await act(async () => {});

		rendu.unmount();
		await act(async () => { chargerModele(landmarker); });

		expect(pendingFrames.size).toBe(0);
		expect(landmarker.detectForVideo).not.toHaveBeenCalled();
	});
});
