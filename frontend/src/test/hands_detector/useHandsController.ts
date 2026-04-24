import { useEffect, useRef, useState } from "react";
import type { RefObject } from "react";
import type { HandLandmarker, HandLandmarkerResult } from "@mediapipe/tasks-vision";

import type { GameAction } from "./actions";
import { applyCooldowns } from "./actions";
import {
	HAND_DEBUG_RENDER_FPS,
	HAND_DETECTION_FPS,
} from "./constants";
import { analyzeHand } from "./gestures";
import type { HandGesture, Handedness, HandLandmarks } from "./gestures";
import { createHandLandmarker } from "./landmarker";
import { createMotionState, detectMotionActions } from "./motion";
import type { MotionState } from "./motion";
import { startWebcam, stopWebcam } from "./webcam";

export type HandsControllerStatus = "idle" | "loading" | "running" | "error";

export type DetectedHand = {
	handedness: Handedness;
	landmarks: HandLandmarks;
	gesture: HandGesture;
};

export type UseHandsControllerOptions = {
	enabled: boolean;
	videoRef: RefObject<HTMLVideoElement | null>;
	onAction: (action: GameAction) => void;
};

export type UseHandsControllerResult = {
	status: HandsControllerStatus;
	error: string | null;
	hands: DetectedHand[];
};

const HAND_DETECTION_INTERVAL_MS = 1000 / HAND_DETECTION_FPS;
const HAND_DEBUG_RENDER_INTERVAL_MS = 1000 / HAND_DEBUG_RENDER_FPS;

function extractHands(result: HandLandmarkerResult): DetectedHand[] {
	const out: DetectedHand[] = [];
	const lists = result.landmarks ?? [];
	const handed = result.handednesses ?? [];
	for (let i = 0; i < lists.length; i++) {
		const cat = handed[i]?.[0];
		const label = (cat?.categoryName as Handedness | undefined) ?? "Right";
		const lm = lists[i] as HandLandmarks;
		out.push({ handedness: label, landmarks: lm, gesture: analyzeHand(lm, label) });
	}
	return out;
}

export function useHandsController(
	opts: UseHandsControllerOptions,
): UseHandsControllerResult {
	const { enabled, videoRef, onAction } = opts;
	const [status, setStatus] = useState<HandsControllerStatus>("idle");
	const [error, setError] = useState<string | null>(null);
	const [hands, setHands] = useState<DetectedHand[]>([]);
	const onActionRef = useRef(onAction);

	useEffect(() => {
		onActionRef.current = onAction;
	}, [onAction]);

	useEffect(() => {
		if (!enabled) return;

		let cancelled = false;
		let stream: MediaStream | null = null;
		let landmarker: HandLandmarker | null = null;
		let rafId = 0;
		let lastVideoTime = -1;
		let lastDetectionAt = 0;
		let lastDebugRenderAt = 0;
		let lastFiredAt: Partial<Record<GameAction, number>> = {};
		let motionState: MotionState = createMotionState();

		setStatus("loading");
		setError(null);

		(async () => {
			try {
				const video = videoRef.current;
				if (!video) throw new Error("video element not mounted");

				stream = await startWebcam(video);
				if (cancelled) return;

				landmarker = await createHandLandmarker();
				if (cancelled) return;

				setStatus("running");

				const loop = (now: number) => {
					if (cancelled || !landmarker || !video) return;
					if (video.readyState >= 2) {
						const shouldDetect =
							now - lastDetectionAt >= HAND_DETECTION_INTERVAL_MS &&
							video.currentTime !== lastVideoTime;

						if (!shouldDetect) {
							rafId = requestAnimationFrame(loop);
							return;
						}
						lastDetectionAt = now;
						lastVideoTime = video.currentTime;

						const result = landmarker.detectForVideo(video, now);
						const detected = extractHands(result);
						const { actions, next: nextMotionState } = detectMotionActions(
							detected,
							motionState,
							now,
						);
						motionState = nextMotionState;
						const { fired, lastFiredAt: nextFired } = applyCooldowns(
							actions,
							lastFiredAt,
							now,
						);
						lastFiredAt = nextFired;
						for (const a of fired) onActionRef.current(a);

						if (now - lastDebugRenderAt >= HAND_DEBUG_RENDER_INTERVAL_MS) {
							lastDebugRenderAt = now;
							setHands(detected);
						}
					}
					rafId = requestAnimationFrame(loop);
				};

				rafId = requestAnimationFrame(loop);
			} catch (err) {
				if (cancelled) return;
				setError(err instanceof Error ? err.message : String(err));
				setStatus("error");
			}
		})();

		return () => {
			cancelled = true;
			if (rafId) cancelAnimationFrame(rafId);
			if (landmarker) {
				try { landmarker.close(); } catch { /* ignore */ }
			}
			stopWebcam(videoRef.current, stream);
			setHands([]);
			setStatus("idle");
		};
	}, [enabled, videoRef]);

	return { status, error, hands };
}
