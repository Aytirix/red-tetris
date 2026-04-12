/**
 * DashboardParallaxScene
 *
 * Full-viewport layered parallax background driven by mouse position.
 * Only uses the exact image assets present in public/img/dashboard/.
 * Dashboard content is passed as children and rendered above all layers.
 */

import type { CSSProperties, ReactNode } from "react";
import { useEffect, useRef } from "react";
import styles from "./DashboardParallaxScene.module.scss";

// ─── Types ───────────────────────────────────────────────────────────────────

export type SceneTheme = "pirates" | "marines";

type Props = {
	theme: SceneTheme;
	children?: ReactNode;
	className?: string;
};

// Custom CSS properties not in the standard CSSProperties type
type LayerStyle = CSSProperties & { "--depth"?: number };

// ─── Depth values ─────────────────────────────────────────────────────────────
// Range 0 (far, barely moves) → 1 (near, moves most).

const D = {
	BG_FAR:   0.04,  // sky
	BG_MID:   0.10,  // sea / horizon
	FRAMING:  0.16,  // marines flags / architecture overlay
	MAIN:     0.26,  // ship group / headquarters ship
	FG:       0.62,  // foreground side panels
} as const;

// ─── RAF easing ──────────────────────────────────────────────────────────────
// How fast the parallax catches up to the actual cursor. Lower = more lag/smoothness.

const EASING = 0.08;

// ─────────────────────────────────────────────────────────────────────────────

