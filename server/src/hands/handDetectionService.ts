// Service de détection de main, côté serveur. Reçoit une image RGB et renvoie, pour
// chaque main, sa latéralité et ses 21 landmarks normalisés (0..1).
//
// Chargé PARESSEUSEMENT (import dynamique au premier usage): tfjs + le backend WASM +
// le modèle MediaPipe Hands ne sont chargés que si quelqu'un lance réellement une
// partie en mode "mains". Le démarrage du serveur et les parties classiques ne sont
// donc pas impactés.
//
// NB: les poids du modèle sont téléchargés depuis le CDN de Google au premier chargement.
// Pour un déploiement hors-ligne, il faudra les servir localement (voir TODO).

import type { HandLandmarks, Handedness } from "./gestures.js";

export const HAND_INPUT_SIZE = 256;

export type DetectedHand = {
	handedness: Handedness;
	score: number;
	landmarks: HandLandmarks;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Detector = { estimateHands: (input: any, cfg?: any) => Promise<any[]> };

let detectorPromise: Promise<Detector> | null = null;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let tfRef: any = null;

async function loadDetector(): Promise<Detector> {
	const tf = await import("@tensorflow/tfjs");
	const wasm = await import("@tensorflow/tfjs-backend-wasm");
	const hpd = await import("@tensorflow-models/hand-pose-detection");

	// Localise les .wasm de tfjs-backend-wasm (fournis par le paquet, pas de CDN).
	const { createRequire } = await import("node:module");
	const { dirname } = await import("node:path");
	const require = createRequire(import.meta.url);
	const wasmDir = dirname(require.resolve("@tensorflow/tfjs-backend-wasm/package.json")) + "/dist/";
	wasm.setWasmPaths(wasmDir);

	await tf.setBackend("wasm");
	await tf.ready();
	tfRef = tf;

	const detector = await hpd.createDetector(hpd.SupportedModels.MediaPipeHands, {
		runtime: "tfjs",
		modelType: "lite",
		maxHands: 2,
	});
	// Warmup: la 1re inférence paie le coût d'initialisation, on l'absorbe ici.
	const warm = tf.zeros([HAND_INPUT_SIZE, HAND_INPUT_SIZE, 3], "int32");
	await detector.estimateHands(warm);
	warm.dispose();
	return detector as unknown as Detector;
}

// Déclenche (ou récupère) le chargement du modèle. À appeler quand un joueur passe
// "caméra prête" pour absorber le temps de chargement avant la partie.
export function ensureHandDetector(): Promise<Detector> {
	if (!detectorPromise)
		detectorPromise = loadDetector();
	return detectorPromise;
}

// Détecte les mains dans une image RGB (HAND_INPUT_SIZE²·3 octets). Renvoie les 21
// landmarks normalisés par main. Silencieux (tableau vide) en cas d'échec ponctuel.
export async function detectHands(rgb: Uint8Array): Promise<DetectedHand[]> {
	const detector = await ensureHandDetector();
	const tf = tfRef;
	const input = tf.tensor3d(rgb, [HAND_INPUT_SIZE, HAND_INPUT_SIZE, 3], "int32");
	try {
		const raw = await detector.estimateHands(input, { flipHorizontal: false });
		return raw.map((h): DetectedHand => ({
			handedness: h.handedness === "Left" ? "Left" : "Right",
			score: typeof h.score === "number" ? h.score : 0,
			landmarks: h.keypoints.map((k: { x: number; y: number }) => ({
				x: k.x / HAND_INPUT_SIZE,
				y: k.y / HAND_INPUT_SIZE,
			})),
		}));
	} finally {
		input.dispose();
	}
}
