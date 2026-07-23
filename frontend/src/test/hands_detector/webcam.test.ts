import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { WEBCAM_CONSTRAINTS } from "./constants";
import { startWebcam, stopWebcam } from "./webcam";

// jsdom n'implemente ni getUserMedia ni HTMLMediaElement.play: on pose des
// doublures minimales, seules les interactions du module sont observees.

type FakeVideo = {
	srcObject: MediaStream | null;
	playsInline: boolean;
	muted: boolean;
	play: ReturnType<typeof vi.fn>;
};

function fakeVideo(play: () => Promise<void> = () => Promise.resolve()): FakeVideo {
	return { srcObject: null, playsInline: false, muted: false, play: vi.fn(play) };
}

function fakeStream(trackCount = 2) {
	const tracks = Array.from({ length: trackCount }, () => ({ stop: vi.fn() }));
	return {
		tracks,
		stream: { getTracks: () => tracks } as unknown as MediaStream,
	};
}

const getUserMedia = vi.fn();

beforeEach(() => {
	getUserMedia.mockReset();
	Object.defineProperty(navigator, "mediaDevices", {
		value: { getUserMedia },
		configurable: true,
		writable: true,
	});
});

afterEach(() => {
	vi.restoreAllMocks();
});

describe("startWebcam", () => {
	it("demande la camera avec les contraintes du module", async () => {
		const { stream } = fakeStream();
		getUserMedia.mockResolvedValue(stream);
		await startWebcam(fakeVideo() as unknown as HTMLVideoElement);

		expect(getUserMedia).toHaveBeenCalledTimes(1);
		expect(getUserMedia).toHaveBeenCalledWith(WEBCAM_CONSTRAINTS);
	});

	it("branche le flux sur la balise video, muette et inline", async () => {
		const { stream } = fakeStream();
		getUserMedia.mockResolvedValue(stream);
		const video = fakeVideo();

		const rendu = await startWebcam(video as unknown as HTMLVideoElement);

		expect(video.srcObject).toBe(stream);
		// Sans muted + playsInline, iOS refuse la lecture automatique.
		expect(video.muted).toBe(true);
		expect(video.playsInline).toBe(true);
		expect(video.play).toHaveBeenCalledTimes(1);
		expect(rendu).toBe(stream);
	});

	it("attend que la lecture ait demarre avant de rendre le flux", async () => {
		const { stream } = fakeStream();
		getUserMedia.mockResolvedValue(stream);
		let demarrerLecture = () => {};
		const video = fakeVideo(() => new Promise<void>(resolve => { demarrerLecture = () => resolve(); }));

		let termine = false;
		const promesse = startWebcam(video as unknown as HTMLVideoElement).then(() => { termine = true; });
		await Promise.resolve();
		await Promise.resolve();
		expect(termine).toBe(false);

		demarrerLecture();
		await promesse;
		expect(termine).toBe(true);
	});

	it("propage un refus d'autorisation sans toucher a la video", async () => {
		const refus = new DOMException("Permission denied", "NotAllowedError");
		getUserMedia.mockRejectedValue(refus);
		const video = fakeVideo();

		await expect(startWebcam(video as unknown as HTMLVideoElement)).rejects.toBe(refus);
		expect(video.srcObject).toBeNull();
		expect(video.play).not.toHaveBeenCalled();
	});
});

describe("stopWebcam", () => {
	it("arrete toutes les pistes et libere la balise video", () => {
		const { stream, tracks } = fakeStream(3);
		const video = fakeVideo();
		video.srcObject = stream;

		stopWebcam(video as unknown as HTMLVideoElement, stream);

		for (const track of tracks) expect(track.stop).toHaveBeenCalledTimes(1);
		expect(video.srcObject).toBeNull();
	});

	it("libere la video meme sans flux connu", () => {
		const video = fakeVideo();
		video.srcObject = fakeStream().stream;

		stopWebcam(video as unknown as HTMLVideoElement, null);

		expect(video.srcObject).toBeNull();
	});

	it("arrete les pistes meme si la video a deja ete demontee", () => {
		const { stream, tracks } = fakeStream();
		expect(() => stopWebcam(null, stream)).not.toThrow();
		for (const track of tracks) expect(track.stop).toHaveBeenCalledTimes(1);
	});

	it("ne casse pas quand il n'y a plus rien a arreter", () => {
		expect(() => stopWebcam(null, null)).not.toThrow();
	});
});