export default function DashboardParallaxScene({ theme, children, className }: Props) {
	const sceneRef  = useRef<HTMLDivElement>(null);
	const target    = useRef({ x: 0, y: 0 });
	const current   = useRef({ x: 0, y: 0 });
	const rafId     = useRef<number | null>(null);

	useEffect(() => {
		const scene = sceneRef.current;
		if (!scene) return;

		// Normalize cursor to [-1, 1] relative to scene center
		function onPointerMove(e: PointerEvent) {
			if (e.pointerType !== "mouse") return;
			const r = scene!.getBoundingClientRect();
			target.current.x = ((e.clientX - r.left) / r.width  - 0.5) * 2;
			target.current.y = ((e.clientY - r.top)  / r.height - 0.5) * 2;
		}

		// Gently return to center when the cursor leaves the viewport
		function onPointerLeave() {
			target.current.x = 0;
			target.current.y = 0;
		}

		// Single RAF loop — writes two CSS vars on the scene root.
		// Each layer reads them through calc() in SCSS; no per-layer DOM writes.
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

	const sceneClass = [styles.scene, className].filter(Boolean).join(" ");

	return (
		<div ref={sceneRef} className={sceneClass} aria-hidden="true">
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

// ─── Pirate layers ────────────────────────────────────────────────────────────

function PirateLayers() {
	return (
		<>
			{/* ── Sky — far full-screen background ── */}
			<div
				className={`${styles.layer} ${styles.fullscreen}`}
				style={{ zIndex: 1, "--depth": D.BG_FAR } as LayerStyle}
			>
				<img
					className={styles.coverImg}
					src="/img/dashboard/pirates/pirates_sky.jpg"
					alt=""
					draggable={false}
					loading="eager"
					decoding="async"
				/>
			</div>

			{/* ── Sea / horizon — mid background ── */}
			<div
				className={`${styles.layer} ${styles.fullscreen}`}
				style={{ zIndex: 2, "--depth": D.BG_MID } as LayerStyle}
			>
				<img
					className={styles.coverImg}
					src="/img/dashboard/pirates/pirates_sea_horizon.jpg"
					alt=""
					draggable={false}
					loading="eager"
					decoding="async"
				/>
			</div>

			{/* ── Ship group — hull + masts as one aligned composition ──────────
			    DOM order: mast first (z=1) so hull (z=2) renders on top at the
			    overlap zone, which is visually correct (hull deck in front).     */}
			<div
				className={`${styles.layer} ${styles.shipGroup}`}
				style={{ zIndex: 4, "--depth": D.MAIN } as LayerStyle}
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

			{/* ── Foreground left — edge panel ──
			    NOTE: pirates_foreground_left.png was not found on disk.
			    The img is included so it renders if the asset is added later.
			    onError hides the wrapper to avoid a broken-image icon.           */}
			<div
				className={`${styles.layer} ${styles.fgLeft}`}
				style={{ zIndex: 7, "--depth": D.FG } as LayerStyle}
			>
				<img
					className={styles.fgImg}
					src="/img/dashboard/pirates/pirates_foreground_left.png"
					alt=""
					draggable={false}
					loading="eager"
					decoding="async"
					onError={(e) => {
						const wrapper = e.currentTarget.parentElement;
						if (wrapper) wrapper.style.display = "none";
					}}
				/>
			</div>

			{/* ── Foreground right — edge panel ── */}
			<div
				className={`${styles.layer} ${styles.fgRight}`}
				style={{ zIndex: 7, "--depth": D.FG } as LayerStyle}
			>
				<img
					className={styles.fgImg}
					src="/img/dashboard/pirates/pirates_foreground_right.png"
					alt=""
					draggable={false}
					loading="eager"
					decoding="async"
				/>
			</div>
		</>
	);
}

// ─── Marine layers ────────────────────────────────────────────────────────────

function MarineLayers() {
	return (
		<>
			{/* ── Sky — far full-screen background ── */}
			<div
				className={`${styles.layer} ${styles.fullscreen}`}
				style={{ zIndex: 1, "--depth": D.BG_FAR } as LayerStyle}
			>
				<img
					className={styles.coverImg}
					src="/img/dashboard/marines/marines_sky.jpg"
					alt=""
					draggable={false}
					loading="eager"
					decoding="async"
				/>
			</div>

			{/* ── Sea / horizon — mid background ── */}
			<div
				className={`${styles.layer} ${styles.fullscreen}`}
				style={{ zIndex: 2, "--depth": D.BG_MID } as LayerStyle}
			>
				<img
					className={styles.coverImg}
					src="/img/dashboard/marines/marines_sea_horizon.jpg"
					alt=""
					draggable={false}
					loading="eager"
					decoding="async"
				/>
			</div>

			{/* ── Headquarters ship — lower-center decorative ── */}
			<div
				className={`${styles.layer} ${styles.hqShip}`}
				style={{ zIndex: 3, "--depth": D.MAIN } as LayerStyle}
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

			{/* ── Flags / architecture — full-screen framing overlay ──
			    This PNG layer has transparency; cover preserves the framing
			    effect across the full viewport.                                   */}
			<div
				className={`${styles.layer} ${styles.fullscreen}`}
				style={{ zIndex: 4, "--depth": D.FRAMING } as LayerStyle}
			>
				<img
					className={styles.coverImg}
					src="/img/dashboard/marines/marines_flags_architecture.png"
					alt=""
					draggable={false}
					loading="eager"
					decoding="async"
				/>
			</div>

			{/* ── Foreground left — edge panel ── */}
			<div
				className={`${styles.layer} ${styles.fgLeft}`}
				style={{ zIndex: 7, "--depth": D.FG } as LayerStyle}
			>
				<img
					className={styles.fgImg}
					src="/img/dashboard/marines/marines_foreground_left.png"
					alt=""
					draggable={false}
					loading="eager"
					decoding="async"
				/>
			</div>

			{/* ── Foreground right — edge panel ── */}
			<div
				className={`${styles.layer} ${styles.fgRight}`}
				style={{ zIndex: 7, "--depth": D.FG } as LayerStyle}
			>
				<img
					className={styles.fgImg}
					src="/img/dashboard/marines/marines_foreground_right.png"
					alt=""
					draggable={false}
					loading="eager"
					decoding="async"
				/>
			</div>
		</>
	);
}
