import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
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

const CHARACTERS: Record<Faction, { id: string; name: string; role: string }[]> = {
	pirates: [
		{ id: "luffy",   name: "Luffy",   role: "Capitaine" },
		{ id: "zoro",    name: "Zoro",    role: "Combattant" },
		{ id: "nami",    name: "Nami",    role: "Navigatrice" },
		{ id: "usopp",   name: "Usopp",   role: "Tireur d'élite" },
		{ id: "sanji",   name: "Sanji",   role: "Cuisinier" },
		{ id: "chopper", name: "Chopper", role: "Médecin" },
		{ id: "robin",   name: "Robin",   role: "Archéologue" },
		{ id: "franky",  name: "Franky",  role: "Charpentier" },
		{ id: "brook",   name: "Brook",   role: "Musicien" },
		{ id: "jinbei",  name: "Jinbei",  role: "Timonier" },
	],
	marines: [
		{ id: "garp",     name: "Garp",     role: "Vice-Amiral" },
		{ id: "smoker",   name: "Smoker",   role: "Vice-Amiral" },
		{ id: "tashigi",  name: "Tashigi",  role: "Capitaine" },
		{ id: "coby",     name: "Coby",     role: "Contre-Amiral" },
		{ id: "aokiji",   name: "Aokiji",   role: "Amiral" },
		{ id: "kizaru",   name: "Kizaru",   role: "Amiral" },
		{ id: "akainu",   name: "Akainu",   role: "Amiral en chef" },
		{ id: "fujitora", name: "Fujitora", role: "Amiral" },
		{ id: "sengoku",  name: "Sengoku",  role: "Amiral en chef" },
		{ id: "ryokugyu", name: "Ryokugyu", role: "Amiral" },
	],
};

type CheckState = "idle" | "checking" | "available" | "unavailable";

// ─── Username step ───────────────────────────────────────────────────────────

