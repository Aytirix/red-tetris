import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ClipLoader } from "react-spinners";
import { useWsSession } from "../contexts/WsStateContext";
import { useSocket } from "../contexts/SocketContext";
import DashboardParallaxScene from "../components/DashboardParallaxScene";
import { emitSubscribeRooms, emitUnsubscribeRooms } from "../socket/events/room";
import styles from "./DashboardPage.module.scss";

type RoomInfo = {
	roomId: string;
	playerCount: number;
	maxPlayers?: number;
	mode?: string;
};

type View = "home" | "multiplayer";

export default function DashboardPage() {
	const { faction } = useWsSession();
	const { socket } = useSocket();
	const navigate = useNavigate();
	const theme = faction ?? "pirate";

	const [hideUI, setHideUI] = useState(false);
	const [view, setView] = useState<View>("home");
	const [rooms, setRooms] = useState<RoomInfo[]>([]);
	const [roomsLoading, setRoomsLoading] = useState(true);
	const [roomName, setRoomName] = useState("");

	const username = localStorage.getItem("username") ?? "";

	useEffect(() => {
		if (view !== "multiplayer") return;

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
	}, [view, socket]);

	function handleSolo() {
		const suffix = Math.random().toString(36).substring(2, 8);
		navigate(`/sologame_${suffix}/${username}`);
	}

	function handleCreateRoom() {
		const name = roomName.trim();
		if (!name || name.length > 15) return;
		navigate(`/${name}/${username}`);
	}

	function handleJoinRoom(roomId: string) {
		navigate(`/${roomId}/${username}`);
	}

	const roomNameValid = roomName.trim().length >= 1 && roomName.trim().length <= 15;

	return (
		<DashboardParallaxScene theme={theme}>
			<div className={styles.wrapper}>

				{/* ── Hide toggle (always top-right) ── */}
				<button
					className={`button button-ghost ${styles.hideBtn}`}
					onClick={() => setHideUI(h => !h)}
				>
					{hideUI ? "Afficher" : "Cacher"}
				</button>

				{/* ── Home panel ── */}
				{!hideUI && view === "home" && (
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

				{/* ── Multiplayer panel ── */}
				{!hideUI && view === "multiplayer" && (
					<div className={`${styles.panel} ${theme === "marine" ? styles.panelMarine : ""}`}>

						<button
							className={styles.backBtn}
							onClick={() => setView("home")}
							title="Retour"
						>
							&#8592;
						</button>

						{/* Create room */}
						<div>
							<p className={styles.sectionLabel}>Créer une salle</p>
							<div className={styles.createRow}>
								<input
									className={styles.input}
									placeholder="Nom (1–15 caractères)"
									value={roomName}
									maxLength={15}
									onChange={e => setRoomName(e.target.value)}
									onKeyDown={e => e.key === "Enter" && handleCreateRoom()}
								/>
								<button
									className="button button-primary"
									onClick={handleCreateRoom}
									disabled={!roomNameValid}
								>
									Créer
								</button>
							</div>
						</div>

						{/* Room list */}
						<div className={styles.roomListSection}>
							<p className={styles.sectionLabel}>Salles disponibles</p>
							<div className={styles.roomList}>
								{roomsLoading ? (
									<div className={styles.emptyRooms}>
										<ClipLoader color="var(--color-secondary)" size={14} />
										<span style={{ marginLeft: "0.5rem" }}>Recherche de salles…</span>
									</div>
								) : rooms.length === 0 ? (
									<div className={styles.emptyRooms}>
										<span>Aucune salle disponible</span>
									</div>
								) : (
									rooms.map(room => (
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
