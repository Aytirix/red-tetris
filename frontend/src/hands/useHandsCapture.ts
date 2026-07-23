import { useEffect, useRef, useState } from "react";
import type { RefObject } from "react";
import { frameToRgb } from "./frameToRgb";
import { emitHandsFrame } from "../socket/events/game";

// MediaStreamTrackProcessor (WebCodecs) n'est pas encore dans les types DOM standard.
// Déclaration minimale de ce qu'on utilise: lire des VideoFrame sans canvas.
declare global {
	interface MediaStreamTrackProcessorInit { track: MediaStreamTrack }
	class MediaStreamTrackProcessor {
		constructor(init: MediaStreamTrackProcessorInit);
		readonly readable: ReadableStream<VideoFrame>;
	}
}

export type HandsCaptureStatus = "idle" | "starting" | "on" | "error" | "unsupported";

export type UseHandsCaptureOptions = {
	// Caméra allumée (aperçu). Le joueur l'active dans le lobby.
	cameraOn: boolean;
	// Envoi des frames au serveur (uniquement pendant une partie en mode mains).
	streaming: boolean;
	videoRef: RefObject<HTMLVideoElement | null>;
};

// ~18 images/s envoyées: suffisant pour des gestes francs, raisonnable en bande passante.
const SEND_INTERVAL_MS = 1000 / 18;

// La capture pixel repose sur WebCodecs (MediaStreamTrackProcessor), qui évite tout
// canvas côté client. Indisponible hors Chromium récent.
function isWebCodecsSupported(): boolean {
	return typeof MediaStreamTrackProcessor === "function";
}

export function useHandsCapture(opts: UseHandsCaptureOptions): { status: HandsCaptureStatus; error: string | null } {
	const { cameraOn, streaming, videoRef } = opts;
	const [status, setStatus] = useState<HandsCaptureStatus>("idle");
	const [error, setError] = useState<string | null>(null);
	// Ref pour lire l'état "streaming" à jour dans la boucle sans la relancer.
	const streamingRef = useRef(streaming);
	useEffect(() => { streamingRef.current = streaming; }, [streaming]);

	useEffect(() => {
		if (!cameraOn) {
			setStatus("idle");
			return;
		}
		if (!isWebCodecsSupported()) {
			setStatus("unsupported");
			setError("Votre navigateur ne supporte pas la capture sans canvas (WebCodecs).");
			return;
		}

		let cancelled = false;
		let stream: MediaStream | null = null;
		let reader: ReadableStreamDefaultReader<VideoFrame> | null = null;
		let lastSend = 0;

		setStatus("starting");
		setError(null);

		// Une passe de capture: ouvre la caméra, lit les frames, envoie celles à streamer.
		// Retourne quand le reader se termine (track arrêté) — l'appelant redémarre alors.
		async function runCapture(): Promise<void> {
			const video = videoRef.current;
			if (!video) throw new Error("élément vidéo non monté");
			stream = await navigator.mediaDevices.getUserMedia({
				video: { width: 640, height: 480, frameRate: 30 },
				audio: false,
			});
			if (cancelled) return;
			video.srcObject = stream;
			await video.play().catch(() => undefined);
			const track = stream.getVideoTracks()[0];
			if (!track) throw new Error("aucune piste vidéo");
			const activeReader = new MediaStreamTrackProcessor({ track }).readable.getReader();
			reader = activeReader;
			setStatus("on");

			while (!cancelled) {
				const { value: frame, done } = await activeReader.read();
				if (done) break;
				if (!frame) continue;
				const now = performance.now();
				// Throttle + on ne convertit/envoie que si on stream réellement.
				if (!streamingRef.current || now - lastSend < SEND_INTERVAL_MS) {
					frame.close();
					continue;
				}
				lastSend = now;
				// Chaque frame est isolée: une conversion qui échoue ne doit JAMAIS
				// tuer la boucle de capture (sinon plus aucune frame n'est envoyée).
				try {
					const rgb = await frameToRgb(frame);
					if (rgb) emitHandsFrame(rgb);
				} catch {
					/* frame ignorée */
				} finally {
					frame.close();
				}
			}
			// Reader terminé (track arrêté): on libère ce flux, l'appelant relancera.
			for (const t of stream.getTracks()) t.stop();
			stream = null;
		}

		(async () => {
			// Boucle de résilience: tant que la caméra doit rester active, si une passe
			// se TERMINE (reader done = track arrêté par l'OS, changement d'appareil,
			// glitch), on relance — c'est ce qui empêchait les frames de repartir. En
			// revanche un ÉCHEC de démarrage (permission refusée, pas de caméra) est
			// définitif: on passe en "error" sans réessayer en boucle.
			while (!cancelled) {
				try {
					await runCapture();
				} catch (err) {
					if (cancelled) return;
					setError(err instanceof Error ? err.message : String(err));
					setStatus("error");
					return;
				}
				if (cancelled) return;
				// Reader terminé mais la caméra doit rester on: courte pause puis relance.
				await new Promise((r) => setTimeout(r, 200));
			}
		})();

		return () => {
			cancelled = true;
			if (reader) {
				try { reader.cancel().catch(() => undefined); } catch { /* ignore */ }
			}
			if (stream) {
				for (const track of stream.getTracks()) track.stop();
			}
			const video = videoRef.current;
			if (video) video.srcObject = null;
			setStatus("idle");
		};
	}, [cameraOn, videoRef]);

	return { status, error };
}
