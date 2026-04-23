// Shared thresholds, cooldowns and configuration for hand-based controls.

export const HAND_LANDMARKER_WASM_URL =
	"https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.34/wasm";

export const HAND_LANDMARKER_MODEL_URL =
	"https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task";

export const WEBCAM_CONSTRAINTS: MediaStreamConstraints = {
	video: {
		width: { ideal: 640 },
		height: { ideal: 480 },
		frameRate: { ideal: 60, max: 60 },
		facingMode: "user",
	},
	audio: false,
};

// Fallback normalized (0..1) distance threshold for "fingers touching".
export const FINGER_TOUCH_DISTANCE = 0.06;
// Default touch threshold is scaled from palm size, so it stays usable when
// the hand moves closer/farther from the camera.
export const FINGER_TOUCH_HAND_SCALE_RATIO = 0.25;
export const FINGER_TOUCH_MIN_DISTANCE = 0.025;
export const FINGER_TOUCH_MAX_DISTANCE = 0.095;
export const FINGER_TOUCH_SEMI_CLOSED_RATIO = 0.72;
// MediaPipe z is noisy; keep it useful without letting it dominate x/y.
export const FINGER_TOUCH_Z_WEIGHT = 0.35;

// Fist detection: ratio of (tip→wrist) / (mcp→wrist). Below => curled.
// Strict: 0.85 avoids counting half-curled fingers during transitions.
export const FIST_RATIO_THRESHOLD = 0.85;
// All 4 non-thumb fingers must be curled to count as a fist.
export const FIST_MIN_CURLED_FINGERS = 4;
// If >= this many fingers are curling, only accept tighter pinch contacts
// during fist-closing transitions.
export const SEMI_FIST_THRESHOLD = 2;

// Per-action cooldowns (ms) to avoid gesture spam.
export const COOLDOWN_MOVE_MS = 150;
export const COOLDOWN_ROTATE_MS = 220;
export const COOLDOWN_SOFT_DROP_MS = 70;
export const COOLDOWN_HARD_DROP_MS = 500;
// After a hard drop, all other actions are blocked for this duration.
export const COOLDOWN_RELEASE_BLOCK_MS = 350;

// Gesture stability: a candidate action must be detected for this many
// consecutive frames before it is actually dispatched.
export const STABILITY_FRAMES_REQUIRED = 2;
export const STABILITY_FRAMES_REQUIRED_BY_ACTION = {
	LEFT: 3,
	RIGHT: 3,
	DOWN: 4,
	ROTATE: 4,
	DROP: 4,
} as const;

// Required Hand Landmarker configuration.
export const MAX_HANDS = 2;
export const MIN_HAND_DETECTION_CONFIDENCE = 0.5;
export const MIN_HAND_PRESENCE_CONFIDENCE = 0.5;
export const MIN_TRACKING_CONFIDENCE = 0.5;

// Landmark indices (MediaPipe Hand model).
export const LM = {
	WRIST: 0,
	THUMB_TIP: 4,
	INDEX_MCP: 5,
	INDEX_TIP: 8,
	MIDDLE_MCP: 9,
	MIDDLE_TIP: 12,
	RING_MCP: 13,
	RING_TIP: 16,
	PINKY_MCP: 17,
	PINKY_TIP: 20,
} as const;
