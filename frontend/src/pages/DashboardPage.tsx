import { useState, useEffect } from "react";
import { useCloudNavigate } from "../transition/TransitionContext";
import { ClipLoader } from "react-spinners";
import { useWsSession, useClearCurrentUserFaction } from "../contexts/WsStateContext";
import { useSocket } from "../contexts/SocketContext";
import { useShop } from "../contexts/ShopContext";
import DashboardParallaxScene from "../components/DashboardParallaxScene";
import ShopScreen from "../components/ShopScreen";
import KeyBindingsScreen from "../components/KeyBindingsScreen";
import StatsScreen from "../components/StatsScreen";
import { emitSubscribeRooms, emitUnsubscribeRooms } from "../socket/events/room";
import styles from "./DashboardPage.module.scss";

type RoomInfo = {
	roomId: string;
	playerCount: number;
	maxPlayers?: number;
	mode?: string;
};

type View = "home" | "multiplayer";
type Screen = "dashboard" | "shop" | "keys" | "stats";

// Noms d'équipages de pirates One Piece pour nommer les salles automatiquement.
// (≤ 10 car. pour laisser la place au suffixe _N sans dépasser 15.)
const CREW_NAMES = [
	// Yonko
	"Mugiwara",
	"Straw Hat",
	"Red Hair",
	"Whitebeard",
	"Big Mom",
	"Beasts",
	"Blackbeard",

	// Légendes
	"Roger",
	"Rocks",
	"Gold Lion",
	"Spade",
	"Rumbar",

	// Supernovas
	"Heart",
	"Kid",
	"Hawkins",
	"On Air",
	"Monk",
	"Bonney",
	"Fire Tank",
	"Drake",

	// East Blue
	"Alvida",
	"Buggy",
	"Black Cat",
	"Krieg",
	"Arlong",

	// Grand Line
	"Bliking",
	"Baroque",
	"Foxy",
	"Saruyama",
	"Bellamy",
	"Giants",
	"Moria",

	// Water Seven / CP
	"Franky",
	"CP9",
	"CP0",

	// Nouveau Monde / Fishman
	"Kuja",
	"Sun",
	"Fishman",
	"Flying",
	"Caribou",
	"Macro",
	"Fake Hat",

	// Dressrosa / Grand Fleet
	"Doflamingo",
	"Barto Club",
	"Beautiful",
	"Happo Navy",
	"Tontatta",
	"Ideo",
	"Yonta",
	"New Giants",
	"SH Fleet",

	// Wano
	"Scabbards",
	"Kozuki",
	"Kurozumi",
	"Mimawari",

	// Organisations
	"Germa 66",
	"Revo Army",
	"CrossGuild",
	"Knights",
	"SWORD",
];

const SOLO_PREFIX = "sologame_";

// Identifiant de salle accepté par le serveur: [a-zA-Z0-9_], 15 caractères max.
export function toRoomId(name: string): string {
	return name.replace(/[^a-zA-Z0-9_]/g, "_").slice(0, 15);
}

