import { useEffect, useRef, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { ClipLoader } from "react-spinners";
import { useSocket } from "../contexts/SocketContext";
import { emitCheckUsernameAvailable } from "../socket/events/user";
import { APP_NAME } from "../config";

// ─── Data ───────────────────────────────────────────────────────────────────

type Faction = "pirates" | "marines";

const FACTIONS: Record<Faction, { label: string; tone: "red" | "cyan"; icon: string; color: string; colorSoft: string; shadow: string; description: string }> = {
	pirates: {
		label: "Pirates",
		tone: "red",
		icon: "☠",
		color: "var(--color-primary)",
		colorSoft: "var(--color-primary-soft)",
		shadow: "var(--shadow-neon-red)",
		description: "La liberté avant tout. Voguer vers le bout du monde et briser toutes les règles.",
	},
	marines: {
		label: "Marines",
		tone: "cyan",
		icon: "⚓",
		color: "var(--color-secondary)",
		colorSoft: "var(--color-secondary-soft)",
		shadow: "var(--shadow-neon-cyan)",
		description: "Justice absolue. Protéger les mers et maintenir l'ordre à tout prix.",
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

function getCharacterAvatarSrc(faction: Faction, characterId: string): string {
	return `/img/avatar/${faction}/${characterId}.png`;
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

	useEffect(() => {
		setHasError(false);
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
					style={{
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

	return (
		<>
			<section className="card hero-card">
				<div className="hero-copy">
					<p className="eyebrow">Première connexion</p>
					<h1 style={{ maxWidth: "none" }}>
						<span style={{ color: "var(--color-secondary)" }}>{username}</span>
					</h1>
					<p className="hero-text">
						Choisissez votre faction. Ce choix est <strong style={{ color: "var(--color-primary)" }}>définitif</strong> — vous ne pourrez pas en changer.
					</p>

					<div className="hero-actions">
						{(Object.entries(FACTIONS) as [Faction, typeof FACTIONS.pirates][]).map(([key, fc]) => (
							<button
								key={key}
								className={`button ${faction === key ? (key === "pirates" ? "button-primary" : "button-secondary") : "button-outline"}`}
								onClick={() => { setFaction(key); setAvatar(null); }}
							>
								{fc.icon} {fc.label}
							</button>
						))}
					</div>
				</div>

				<aside className="card hero-preview" style={f ? {
					boxShadow: `var(--shadow-panel), ${f.shadow}`,
					border: `1px solid ${f.color}44`,
				} : {}}>
					{faction && f ? (
						<>
							<div className="preview-chip" style={{ borderColor: `${f.color}44`, color: f.color }}>
								<span className="status-dot" style={{ background: f.color, boxShadow: `0 0 14px ${f.color}` }} />
								{f.label} sélectionnés
							</div>
							<div className="preview-grid">
								<div className="mini-card" data-tone={f.tone}>
									<span>Faction</span>
									<strong>{f.label}</strong>
								</div>
								<div className="mini-card" data-tone={f.tone}>
									<span>Équipage</span>
									<strong>{CHARACTERS[faction].length}</strong>
								</div>
							</div>
							<div className="signal-panel">
								<div className="signal-head">
									<strong style={{ color: f.color }}>{f.label}</strong>
								</div>
								<div className="signal-bar">
									<span style={{
										background: f.tone === "red"
											? "linear-gradient(90deg, var(--color-primary), var(--color-accent))"
											: "linear-gradient(90deg, var(--color-secondary), var(--color-accent))"
									}} />
								</div>
								<p>{f.description}</p>
							</div>
						</>
					) : (
						<>
							<div className="preview-chip">
								<span className="status-dot" style={{ background: "var(--color-text-muted)", boxShadow: "none" }} />
								Aucune faction choisie
							</div>
							<p style={{ color: "var(--color-text-muted)", fontSize: "0.88rem", lineHeight: 1.6, marginTop: "0.75rem" }}>
								Sélectionnez une faction pour découvrir son équipage et choisir votre avatar.
							</p>
						</>
					)}
				</aside>
			</section>

			{faction && f && (
				<section className="card" style={{ padding: "1.5rem 2rem" }}>
					<div className="section-header">
						<div>
							<p className="section-kicker" style={{ color: f.color }}>
								{f.icon} {f.label} — Choisissez votre avatar
							</p>
							<p className="section-copy">Vous pourrez changer d'avatar plus tard.</p>
						</div>
						{avatar && (
							<button className="button button-primary" onClick={() => onSubmit(faction, avatar)}>
								Rejoindre la bataille →
							</button>
						)}
					</div>

					<div className="feature-grid" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: "0.8rem" }}>
						{CHARACTERS[faction].map((char) => {
							const selected = avatar === char.id;
							return (
								<button key={char.id} onClick={() => setAvatar(char.id)} style={{
									all: "unset", cursor: "pointer",
									width: "100%",
									display: "flex", flexDirection: "column", alignItems: "stretch",
									gap: "0.55rem",
									transition: "transform var(--transition-soft)",
								}}>
									<AvatarPreview
										faction={faction}
										characterId={char.id}
										characterName={char.name}
										selected={selected}
										color={f.color}
									/>
									<span style={{
										fontSize: "0.76rem", fontWeight: 700,
										fontFamily: "var(--font-display)", letterSpacing: "0.04em",
										color: selected ? f.color : "var(--color-text)",
										textAlign: "center",
									}}>
										{char.name}
									</span>
								</button>
							);
						})}
					</div>
				</section>
			)}
		</>
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
