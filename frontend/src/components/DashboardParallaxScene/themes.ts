/** Parallax scene themes. */

export type ParallaxLayer = {
	key: string;
	src: string;
	depth: number;
	scale?: number;
	zIndex: number;
	opacity?: number;
	position: {
		top?: string;
		bottom?: string;
		left?: string;
		right?: string;
		width?: string;
		height?: string;
	};
	objectPosition?: string;
	floatAmplitude?: number;
	floatDuration?: number;
	floatDelay?: number;
};

export type SceneTheme = "pirate" | "marine";

const PIRATE_BASE = "/img/dashboard/pirate";
const MARINE_BASE = "/img/dashboard/marine";

const FULL_COVER = { top: "0", left: "0", width: "100%", height: "100%" } as const;

export const SCENE_THEMES: Record<SceneTheme, ParallaxLayer[]> = {
	pirate: [
		{
			key: "sky",
			src: `${PIRATE_BASE}/pirate_sky.jpg`,
			depth: 0.05,
			scale: 1.15,
			zIndex: 1,
			position: FULL_COVER,
			floatAmplitude: 2,
			floatDuration: 16000,
		},
		{
			key: "sea-horizon",
			src: `${PIRATE_BASE}/pirate_sea_horizon.jpg`,
			depth: 0.12,
			scale: 1.1,
			zIndex: 2,
			opacity: 0.96,
			position: FULL_COVER,
			objectPosition: "center 55%",
			floatAmplitude: 3,
			floatDuration: 13000,
		},
		{
			key: "ship-hull",
			src: `${PIRATE_BASE}/pirate_ship_hull.png`,
			depth: 0.32,
			scale: 1,
			zIndex: 4,
			position: { bottom: "6%", left: "50%", width: "64%" },
			floatAmplitude: 5,
			floatDuration: 9000,
		},
		{
			key: "ship-masts",
			src: `${PIRATE_BASE}/pirate_ship_masts_sails.png`,
			depth: 0.34,
			scale: 1,
			zIndex: 5,
			position: { bottom: "6%", left: "50%", width: "64%" },
			floatAmplitude: 6,
			floatDuration: 9000,
			floatDelay: -400,
		},
		{
			key: "foreground-right",
			src: `${PIRATE_BASE}/pirate_foreground_right.png`,
			depth: 0.78,
			scale: 1,
			zIndex: 7,
			position: { bottom: "0", right: "0", width: "34%" },
			floatAmplitude: 9,
			floatDuration: 10000,
			floatDelay: -1500,
		},
		// pirate_foreground_left.png intentionally omitted — asset not present.
	],
	marine: [
		{
			key: "sky",
			src: `${MARINE_BASE}/marine_sky.jpg`,
			depth: 0.05,
			scale: 1.15,
			zIndex: 1,
			position: FULL_COVER,
			floatAmplitude: 2,
			floatDuration: 16000,
		},
		{
			key: "sea-horizon",
			src: `${MARINE_BASE}/marine_sea_horizon.jpg`,
			depth: 0.12,
			scale: 1.1,
			zIndex: 2,
			opacity: 0.96,
			position: FULL_COVER,
			objectPosition: "center 55%",
			floatAmplitude: 3,
			floatDuration: 13000,
		},
		{
			key: "headquarters-ship",
			src: `${MARINE_BASE}/marine_headquarters_ship.png`,
			depth: 0.3,
			scale: 1,
			zIndex: 4,
			position: { bottom: "8%", left: "50%", width: "68%" },
			floatAmplitude: 4,
			floatDuration: 10000,
		},
		{
			key: "flags-architecture",
			src: `${MARINE_BASE}/marine_flags_architecture.png`,
			depth: 0.45,
			scale: 1.02,
			zIndex: 5,
			opacity: 0.98,
			position: FULL_COVER,
			floatAmplitude: 5,
			floatDuration: 11000,
			floatDelay: -600,
		},
		{
			key: "foreground-left",
			src: `${MARINE_BASE}/marine_foreground_left.png`,
			depth: 0.78,
			scale: 1,
			zIndex: 7,
			position: { bottom: "0", left: "0", width: "34%" },
			floatAmplitude: 9,
			floatDuration: 9500,
		},
		{
			key: "foreground-right",
			src: `${MARINE_BASE}/marine_foreground_right.png`,
			depth: 0.78,
			scale: 1,
			zIndex: 7,
			position: { bottom: "0", right: "0", width: "34%" },
			floatAmplitude: 9,
			floatDuration: 10000,
			floatDelay: -1800,
		},
	],
};

/** Base amplitude in px for mouse parallax along X / Y, before depth scaling. */
export const PARALLAX_AMPLITUDE = { x: 42, y: 26 } as const;