export default function DashboardPage() {
	const { faction } = useWsSession();
	const { socket } = useSocket();
	const { berrys } = useShop();
	const navigate = useCloudNavigate();
	const clearCurrentUserFaction = useClearCurrentUserFaction();
	const theme = faction ?? "pirate";

	// screen = dashboard | shop → on switch les composants SANS quitter la page
	// (le fond parallax reste monté). view = sous-vue du dashboard.
	const [screen, setScreen] = useState<Screen>("dashboard");
	const [view, setView] = useState<View>("home");
	const [rooms, setRooms] = useState<RoomInfo[]>([]);
	const [roomsLoading, setRoomsLoading] = useState(true);
	// Menu de l'engrenage (coin haut-droite).
	const [menuOpen, setMenuOpen] = useState(false);

	const username = localStorage.getItem("username") ?? "";

	// Ferme le menu engrenage au clic en dehors.
	useEffect(() => {
		if (!menuOpen) return;
		const close = () => setMenuOpen(false);
		window.addEventListener("click", close);
		return () => window.removeEventListener("click", close);
	}, [menuOpen]);

	// Déconnexion : oublie le pseudo + la faction et revient à l'accueil (écran de
	// connexion). Le prochain arrivant devra re-saisir pseudo et camp.
	function handleLogout() {
		setMenuOpen(false);
		clearCurrentUserFaction();
		localStorage.removeItem("username");
		navigate("/");
	}

	useEffect(() => {
		if (screen !== "dashboard" || view !== "multiplayer") return;

		setRoomsLoading(true);

		function handleRoomList(data: unknown) {
			if (Array.isArray(data)) {
				setRooms(data as RoomInfo[]);
				setRoomsLoading(false);
			}
		}

		socket.on("room:list", handleRoomList);
		emitSubscribeRooms();

		function handleUnload() {
			emitUnsubscribeRooms();
		}
		window.addEventListener("beforeunload", handleUnload);

		return () => {
			window.removeEventListener("beforeunload", handleUnload);
			socket.off("room:list", handleRoomList);
			emitUnsubscribeRooms();
			setRooms([]);
			setRoomsLoading(true);
		};
	}, [screen, view, socket]);

	function handleSolo() {
		const suffix = Math.random().toString(36).substring(2, 8);
		navigate(`/sologame_${suffix}/${username}`);
	}
	function pickRoomName(): string {
		const taken = new Set(rooms.map((r) => r.roomId));
		const candidates = CREW_NAMES.map(toRoomId);
		const free = candidates.filter((n) => !taken.has(n));
		if (free.length > 0) return free[Math.floor(Math.random() * free.length)];
		for (let i = 1; i < 1000; i++) {
			const freeSuffixed = candidates.map((n) => toRoomId(`${n}_${i}`)).filter((c) => !taken.has(c));
			if (freeSuffixed.length > 0) return freeSuffixed[Math.floor(Math.random() * freeSuffixed.length)];
		}
		return `Crew_${Math.random().toString(36).slice(2, 7)}`;
	}

	function handleCreateRoom() {
		navigate(`/${pickRoomName()}/${username}`);
	}

	function handleJoinRoom(roomId: string) {
		navigate(`/${roomId}/${username}`);
	}

	// Les parties solo ne doivent pas apparaître dans les salles disponibles.
	const visibleRooms = rooms.filter((r) => !r.roomId.startsWith(SOLO_PREFIX));

	// « Écrans secondaires » = tout sauf l'accueil : Boutique, Touches, Stats, Multijoueur.
	// Ils partagent un unique bouton « Retour » en haut à gauche qui ramène à l'accueil.
	const inSecondary =
		screen === "shop" || screen === "keys" || screen === "stats" ||
		(screen === "dashboard" && view === "multiplayer");

	function goHome() {
		setScreen("dashboard");
		setView("home");
	}

	return (
		<DashboardParallaxScene theme={theme}>
			<div className={styles.wrapper}>

				{/* ── Coin haut-gauche : sur un écran secondaire, un unique bouton « Retour ».
				     Sur l'accueil : Boutique + Stats côte à côte, et le solde en dessous. ── */}
				<div className={styles.topLeft}>
					{inSecondary ? (
						<button className="button button-outline" onClick={goHome}>
							← Retour
						</button>
					) : (
						<div className={styles.navGroup}>
							<button className="button button-outline" onClick={() => setScreen("shop")}>
								🛒 Boutique
							</button>
							<button className="button button-outline" onClick={() => setScreen("stats")}>
								📊 Stats
							</button>
						</div>
					)}
					{(screen === "shop" || (screen === "dashboard" && view === "home")) && (
						<span className={styles.balance} title="Cumul de tes scores de fin de partie">
							{berrys.toLocaleString()} ฿
						</span>
					)}
				</div>

				{/* ── Coin haut-droite : engrenage ⚙ → menu (configurer les touches / se
				     déconnecter). Masqué sur les écrans secondaires (seul « Retour » subsiste). ── */}
				{!inSecondary && (
					<div className={`${styles.topRight} ${styles.gear}`}>
						<button
							className="button button-outline"
							onClick={(e) => { e.stopPropagation(); setMenuOpen((o) => !o); }}
							aria-haspopup="menu"
							aria-expanded={menuOpen}
							aria-label="Options"
							title="Options"
						>
							⚙
						</button>
						{menuOpen && (
							<div className={styles.gearMenu} role="menu">
								<button
									className={styles.gearItem}
									role="menuitem"
									onClick={() => { setMenuOpen(false); setScreen("keys"); }}
								>
									⌨ Configurer les touches
								</button>
								<button
									className={styles.gearItem}
									role="menuitem"
									onClick={handleLogout}
								>
									🚪 Se déconnecter
								</button>
							</div>
						)}
					</div>
				)}

				{/* ── Écran BOUTIQUE ── */}
				{screen === "shop" && <ShopScreen />}

				{/* ── Écran TOUCHES ── */}
				{screen === "keys" && <KeyBindingsScreen />}

				{/* ── Écran STATISTIQUES ── */}
				{screen === "stats" && <StatsScreen />}

				{/* ── Accueil : panneau Solo / Multijoueur ── */}
				{screen === "dashboard" && view === "home" && (
					<div className={`${styles.panel} ${theme === "marine" ? styles.panelMarine : ""}`}>
						<p className="eyebrow">
							{theme === "pirate" ? "Pirates" : "Marines"}
						</p>
						<h2 style={{ marginTop: "0.4rem", marginBottom: 0 }}>Jouer</h2>

						<div className={styles.actions}>
							<button className="button button-primary" onClick={handleSolo}>
								Solo
							</button>
							<button
								className="button button-outline"
								onClick={() => setView("multiplayer")}
							>
								Multijoueur
							</button>
						</div>
					</div>
				)}

				{/* ── Écran MULTIJOUEUR : plein écran centré, façon boutique ── */}
				{screen === "dashboard" && view === "multiplayer" && (
					<div className={styles.mpScreen}>
						<div className={styles.mpInner}>
							<div className={styles.mpHead}>
								<p className="eyebrow">Multijoueur</p>
								<h2 className={styles.mpTitle}>Salles disponibles</h2>
								<p className={styles.mpHint}>Rejoins une salle existante ou crée la tienne.</p>
							</div>

							{/* Créer une salle — nom d'équipage One Piece attribué automatiquement.
							    Désactivé tant que la liste n'est pas arrivée: sans elle `taken` est
							    vide et le tirage pourrait viser une salle déjà occupée. */}
							<button
								className="button button-primary"
								style={{ width: "100%" }}
								onClick={handleCreateRoom}
								disabled={roomsLoading}
							>
								+ Créer une salle
							</button>

							{/* Room list */}
							<div className={styles.mpRoomList}>
								{roomsLoading ? (
									<div className={styles.emptyRooms}>
										<ClipLoader color="var(--color-secondary)" size={14} />
										<span style={{ marginLeft: "0.5rem" }}>Recherche de salles…</span>
									</div>
								) : visibleRooms.length === 0 ? (
									<div className={styles.emptyRooms}>
										<span>Aucune salle disponible</span>
									</div>
								) : (
									visibleRooms.map(room => {
										const isFull = !!room.maxPlayers
											&& room.playerCount >= room.maxPlayers;
										return (
										<div key={room.roomId} className={styles.roomItem}>
											<span className={styles.roomName}>{room.roomId}</span>
											<span className={styles.roomMeta}>
												{room.playerCount}
												{room.maxPlayers ? `/${room.maxPlayers}` : ""}
											</span>
											{room.mode && (
												<span className="badge">{room.mode}</span>
											)}
											<button
												className="button button-outline"
												style={{ padding: "0.35rem 0.75rem", fontSize: "0.82rem", flexShrink: 0 }}
												onClick={() => handleJoinRoom(room.roomId)}
												disabled={isFull}
												title={isFull ? "Salle complète" : undefined}
											>
												{isFull ? "Complète" : "Rejoindre"}
											</button>
										</div>
										);
									})
								)}
							</div>
						</div>
					</div>
				)}

			</div>
		</DashboardParallaxScene>
	);
}
