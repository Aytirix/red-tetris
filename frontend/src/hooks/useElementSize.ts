import { useEffect, useState, type RefObject } from "react";

export type ElementSize = { width: number; height: number };

/** Taille intérieure (content box) d'un élément, suivie via ResizeObserver. */
export function useElementSize<T extends Element>(ref: RefObject<T | null>): ElementSize | null {
	const [size, setSize] = useState<ElementSize | null>(null);

	useEffect(() => {
		const element = ref.current;
		if (!element || typeof ResizeObserver === "undefined") return;

		const observer = new ResizeObserver((entries) => {
			const entry = entries[0];
			if (!entry) return;
			// `contentRect` = boîte intérieure (paddings/bordures déduits), exactement
			// la place utilisable par le plateau.
			const { width, height } = entry.contentRect;
			// Une boîte à 0 (élément masqué, démontage en cours) ne doit pas écraser le
			// plateau à sa taille minimale : on garde la dernière mesure valide.
			if (width <= 0 || height <= 0) return;
			setSize((previous) =>
				previous && previous.width === width && previous.height === height ? previous : { width, height },
			);
		});

		observer.observe(element);
		return () => observer.disconnect();
	}, [ref]);

	return size;
}
