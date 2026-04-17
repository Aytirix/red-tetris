import { useEffect, useRef, useState } from "react";
import type { RefObject } from "react";
import type { HandLandmarker, HandLandmarkerResult } from "@mediapipe/tasks-vision";

import type { GameAction } from "./actions";
import { applyCooldowns, gesturesToActions } from "./actions";
import { updateStability } from "./stability";
import type { StabilityState } from "./stability";
import { analyzeHand } from "./gestures";
import type { HandGesture, Handedness, HandLandmarks } from "./gestures";
import { createHandLandmarker } from "./landmarker";
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
		let lastFiredAt: Partial<Record<GameAction, number>> = {};
		let stabilityState: StabilityState = {};

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

				const loop = () => {
					if (cancelled || !landmarker || !video) return;
					if (video.readyState >= 2 && video.currentTime !== lastVideoTime) {
						lastVideoTime = video.currentTime;
						const now = performance.now();
						const result = landmarker.detectForVideo(video, now);
						const detected = extractHands(result);
						setHands(detected);
						const raw = gesturesToActions(detected.map(d => d.gesture));
						const { confirmed, next: nextStability } = updateStability(raw, stabilityState);
						stabilityState = nextStability;
						const { fired, lastFiredAt: nextFired } = applyCooldowns(
							confirmed,
							lastFiredAt,
							now,
						);
						lastFiredAt = nextFired;
						for (const a of fired) onActionRef.current(a);
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
