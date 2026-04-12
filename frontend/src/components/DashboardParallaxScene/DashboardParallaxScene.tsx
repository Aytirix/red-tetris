/**
 * DashboardParallaxScene
 *
 * Full-viewport layered parallax background.
 * Dashboard content is passed as children and rendered above all layers.
 */

import type { CSSProperties, ReactNode } from "react";
import { useEffect, useRef } from "react";
import styles from "./DashboardParallaxScene.module.scss";

export type SceneTheme = "pirates" | "marines";

type Props = {
	theme: SceneTheme;
	children?: ReactNode;
};

// Depth: 0 = barely moves, 1 = full amplitude at cursor extreme
const D = {
	SKY:     0.04,
	MAIN:    0.26,
	FRAMING: 0.16,
	FG:      0.58,
} as const;

type WithDepth = CSSProperties & { "--depth"?: number };

const EASING = 0.08;

export default function DashboardParallaxScene({ theme, children }: Props) {
	const sceneRef = useRef<HTMLDivElement>(null);
	const target   = useRef({ x: 0, y: 0 });
	const current  = useRef({ x: 0, y: 0 });
	const rafId    = useRef<number | null>(null);

	useEffect(() => {
		const scene = sceneRef.current;
		if (!scene) return;

		function onPointerMove(e: PointerEvent) {
			if (e.pointerType !== "mouse") return;
			const r = scene!.getBoundingClientRect();
			target.current.x = ((e.clientX - r.left) / r.width  - 0.5) * 2;
			target.current.y = ((e.clientY - r.top)  / r.height - 0.5) * 2;
		}

		function onPointerLeave() {
			target.current.x = 0;
			target.current.y = 0;
		}

		function tick() {
			current.current.x += (target.current.x - current.current.x) * EASING;
			current.current.y += (target.current.y - current.current.y) * EASING;
			scene!.style.setProperty("--px", current.current.x.toFixed(4));
			scene!.style.setProperty("--py", current.current.y.toFixed(4));
			rafId.current = requestAnimationFrame(tick);
		}

		window.addEventListener("pointermove",  onPointerMove,  { passive: true });
		window.addEventListener("pointerleave", onPointerLeave);
		rafId.current = requestAnimationFrame(tick);

		return () => {
			if (rafId.current !== null) cancelAnimationFrame(rafId.current);
			window.removeEventListener("pointermove",  onPointerMove);
			window.removeEventListener("pointerleave", onPointerLeave);
		};
	}, []);

	return (
		<div ref={sceneRef} className={styles.scene} aria-hidden="true">
			{theme === "pirates" ? <PirateLayers /> : <MarineLayers />}
			<div className={styles.scrim} />
			{children !== undefined && (
				<div className={styles.content} aria-hidden="false">
					{children}
				</div>
			)}
		</div>
	);
}

function FgImg({ src }: { src: string }) {
	return (
		<img
			className={styles.fgImg}
			src={src}
			alt=""
			draggable={false}
			loading="eager"
			decoding="async"
			onError={(e) => {
				const el = e.currentTarget.parentElement;
				if (el) el.style.display = "none";
			}}
		/>
	);
}

// ─── Pirates ──────────────────────────────────────────────────────────────────
// sky → ship group → fg left / fg right

function PirateLayers() {
	return (
		<>
			{/* 1 — Sky */}
			<div
				className={`${styles.layer} ${styles.sky}`}
				style={{ zIndex: 1, "--depth": D.SKY } as WithDepth}
			>
				<img
					className={styles.skyImg}
					src="/img/dashboard/pirates/pirates_sky.jpg"
					alt=""
					draggable={false}
					loading="eager"
					decoding="async"
				/>
			</div>

			{/* 2 — Ship: mast first (z=1) so hull (z=2) overlaps at the deck zone */}
			<div
				className={`${styles.layer} ${styles.shipGroup}`}
				style={{ zIndex: 2, "--depth": D.MAIN } as WithDepth}
			>
				<img
					className={styles.shipMast}
					src="/img/dashboard/pirates/pirates_ship_masts_sails.png"
					alt=""
					draggable={false}
					loading="eager"
					decoding="async"
				/>
				<img
					className={styles.shipHull}
					src="/img/dashboard/pirates/pirates_ship_hull.png"
					alt=""
					draggable={false}
					loading="eager"
					decoding="async"
				/>
			</div>

			{/* 3 — Foreground left (missing on disk → onError hides wrapper) */}
			<div
				className={`${styles.layer} ${styles.fgLeft}`}
				style={{ zIndex: 3, "--depth": D.FG } as WithDepth}
			>
				<FgImg src="/img/dashboard/pirates/pirates_foreground_left.png" />
			</div>

			{/* 3 — Foreground right */}
			<div
				className={`${styles.layer} ${styles.fgRight}`}
				style={{ zIndex: 3, "--depth": D.FG } as WithDepth}
			>
				<FgImg src="/img/dashboard/pirates/pirates_foreground_right.png" />
			</div>
		</>
	);
}

// ─── Marines ──────────────────────────────────────────────────────────────────
// sky → headquarters ship → flags/architecture → fg left / fg right

function MarineLayers() {
	return (
		<>
			{/* 1 — Sky */}
			<div
				className={`${styles.layer} ${styles.sky}`}
				style={{ zIndex: 1, "--depth": D.SKY } as WithDepth}
			>
				<img
					className={styles.skyImg}
					src="/img/dashboard/marines/marines_sky.jpg"
					alt=""
					draggable={false}
					loading="eager"
					decoding="async"
				/>
			</div>

			{/* 2 — Headquarters ship */}
			<div
				className={`${styles.layer} ${styles.hqShip}`}
				style={{ zIndex: 2, "--depth": D.MAIN } as WithDepth}
			>
				<img
					className={styles.hqImg}
					src="/img/dashboard/marines/marines_headquarters_ship.png"
					alt=""
					draggable={false}
					loading="eager"
					decoding="async"
				/>
			</div>

			{/* 3 — Flags / architecture framing */}
			<div
				className={`${styles.layer} ${styles.fullscreenPng}`}
				style={{ zIndex: 3, "--depth": D.FRAMING } as WithDepth}
			>
				<img
					className={styles.fullscreenPngImg}
					src="/img/dashboard/marines/marines_flags_architecture.png"
					alt=""
					draggable={false}
					loading="eager"
					decoding="async"
				/>
			</div>

			{/* 4 — Foreground left */}
			<div
				className={`${styles.layer} ${styles.fgLeft} ${styles.marineFg}`}
				style={{ zIndex: 4, "--depth": D.FG } as WithDepth}
			>
				<FgImg src="/img/dashboard/marines/marines_foreground_left.png" />
			</div>

			{/* 4 — Foreground right */}
			<div
				className={`${styles.layer} ${styles.fgRight} ${styles.marineFg}`}
				style={{ zIndex: 4, "--depth": D.FG } as WithDepth}
			>
				<FgImg src="/img/dashboard/marines/marines_foreground_right.png" />
			</div>
		</>
	);
}
