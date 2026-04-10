import { useEffect, useRef, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { ClipLoader } from "react-spinners";
import { useSocket } from "../contexts/SocketContext";
import { emitCheckUsernameAvailable } from "../socket/events/user";
import { APP_NAME } from "../config";

// ─── Data ───────────────────────────────────────────────────────────────────

type Faction = "pirates" | "marines";

const FACTIONS: Record<Faction, { label: string; tone: "red" | "cyan"; icon: string; color: string; colorSoft: string; shadow: string }> = {
	pirates: {
		label: "Pirates",
		tone: "red",
		icon: "☠",
		color: "var(--color-primary)",
		colorSoft: "var(--color-primary-soft)",
		shadow: "var(--shadow-neon-red)",
	},
	marines: {
		label: "Marines",
		tone: "cyan",
		icon: "⚓",
		color: "var(--color-secondary)",
		colorSoft: "var(--color-secondary-soft)",
		shadow: "var(--shadow-neon-cyan)",
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

function AvatarPreview({ faction, characterId, characterName, selected, color }: {
	faction: Faction;
	characterId: string;
	characterName: string;
	selected: boolean;
	color: string;
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
				: "1px solid rgba(255,255,255,0.08)",
			outlineOffset: 0,
			boxShadow: selected
				? `0 0 22px ${color}55`
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
					textShadow: "0 0 30px var(--color-primary), 0 2px 8px rgba(0,0,0,0.8)",
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
	const f = faction ? FACTIONS[faction] : null;
	const characters = faction ? CHARACTERS[faction] : [];
	const selectedCharacter = avatar ? characters.find((char) => char.id === avatar) ?? null : null;

	return (
		<section
			className="card"
			style={{
				padding: "clamp(1.3rem, 3vw, 2rem)",
				boxShadow: f ? `var(--shadow-panel), ${f.shadow}` : "var(--shadow-panel), var(--shadow-neon-accent)",
			}}
		>
			<div style={{ display: "grid", gap: "1.35rem", position: "relative", zIndex: 1 }}>
				<div className="section-header" style={{ marginBottom: 0 }}>
					<div>
						<p className="eyebrow">Première connexion</p>
						<h1 style={{ maxWidth: "none", marginTop: "0.55rem" }}>
							Assemblez votre entrée en scène
						</h1>
						<p className="hero-text" style={{ marginTop: "0.75rem", maxWidth: "60ch" }}>
							<span style={{ color: "var(--color-secondary)", fontWeight: 700 }}>{username}</span>, choisissez votre faction puis votre avatar.
							Ce choix de camp est <strong style={{ color: "var(--color-primary)" }}>définitif</strong>.
						</p>
					</div>
					{avatar && faction && (
						<button className="button button-primary" onClick={() => onSubmit(faction, avatar)}>
							Rejoindre la bataille
						</button>
					)}
				</div>

				<div className="split-grid" style={{ display: "grid", gap: "1rem", alignItems: "start" }}>
					<div style={{ display: "grid", gap: "1rem" }}>
						<div
							style={{
								padding: "1.1rem",
								borderRadius: "28px",
								border: "1px solid var(--color-border)",
								background: "linear-gradient(180deg, rgba(255,255,255,0.58), rgba(255,255,255,0.34))",
								boxShadow: "inset 0 1px 0 rgba(255,255,255,0.75)",
							}}
						>
							<p className="section-kicker" style={{ color: "var(--color-accent)" }}>1. Faction</p>
							<p className="section-copy" style={{ marginTop: "0.65rem" }}>
								Choisissez le camp qui définira votre identité pour la suite.
							</p>
							<div style={{ display: "grid", gap: "0.75rem", marginTop: "1rem" }}>
								{(Object.entries(FACTIONS) as [Faction, typeof FACTIONS.pirates][]).map(([key, fc]) => {
									const selected = faction === key;
									return (
										<button
											key={key}
											type="button"
											onClick={() => {
												setFaction(key);
												setAvatar(null);
											}}
											style={{
												all: "unset",
												cursor: "pointer",
												display: "grid",
												gap: "0.35rem",
												padding: "1rem 1.05rem",
												borderRadius: "22px",
												border: `1px solid ${selected ? `${fc.color}55` : "var(--color-border)"}`,
												background: selected ? fc.colorSoft : "rgba(255,255,255,0.56)",
												boxShadow: selected ? fc.shadow : "none",
												transition: "all var(--transition-soft)",
											}}
										>
											<div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "1rem" }}>
												<strong style={{ color: selected ? fc.color : "var(--color-text)", fontSize: "1rem", letterSpacing: "0.02em" }}>
													{fc.icon} {fc.label}
												</strong>
												<span
													style={{
														fontSize: "0.72rem",
														fontWeight: 700,
														letterSpacing: "0.1em",
														textTransform: "uppercase",
														color: selected ? fc.color : "var(--color-text-muted)",
													}}
												>
													{selected ? "Choisie" : "Choisir"}
												</span>
											</div>
										</button>
									);
								})}
							</div>
						</div>

						<div
							style={{
								padding: "1.15rem",
								borderRadius: "28px",
								border: "1px solid var(--color-border)",
								background: f
									? `linear-gradient(180deg, ${f.colorSoft}, rgba(255,255,255,0.42))`
									: "linear-gradient(180deg, rgba(255,255,255,0.58), rgba(255,255,255,0.34))",
								boxShadow: "inset 0 1px 0 rgba(255,255,255,0.75)",
								textAlign: "center",
							}}
						>
							<p className="section-kicker" style={{ color: f ? f.color : "var(--color-accent)" }}>
								{f ? "2. Aperçu" : "En attente"}
							</p>
							{f && selectedCharacter ? (
								<>
									<div style={{ width: "min(220px, 72%)", margin: "1rem auto 0" }}>
										<AvatarPreview
											faction={faction}
											characterId={selectedCharacter.id}
											characterName={selectedCharacter.name}
											selected
											color={f.color}
										/>
									</div>
									<h2 style={{ marginTop: "1rem", color: f.color }}>
										{selectedCharacter.name}
									</h2>
									<div style={{ display: "flex", justifyContent: "center", gap: "0.6rem", flexWrap: "wrap", marginTop: "1rem" }}>
										<span className="badge" style={{ color: f.color, borderColor: `${f.color}33`, background: "rgba(255,255,255,0.58)" }}>
											{f.label}
										</span>
										<span className="badge" style={{ color: "var(--color-text-muted)", background: "rgba(255,255,255,0.58)" }}>
											{username}
										</span>
									</div>
								</>
							) : f ? (
								<>
									<h2 style={{ marginTop: "0.85rem", color: f.color }}>{f.label}</h2>
									<p className="section-copy" style={{ margin: "0.7rem auto 0", maxWidth: "28ch" }}>
										Camp choisi. Il ne manque plus que votre avatar pour rejoindre la bataille.
									</p>
								</>
							) : (
								<>
									<h2 style={{ marginTop: "0.85rem" }}>Choisissez un camp</h2>
									<p className="section-copy" style={{ margin: "0.7rem auto 0", maxWidth: "28ch" }}>
										Une fois votre faction choisie, la galerie d’avatars s’ouvre juste à droite.
									</p>
								</>
							)}
						</div>
					</div>

					<div
						style={{
							padding: "1.2rem",
							borderRadius: "28px",
							border: "1px solid var(--color-border)",
							background: "linear-gradient(180deg, rgba(255,255,255,0.62), rgba(255,255,255,0.38))",
							boxShadow: "inset 0 1px 0 rgba(255,255,255,0.75)",
						}}
					>
						<div className="section-header" style={{ marginBottom: "1.15rem" }}>
							<div>
								<p className="section-kicker" style={{ color: f ? f.color : "var(--color-accent)" }}>
									2. Avatar
								</p>
								<h2 style={{ marginTop: "0.45rem" }}>
									{f ? `Roster ${f.label}` : "Choisissez d'abord une faction"}
								</h2>
								<p className="section-copy" style={{ marginTop: "0.6rem" }}>
									{f
										? "Sélectionnez le personnage qui vous représentera lors de votre première entrée dans le jeu."
										: "La galerie d’avatars apparaîtra ici dès qu’une faction sera choisie."}
								</p>
							</div>
							{faction && (
								<div className="badge" style={{ color: f?.color, borderColor: f ? `${f.color}33` : undefined }}>
									{characters.length} avatars
								</div>
							)}
						</div>

						{faction && f ? (
							<div className="feature-grid" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(165px, 1fr))", gap: "1rem" }}>
								{characters.map((char) => {
									const selected = avatar === char.id;
									return (
										<button
											key={char.id}
											type="button"
											onClick={() => setAvatar(char.id)}
											style={{
												all: "unset",
												cursor: "pointer",
												display: "grid",
												gap: "0.7rem",
												padding: "0.85rem",
												borderRadius: "24px",
												border: `1px solid ${selected ? `${f.color}55` : "rgba(53, 91, 132, 0.1)"}`,
												background: selected ? f.colorSoft : "rgba(255,255,255,0.52)",
												boxShadow: selected ? f.shadow : "0 10px 24px rgba(52, 72, 99, 0.04)",
												transition: "all var(--transition-soft)",
											}}
										>
											<AvatarPreview
												faction={faction}
												characterId={char.id}
												characterName={char.name}
												selected={selected}
												color={f.color}
											/>
											<div style={{ textAlign: "center", display: "grid", gap: "0.3rem" }}>
												<strong style={{ color: selected ? f.color : "var(--color-text)", fontSize: "0.98rem", letterSpacing: "0.02em" }}>
													{char.name}
												</strong>
												<span style={{ color: "var(--color-text-muted)", fontSize: "0.74rem", letterSpacing: "0.08em", textTransform: "uppercase" }}>
													{selected ? "Avatar sélectionné" : "Disponible"}
												</span>
											</div>
										</button>
									);
								})}
							</div>
						) : (
							<div
								style={{
									padding: "2.25rem 1rem",
									borderRadius: "24px",
									border: "1px dashed var(--color-border-strong)",
									background: "rgba(255,255,255,0.42)",
									textAlign: "center",
								}}
							>
								<p className="section-copy" style={{ margin: 0 }}>
									Choisissez une faction à gauche pour révéler les avatars disponibles.
								</p>
							</div>
						)}
					</div>
				</div>
			</div>
		</section>
	);
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function HomePage() {
	const navigate = useNavigate();
	const location = useLocation();
	const { socket } = useSocket();

	const locationState = location.state as { step?: "register"; returnTo?: string } | null;
	const [step, setStep] = useState<"username" | "register">(
		locationState?.step === "register" ? "register" : "username"
	);
	const [username, setUsername] = useState(() => localStorage.getItem("username") ?? "");
	const [checkState, setCheckState] = useState<CheckState>("idle");
	const [isRegistered, setIsRegistered] = useState(false);
	const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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
			if (!data.available) { setCheckState("unavailable"); setIsRegistered(false); return; }
			setIsRegistered(data.is_register);
			setCheckState("available");
		}
		socket.on("user:ResultUsernameAvailable", onResult);
		return () => { socket.off("user:ResultUsernameAvailable", onResult); };
	}, [socket, navigate]);

	function resolveDestination(newUsername: string): string {
		const returnTo = locationState?.returnTo;
		if (!returnTo) return "/dashboard";
		const parts = returnTo.split("/").filter(Boolean);
		if (parts.length === 2) return `/${parts[0]}/${newUsername}`;
		return returnTo;
	}

	function handleUsernameConfirm() {
		const trimmed = username.trim();
		localStorage.setItem("username", trimmed);
		if (isRegistered) { navigate(resolveDestination(trimmed)); return; }
		setStep("register");
	}

	function handleRegisterSubmit(faction: Faction, avatar: string) {
		const trimmed = username.trim();
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
				<RegisterStep username={username.trim()} onSubmit={handleRegisterSubmit} />
			)}
		</>
	);
}
