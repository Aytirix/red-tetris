import { describe, expect, it } from "vitest";
import {
	COOLDOWN_HARD_DROP_MS,
	COOLDOWN_MOVE_MS,
	COOLDOWN_RELEASE_BLOCK_MS,
	COOLDOWN_ROTATE_MS,
	COOLDOWN_SOFT_DROP_MS,
	FIST_MIN_CURLED_FINGERS,
	FIST_RATIO_THRESHOLD,
	HAND_DEBUG_RENDER_FPS,
	HAND_DETECTION_FPS,
	HAND_LANDMARKER_MODEL_URL,
	HAND_LANDMARKER_WASM_URL,
	LM,
	MAX_HANDS,
	MIN_HAND_DETECTION_CONFIDENCE,
	MIN_HAND_PRESENCE_CONFIDENCE,
	MIN_TRACKING_CONFIDENCE,
	MOTION_CIRCLE_CLOSE_RATIO,
	MOTION_CIRCLE_HISTORY_MS,
	MOTION_CIRCLE_MAX_RADIUS,
	MOTION_CIRCLE_MAX_RADIUS_VARIATION_RATIO,
	MOTION_CIRCLE_MIN_ANGLE,
	MOTION_CIRCLE_MIN_DURATION_MS,
	MOTION_CIRCLE_MIN_PATH_RATIO,
	MOTION_CIRCLE_MIN_RADIUS,
	MOTION_CIRCLE_MIN_SAMPLES,
	MOTION_CIRCLE_REPEAT_BLOCK_MS,
	MOTION_HISTORY_MS,
	MOTION_SWIPE_DOMINANCE_RATIO,
	MOTION_SWIPE_HAND_SCALE_RATIO,
	MOTION_SWIPE_MAX_DISTANCE,
	MOTION_SWIPE_MIN_DISTANCE,
	MOTION_SWIPE_MIN_SPEED,
	MOTION_SWIPE_REPEAT_BLOCK_MS,
	MOTION_SWIPE_WINDOW_MS,
	MOTION_TRACK_LOST_MS,
	MOTION_TWO_HAND_DROP_WINDOW_MS,
	WEBCAM_CONSTRAINTS,
} from "./constants";

// Les indices de landmarks sont imposes par le modele "hand_landmarker" de
// MediaPipe (21 points, ordre documente wrist -> pouce -> ... -> auriculaire).
// Cette table de reference est recopiee de la doc, jamais du code teste.
const MEDIAPIPE_HAND_LANDMARK_INDICES = {
	WRIST: 0,
	INDEX_MCP: 5,
	INDEX_TIP: 8,
	MIDDLE_MCP: 9,
	MIDDLE_TIP: 12,
	RING_MCP: 13,
	RING_TIP: 16,
	PINKY_MCP: 17,
	PINKY_TIP: 20,
} as const;

describe("constants — indices de landmarks MediaPipe", () => {
	it("reprend exactement la numerotation du modele hand_landmarker", () => {
		expect(LM).toEqual(MEDIAPIPE_HAND_LANDMARK_INDICES);
	});

	it("reste dans les 21 points du modele et sans doublon", () => {
		const indices = Object.values(LM);
		for (const index of indices) {
			expect(Number.isInteger(index)).toBe(true);
			expect(index).toBeGreaterThanOrEqual(0);
			expect(index).toBeLessThan(21);
		}
		expect(new Set(indices).size).toBe(indices.length);
	});

	it("place chaque bout de doigt au-dela de son articulation MCP", () => {
		expect(LM.INDEX_TIP).toBeGreaterThan(LM.INDEX_MCP);
		expect(LM.MIDDLE_TIP).toBeGreaterThan(LM.MIDDLE_MCP);
		expect(LM.RING_TIP).toBeGreaterThan(LM.RING_MCP);
		expect(LM.PINKY_TIP).toBeGreaterThan(LM.PINKY_MCP);
	});
});

describe("constants — detection de poing", () => {
	it("garde un seuil de repli strictement inferieur a 1", () => {
		// A 1 ou plus, un doigt tendu (tip plus loin du poignet que le MCP)
		// compterait deja comme replie: la detection ne voudrait plus rien dire.
		expect(FIST_RATIO_THRESHOLD).toBeGreaterThan(0);
		expect(FIST_RATIO_THRESHOLD).toBeLessThan(1);
	});

	it("exige les quatre doigts hors pouce", () => {
		expect(FIST_MIN_CURLED_FINGERS).toBe(4);
	});
});

