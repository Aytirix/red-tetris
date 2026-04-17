import { FilesetResolver, HandLandmarker } from "@mediapipe/tasks-vision";
import {
	HAND_LANDMARKER_MODEL_URL,
	HAND_LANDMARKER_WASM_URL,
	MAX_HANDS,
	MIN_HAND_DETECTION_CONFIDENCE,
	MIN_HAND_PRESENCE_CONFIDENCE,
	MIN_TRACKING_CONFIDENCE,
} from "./constants";

export async function createHandLandmarker(): Promise<HandLandmarker> {
	const fileset = await FilesetResolver.forVisionTasks(HAND_LANDMARKER_WASM_URL);
	return HandLandmarker.createFromOptions(fileset, {
		baseOptions: {
			modelAssetPath: HAND_LANDMARKER_MODEL_URL,
			delegate: "GPU",
		},
		runningMode: "VIDEO",
		numHands: MAX_HANDS,
		minHandDetectionConfidence: MIN_HAND_DETECTION_CONFIDENCE,
		minHandPresenceConfidence: MIN_HAND_PRESENCE_CONFIDENCE,
		minTrackingConfidence: MIN_TRACKING_CONFIDENCE,
	});
}
