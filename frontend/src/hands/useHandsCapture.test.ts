import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, waitFor, cleanup } from "@testing-library/react";
import { createRef } from "react";

const emitHandsFrame = vi.hoisted(() => vi.fn());
vi.mock("../socket/events/game", () => ({ emitHandsFrame }));

import { useHandsCapture } from "./useHandsCapture";

function fakeFrame(): VideoFrame {
	return {
		format: "I420",
		codedWidth: 2,
		codedHeight: 2,
		allocationSize: () => 6,
		copyTo: async (dest: Uint8Array) => {
			dest.set([128, 128, 128, 128, 128, 128]);
			return [{ offset: 0, stride: 2 }, { offset: 4, stride: 1 }, { offset: 5, stride: 1 }];
		},
		close: vi.fn(),
	} as unknown as VideoFrame;
}

function fakeVideoRef() {
	const ref = createRef<HTMLVideoElement>() as { current: HTMLVideoElement | null };
	ref.current = { srcObject: null, play: vi.fn(async () => undefined) } as unknown as HTMLVideoElement;
	return ref;
}

let trackStopped = false;

function installWebCodecs(frames: number) {
	trackStopped = false;
	const track = { stop: () => { trackStopped = true; } };
	const stream = { getVideoTracks: () => [track], getTracks: () => [track] };
	vi.stubGlobal("navigator", {
		mediaDevices: { getUserMedia: vi.fn(async () => stream) },
	});
	let left = frames;
	const reader = {
		read: vi.fn(async () => (left-- > 0 ? { value: fakeFrame(), done: false } : { value: undefined, done: true })),
		cancel: vi.fn(async () => undefined),
	};
	class FakeProcessor {
		readable = { getReader: () => reader };
		constructor(_init: unknown) { void _init; }
	}
	vi.stubGlobal("MediaStreamTrackProcessor", FakeProcessor);
}

describe("useHandsCapture", () => {
	beforeEach(() => { vi.clearAllMocks(); });
	afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

	it("reste idle tant que la caméra est éteinte", () => {
		installWebCodecs(0);
		const ref = fakeVideoRef();
		const { result } = renderHook(() => useHandsCapture({ cameraOn: false, streaming: false, videoRef: ref }));
		expect(result.current.status).toBe("idle");
	});

	it("signale un navigateur sans WebCodecs", () => {
		vi.stubGlobal("MediaStreamTrackProcessor", undefined);
		const ref = fakeVideoRef();
		const { result } = renderHook(() => useHandsCapture({ cameraOn: true, streaming: false, videoRef: ref }));
		expect(result.current.status).toBe("unsupported");
		expect(result.current.error).toBeTruthy();
	});

	it("démarre la caméra et envoie les frames quand on stream", async () => {
		installWebCodecs(2);
		const ref = fakeVideoRef();

		const { result } = renderHook(() => useHandsCapture({ cameraOn: true, streaming: true, videoRef: ref }));

		await waitFor(() => expect(result.current.status).toBe("on"));
		await waitFor(() => expect(emitHandsFrame).toHaveBeenCalled());
	});

	it("n'envoie aucune frame quand streaming est faux", async () => {
		installWebCodecs(2);
		const ref = fakeVideoRef();

		const { result } = renderHook(() => useHandsCapture({ cameraOn: true, streaming: false, videoRef: ref }));

		await waitFor(() => expect(result.current.status).toBe("on"));
		expect(emitHandsFrame).not.toHaveBeenCalled();
	});

	it("passe en erreur si getUserMedia échoue", async () => {
		installWebCodecs(0);
		vi.stubGlobal("navigator", {
			mediaDevices: { getUserMedia: vi.fn(async () => { throw new Error("refusé"); }) },
		});
		const ref = fakeVideoRef();

		const { result } = renderHook(() => useHandsCapture({ cameraOn: true, streaming: true, videoRef: ref }));

		await waitFor(() => expect(result.current.status).toBe("error"));
		expect(result.current.error).toContain("refusé");
	});

	it("coupe la caméra au démontage", async () => {
		installWebCodecs(5);
		const ref = fakeVideoRef();

		const { result, unmount } = renderHook(() => useHandsCapture({ cameraOn: true, streaming: true, videoRef: ref }));
		await waitFor(() => expect(result.current.status).toBe("on"));
		unmount();
		await waitFor(() => expect(trackStopped).toBe(true));
	});
});
