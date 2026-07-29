import { useEffect, useState } from "react";

export type ViewportSize = { width: number; height: number };

function readViewport(): ViewportSize {
	// Garde-fou : en environnement sans DOM, on retombe sur une taille de bureau
	// classique plutôt que 0 (qui écraserait le plateau à sa taille minimale).
	if (typeof window === "undefined") return { width: 1280, height: 800 };
	return { width: window.innerWidth, height: window.innerHeight };
}

/** Taille du viewport, réévaluée à chaque redimensionnement de la fenêtre. */
export function useViewportSize(): ViewportSize {
	const [size, setSize] = useState<ViewportSize>(readViewport);

	useEffect(() => {
		// La lecture initiale a lieu au premier rendu : on resynchronise au montage
		// au cas où la fenêtre aurait changé entre-temps (hydratation, écran externe).
		setSize(readViewport());

		let frame = 0;
		function onResize() {
			// Un « resize » émet en rafale pendant le drag : on ne recalcule qu'une
			// fois par frame pour ne pas re-rendre le plateau des dizaines de fois.
			if (frame) return;
			frame = window.requestAnimationFrame(() => {
				frame = 0;
				setSize(readViewport());
			});
		}

		window.addEventListener("resize", onResize);
		return () => {
			window.removeEventListener("resize", onResize);
			if (frame) window.cancelAnimationFrame(frame);
		};
	}, []);

	return size;
}
