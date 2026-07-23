import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ClipLoader } from "react-spinners";
import { useWsSession } from "../contexts/WsStateContext";
import { useSocket } from "../contexts/SocketContext";
import { useShop } from "../contexts/ShopContext";
import DashboardParallaxScene from "../components/DashboardParallaxScene";
import ShopScreen from "../components/ShopScreen";
import { emitSubscribeRooms, emitUnsubscribeRooms } from "../socket/events/room";
import styles from "./DashboardPage.module.scss";

type RoomInfo = {
	roomId: string;
	playerCount: number;
	maxPlayers?: number;
	mode?: string;
};

type View = "home" | "multiplayer";
type Screen = "dashboard" | "shop";

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

export default function DashboardPage() {
	const { faction } = useWsSession();
	const { socket } = useSocket();
	const { berrys } = useShop();
	const navigate = useNavigate();
	const theme = faction ?? "pirate";

	// screen = dashboard | shop → on switch les composants SANS quitter la page
	// (le fond parallax reste monté). view = sous-vue du dashboard.
	const [screen, setScreen] = useState<Screen>("dashboard");
	const [hideUI, setHideUI] = useState(false);
	const [view, setView] = useState<View>("home");
	const [rooms, setRooms] = useState<RoomInfo[]>([]);
	const [roomsLoading, setRoomsLoading] = useState(true);

	const username = localStorage.getItem("username") ?? "";

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

	// Choisit un nom d'équipage libre (aléatoire); si tous pris, ajoute _1, _2, …
	function pickRoomName(): string {
		const taken = new Set(rooms.map((r) => r.roomId));
		const free = CREW_NAMES.filter((n) => !taken.has(n));
		if (free.length > 0) return free[Math.floor(Math.random() * free.length)];
		for (let i = 1; i < 1000; i++) {
			const freeSuffixed = CREW_NAMES.map((n) => `${n}_${i}`).filter((c) => !taken.has(c));
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

	return (
		<DashboardParallaxScene theme={theme}>
			<div className={styles.wrapper}>

				{/* ── Coin haut-gauche : Boutique (switch d'écran) + solde ── */}
				<div className={styles.topLeft}>
					<button
						className="button button-outline"
						onClick={() => setScreen((s) => (s === "shop" ? "dashboard" : "shop"))}
					>
						{screen === "shop" ? "← Jouer" : "🛒 Boutique"}
					</button>
					<span className={styles.balance} title="Cumul de tes scores de fin de partie">
						{berrys.toLocaleString()} ฿
					</span>
				</div>

				{/* ── Cacher : haut-droite, uniquement sur l'accueil du dashboard ── */}
				{screen === "dashboard" && view === "home" && (
					<button
						className={`button button-ghost ${styles.hideBtn}`}
						onClick={() => setHideUI((h) => !h)}
					>
						{hideUI ? "Afficher" : "Cacher"}
					</button>
				)}

				{/* ── Écran BOUTIQUE ── */}
				{screen === "shop" && <ShopScreen />}

				{/* ── Accueil : panneau Solo / Multijoueur ── */}
				{screen === "dashboard" && view === "home" && !hideUI && (
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
							<button
								className={styles.mpBack}
								onClick={() => setView("home")}
								title="Retour"
							>
								&#8592;
							</button>

							<div className={styles.mpHead}>
								<p className="eyebrow">Multijoueur</p>
								<h2 className={styles.mpTitle}>Salles disponibles</h2>
								<p className={styles.mpHint}>Rejoins une salle existante ou crée la tienne.</p>
							</div>

							{/* Créer une salle — nom d'équipage One Piece attribué automatiquement */}
							<button
								className="button button-primary"
								style={{ width: "100%" }}
								onClick={handleCreateRoom}
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
									visibleRooms.map(room => (
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
											>
												Rejoindre
											</button>
										</div>
									))
								)}
							</div>
						</div>
					</div>
				)}

			</div>
		</DashboardParallaxScene>
	);
}
