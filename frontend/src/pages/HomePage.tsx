import { useEffect, useRef, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { ClipLoader } from "react-spinners";
import { useSocket } from "../contexts/SocketContext";
import { useRememberCurrentUserFaction } from "../contexts/WsStateContext";
import { emitCheckUsernameAvailable } from "../socket/events/user";
import { APP_NAME } from "../config";
import {
	normalizeUsernameAvailability,
	type AppFaction as Faction,
} from "../socket/userState";

// ─── Data ───────────────────────────────────────────────────────────────────

type FactionData = {
	label: string; tone: "red" | "cyan"; icon: string; image: string;
	color: string; colorSoft: string; shadow: string;
	border: string; borderStrong: string;
	glow: string; glowHover: string; selected: string;
	dropShadow: string;
};

const FACTIONS: Record<Faction, FactionData> = {
	pirate: {
		label: "Pirates",
		tone: "red",
		icon: "☠",
		image: "/img/choix-faction/pirates.jpg",
		color: "var(--color-primary)",
		colorSoft: "var(--color-primary-soft)",
		shadow: "var(--shadow-neon-red)",
		border: "var(--color-primary-border)",
		borderStrong: "var(--color-primary-border-strong)",
		glow: "var(--color-primary-glow)",
		glowHover: "var(--color-primary-glow-hover)",
		selected: "var(--color-primary-selected)",
		dropShadow: "var(--shadow-drop-primary)",
	},
	marine: {
		label: "Marines",
		tone: "cyan",
		icon: "⚓",
		image: "/img/choix-faction/marine.jpg",
		color: "var(--color-secondary)",
		colorSoft: "var(--color-secondary-soft)",
		shadow: "var(--shadow-neon-cyan)",
		border: "var(--color-secondary-border)",
		borderStrong: "var(--color-secondary-border-strong)",
		glow: "var(--color-secondary-glow)",
		glowHover: "var(--color-secondary-glow-hover)",
		selected: "var(--color-secondary-selected)",
		dropShadow: "var(--shadow-drop-secondary)",
	},
};

const CHARACTERS: Record<Faction, { id: string; name: string }[]> = {
	pirate: [
		{ id: "luffy", name: "Luffy" },
		{ id: "zoro", name: "Zoro" },
		{ id: "nami", name: "Nami" },
		{ id: "usopp", name: "Usopp" },
		{ id: "sanji", name: "Sanji" },
		{ id: "chopper", name: "Chopper" },
		{ id: "robin", name: "Robin" },
		{ id: "franky", name: "Franky" },
		{ id: "brook", name: "Brook" },
		{ id: "jinbei", name: "Jinbei" },
	],
	marine: [
		{ id: "garp", name: "Garp" },
		{ id: "smoker", name: "Smoker" },
		{ id: "tashigi", name: "Tashigi" },
		{ id: "koby", name: "Koby" },
		{ id: "aokiji", name: "Aokiji" },
		{ id: "kizaru", name: "Kizaru" },
		{ id: "akainu", name: "Akainu" },
		{ id: "fujitora", name: "Fujitora" },
		{ id: "sengoku", name: "Sengoku" },
		{ id: "ryokugyu", name: "Ryokugyu" },
	],
};

type CheckState = "idle" | "checking" | "available" | "unavailable";
type AvatarCrop = {
	positionX: number;
	positionY: number;
	zoom: number;
};

const avatarCropCache = new Map<string, AvatarCrop>();
const REGISTER_SCENE_IMAGE_SRCS = [
	"/img/choix-faction/affrontement.jpg",
	"/img/choix-faction/pirates.jpg",
	"/img/choix-faction/marine.jpg",
];

function preloadImageAsset(src: string): Promise<void> {
	return new Promise((resolve) => {
		const image = new Image();
		let settled = false;

		function finish() {
			if (settled) return;
			settled = true;
			resolve();
		}

		function decodeAndFinish() {
			if (typeof image.decode === "function") {
				image.decode().catch(() => undefined).finally(finish);
				return;
			}
			finish();
		}

		image.decoding = "async";
		image.onload = decodeAndFinish;
		image.onerror = finish;
		image.src = src;

		if (image.complete) {
			decodeAndFinish();
		}
	});
}

function getCharacterAvatarSrc(faction: Faction, characterId: string): string {
	const dir = faction === "pirate" ? "pirates" : "marines";
	return `/img/avatar/${dir}/${characterId}.png`;
}

function computeAvatarCrop(src: string): Promise<AvatarCrop> {
	const cached = avatarCropCache.get(src);
	if (cached) return Promise.resolve(cached);

	return new Promise((resolve, reject) => {
		const image = new Image();
		image.onload = () => {
			try {
				const canvas = document.createElement("canvas");
				canvas.width = image.naturalWidth;
				canvas.height = image.naturalHeight;

				const context = canvas.getContext("2d", { willReadFrequently: true });
				if (!context) {
					reject(new Error("Canvas context unavailable"));
					return;
				}

				context.drawImage(image, 0, 0);
				const { data, width, height } = context.getImageData(0, 0, canvas.width, canvas.height);

				let minX = width;
				let minY = height;
				let maxX = -1;
				let maxY = -1;

				for (let y = 0; y < height; y += 1) {
					for (let x = 0; x < width; x += 1) {
						const alpha = data[(y * width + x) * 4 + 3];
						if (alpha < 8) continue;
						if (x < minX) minX = x;
						if (y < minY) minY = y;
						if (x > maxX) maxX = x;
						if (y > maxY) maxY = y;
					}
				}

				const hasVisiblePixels = maxX >= minX && maxY >= minY;
				const contentWidth = hasVisiblePixels ? maxX - minX + 1 : width;
				const contentHeight = hasVisiblePixels ? maxY - minY + 1 : height;
				const contentCenterX = hasVisiblePixels ? minX + contentWidth / 2 : width / 2;
				const contentCenterY = hasVisiblePixels ? minY + contentHeight / 2 : height / 2;
				const overscan = 1.04;
				const scale = overscan / Math.max(1, Math.min(contentWidth, contentHeight));

				const crop: AvatarCrop = {
					positionX: (contentCenterX / width) * 100,
					positionY: (contentCenterY / height) * 100,
					zoom: Math.min(3, Math.max(1.04, scale * Math.min(width, height))),
				};

				avatarCropCache.set(src, crop);
				resolve(crop);
			} catch (error) {
				reject(error);
			}
		};
		image.onerror = () => reject(new Error(`Failed to load avatar: ${src}`));
		image.src = src;
	});
}

function AvatarPreview({ faction, characterId, characterName, selected, color, selectedGlow }: {
	faction: Faction;
	characterId: string;
	characterName: string;
	selected: boolean;
	color: string;
	selectedGlow: string;
}) {
	const src = getCharacterAvatarSrc(faction, characterId);
	const [hasError, setHasError] = useState(false);
	const [crop, setCrop] = useState<AvatarCrop | null>(() => avatarCropCache.get(src) ?? null);

	useEffect(() => {
		setHasError(false);
		setCrop(avatarCropCache.get(src) ?? null);

		let cancelled = false;
		computeAvatarCrop(src)
			.then((nextCrop) => {
				if (!cancelled) {
					setCrop(nextCrop);
				}
			})
			.catch(() => {
				if (!cancelled) {
					setHasError(true);
				}
			});

		return () => {
			cancelled = true;
		};
	}, [src]);

	return (
		<div style={{
			width: "100%",
			aspectRatio: "1",
			borderRadius: "50%",
			display: "flex",
			alignItems: "center",
			justifyContent: "center",
			overflow: "hidden",
			outline: selected
				? `2px solid ${color}`
				: "1px solid var(--color-border)",
			outlineOffset: 0,
			boxShadow: selected
				? `0 0 22px ${selectedGlow}`
				: "none",
			transition: "all var(--transition-soft)",
			position: "relative",
		}}>
			{hasError ? (
				<span style={{
					fontFamily: "var(--font-display)",
					fontSize: "2.7rem",
					fontWeight: 700,
					color: selected ? color : "var(--color-text-muted)",
				}}>
					{characterName[0]}
				</span>
			) : (
				<img
					src={src}
					alt={characterName}
					onError={() => setHasError(true)}
					style={crop ? {
						width: "100%",
						height: "100%",
						display: "block",
						objectFit: "cover",
						objectPosition: `${crop.positionX}% ${crop.positionY}%`,
						transform: `scale(${crop.zoom})`,
					} : {
						width: "100%",
						height: "100%",
						display: "block",
						objectFit: "cover",
						objectPosition: "center top",
						transform: "scale(1.06)",
					}}
				/>
			)}
		</div>
	);
}

// ─── Username step ───────────────────────────────────────────────────────────

function UsernameStep({ username, setUsername, checkState, isRegistered, onConfirm, sceneExitActive = false }: {
	username: string;
	setUsername: (v: string) => void;
	checkState: CheckState;
	isRegistered: boolean;
	onConfirm: () => void;
	sceneExitActive?: boolean;
}) {
	const containerRef = useRef<HTMLDivElement>(null);
	const targetRef = useRef({ x: 0, y: 0 });
	const currentRef = useRef({ x: 0, y: 0 });
	const rafRef = useRef<number>(0);

	useEffect(() => {
		function tick() {
			const cur = currentRef.current;
			const tgt = targetRef.current;
			cur.x += (tgt.x - cur.x) * 0.08;
			cur.y += (tgt.y - cur.y) * 0.08;
			containerRef.current?.style.setProperty("--px", cur.x.toFixed(4));
			containerRef.current?.style.setProperty("--py", cur.y.toFixed(4));
			rafRef.current = requestAnimationFrame(tick);
		}

		rafRef.current = requestAnimationFrame(tick);
		return () => cancelAnimationFrame(rafRef.current);
	}, []);

	return (
		<div
			ref={containerRef}
			onMouseMove={(e) => {
				const rect = e.currentTarget.getBoundingClientRect();
				targetRef.current = {
					x: ((e.clientX - rect.left) / rect.width - 0.5) * 2,
					y: ((e.clientY - rect.top) / rect.height - 0.5) * 2,
				};
			}}
			onMouseLeave={() => {
				targetRef.current = { x: 0, y: 0 };
			}}
			style={{
				position: "fixed",
				inset: 0,
				overflow: "hidden",
				background: "#05080e",
				opacity: sceneExitActive ? 0.9 : 1,
				transform: sceneExitActive ? "translateX(-28px) scale(1.01)" : "translateX(0) scale(1)",
				transformOrigin: "center center",
				transition: "opacity 260ms ease, transform 420ms cubic-bezier(0.22, 1, 0.36, 1)",
				willChange: "opacity, transform",
			}}
		>
			<img
				src="/img/Luffy-vs-Akainu.jpg"
				alt=""
				draggable={false}
				style={{
					position: "absolute",
					inset: 0,
					width: "100%",
					height: "100%",
					objectFit: "cover",
					objectPosition: "center center",
					transform: "scale(1.03) translate(calc(var(--px, 0) * -18px), calc(var(--py, 0) * -12px))",
					transformOrigin: "center center",
					willChange: "transform",
					userSelect: "none",
					pointerEvents: "none",
				}}
			/>

			{/* Zone de saisie centrée en haut */}
			<div style={{
				position: "absolute",
				top: "6%",
				left: "50%",
				transform: "translate(calc(-50% - 5px + (var(--px, 0) * 5px)), calc(var(--py, 0) * 4px))",
				display: "flex",
				flexDirection: "column",
				alignItems: "center",
				gap: "0.75rem",
				width: "min(360px, 90vw)",
				willChange: "transform",
			}}>
				<h1 style={{
					margin: 0,
					fontSize: "clamp(1.8rem, 5vw, 3rem)",
					fontFamily: "var(--font-display)",
					letterSpacing: "0.12em",
					textTransform: "uppercase",
					color: "rgba(255, 250, 244, 0.98)",
					textShadow: "0 0 24px rgba(255, 255, 255, 0.16), 0 2px 12px rgba(5, 8, 14, 0.8)",
					textAlign: "center",
				}}>
					{APP_NAME}
				</h1>

				<div style={{ position: "relative", width: "100%" }}>
					<input
						type="text"
						value={username}
						onChange={(e) => setUsername(e.target.value)}
						placeholder="Votre pseudo…"
						maxLength={15}
						autoComplete="off"
						spellCheck={false}
						style={{
							width: "100%",
							padding: "0.85rem 2.8rem 0.85rem 1.1rem",
							background: "var(--color-surface-strong)",
							border: `1px solid ${checkState === "available" ? "var(--color-secondary)" :
								checkState === "unavailable" ? "var(--color-primary)" :
									"var(--color-border)"
								}`,
							borderRadius: "12px",
							color: "var(--color-text)",
							fontSize: "1rem",
							fontFamily: "var(--font-display)",
							letterSpacing: "0.06em",
							outline: "none",
							backdropFilter: "blur(8px)",
							transition: "border-color var(--transition-soft), box-shadow var(--transition-soft)",
							boxShadow: checkState === "available"
								? "var(--shadow-neon-cyan)"
								: checkState === "unavailable"
									? "var(--shadow-neon-red)"
									: "var(--shadow-panel)",
							boxSizing: "border-box",
						}}
					/>
					{checkState !== "idle" && (
						<span style={{
							position: "absolute", right: "0.9rem", top: "50%", transform: "translateY(-50%)",
							fontSize: "1.1rem", lineHeight: 1, pointerEvents: "none",
							display: "flex", alignItems: "center",
							color: checkState === "available"
								? "var(--color-secondary)"
								: "var(--color-primary)",
						}}>
							{checkState === "checking" ? <ClipLoader size={16} color="var(--color-text-muted)" /> :
								checkState === "available" ? "✓" :
									"Indisponible"
							}
						</span>
					)}
				</div>

				<button
					className="button button-primary"
					disabled={checkState !== "available"}
					onClick={onConfirm}
					style={{
						width: "60%",
						opacity: checkState === "available" ? 1 : 0.35,
						cursor: checkState === "available" ? "pointer" : "not-allowed",
						transition: "opacity var(--transition-slow)",
					}}
				>
					{isRegistered ? "Jouer →" : "Choisir ce pseudo"}
				</button>
			</div>
		</div>
	);
}

// ─── Register step ───────────────────────────────────────────────────────────

function RegisterStep({ username, onSubmit, sceneEnterActive = false }: {
	username: string;
	onSubmit: (faction: Faction, avatar: string) => void;
	sceneEnterActive?: boolean;
}) {
	const swipeDurationMs = 460;
	const edgeHandleBaseOffset = 24;
	const edgeHandleMinOpacity = 0.54;
	const [faction, setFaction] = useState<Faction | null>(null);
	const [avatar, setAvatar] = useState<string | null>(null);
	const [isFactionDetailVisible, setIsFactionDetailVisible] = useState(false);
	const containerRef = useRef<HTMLDivElement>(null);
	const targetRef = useRef({ x: 0, y: 0 });
	const currentRef = useRef({ x: 0, y: 0 });
	const rafRef = useRef<number>(0);
	const swipeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	const revealFrameRef = useRef<number | null>(null);

	// Parallax animation loop — no React state, pure DOM updates
	useEffect(() => {
		function tick() {
			const cur = currentRef.current;
			const tgt = targetRef.current;
			cur.x += (tgt.x - cur.x) * 0.08;
			cur.y += (tgt.y - cur.y) * 0.08;
			containerRef.current?.style.setProperty("--px", cur.x.toFixed(4));
			containerRef.current?.style.setProperty("--py", cur.y.toFixed(4));
			rafRef.current = requestAnimationFrame(tick);
		}
		rafRef.current = requestAnimationFrame(tick);
		return () => cancelAnimationFrame(rafRef.current);
	}, []);

	useEffect(() => {
		return () => {
			if (revealFrameRef.current !== null) {
				cancelAnimationFrame(revealFrameRef.current);
			}
			if (swipeTimerRef.current) {
				clearTimeout(swipeTimerRef.current);
			}
		};
	}, []);

	useEffect(() => {
		const host = containerRef.current;
		if (!host) return;
		if (!faction || !isFactionDetailVisible) {
			host.style.setProperty("--edge-handle-offset", `${edgeHandleBaseOffset}px`);
			host.style.setProperty("--edge-handle-opacity", "0");
			return;
		}
		host.style.setProperty(
			"--edge-handle-offset",
			faction === "pirate" ? `${edgeHandleBaseOffset}px` : `-${edgeHandleBaseOffset}px`,
		);
		host.style.setProperty("--edge-handle-opacity", `${edgeHandleMinOpacity}`);
	}, [edgeHandleBaseOffset, edgeHandleMinOpacity, faction, isFactionDetailVisible]);

	function handleMouseMove(e: React.MouseEvent<HTMLDivElement>) {
		const rect = e.currentTarget.getBoundingClientRect();
		targetRef.current = {
			x: ((e.clientX - rect.left) / rect.width - 0.5) * 2,
			y: ((e.clientY - rect.top) / rect.height - 0.5) * 2,
		};

		const host = containerRef.current;
		if (!host || !faction || !isFactionDetailVisible) {
			host?.style.setProperty("--edge-handle-offset", `${edgeHandleBaseOffset}px`);
			host?.style.setProperty("--edge-handle-opacity", "0");
			return;
		}

		const edgeDistance = faction === "pirate"
			? rect.right - e.clientX
			: e.clientX - rect.left;
		const reveal = Math.max(0, Math.min(1, 1 - edgeDistance / 160));
		const offset = (1 - reveal) * edgeHandleBaseOffset;

		host.style.setProperty(
			"--edge-handle-offset",
			faction === "pirate" ? `${offset}px` : `${-offset}px`,
		);
		host.style.setProperty(
			"--edge-handle-opacity",
			`${edgeHandleMinOpacity + reveal * (0.96 - edgeHandleMinOpacity)}`,
		);
	}

	function handleFactionSelect(nextFaction: Faction) {
		if (revealFrameRef.current !== null) {
			cancelAnimationFrame(revealFrameRef.current);
			revealFrameRef.current = null;
		}
		if (swipeTimerRef.current) {
			clearTimeout(swipeTimerRef.current);
		}
		setAvatar(null);
		setFaction(nextFaction);
		setIsFactionDetailVisible(false);
		revealFrameRef.current = requestAnimationFrame(() => {
			setIsFactionDetailVisible(true);
			revealFrameRef.current = null;
		});
	}

	function handleFactionBack() {
		if (!faction) return;
		if (revealFrameRef.current !== null) {
			cancelAnimationFrame(revealFrameRef.current);
			revealFrameRef.current = null;
		}
		if (swipeTimerRef.current) {
			clearTimeout(swipeTimerRef.current);
		}
		setAvatar(null);
		setIsFactionDetailVisible(false);
		swipeTimerRef.current = setTimeout(() => {
			setFaction(null);
			swipeTimerRef.current = null;
		}, swipeDurationMs);
	}

	const isPirate = faction === "pirate";
	const isCampView = !faction || !isFactionDetailVisible;
	const chooserUiTranslate = !faction || !isFactionDetailVisible
		? "0vw"
		: (isPirates ? "110vw" : "-110vw");

	return (
		<div
			ref={containerRef}
			onMouseMove={handleMouseMove}
			onMouseLeave={() => {
				containerRef.current?.style.setProperty(
					"--edge-handle-opacity",
					faction && isFactionDetailVisible ? `${edgeHandleMinOpacity}` : "0",
				);
				containerRef.current?.style.setProperty(
					"--edge-handle-offset",
					faction === "marine" ? `-${edgeHandleBaseOffset}px` : `${edgeHandleBaseOffset}px`,
				);
			}}
			style={{
				position: "fixed", inset: 0, overflow: "hidden",
				background: "linear-gradient(180deg, var(--color-bg-2) 0%, var(--color-bg-1) 48%, var(--color-bg-0) 100%)",
				opacity: sceneEnterActive ? 0.9 : 1,
				transform: sceneEnterActive ? "translateX(28px) scale(1.012)" : "translateX(0) scale(1)",
				transformOrigin: "center center",
				transition: "opacity 260ms ease, transform 520ms cubic-bezier(0.22, 1, 0.36, 1)",
				willChange: "opacity, transform",
			}}
		>
			<img
				src="/img/choix-faction/affrontement.jpg"
				alt=""
				draggable={false}
				style={{
					position: "absolute",
					inset: 0,
					width: "100%",
					height: "100%",
					objectFit: "cover",
					objectPosition: "center center",
					transform: "scale(1.02) translate(calc(var(--px, 0) * -4px), calc(var(--py, 0) * -3px))",
					willChange: "transform, opacity",
					userSelect: "none",
					pointerEvents: "none",
					filter: "brightness(0.92) saturate(0.96)",
					opacity: isCampView ? 1 : 0,
					transition: `opacity ${swipeDurationMs}ms cubic-bezier(0.22, 1, 0.36, 1)`,
					zIndex: 2,
				}}
			/>

			<div style={{
				position: "absolute",
				inset: 0,
				transform: `translateX(${chooserUiTranslate})`,
				transition: `transform ${swipeDurationMs}ms cubic-bezier(0.22, 1, 0.36, 1)`,
				willChange: "transform",
				pointerEvents: "none",
				zIndex: 3,
			}}>
				<div style={{
					position: "absolute",
					top: 0,
					left: 0,
					right: 0,
					padding: "2rem 1.5rem 0",
					display: "flex",
					justifyContent: "center",
					transform: "translate(calc(var(--px, 0) * 5px), calc(var(--py, 0) * 3px))",
					willChange: "transform",
				}}>
					<div style={{
						display: "flex",
						flexDirection: "column",
						alignItems: "center",
						gap: "0.3rem",
						textAlign: "center",
					}}>
						<h1 style={{
							margin: 0,
							maxWidth: "unset",
							fontSize: "clamp(2.6rem, 6vw, 4.8rem)",
							letterSpacing: "0.03em",
							color: "rgba(255, 249, 240, 0.98)",
							textShadow: "0 4px 24px rgba(8, 19, 37, 0.85)",
						}}>
							{username || "Toto"}
						</h1>
						<p style={{
							margin: 0,
							fontFamily: "var(--font-display)",
							fontSize: "clamp(1.3rem, 3vw, 2rem)",
							letterSpacing: "0.05em",
							color: "rgba(255, 251, 244, 0.96)",
							textShadow: "0 3px 20px rgba(8, 19, 37, 0.75)",
						}}>
							Choisissez votre camp
						</p>
					</div>
				</div>

				<div style={{
					position: "absolute",
					left: "50%",
					top: "54%",
					transform: "translate(-50%, -50%)",
					width: "clamp(72px, 6vw, 118px)",
					height: "72vh",
					opacity: 0.92,
				}}>
					<svg
						viewBox="0 0 100 100"
						preserveAspectRatio="none"
						aria-hidden="true"
						style={{ width: "100%", height: "100%", overflow: "visible" }}
					>
						<path
							d="M58 0 L68 12 L49 27 L61 42 L43 56 L55 72 L39 86 L47 100"
							fill="none"
							stroke="rgba(167, 223, 255, 0.34)"
							strokeWidth="18"
							strokeLinecap="round"
							strokeLinejoin="round"
						/>
						<path
							d="M58 0 L68 12 L49 27 L61 42 L43 56 L55 72 L39 86 L47 100"
							fill="none"
							stroke="rgba(255, 243, 205, 0.78)"
							strokeWidth="9"
							strokeLinecap="round"
							strokeLinejoin="round"
						/>
						<path
							d="M58 0 L68 12 L49 27 L61 42 L43 56 L55 72 L39 86 L47 100"
							fill="none"
							stroke="rgba(255, 252, 242, 0.98)"
							strokeWidth="3.2"
							strokeLinecap="round"
							strokeLinejoin="round"
						/>
					</svg>
				</div>

				{(Object.entries(FACTIONS) as [Faction, typeof FACTIONS.pirates][]).map(([key, fc]) => {
					const isLeft = key === "pirate";
					return (
						<button
							key={key}
							type="button"
							aria-label={`Choisir ${fc.label}`}
							onClick={() => handleFactionSelect(key)}
							style={{
								all: "unset",
								position: "absolute",
								top: 0,
								bottom: 0,
								left: isLeft ? 0 : "50%",
								width: "50%",
								cursor: !faction ? "pointer" : "default",
								opacity: !faction ? 1 : 0,
								display: "flex",
								alignItems: "center",
								justifyContent: "center",
								paddingTop: "10vh",
								background: isLeft
									? "linear-gradient(90deg, rgba(209, 75, 63, 0.16) 0%, rgba(209, 75, 63, 0.06) 48%, rgba(209, 75, 63, 0) 100%)"
									: "linear-gradient(270deg, rgba(28, 120, 192, 0.16) 0%, rgba(28, 120, 192, 0.06) 48%, rgba(28, 120, 192, 0) 100%)",
								transition: "opacity 140ms ease, background var(--transition-soft), transform var(--transition-soft)",
								pointerEvents: !faction ? "auto" : "none",
								zIndex: 1,
							}}
							onMouseEnter={e => {
								if (faction) return;
								const el = e.currentTarget;
								el.style.background = isLeft
									? "linear-gradient(90deg, rgba(209, 75, 63, 0.26) 0%, rgba(209, 75, 63, 0.11) 52%, rgba(209, 75, 63, 0) 100%)"
									: "linear-gradient(270deg, rgba(28, 120, 192, 0.26) 0%, rgba(28, 120, 192, 0.11) 52%, rgba(28, 120, 192, 0) 100%)";
								el.style.transform = isLeft ? "translateX(-4px)" : "translateX(4px)";
							}}
							onMouseLeave={e => {
								const el = e.currentTarget;
								el.style.background = isLeft
									? "linear-gradient(90deg, rgba(209, 75, 63, 0.16) 0%, rgba(209, 75, 63, 0.06) 48%, rgba(209, 75, 63, 0) 100%)"
									: "linear-gradient(270deg, rgba(28, 120, 192, 0.16) 0%, rgba(28, 120, 192, 0.06) 48%, rgba(28, 120, 192, 0) 100%)";
								el.style.transform = "none";
							}}
						>
							<div style={{
								display: "flex",
								flexDirection: "column",
								alignItems: "center",
								gap: "0.75rem",
								pointerEvents: "none",
								textAlign: "center",
							}}>
								<span style={{
									fontSize: "clamp(3.2rem, 7vw, 5.4rem)",
									lineHeight: 1,
									color: isLeft ? "rgba(255, 248, 241, 0.98)" : "rgba(242, 248, 255, 0.98)",
									WebkitTextStroke: isLeft ? "1px rgba(58, 22, 18, 0.55)" : "1px rgba(12, 39, 67, 0.45)",
									textShadow: isLeft
										? "0 0 28px rgba(209, 75, 63, 0.55)"
										: "0 0 28px rgba(28, 120, 192, 0.42)",
								}}>
									{fc.icon}
								</span>
								<strong style={{
									color: isLeft ? "rgba(255, 242, 235, 0.98)" : "rgba(241, 248, 255, 0.98)",
									fontSize: "clamp(2rem, 4vw, 3.2rem)",
									fontFamily: "var(--font-display)",
									letterSpacing: "0.1em",
									textTransform: "uppercase",
									textShadow: "0 4px 22px rgba(8, 19, 37, 0.82)",
								}}>
									{fc.label}
								</strong>
							</div>
						</button>
					);
				})}
			</div>

			{(Object.entries(FACTIONS) as [Faction, typeof FACTIONS.pirates][]).map(([layerFaction, layerData]) => {
				const layerIsPirates = layerFaction === "pirate";
				const layerIsActive = faction === layerFaction;
				const layerIsVisible = layerIsActive && isFactionDetailVisible;
				const layerTranslate = isCampView
					? (layerIsPirates ? "-50vw" : "50vw")
					: layerIsVisible
						? "0vw"
						: (layerIsPirates ? "-100vw" : "100vw");
				const layerUiTranslate = layerIsVisible
					? "0vw"
					: (layerIsPirates ? "calc(-120vw - 160px)" : "calc(120vw + 160px)");
				const layerPanelOffset = layerIsPirates ? "-25rem" : "25rem";
				const layerHandleTranslate = layerIsVisible
					? `var(--edge-handle-offset, ${edgeHandleBaseOffset}px)`
					: (layerIsPirates ? "92px" : "-92px");
				const layerCharacters = CHARACTERS[layerFaction];

				return (
					<div
						key={layerFaction}
						style={{
							position: "absolute",
							inset: 0,
							overflow: "hidden",
							pointerEvents: layerIsVisible ? "auto" : "none",
							zIndex: layerIsVisible ? 4 : 1,
							transform: `translateX(${layerTranslate})`,
							transition: `transform ${swipeDurationMs}ms cubic-bezier(0.22, 1, 0.36, 1)`,
							willChange: "transform",
						}}
					>
						<img
							src={layerData.image}
							alt=""
							draggable={false}
							style={{
								position: "absolute",
								inset: 0,
								width: "100%",
								height: "100%",
								objectFit: "cover",
								objectPosition: "center center",
								transform: "scale(1.03) translate(calc(var(--px, 0) * -6px), calc(var(--py, 0) * -4px))",
								willChange: "transform",
								userSelect: "none",
								pointerEvents: "none",
								filter: "brightness(0.95) saturate(1)",
							}}
						/>
						<div style={{
							position: "absolute",
							inset: 0,
							background: "linear-gradient(180deg, rgba(8, 18, 34, 0.12) 0%, rgba(8, 18, 34, 0.08) 38%, rgba(8, 18, 34, 0.18) 100%)",
							pointerEvents: "none",
						}} />

						<div style={{
							position: "absolute",
							inset: 0,
							transform: `translateX(${layerUiTranslate})`,
							transition: `transform ${swipeDurationMs}ms cubic-bezier(0.22, 1, 0.36, 1)`,
							willChange: "transform",
							zIndex: 4,
						}}>
							<button
								type="button"
								onClick={handleFactionBack}
								tabIndex={layerIsVisible ? 0 : -1}
								style={{
									all: "unset",
									position: "absolute",
									top: 0,
									[layerIsPirates ? "right" : "left"]: 0,
									width: "88px",
									height: "100%",
									display: "flex",
									alignItems: "center",
									justifyContent: "center",
									cursor: "pointer",
									zIndex: 5,
									opacity: "var(--edge-handle-opacity, 0)",
									transform: `translateX(${layerHandleTranslate})`,
									transition: "opacity 180ms ease, transform 320ms cubic-bezier(0.22, 1, 0.36, 1)",
									filter: `drop-shadow(0 10px 24px rgba(0, 0, 0, 0.14)) drop-shadow(0 0 14px ${layerData.glow})`,
								}}
							>
								<svg
									viewBox="0 0 88 100"
									preserveAspectRatio="none"
									aria-hidden="true"
									style={{
										position: "absolute",
										inset: 0,
										width: "100%",
										height: "100%",
										overflow: "visible",
									}}
								>
									<defs>
										<linearGradient id={`edge-handle-fill-${layerFaction}`} x1={layerIsPirates ? "0%" : "100%"} y1="0%" x2={layerIsPirates ? "100%" : "0%"} y2="0%">
											<stop offset="0%" stopColor="rgba(7, 12, 22, 0)" />
											<stop offset="18%" stopColor="rgba(7, 12, 22, 0.04)" />
											<stop offset="52%" stopColor="rgba(7, 12, 22, 0.14)" />
											<stop offset="100%" stopColor="rgba(7, 12, 22, 0.46)" />
										</linearGradient>
									</defs>
									<path
										d={layerIsPirates
											? "M88 0 H30 C16 4 8 18 6 34 C2 43 0 47 0 50 C0 53 2 57 6 66 C8 82 16 96 30 100 H88 Z"
											: "M0 0 H58 C72 4 80 18 82 34 C86 43 88 47 88 50 C88 53 86 57 82 66 C80 82 72 96 58 100 H0 Z"}
										fill={`url(#edge-handle-fill-${layerFaction})`}
									/>
								</svg>
								<svg
									viewBox="0 0 24 24"
									aria-hidden="true"
									style={{
										position: "relative",
										zIndex: 1,
										width: "38px",
										height: "38px",
										transform: layerIsPirates ? "translateX(-10px)" : "translateX(10px)",
										filter: `drop-shadow(0 0 12px ${layerData.glow}) drop-shadow(0 0 18px rgba(255, 255, 255, 0.28))`,
									}}
								>
									<path
										d={layerIsPirates ? "M10 5 L17 12 L10 19" : "M14 5 L7 12 L14 19"}
										fill="none"
										stroke="rgba(7, 12, 22, 0.52)"
										strokeWidth="7"
										strokeLinecap="round"
										strokeLinejoin="round"
									/>
									<path
										d={layerIsPirates ? "M10 5 L17 12 L10 19" : "M14 5 L7 12 L14 19"}
										fill="none"
										stroke="rgba(255, 252, 247, 1)"
										strokeWidth="3.8"
										strokeLinecap="round"
										strokeLinejoin="round"
									/>
								</svg>
							</button>

							<div style={{
								position: "absolute",
								top: "50%",
								left: "50%",
								transform: `translate(-50%, -50%) translateX(${layerPanelOffset})`,
								width: "min(560px, calc(100vw - 2rem))",
								display: "grid",
								gap: "1rem",
								zIndex: 4,
							}}>
								<div style={{ textAlign: "center" }}>
									<p className="eyebrow" style={{ color: layerData.color }}>
										{username || "Toto"}
									</p>
									<h2 style={{
										marginTop: "0.35rem",
										color: "rgba(255, 250, 244, 0.98)",
										textShadow: "0 4px 22px rgba(7, 12, 23, 0.66)",
									}}>
										Choisissez votre personnage
									</h2>
								</div>

								<div style={{
									position: "relative",
									overflow: "hidden",
									borderRadius: "36px",
									aspectRatio: "1 / 1",
									background: "linear-gradient(180deg, rgba(14, 23, 37, 0.82) 0%, rgba(14, 23, 37, 0.56) 100%)",
									border: `1px solid ${layerData.border}`,
									backdropFilter: "blur(14px) saturate(130%)",
									boxShadow: `0 28px 64px rgba(6, 12, 22, 0.38), 0 0 48px ${layerData.glow}`,
								}}>
									<div style={{
										position: "absolute",
										inset: "5% 35% 5% 35%",
										opacity: 0.28,
										pointerEvents: "none",
									}}>
										<svg
											viewBox="0 0 100 100"
											preserveAspectRatio="none"
											aria-hidden="true"
											style={{ width: "100%", height: "100%" }}
										>
											<path
												d="M58 0 L68 12 L49 27 L61 42 L43 56 L55 72 L39 86 L47 100"
												fill="none"
												stroke={layerData.selected}
												strokeWidth="10"
												strokeLinecap="round"
												strokeLinejoin="round"
											/>
											<path
												d="M58 0 L68 12 L49 27 L61 42 L43 56 L55 72 L39 86 L47 100"
												fill="none"
												stroke="rgba(255, 248, 236, 0.72)"
												strokeWidth="3"
												strokeLinecap="round"
												strokeLinejoin="round"
											/>
										</svg>
									</div>

									<div style={{
										position: "relative",
										zIndex: 1,
										height: "100%",
										display: "grid",
										gridTemplateRows: "auto 1fr",
										padding: "1rem",
									}}>
										<div style={{
											display: "flex",
											alignItems: "center",
											justifyContent: "space-between",
											marginBottom: "0.6rem",
										}}>
											<span style={{
												color: "rgba(255, 248, 240, 0.88)",
												fontFamily: "var(--font-display)",
												fontSize: "0.95rem",
												letterSpacing: "0.08em",
											}}>
												{layerData.icon} {layerData.label}
											</span>
											<span style={{
												color: "rgba(255, 248, 240, 0.62)",
												fontSize: "0.78rem",
												letterSpacing: "0.08em",
												textTransform: "uppercase",
											}}>
												10 personnages
											</span>
										</div>

										<div style={{
											display: "grid",
											gridTemplateColumns: "repeat(5, 1fr)",
											gap: "0.55rem",
											alignContent: "start",
										}}>
											{layerCharacters.map(char => {
												const selected = layerIsActive && avatar === char.id;
												return (
													<button
														key={char.id}
														type="button"
														tabIndex={layerIsVisible ? 0 : -1}
														onClick={() => setAvatar(char.id)}
														style={{
															all: "unset",
															cursor: "pointer",
															display: "flex",
															flexDirection: "column",
															alignItems: "center",
															gap: "0.45rem",
															padding: "0.35rem 0.15rem 0.45rem",
															borderRadius: "20px",
															border: "1px solid transparent",
															background: selected
																? `linear-gradient(180deg, ${layerData.colorSoft} 0%, rgba(255, 255, 255, 0) 100%)`
																: "transparent",
															boxShadow: selected ? `0 14px 28px ${layerData.glow}` : "none",
															transform: selected ? "translateY(-2px)" : "none",
															transition: "all var(--transition-soft)",
														}}
													>
														<div style={{ width: "clamp(58px, 5vw, 72px)", height: "clamp(58px, 5vw, 72px)" }}>
															<AvatarPreview
																faction={layerFaction}
																characterId={char.id}
																characterName={char.name}
																selected={selected}
																color={layerData.color}
																selectedGlow={layerData.selected}
															/>
														</div>
														<span style={{
															color: selected ? "rgba(255, 250, 243, 0.98)" : "rgba(233, 238, 246, 0.92)",
															fontSize: "0.78rem",
															fontWeight: 700,
															fontFamily: "var(--font-display)",
															letterSpacing: "0.04em",
															lineHeight: 1.1,
															textAlign: "center",
															textShadow: "0 1px 14px rgba(6, 12, 22, 0.7)",
														}}>
															{char.name}
														</span>
													</button>
												);
											})}
										</div>
									</div>
								</div>

								{layerIsActive && (
									<div style={{ display: "flex", justifyContent: "center" }}>
										<button
											className="button button-primary"
											disabled={!avatar}
											onClick={() => {
												if (!avatar) return;
												onSubmit(layerFaction, avatar);
											}}
											style={{
												opacity: avatar ? 1 : 0.42,
												cursor: avatar ? "pointer" : "not-allowed",
												filter: avatar ? "none" : "grayscale(0.2)",
												transition: "opacity var(--transition-soft), filter var(--transition-soft)",
											}}
										>
											Rejoindre la bataille
										</button>
									</div>
								)}
							</div>
						</div>
					</div>
				);
			})}
		</div>
	);
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function HomePage() {
	const navigate = useNavigate();
	const location = useLocation();
	const { socket } = useSocket();
	const rememberCurrentUserFaction = useRememberCurrentUserFaction();
	const stepTransitionMs = 440;
	const stepTransitionSwitchMs = 180;

	// Detect room-join mode: returnTo with exactly 2 non-empty path parts (e.g. /room/username)
	const returnTo = (location.state as { returnTo?: string } | null)?.returnTo ?? "";
	const returnToParts = returnTo.split("/").filter(Boolean);
	const isRoomJoin = returnToParts.length === 2 && returnToParts[0].length >= 1 && returnToParts[1].length >= 1;

	// In room-join mode: use username from URL, show nothing while check is pending
	const [step, setStep] = useState<"loading" | "username" | "register">(
		() => isRoomJoin ? "loading" : "username"
	);
	const [username, setUsername] = useState(
		() => isRoomJoin ? returnToParts[1] : (localStorage.getItem("username") ?? "")
	);
	const [checkState, setCheckState] = useState<CheckState>("idle");
	const [isRegistered, setIsRegistered] = useState(false);
	const [sceneTransition, setSceneTransition] = useState<null | "to-register">(null);
	const [isSceneTransitionActive, setIsSceneTransitionActive] = useState(false);
	const [isRegisterSceneEntering, setIsRegisterSceneEntering] = useState(false);
	const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	const transitionRafRef = useRef<number | null>(null);
	const registerEnterRafRef = useRef<number | null>(null);
	const transitionTimersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
	const registerSceneReadyRef = useRef(false);
	const registerSceneReadyPromiseRef = useRef<Promise<void> | null>(null);
	const transitionTokenRef = useRef(0);

	// Ref to read latest username inside the socket handler without stale closure
	const usernameRef = useRef(username);
	useEffect(() => { usernameRef.current = username; }, [username]);
	const availableFactionRef = useRef<Faction | null>(null);

	function ensureRegisterSceneReady() {
		if (registerSceneReadyRef.current) {
			return Promise.resolve();
		}
		if (registerSceneReadyPromiseRef.current) {
			return registerSceneReadyPromiseRef.current;
		}
		registerSceneReadyPromiseRef.current = Promise.all(
			REGISTER_SCENE_IMAGE_SRCS.map(preloadImageAsset),
		).then(() => {
			registerSceneReadyRef.current = true;
		});
		return registerSceneReadyPromiseRef.current;
	}

	function clearSceneTransitionTimers() {
		transitionTokenRef.current += 1;
		if (transitionRafRef.current !== null) {
			cancelAnimationFrame(transitionRafRef.current);
			transitionRafRef.current = null;
		}
		if (registerEnterRafRef.current !== null) {
			cancelAnimationFrame(registerEnterRafRef.current);
			registerEnterRafRef.current = null;
		}
		transitionTimersRef.current.forEach(clearTimeout);
		transitionTimersRef.current = [];
	}

	useEffect(() => {
		void ensureRegisterSceneReady();
	}, []);

	useEffect(() => {
		return () => {
			clearSceneTransitionTimers();
		};
	}, []);

	function startRegisterStepTransition() {
		clearSceneTransitionTimers();
		const transitionToken = transitionTokenRef.current;
		setSceneTransition("to-register");
		setIsSceneTransitionActive(false);
		transitionRafRef.current = requestAnimationFrame(() => {
			if (transitionTokenRef.current !== transitionToken) return;
			setIsSceneTransitionActive(true);
			transitionRafRef.current = null;
		});
		transitionTimersRef.current.push(setTimeout(() => {
			void ensureRegisterSceneReady().then(() => {
				if (transitionTokenRef.current !== transitionToken) return;
				setIsRegisterSceneEntering(true);
				setStep("register");
				registerEnterRafRef.current = requestAnimationFrame(() => {
					if (transitionTokenRef.current !== transitionToken) return;
					setIsRegisterSceneEntering(false);
					registerEnterRafRef.current = null;
				});
				transitionTimersRef.current.push(setTimeout(() => {
					if (transitionTokenRef.current !== transitionToken) return;
					setSceneTransition(null);
					setIsSceneTransitionActive(false);
					transitionTimersRef.current = [];
				}, stepTransitionMs + 40));
			});
		}, stepTransitionSwitchMs));
	}

	useEffect(() => {
		const trimmed = username.trim();
		setCheckState("idle");
		setIsRegistered(false);
		if (!trimmed) return;
		if (timerRef.current) clearTimeout(timerRef.current);
		timerRef.current = setTimeout(() => {
			setCheckState("checking");
			emitCheckUsernameAvailable(trimmed);
		}, 800);
		return () => { if (timerRef.current) clearTimeout(timerRef.current); };
	}, [username]);

	useEffect(() => {
		function onResult(data: unknown) {
			const result = normalizeUsernameAvailability(data);
			if (!result) return;

			availableFactionRef.current = result.available ? result.user_faction : null;

			if (!result.available) {
				setCheckState("unavailable");
				setIsRegistered(result.isRegistered);
				if (isRoomJoin) {
					// URL username is taken → let user pick a new one
					setStep("username");
				}
				return;
			}
			// available: true
			setIsRegistered(result.isRegistered);
			setCheckState("available");
			if (isRoomJoin && !result.isRegistered) {
				// Available + not registered → skip to faction selection
				if (step === "username") {
					startRegisterStepTransition();
				} else {
					setStep("register");
				}
			} else if (isRoomJoin && result.isRegistered) {
				// Available + already registered → show username step with "Jouer →"
				setStep("username");
			}
			// non-room-join: step stays "username", user clicks the button
		}
		socket.on("user:ResultUsernameAvailable", onResult);
		return () => { socket.off("user:ResultUsernameAvailable", onResult); };
	}, [isRoomJoin, socket, step]); // isRoomJoin is stable (derived from location.state)

	function resolveDestination(newUsername: string): string {
		if (!returnTo) return "/dashboard";
		if (returnToParts.length === 2) return `/${returnToParts[0]}/${newUsername}`;
		return returnTo;
	}

	function handleUsernameConfirm() {
		const trimmed = username.trim();
		localStorage.setItem("username", trimmed);
		if (isRegistered) {
			rememberCurrentUserFaction(availableFactionRef.current);
			navigate(resolveDestination(trimmed));
			return;
		}
		startRegisterStepTransition();
	}

	function handleRegisterSubmit(faction: Faction, avatar: string) {
		const trimmed = usernameRef.current.trim();
		localStorage.setItem("username", trimmed);
		rememberCurrentUserFaction(faction);
		socket.emit("user:Register", { username: trimmed, faction, avatar });
		navigate(resolveDestination(trimmed));
	}

	return (
		<>
			{step === "username" && (
				<UsernameStep
					username={username}
					setUsername={setUsername}
					checkState={checkState}
					isRegistered={isRegistered}
					onConfirm={handleUsernameConfirm}
					sceneExitActive={sceneTransition === "to-register" && step === "username" && isSceneTransitionActive}
				/>
			)}
			{step === "register" && (
				<RegisterStep
					username={usernameRef.current.trim()}
					onSubmit={handleRegisterSubmit}
					sceneEnterActive={isRegisterSceneEntering}
				/>
			)}
			{sceneTransition === "to-register" && (
				<div
					aria-hidden="true"
					style={{
						position: "fixed",
						inset: 0,
						overflow: "hidden",
						pointerEvents: "none",
						zIndex: 90,
					}}
				>
					<div style={{
						position: "absolute",
						top: 0,
						left: "-112vw",
						width: "112vw",
						height: "100%",
						transform: `translate3d(${!isSceneTransitionActive
								? "0vw"
								: step === "username"
									? "112vw"
									: "224vw"
							}, 0, 0)`,
						transformOrigin: "left center",
						transition: `transform ${stepTransitionMs}ms cubic-bezier(0.22, 1, 0.36, 1)`,
						background: "linear-gradient(90deg, rgba(5, 9, 16, 0.98) 0%, rgba(6, 10, 18, 0.97) 76%, rgba(255, 250, 242, 0.18) 100%)",
						boxShadow: "18px 0 42px rgba(255, 248, 236, 0.08)",
						willChange: "transform",
					}}>
						<div style={{
							position: "absolute",
							top: 0,
							right: 0,
							width: "4px",
							height: "100%",
							background: "linear-gradient(180deg, rgba(255, 250, 242, 0.1) 0%, rgba(255, 250, 242, 0.46) 50%, rgba(255, 250, 242, 0.1) 100%)",
						}} />
					</div>
				</div>
			)}
			{/* step === "loading": renders nothing while the initial room-join check is pending */}
		</>
	);
}
