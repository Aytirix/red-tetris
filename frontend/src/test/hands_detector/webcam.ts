import { WEBCAM_CONSTRAINTS } from "./constants";

export async function startWebcam(video: HTMLVideoElement): Promise<MediaStream> {
	const stream = await navigator.mediaDevices.getUserMedia(WEBCAM_CONSTRAINTS);
	video.srcObject = stream;
	video.playsInline = true;
	video.muted = true;
	await video.play();
	return stream;
}

export function stopWebcam(video: HTMLVideoElement | null, stream: MediaStream | null): void {
	if (stream) {
		for (const track of stream.getTracks()) track.stop();
	}
	if (video) {
		video.srcObject = null;
	}
}
