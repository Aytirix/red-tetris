// Shared thresholds, cooldowns and configuration for hand-based controls.

export const HAND_LANDMARKER_WASM_URL =
	"https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.34/wasm";

export const HAND_LANDMARKER_MODEL_URL =
	"https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task";

export const WEBCAM_CONSTRAINTS: MediaStreamConstraints = {
	video: {
		width: { ideal: 320, max: 640 },
		height: { ideal: 240, max: 480 },
		frameRate: { ideal: 60, max: 60 },
		facingMode: "user",
	},
	audio: false,
};

// Fist detection: ratio of (tip→wrist) / (mcp→wrist). Below => curled.
// Strict: 0.85 avoids counting half-curled fingers during transitions.
export const FIST_RATIO_THRESHOLD = 0.85;
// All 4 non-thumb fingers must be curled to count as a fist.
export const FIST_MIN_CURLED_FINGERS = 4;

// Per-action cooldowns (ms) to avoid gesture spam.
export const COOLDOWN_MOVE_MS = 150;
export const COOLDOWN_ROTATE_MS = 0;
export const COOLDOWN_SOFT_DROP_MS = 70;
export const COOLDOWN_HARD_DROP_MS = 500;
// After a hard drop, all other actions are blocked for this duration.
export const COOLDOWN_RELEASE_BLOCK_MS = 350;

// Motion controls. X is mirrored because the webcam preview is displayed as a
// selfie view in TestPage.
export const MOTION_MIRROR_X = true;
export const MOTION_HISTORY_MS = 1400;
export const MOTION_TRACK_LOST_MS = 350;

// Palm swipe detection for slap-like controls.
export const MOTION_SWIPE_WINDOW_MS = 260;
export const MOTION_SWIPE_HAND_SCALE_RATIO = 0.8;
export const MOTION_SWIPE_MIN_DISTANCE = 0.1;
export const MOTION_SWIPE_MAX_DISTANCE = 0.24;
export const MOTION_SWIPE_MIN_SPEED = 0.45;
export const MOTION_SWIPE_DOMINANCE_RATIO = 1.2;
export const MOTION_SWIPE_REPEAT_BLOCK_MS = 350;
export const MOTION_TWO_HAND_DROP_WINDOW_MS = 150;

// Index circle detection for rotate.
export const MOTION_CIRCLE_HISTORY_MS = 1300;
export const MOTION_CIRCLE_MIN_DURATION_MS = 300;
export const MOTION_CIRCLE_MIN_SAMPLES = 10;
export const MOTION_CIRCLE_MIN_RADIUS = 0.025;
export const MOTION_CIRCLE_MAX_RADIUS = 0.18;
export const MOTION_CIRCLE_MIN_ANGLE = Math.PI * 1.65;
export const MOTION_CIRCLE_CLOSE_RATIO = 1.15;
export const MOTION_CIRCLE_MAX_RADIUS_VARIATION_RATIO = 0.9;
export const MOTION_CIRCLE_MIN_PATH_RATIO = 4.2;
export const MOTION_CIRCLE_REPEAT_BLOCK_MS = 450;

// Required Hand Landmarker configuration.
export const MAX_HANDS = 2;
export const MIN_HAND_DETECTION_CONFIDENCE = 0.5;
export const MIN_HAND_PRESENCE_CONFIDENCE = 0.5;
export const MIN_TRACKING_CONFIDENCE = 0.5;

// Landmark indices (MediaPipe Hand model).
export const LM = {
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