describe("constants — cooldowns", () => {
	it("n'utilise que des durees positives ou nulles", () => {
		for (const ms of [
			COOLDOWN_MOVE_MS,
			COOLDOWN_ROTATE_MS,
			COOLDOWN_SOFT_DROP_MS,
			COOLDOWN_HARD_DROP_MS,
			COOLDOWN_RELEASE_BLOCK_MS,
		]) {
			expect(ms).toBeGreaterThanOrEqual(0);
		}
	});

	it("hierarchise les cooldowns: hard drop > deplacement > soft drop > rotation", () => {
		expect(COOLDOWN_HARD_DROP_MS).toBeGreaterThan(COOLDOWN_MOVE_MS);
		expect(COOLDOWN_MOVE_MS).toBeGreaterThan(COOLDOWN_SOFT_DROP_MS);
		expect(COOLDOWN_SOFT_DROP_MS).toBeGreaterThan(COOLDOWN_ROTATE_MS);
	});

	it("libere le blocage post-drop avant que le drop lui-meme soit re-armable", () => {
		// Sinon le blocage global serait inutile: le hard drop suivant serait
		// deja autorise que les autres actions seraient encore gelees.
		expect(COOLDOWN_RELEASE_BLOCK_MS).toBeLessThan(COOLDOWN_HARD_DROP_MS);
		expect(COOLDOWN_RELEASE_BLOCK_MS).toBeGreaterThan(0);
	});
});

describe("constants — cadences", () => {
	it("rafraichit le debug moins souvent que la detection", () => {
		expect(HAND_DETECTION_FPS).toBeGreaterThan(0);
		expect(HAND_DEBUG_RENDER_FPS).toBeGreaterThan(0);
		expect(HAND_DEBUG_RENDER_FPS).toBeLessThan(HAND_DETECTION_FPS);
	});

	it("detecte assez vite pour qu'un swipe tienne plusieurs frames", () => {
		const framesParFenetreDeSwipe = (MOTION_SWIPE_WINDOW_MS / 1000) * HAND_DETECTION_FPS;
		expect(framesParFenetreDeSwipe).toBeGreaterThanOrEqual(2);
	});

	it("detecte assez vite pour remplir un cercle complet", () => {
		const framesParFenetreDeCercle = (MOTION_CIRCLE_HISTORY_MS / 1000) * HAND_DETECTION_FPS;
		expect(framesParFenetreDeCercle).toBeGreaterThanOrEqual(MOTION_CIRCLE_MIN_SAMPLES);
	});
});

describe("constants — fenetres temporelles de mouvement", () => {
	it("garde chaque sous-fenetre dans l'historique conserve", () => {
		// Les echantillons plus vieux que MOTION_HISTORY_MS sont jetes: toute
		// fenetre plus large que lui serait structurellement inatteignable.
		expect(MOTION_SWIPE_WINDOW_MS).toBeLessThanOrEqual(MOTION_HISTORY_MS);
		expect(MOTION_CIRCLE_HISTORY_MS).toBeLessThanOrEqual(MOTION_HISTORY_MS);
		expect(MOTION_CIRCLE_MIN_DURATION_MS).toBeLessThanOrEqual(MOTION_CIRCLE_HISTORY_MS);
	});

	it("tolere une perte de suivi plus longue qu'une frame de detection", () => {
		expect(MOTION_TRACK_LOST_MS).toBeGreaterThan(1000 / HAND_DETECTION_FPS);
	});

	it("laisse le temps d'assembler un drop a deux mains", () => {
		expect(MOTION_TWO_HAND_DROP_WINDOW_MS).toBeGreaterThan(1000 / HAND_DETECTION_FPS);
		// La fenetre doit rester courte face au re-armement du swipe, sinon deux
		// swipes successifs d'une meme main seraient lus comme un drop.
		expect(MOTION_TWO_HAND_DROP_WINDOW_MS).toBeLessThan(MOTION_SWIPE_REPEAT_BLOCK_MS);
	});
});

describe("constants — swipe de paume", () => {
	it("borne la distance minimale entre un plancher et un plafond coherents", () => {
		expect(MOTION_SWIPE_MIN_DISTANCE).toBeGreaterThan(0);
		expect(MOTION_SWIPE_MIN_DISTANCE).toBeLessThan(MOTION_SWIPE_MAX_DISTANCE);
		// Coordonnees normalisees: au-dela de 1 la main sortirait de l'image.
		expect(MOTION_SWIPE_MAX_DISTANCE).toBeLessThan(1);
	});

	it("exige une direction franchement dominante", () => {
		expect(MOTION_SWIPE_DOMINANCE_RATIO).toBeGreaterThan(1);
	});

	it("demande une vitesse atteignable dans la fenetre de swipe", () => {
		const vitesseMaxAtteignable = MOTION_SWIPE_MAX_DISTANCE / (MOTION_SWIPE_WINDOW_MS / 1000);
		expect(MOTION_SWIPE_MIN_SPEED).toBeGreaterThan(0);
		expect(MOTION_SWIPE_MIN_SPEED).toBeLessThan(vitesseMaxAtteignable);
	});

	it("derive un seuil proportionnel a la main qui reste dans les bornes", () => {
		expect(MOTION_SWIPE_HAND_SCALE_RATIO).toBeGreaterThan(0);
		expect(MOTION_SWIPE_HAND_SCALE_RATIO).toBeLessThan(1);
	});
});

