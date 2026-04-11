import { useEffect, useRef, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { ClipLoader } from "react-spinners";
import { useSocket } from "../contexts/SocketContext";
import { emitCheckUsernameAvailable } from "../socket/events/user";
import { APP_NAME } from "../config";

// ─── Data ───────────────────────────────────────────────────────────────────

type Faction = "pirates" | "marines";

type FactionData = {
	label: string; tone: "red" | "cyan"; icon: string; image: string;
	color: string; colorSoft: string; shadow: string;
	border: string; borderStrong: string;
	glow: string; glowHover: string; selected: string;
	dropShadow: string;
};

const FACTIONS: Record<Faction, FactionData> = {
	pirates: {
		label: "Pirates",
		tone: "red",
		icon: "☠",
		image: "/img/choix-faction/luffy.png",
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
	marines: {
		label: "Marines",
		tone: "cyan",
		icon: "⚓",
		image: "/img/choix-faction/garp.png",
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
	pirates: [
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
	marines: [
		{ id: "garp", name: "Garp" },
		{ id: "smoker", name: "Smoker" },
		{ id: "tashigi", name: "Tashigi" },
		{ id: "coby", name: "Coby" },
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

function getCharacterAvatarSrc(faction: Faction, characterId: string): string {
	return `/img/avatar/${faction}/${characterId}.png`;
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

function UsernameStep({ username, setUsername, checkState, isRegistered, onConfirm }: {
	username: string;
	setUsername: (v: string) => void;
	checkState: CheckState;
	isRegistered: boolean;
	onConfirm: () => void;
}) {
	return (
		<div style={{
			position: "fixed", inset: 0,
			backgroundImage: "url('/img/Luffy-vs-Akainu.png')",
			backgroundSize: "cover",
			backgroundPosition: "calc(50% + 18px) center",
			backgroundRepeat: "no-repeat",
		}}>
			{/* Zone de saisie centrée en haut */}
			<div style={{
				position: "absolute",
				top: "6%",
				left: "50%",
				transform: "translateX(-50%)",
				display: "flex",
				flexDirection: "column",
				alignItems: "center",
				gap: "0.75rem",
				width: "min(360px, 90vw)",
			}}>
				<h1 style={{
					margin: 0,
					fontSize: "clamp(1.8rem, 5vw, 3rem)",
					fontFamily: "var(--font-display)",
					letterSpacing: "0.12em",
					textTransform: "uppercase",
					color: "var(--color-text)",
					textShadow: "0 0 30px var(--color-primary), 0 2px 8px var(--color-scrim)",
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
						maxLength={10}
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

function RegisterStep({ username, onSubmit }: {
	username: string;
	onSubmit: (faction: Faction, avatar: string) => void;
}) {
	const [faction, setFaction] = useState<Faction | null>(null);
	const [avatar, setAvatar] = useState<string | null>(null);
	const containerRef = useRef<HTMLDivElement>(null);
	const targetRef = useRef({ x: 0, y: 0 });
	const currentRef = useRef({ x: 0, y: 0 });
	const rafRef = useRef<number>(0);

	const f = faction ? FACTIONS[faction] : null;
	const characters = faction ? CHARACTERS[faction] : [];

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

	function handleMouseMove(e: React.MouseEvent<HTMLDivElement>) {
		const rect = e.currentTarget.getBoundingClientRect();
		targetRef.current = {
			x: ((e.clientX - rect.left) / rect.width - 0.5) * 2,
			y: ((e.clientY - rect.top) / rect.height - 0.5) * 2,
		};
	}

	return (
		<div
			ref={containerRef}
			onMouseMove={handleMouseMove}
			style={{
				position: "fixed", inset: 0, overflow: "hidden",
				background: "linear-gradient(180deg, var(--color-bg-2) 0%, var(--color-bg-1) 48%, var(--color-bg-0) 100%)",
			}}
		>
			{/* ── Layer 0 : Luffy (arrière-plan, mouvement lent inverse) ── */}
			<img
				src={f ? f.image : "/img/choix-faction/luffy.png"}
				alt=""
				draggable={false}
				style={{
					position: "absolute",
					height: "88vh",
					width: "auto",
					left: "50%",
					top: "50%",
					transform: "translateX(-50%) translateY(-48%) translate(calc(var(--px, 0) * -18px), calc(var(--py, 0) * -12px))",
					willChange: "transform",
					pointerEvents: "none",
					userSelect: "none",
					filter: f ? f.dropShadow : "var(--shadow-drop-neutral)",
					transition: "filter 0.4s ease",
				}}
			/>

			{/* ── Vignette bas (fondu vers le fond) ── */}
			<div style={{
				position: "absolute", bottom: 0, left: 0, right: 0, height: "22%",
				pointerEvents: "none",
				background: "linear-gradient(to top, var(--color-bg-0) 0%, transparent 100%)",
			}} />

			{/* ── Layer 1 : En-tête (léger mouvement avant) ── */}
			<div style={{
				position: "absolute", top: 0, left: 0, right: 0,
				padding: "1.5rem 2rem",
				display: "flex", justifyContent: "space-between", alignItems: "flex-start",
				transform: "translate(calc(var(--px, 0) * 5px), calc(var(--py, 0) * 3px))",
				willChange: "transform",
			}}>
				<div>
					<p className="eyebrow">Première connexion</p>
					<h2 style={{ marginTop: "0.3rem" }}>
						<span style={{ color: "var(--color-secondary)" }}>{username}</span>
						{faction ? `, camp ${f!.label}` : ", choisissez votre camp"}
					</h2>
				</div>
				{avatar && faction && (
					<button className="button button-primary" onClick={() => onSubmit(faction, avatar)}>
						Rejoindre la bataille
					</button>
				)}
			</div>

			{/* ── Layer 2 : Zone de sélection entre les bras (plan avant, mouvement rapide) ── */}
			<div style={{
				position: "absolute",
				top: "48%", left: "50%",
				transform: "translateX(-50%) translate(calc(var(--px, 0) * 14px), calc(var(--py, 0) * 9px))",
				willChange: "transform",
				width: "min(560px, 60vw)",
			}}>
				{!faction ? (
					<div style={{ display: "flex", gap: "1rem" }}>
						{(Object.entries(FACTIONS) as [Faction, typeof FACTIONS.pirates][]).map(([key, fc]) => (
							<button
								key={key}
								type="button"
								onClick={() => setFaction(key)}
								style={{
									all: "unset",
									cursor: "pointer",
									flex: 1,
									padding: "1.6rem 1rem",
									background: "var(--color-surface)",
									border: `1px solid ${fc.border}`,
									borderRadius: "22px",
									backdropFilter: "blur(10px)",
									boxShadow: `var(--shadow-panel), 0 0 28px ${fc.glow}`,
									display: "flex", flexDirection: "column", alignItems: "center", gap: "0.65rem",
									transition: "all 0.2s ease",
								}}
								onMouseEnter={e => {
									const el = e.currentTarget;
									el.style.boxShadow = `var(--shadow-panel), 0 0 48px ${fc.glowHover}`;
									el.style.borderColor = fc.borderStrong;
									el.style.background = fc.colorSoft;
									el.style.transform = "translateY(-3px) scale(1.02)";
								}}
								onMouseLeave={e => {
									const el = e.currentTarget;
									el.style.boxShadow = `var(--shadow-panel), 0 0 28px ${fc.glow}`;
									el.style.borderColor = fc.border;
									el.style.background = "var(--color-surface)";
									el.style.transform = "";
								}}
							>
								<span style={{ fontSize: "2.4rem", lineHeight: 1 }}>{fc.icon}</span>
								<strong style={{
									color: fc.color, fontSize: "1.1rem",
									fontFamily: "var(--font-display)", letterSpacing: "0.08em",
									textTransform: "uppercase",
								}}>
									{fc.label}
								</strong>
							</button>
						))}
					</div>
				) : (
					<div style={{
						background: "var(--color-surface)",
						border: `1px solid ${f!.border}`,
						borderRadius: "24px",
						backdropFilter: "blur(10px)",
						padding: "0.85rem",
						boxShadow: `var(--shadow-panel), 0 0 48px ${f!.glow}`,
					}}>
						<div style={{
							display: "flex", alignItems: "center", justifyContent: "space-between",
							marginBottom: "0.7rem", padding: "0 0.2rem",
						}}>
							<button
								type="button"
								className="button button-ghost"
								onClick={() => { setFaction(null); setAvatar(null); }}
								style={{ fontSize: "0.76rem", minHeight: "28px", padding: "0 0.65rem" }}
							>
								← Faction
							</button>
							<span style={{
								color: f!.color, fontFamily: "var(--font-display)",
								fontSize: "0.76rem", letterSpacing: "0.12em", textTransform: "uppercase",
							}}>
								{f!.icon} {f!.label}
							</span>
						</div>
						<div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: "0.45rem" }}>
							{characters.map(char => {
								const selected = avatar === char.id;
								return (
									<button
										key={char.id}
										type="button"
										onClick={() => setAvatar(char.id)}
										style={{
											all: "unset",
											cursor: "pointer",
											display: "flex", flexDirection: "column",
											alignItems: "center", gap: "0.35rem",
											padding: "0.5rem 0.25rem",
											borderRadius: "14px",
											border: `1px solid ${selected ? f!.selected : "var(--color-border)"}`,
											background: selected ? f!.colorSoft : "var(--color-surface-soft)",
											boxShadow: selected ? f!.shadow : "none",
											transition: "all var(--transition-soft)",
										}}
									>
										<div style={{ width: "52px", height: "52px" }}>
											<AvatarPreview
												faction={faction}
												characterId={char.id}
												characterName={char.name}
												selected={selected}
												color={f!.color}
												selectedGlow={f!.selected}
											/>
										</div>
										<span style={{
											color: selected ? f!.color : "var(--color-text-muted)",
											fontSize: "0.68rem", fontWeight: 600,
											letterSpacing: "0.03em", textAlign: "center",
										}}>
											{char.name}
										</span>
									</button>
								);
							})}
						</div>
					</div>
				)}
			</div>
		</div>
	);
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function HomePage() {
	const navigate = useNavigate();
	const location = useLocation();
	const { socket } = useSocket();

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
	const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

	// Ref to read latest username inside the socket handler without stale closure
	const usernameRef = useRef(username);
	useEffect(() => { usernameRef.current = username; }, [username]);

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
		function onResult(data: { available: boolean; is_register: boolean }) {
			if (!data.available) {
				setCheckState("unavailable");
				setIsRegistered(data.is_register);
				if (isRoomJoin) {
					// URL username is taken → let user pick a new one
					setStep("username");
				}
				return;
			}
			// available: true
			setIsRegistered(data.is_register);
			setCheckState("available");
			if (isRoomJoin && !data.is_register) {
				// Available + not registered → skip to faction selection
				setStep("register");
			} else if (isRoomJoin && data.is_register) {
				// Available + already registered → show username step with "Jouer →"
				setStep("username");
			}
			// non-room-join: step stays "username", user clicks the button
		}
		socket.on("user:ResultUsernameAvailable", onResult);
		return () => { socket.off("user:ResultUsernameAvailable", onResult); };
	}, [socket]); // isRoomJoin is stable (derived from location.state)

	function resolveDestination(newUsername: string): string {
		if (!returnTo) return "/dashboard";
		if (returnToParts.length === 2) return `/${returnToParts[0]}/${newUsername}`;
		return returnTo;
	}

	function handleUsernameConfirm() {
		const trimmed = username.trim();
		localStorage.setItem("username", trimmed);
		if (isRegistered) { navigate(resolveDestination(trimmed)); return; }
		setStep("register");
	}

	function handleRegisterSubmit(faction: Faction, avatar: string) {
		const trimmed = usernameRef.current.trim();
		localStorage.setItem("username", trimmed);
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
				/>
			)}
			{step === "register" && (
				<RegisterStep username={usernameRef.current.trim()} onSubmit={handleRegisterSubmit} />
			)}
			{/* step === "loading": renders nothing while the initial room-join check is pending */}
		</>
	);
}
