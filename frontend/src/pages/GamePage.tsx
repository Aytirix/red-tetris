import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ClipLoader } from "react-spinners";
import { useSocket } from "../contexts/SocketContext";
import { normalizeUsernameAvailability } from "../socket/userState";
import { emitJoinRoom, emitLeaveRoom, emitKickPlayer, emitStartGame } from "../socket/events/room";

// ─── Types ───────────────────────────────────────────────────────────────────

type GameView = "connecting" | "lobby" | "game" | "gameover";

type RoomPlayer = {
	username: string;
	isHost?: boolean;
};

// ─── Connecting ──────────────────────────────────────────────────────────────

function ConnectingView({ roomName, playerName }: { roomName: string; playerName: string }) {
	return (
		<div className="game-connecting">
			<ClipLoader color="var(--color-primary)" size={52} />
			<p className="game-connecting__room">
				<span className="eyebrow">Salle</span>
				<span className="game-connecting__value">{roomName}</span>
			</p>
			<p className="game-connecting__player">
				<span className="eyebrow">Joueur</span>
				<span className="game-connecting__value">{playerName}</span>
			</p>
		</div>
	);
}

// ─── Lobby ───────────────────────────────────────────────────────────────────

function LobbyView({
	roomName,
	playerName,
	players,
	onLeave,
}: {
	roomName: string;
	playerName: string;
	players: RoomPlayer[];
	onLeave: () => void;
}) {
	const isAdmin = players.length === 0 || players[0]?.username === playerName;

	return (
		<div className="game-lobby">
			{/* ── Sidebar ── */}
			<aside className="game-lobby__sidebar">
				<div className="game-lobby__brand">
					<span className="eyebrow">Red Piece</span>
				</div>

				<div className="game-lobby__room-info">
					<p className="game-lobby__room-label">Salle</p>
					<h1 className="game-lobby__room-name">{roomName}</h1>
					<span className={`game-lobby__status-badge${isAdmin ? " game-lobby__status-badge--admin" : ""}`}>
						{isAdmin ? "Admin" : "Joueur"}
					</span>
				</div>

				<div className="game-lobby__sidebar-actions">
					{isAdmin && (
						<button
							className="button button-primary game-lobby__start-btn"
							onClick={emitStartGame}
						>
							<span className="game-lobby__btn-icon">▶</span>
							Lancer la partie
						</button>
					)}
					{!isAdmin && (
						<div className="game-lobby__waiting-hint">
							<ClipLoader color="var(--color-secondary)" size={14} />
							<span>En attente de l'admin…</span>
						</div>
					)}
					<button className="button button-outline game-lobby__leave-btn" onClick={onLeave}>
						<span className="game-lobby__btn-icon">←</span>
						Quitter
					</button>
				</div>

				<div className="game-lobby__sidebar-footer">
					<p className="game-lobby__player-self">
						<span className="game-lobby__player-self-dot" />
						{playerName}
					</p>
				</div>
			</aside>

			{/* ── Main ── */}
			<main className="game-lobby__main">
				<header className="game-lobby__main-header">
					<h2 className="game-lobby__players-title">
						Joueurs
					</h2>
					<span className="game-lobby__player-count-badge">
						{players.length}
					</span>
				</header>

				<ul className="game-lobby__player-list">
					{players.map((p, i) => {
						const isMe = p.username === playerName;
						const isFirst = i === 0;
						return (
							<li
								key={p.username}
								className={[
									"game-lobby__player-item",
									isMe ? "game-lobby__player-item--me" : "",
									isFirst ? "game-lobby__player-item--host" : "",
								].filter(Boolean).join(" ")}
							>
								<span className="game-lobby__player-rank">#{i + 1}</span>

								<span className="game-lobby__player-avatar">
									{p.username.slice(0, 2).toUpperCase()}
								</span>

								<span className="game-lobby__player-name">
									{p.username}
									{isMe && <span className="game-lobby__player-tag game-lobby__player-tag--me">Vous</span>}
									{isFirst && <span className="game-lobby__player-tag game-lobby__player-tag--host">Admin</span>}
								</span>

								{isAdmin && !isMe && (
									<button
										className="game-lobby__kick-btn"
										onClick={() => emitKickPlayer(p.username)}
										title={`Expulser ${p.username}`}
									>
										✕
									</button>
								)}
							</li>
						);
					})}

					{players.length === 0 && (
						<li className="game-lobby__player-empty">
							<ClipLoader color="var(--color-primary)" size={20} />
							<span>Connexion à la salle…</span>
						</li>
					)}
				</ul>

			</main>
		</div>
	);
}