function UsernameStep({ username, setUsername, checkState, onConfirm }: {
	username: string;
	setUsername: (v: string) => void;
	checkState: CheckState;
	onConfirm: () => void;
}) {
	const statusColor =
		checkState === "available"   ? "var(--color-secondary)" :
		checkState === "unavailable" ? "var(--color-primary)"   :
		"var(--color-text-muted)";

	const statusMsg =
		checkState === "checking"    ? "Vérification…" :
		checkState === "available"   ? "Pseudo disponible" :
		checkState === "unavailable" ? "Ce pseudo est déjà pris" :
		username.trim()              ? "Saisie en cours…" : "";

	return (
		<section className="card hero-card">
			<div className="hero-copy">
				<p className="eyebrow">Arcade / One Piece</p>
				<div className="hero-chip">Choisissez votre pseudo pour rejoindre la bataille</div>
				<h1>{APP_NAME}</h1>
				<p className="hero-text">
					Votre pseudo est votre identité sur les mers. Choisissez-le avec soin — il vous accompagnera tout au long de votre aventure.
				</p>

				<div className="hero-actions" style={{ gridTemplateColumns: "1fr", maxWidth: "360px" }}>
					<input
						type="text"
						value={username}
						onChange={(e) => setUsername(e.target.value)}
						placeholder="Votre pseudo…"
						maxLength={10}
						autoComplete="off"
						spellCheck={false}
						style={{
							padding: "0.75rem 1rem",
							background: "rgba(0,0,0,0.45)",
							border: `1px solid ${
								checkState === "available"   ? "var(--color-secondary)" :
								checkState === "unavailable" ? "var(--color-primary)"   :
								"var(--color-border)"
							}`,
							borderRadius: "12px",
							color: "var(--color-text)",
							fontSize: "1rem",
							fontFamily: "var(--font-display)",
							letterSpacing: "0.06em",
							outline: "none",
							transition: "border-color var(--transition-soft)",
						}}
					/>

					{statusMsg && (
						<p style={{ margin: 0, fontSize: "0.82rem", color: statusColor, letterSpacing: "0.04em" }}>
							{statusMsg}
						</p>
					)}

					<button
						className="button button-primary"
						disabled={checkState !== "available"}
						onClick={onConfirm}
						style={{
							opacity: checkState === "available" ? 1 : 0.35,
							cursor: checkState === "available" ? "pointer" : "not-allowed",
							transition: "opacity var(--transition-low)",
						}}
					>
						Choisir ce pseudo
					</button>
				</div>
			</div>

			<aside className="card hero-preview">
				<div className="preview-chip">
					<span className="status-dot" />
					Serveur en ligne
				</div>
				<div className="preview-grid">
					<div className="mini-card" data-tone="red">
						<span>Faction</span>
						<strong>Pirates</strong>
					</div>
					<div className="mini-card" data-tone="cyan">
						<span>Faction</span>
						<strong>Marines</strong>
					</div>
					<div className="mini-card" data-tone="violet">
						<span>Avatars</span>
						<strong>20</strong>
					</div>
					<div className="mini-card" data-tone="red">
						<span>Pièces</span>
						<strong>7</strong>
					</div>
				</div>
				<div className="signal-panel">
					<div className="signal-head">
						<strong>Connexion WS</strong>
					</div>
					<div className="signal-bar"><span /></div>
					<p>Serveur {APP_NAME} actif et prêt à recevoir des joueurs.</p>
				</div>
			</aside>
		</section>
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
									<span style={{ background: f.tone === "red"
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

					<div className="feature-grid" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(110px, 1fr))", gap: "0.65rem" }}>
						{CHARACTERS[faction].map((char) => {
							const selected = avatar === char.id;
							return (
								<button key={char.id} onClick={() => setAvatar(char.id)} style={{
									all: "unset", cursor: "pointer",
									display: "flex", flexDirection: "column", alignItems: "center",
									padding: "1rem 0.5rem", borderRadius: "var(--radius-card)",
									border: `1px solid ${selected ? f.color : "var(--color-border)"}`,
									background: selected ? f.colorSoft : "rgba(255,255,255,0.02)",
									boxShadow: selected ? f.shadow : "none",
									transition: "all var(--transition-soft)",
								}}>
									<div style={{
										width: "3rem", height: "3rem", borderRadius: "50%",
										display: "flex", alignItems: "center", justifyContent: "center",
										background: selected ? f.colorSoft : "rgba(255,255,255,0.05)",
										border: `1px solid ${selected ? f.color : "rgba(255,255,255,0.08)"}`,
										fontFamily: "var(--font-display)", fontSize: "1rem", fontWeight: 700,
										color: selected ? f.color : "var(--color-text-muted)",
										marginBottom: "0.5rem",
										transition: "all var(--transition-soft)",
									}}>
										{char.name[0]}
									</div>
									<span style={{
										fontSize: "0.76rem", fontWeight: 700,
										fontFamily: "var(--font-display)", letterSpacing: "0.04em",
										color: selected ? f.color : "var(--color-text)",
									}}>
										{char.name}
									</span>
									<span style={{ fontSize: "0.64rem", marginTop: "0.2rem", color: "var(--color-text-muted)", textAlign: "center", lineHeight: 1.3 }}>
										{char.role}
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
	const { socket } = useSocket();

	const [step, setStep] = useState<"username" | "register">("username");
	const [username, setUsername] = useState("");
	const [checkState, setCheckState] = useState<CheckState>("idle");
	const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

	useEffect(() => {
		const trimmed = username.trim();
		setCheckState("idle");
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
			if (!data.available) { setCheckState("unavailable"); return; }
			if (data.is_register) { navigate("/dashboard"); return; }
			setCheckState("available");
		}
		socket.on("user:ResultUsernameAvailable", onResult);
		return () => { socket.off("user:ResultUsernameAvailable", onResult); };
	}, [socket, navigate]);

	function handleRegisterSubmit(faction: Faction, avatar: string) {
		socket.emit("user:Register", { username: username.trim(), faction, avatar });
		navigate("/dashboard");
	}

	return (
		<>
			{step === "username" && (
				<UsernameStep
					username={username}
					setUsername={setUsername}
					checkState={checkState}
					onConfirm={() => setStep("register")}
				/>
			)}
			{step === "register" && (
				<RegisterStep username={username.trim()} onSubmit={handleRegisterSubmit} />
			)}
		</>
	);
}
