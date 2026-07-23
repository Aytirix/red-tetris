import { beforeEach, describe, expect, it, vi } from "vitest";
import {
	HAND_LANDMARKER_MODEL_URL,
	HAND_LANDMARKER_WASM_URL,
	MAX_HANDS,
	MIN_HAND_DETECTION_CONFIDENCE,
	MIN_HAND_PRESENCE_CONFIDENCE,
	MIN_TRACKING_CONFIDENCE,
} from "./constants";
import { createHandLandmarker } from "./landmarker";

// Le SDK @mediapipe/tasks-vision telecharge un wasm et un modele de plusieurs Mo:
// on le remplace par une doublure et on verifie la configuration transmise.
const mediapipe = vi.hoisted(() => ({
	forVisionTasks: vi.fn(),
	createFromOptions: vi.fn(),
}));

vi.mock("@mediapipe/tasks-vision", () => ({
	FilesetResolver: { forVisionTasks: mediapipe.forVisionTasks },
	HandLandmarker: { createFromOptions: mediapipe.createFromOptions },
}));

const FILESET = { wasmLoaderPath: "loader.js" };
const LANDMARKER = { detectForVideo: vi.fn(), close: vi.fn() };

beforeEach(() => {
	mediapipe.forVisionTasks.mockReset().mockResolvedValue(FILESET);
	mediapipe.createFromOptions.mockReset().mockResolvedValue(LANDMARKER);
});

describe("createHandLandmarker", () => {
	it("resout le fileset wasm avant de construire le detecteur", async () => {
		await createHandLandmarker();

		expect(mediapipe.forVisionTasks).toHaveBeenCalledWith(HAND_LANDMARKER_WASM_URL);
		expect(mediapipe.createFromOptions).toHaveBeenCalledTimes(1);
		expect(mediapipe.createFromOptions.mock.calls[0][0]).toBe(FILESET);
		expect(mediapipe.forVisionTasks.mock.invocationCallOrder[0])
			.toBeLessThan(mediapipe.createFromOptions.mock.invocationCallOrder[0]);
	});

	it("configure le detecteur pour le suivi video de deux mains sur GPU", async () => {
		await createHandLandmarker();

		expect(mediapipe.createFromOptions.mock.calls[0][1]).toEqual({
			baseOptions: {
				modelAssetPath: HAND_LANDMARKER_MODEL_URL,
				delegate: "GPU",
			},
			// "VIDEO" active le suivi inter-frames; "IMAGE" redetecterait a chaque frame.
			runningMode: "VIDEO",
			numHands: MAX_HANDS,
			minHandDetectionConfidence: MIN_HAND_DETECTION_CONFIDENCE,
			minHandPresenceConfidence: MIN_HAND_PRESENCE_CONFIDENCE,
			minTrackingConfidence: MIN_TRACKING_CONFIDENCE,
		});
	});

	it("rend le detecteur construit par le SDK", async () => {
		await expect(createHandLandmarker()).resolves.toBe(LANDMARKER);
	});

	it("propage un echec de chargement du wasm", async () => {
		const panne = new Error("wasm indisponible");
		mediapipe.forVisionTasks.mockRejectedValue(panne);

		await expect(createHandLandmarker()).rejects.toBe(panne);
		expect(mediapipe.createFromOptions).not.toHaveBeenCalled();
	});

	it("propage un echec de chargement du modele", async () => {
		const panne = new Error("modele introuvable");
		mediapipe.createFromOptions.mockRejectedValue(panne);

		await expect(createHandLandmarker()).rejects.toBe(panne);
	});
});