// ─── Game ────────────────────────────────────────────────────────────────────

function GameView({ playerName }: { playerName: string }) {
	return (
		<div className="game-board">
			<header className="game-board__header">
				<span className="eyebrow">{playerName}</span>
			</header>
			<div className="game-board__area">
				<div className="game-board__grid">
					{/* Tetris grid — à implémenter */}
					{Array.from({ length: 20 }).map((_, row) => (
						<div key={row} className="game-board__row">
							{Array.from({ length: 10 }).map((_, col) => (
								<div key={col} className="game-board__cell" />
							))}
						</div>
					))}
				</div>
			</div>
		</div>
	);
}

// ─── Game Over ────────────────────────────────────────────────────────────────

function GameOverView({ onLeave }: { onLeave: () => void }) {
	return (
		<div className="game-over">
			<h1 className="game-over__title">Game Over</h1>
			<p className="game-over__subtitle">La partie est terminée.</p>
			<div className="game-over__actions">
				<button className="button button-primary">
					Rejouer
				</button>
				<button className="button button-ghost" onClick={onLeave}>
					Quitter
				</button>
			</div>
		</div>
	);
}

// ─── GamePage ─────────────────────────────────────────────────────────────────

export default function GamePage() {
	const { roomName = "", playerName = "" } = useParams<{ roomName: string; playerName: string }>();
	const { socket } = useSocket();
	const navigate = useNavigate();
	const [view, setView] = useState<GameView>("connecting");
	const [players, setPlayers] = useState<RoomPlayer[]>([]);

	// Keep stable refs for use in socket callbacks
	const roomNameRef = useRef(roomName);
	const playerNameRef = useRef(playerName);
	useEffect(() => { roomNameRef.current = roomName; }, [roomName]);
	useEffect(() => { playerNameRef.current = playerName; }, [playerName]);

	// Auth result → join room if OK (redirect is handled by useAuthGuard on failure)
	useEffect(() => {
		function handleAuthResult(data: unknown) {
			const result = normalizeUsernameAvailability(data);
			if (!result) return;
			if (result.available && result.isRegistered) {
				emitJoinRoom(roomNameRef.current);
			}
		}
		socket.on("user:ResultUsernameAvailable", handleAuthResult);
		return () => { socket.off("user:ResultUsernameAvailable", handleAuthResult); };
	}, [socket]);

	// Room events
	useEffect(() => {
		function handleRoomJoined(room: unknown) {
			const r = room as { players?: { username: string }[] } | null;
			if (r?.players) {
				setPlayers(r.players.map((p, i) => ({ username: p.username, isHost: i === 0 })));
			}
			setView("lobby");
		}
		function handleRoomPlayers(data: unknown) {
			const list = data as { username: string }[] | null;
			if (Array.isArray(list)) {
				setPlayers(list.map((p, i) => ({ username: p.username, isHost: i === 0 })));
			}
		}
		socket.on("room:joined", handleRoomJoined);
		socket.on("room:players", handleRoomPlayers);
		return () => {
			socket.off("room:joined", handleRoomJoined);
			socket.off("room:players", handleRoomPlayers);
		};
	}, [socket]);

	// Game events
	useEffect(() => {
		function handleGameStart() { setView("game"); }
		function handleGameOver() { setView("gameover"); }
		socket.on("game:start", handleGameStart);
		socket.on("game:over", handleGameOver);
		return () => {
			socket.off("game:start", handleGameStart);
			socket.off("game:over", handleGameOver);
		};
	}, [socket]);

	function handleLeave() {
		emitLeaveRoom();
		navigate("/");
	}

	return (
		<div className="game-page">
			{view === "connecting" && (
				<ConnectingView roomName={roomName} playerName={playerName} />
			)}
			{view === "lobby" && (
				<LobbyView
					roomName={roomName}
					playerName={playerName}
					players={players}
					onLeave={handleLeave}
				/>
			)}
			{view === "game" && (
				<GameView playerName={playerName} />
			)}
			{view === "gameover" && (
				<GameOverView onLeave={handleLeave} />
			)}
		</div>
	);
}