describe("constants — cercle d'index", () => {
	it("demande assez de points pour decrire une trajectoire fermee", () => {
		expect(MOTION_CIRCLE_MIN_SAMPLES).toBeGreaterThanOrEqual(3);
	});

	it("encadre le rayon entre un plancher et un plafond", () => {
		expect(MOTION_CIRCLE_MIN_RADIUS).toBeGreaterThan(0);
		expect(MOTION_CIRCLE_MIN_RADIUS).toBeLessThan(MOTION_CIRCLE_MAX_RADIUS);
		expect(MOTION_CIRCLE_MAX_RADIUS).toBeLessThan(1);
	});

	it("exige plus d'un demi-tour sans depasser le tour complet", () => {
		expect(MOTION_CIRCLE_MIN_ANGLE).toBeGreaterThan(Math.PI);
		expect(MOTION_CIRCLE_MIN_ANGLE).toBeLessThanOrEqual(2 * Math.PI);
	});

	it("demande un chemin plus court que le perimetre d'un tour complet", () => {
		// pathLength >= avgRadius * ratio; un tour complet vaut 2*PI*r.
		expect(MOTION_CIRCLE_MIN_PATH_RATIO).toBeGreaterThan(0);
		expect(MOTION_CIRCLE_MIN_PATH_RATIO).toBeLessThanOrEqual(2 * Math.PI);
		// ...mais coherent avec l'angle exige: un balayage de MIN_ANGLE radians a
		// rayon r parcourt deja MIN_ANGLE * r.
		expect(MOTION_CIRCLE_MIN_PATH_RATIO).toBeLessThanOrEqual(MOTION_CIRCLE_MIN_ANGLE);
	});

	it("tolere une irregularite de rayon et une boucle non parfaitement fermee", () => {
		expect(MOTION_CIRCLE_MAX_RADIUS_VARIATION_RATIO).toBeGreaterThan(0);
		expect(MOTION_CIRCLE_MAX_RADIUS_VARIATION_RATIO).toBeLessThan(2);
		expect(MOTION_CIRCLE_CLOSE_RATIO).toBeGreaterThan(0);
		// Au-dela de 2r, deux points du cercle peuvent etre diametralement
		// opposes: la contrainte de fermeture ne filtrerait plus rien.
		expect(MOTION_CIRCLE_CLOSE_RATIO).toBeLessThan(2);
	});

	it("re-arme la rotation apres au moins une frame de detection", () => {
		expect(MOTION_CIRCLE_REPEAT_BLOCK_MS).toBeGreaterThan(1000 / HAND_DETECTION_FPS);
	});
});

describe("constants — configuration MediaPipe", () => {
	it("charge le wasm et le modele en https", () => {
		expect(HAND_LANDMARKER_WASM_URL.startsWith("https://")).toBe(true);
		expect(HAND_LANDMARKER_MODEL_URL.startsWith("https://")).toBe(true);
		expect(HAND_LANDMARKER_MODEL_URL.endsWith(".task")).toBe(true);
	});

	it("suit deux mains au plus", () => {
		expect(MAX_HANDS).toBe(2);
	});

	it("garde des confiances dans [0, 1]", () => {
		for (const confidence of [
			MIN_HAND_DETECTION_CONFIDENCE,
			MIN_HAND_PRESENCE_CONFIDENCE,
			MIN_TRACKING_CONFIDENCE,
		]) {
			expect(confidence).toBeGreaterThan(0);
			expect(confidence).toBeLessThanOrEqual(1);
		}
	});
});

describe("constants — contraintes webcam", () => {
	it("demande la camera frontale sans audio", () => {
		expect(WEBCAM_CONSTRAINTS.audio).toBe(false);
		const video = WEBCAM_CONSTRAINTS.video as MediaTrackConstraints;
		expect(video.facingMode).toBe("user");
	});

	it("garde chaque resolution ideale sous son maximum", () => {
		const video = WEBCAM_CONSTRAINTS.video as MediaTrackConstraints;
		for (const range of [video.width, video.height, video.frameRate]) {
			const { ideal, max } = range as { ideal: number; max: number };
			expect(ideal).toBeGreaterThan(0);
			expect(ideal).toBeLessThanOrEqual(max);
		}
	});

	it("capture au moins aussi vite que la detection", () => {
		const video = WEBCAM_CONSTRAINTS.video as MediaTrackConstraints;
		const { ideal } = video.frameRate as { ideal: number };
		expect(ideal).toBeGreaterThanOrEqual(HAND_DETECTION_FPS);
	});
});
