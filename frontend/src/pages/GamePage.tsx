import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ClipLoader } from "react-spinners";
import { useSocket } from "../contexts/SocketContext";
import { useWsSession } from "../contexts/WsStateContext";
import { normalizeUsernameAvailability } from "../socket/userState";
import { emitJoinRoom, emitLeaveRoom, emitKickPlayer, emitStartGame, emitSetGameMode, emitSetPrivate } from "../socket/events/room";

// ─── Types ───────────────────────────────────────────────────────────────────

type GameView = "connecting" | "lobby" | "game" | "gameover";

const GAME_MODES = [
	{ id: "classic", label: "Classique" },
	{ id: "sprint", label: "Sprint" },
	{ id: "ultra", label: "Ultra" },
];

type RoomPlayer = {
	username: string;
	avatar: string;
	faction: "pirate" | "marine" | null;
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
	gameMode,
	isPrivate,
	onLeave,
}: {
	roomName: string;
	playerName: string;
	players: RoomPlayer[];
	gameMode: string;
	isPrivate: boolean;
	onLeave: () => void;
}) {
	const isAdmin = players.length === 0 || players[0]?.username === playerName;

	return (
		<div className="game-lobby">
			<div className="game-lobby__card">
				{/* ── Header ── */}
				<header className="game-lobby__header">
					<div className="game-lobby__header-left">
						<span className="eyebrow">Salle</span>
						<h1 className="game-lobby__room-name">{roomName}</h1>
					</div>
					<div className="game-lobby__header-right">
						<span className={`game-lobby__status-badge${isAdmin ? " game-lobby__status-badge--admin" : ""}`}>
							{isAdmin ? "Admin" : "Joueur"}
						</span>
						<span className="game-lobby__player-count-badge">
							{players.length} joueur{players.length > 1 ? "s" : ""}
						</span>
					</div>
				</header>

				{/* ── Player list ── */}
				<ul className="game-lobby__player-list">
					{players.map((p, i) => {
						const isMe = p.username === playerName;
						const isPirate = p.faction === "pirate";
						const isMarine = p.faction === "marine";
						const factionDir = p.faction === "pirate" ? "pirate" : "marine";
						const avatarSrc = p.faction && p.avatar
							? `/img/avatar/${factionDir}/${p.avatar}.png`
							: null;

						return (
							<li
								key={p.username}
								className={[
									"game-lobby__player-item",
									isPirate ? "game-lobby__player-item--pirate" : "",
									isMarine ? "game-lobby__player-item--marine" : "",
									isMe ? "game-lobby__player-item--me" : "",
								].filter(Boolean).join(" ")}
							>
								<div className="game-lobby__player-avatar">
									{avatarSrc
										? <img src={avatarSrc} alt={p.username} draggable={false} />
										: <span>{p.username.slice(0, 2).toUpperCase()}</span>
									}
								</div>

								<span className="game-lobby__player-name">
									{p.username}
								</span>

								<div className="game-lobby__player-badges">
									{isMe && <span className="game-lobby__player-tag game-lobby__player-tag--me">Vous</span>}
									{i === 0 && <span className="game-lobby__player-tag game-lobby__player-tag--host">Admin</span>}
									{isPirate && <span className="game-lobby__player-tag game-lobby__player-tag--pirate">☠ Pirate</span>}
									{isMarine && <span className="game-lobby__player-tag game-lobby__player-tag--marine">⚓ Marine</span>}
								</div>

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
							<ClipLoader color="var(--color-primary)" size={18} />
							<span>Connexion à la salle…</span>
						</li>
					)}
				</ul>

				{/* ── Settings ── */}
				<div className="game-lobby__settings">
					<div className="game-lobby__setting">
						<span className="game-lobby__setting-label">Mode de jeu</span>
						<div className="game-lobby__mode-list">
							{GAME_MODES.map((m) => (
								<button
									key={m.id}
									className={`game-lobby__mode-btn${gameMode === m.id ? " game-lobby__mode-btn--active" : ""}`}
									onClick={() => isAdmin && emitSetGameMode(m.id)}
									disabled={!isAdmin}
								>
									{m.label}
								</button>
							))}
						</div>
					</div>

					<div className="game-lobby__setting">
						<span className="game-lobby__setting-label">Accès</span>
						<button
							className={`game-lobby__privacy-btn${isPrivate ? " game-lobby__privacy-btn--private" : ""}`}
							onClick={() => isAdmin && emitSetPrivate(!isPrivate)}
							disabled={!isAdmin}
						>
							{isPrivate ? "🔒 Privée" : "🌐 Publique"}
						</button>
					</div>
				</div>

				{/* ── Footer actions ── */}
				<footer className="game-lobby__footer">
					{!isAdmin && (
						<div className="game-lobby__waiting-hint">
							<ClipLoader color="var(--color-secondary)" size={13} />
							<span>En attente de l'admin…</span>
						</div>
					)}
					<div className="game-lobby__footer-actions">
						<button className="button button-ghost" onClick={onLeave}>
							Quitter
						</button>
						{isAdmin && (
							<button className="button button-primary" onClick={emitStartGame}>
								▶ Lancer
							</button>
						)}
					</div>
				</footer>
			</div>
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

const MAX_NAME_LENGTH = 15;

export default function GamePage() {
	const { roomName: rawRoom = "", playerName = "" } = useParams<{ roomName: string; playerName: string }>();
	const { socket } = useSocket();
	const session = useWsSession();
	const navigate = useNavigate();
	const [view, setView] = useState<GameView>("connecting");
	const [players, setPlayers] = useState<RoomPlayer[]>([]);
	const [gameMode, setGameMode] = useState("classic");
	const [isPrivate, setIsPrivate] = useState(false);

	const roomName = rawRoom.slice(0, MAX_NAME_LENGTH);

	// Redirect to truncated URL if room name exceeded the limit
	useEffect(() => {
		if (rawRoom !== roomName) {
			navigate(`/${roomName}/${playerName}`, { replace: true });
		}
	}, []); // eslint-disable-line react-hooks/exhaustive-deps

	// Keep stable refs for use in socket callbacks
	const rawRoomRef = useRef(rawRoom);
	const roomNameRef = useRef(roomName);
	const playerNameRef = useRef(playerName);
	const hasJoinedRoomRef = useRef(false);
	const hasLeftRoomRef = useRef(false);
	useEffect(() => { rawRoomRef.current = rawRoom; }, [rawRoom]);
	useEffect(() => { roomNameRef.current = roomName; }, [roomName]);
	useEffect(() => { playerNameRef.current = playerName; }, [playerName]);

	const joinRoomOnce = useCallback(() => {
		if (hasJoinedRoomRef.current || hasLeftRoomRef.current) return;
		const currentRoom = roomNameRef.current;
		if (!currentRoom || rawRoomRef.current !== currentRoom) return;

		emitJoinRoom(currentRoom);
		hasJoinedRoomRef.current = true;
	}, []);

	const leaveRoomOnce = useCallback(() => {
		if (hasLeftRoomRef.current) return;

		hasLeftRoomRef.current = true;
		if (roomNameRef.current) {
			emitLeaveRoom();
		}
		hasJoinedRoomRef.current = false;
	}, []);

	// Auth result → join room if OK (redirect is handled by useAuthGuard on failure)
	useEffect(() => {
		function handleAuthResult(data: unknown) {
			const result = normalizeUsernameAvailability(data);
			if (!result) return;
			if (result.available && result.isRegistered) {
				if (result.username !== playerNameRef.current) return;
				joinRoomOnce();
			}
		}
		socket.on("user:ResultUsernameAvailable", handleAuthResult);
		return () => { socket.off("user:ResultUsernameAvailable", handleAuthResult); };
	}, [socket, joinRoomOnce]);

	// Room page lifecycle: join after the username session is confirmed, leave on any exit.
	useEffect(() => {
		if (rawRoom !== roomName) return;
		const username = playerName.trim();
		if (!roomName || !username) return;

		hasJoinedRoomRef.current = false;
		hasLeftRoomRef.current = false;
		setView("connecting");
		setPlayers([]);

		function handlePageExit() {
			leaveRoomOnce();
		}

		window.addEventListener("pagehide", handlePageExit);
		window.addEventListener("beforeunload", handlePageExit);

		return () => {
			window.removeEventListener("pagehide", handlePageExit);
			window.removeEventListener("beforeunload", handlePageExit);
			leaveRoomOnce();
		};
	}, [rawRoom, roomName, playerName, leaveRoomOnce]);

	// The auth check is emitted elsewhere. Join once that check is valid for this
	// URL user, including the freshly registered case confirmed by ResultRegister.
	useEffect(() => {
		if (rawRoom !== roomName) return;
		const username = playerName.trim();
		const result = session.lastUsernameAvailability;

		if (!roomName || !username || !result) return;
		if (result.username !== username) return;
		if (!result.available) return;
		if (!result.isRegistered && session.faction === null) return;

		joinRoomOnce();
	}, [rawRoom, roomName, playerName, session.faction, session.lastUsernameAvailability, joinRoomOnce]);

	// Room events
	useEffect(() => {
		type RawPlayer = { username: string; avatar?: string; faction?: string };

		function parsePlayer(p: RawPlayer): RoomPlayer {
			const faction = p.faction === "pirate" || p.faction === "marine" ? p.faction : null;
			return { username: p.username, avatar: p.avatar ?? "", faction };
		}

		function handleRoomJoined(room: unknown) {
			const r = room as { players?: RawPlayer[] } | null;
			if (r?.players) setPlayers(r.players.map(parsePlayer));
			setView("lobby");
		}
		function handleRoomPlayers(data: unknown) {
			const list = data as RawPlayer[] | null;
			if (Array.isArray(list)) setPlayers(list.map(parsePlayer));
		}
		socket.on("room:joined", handleRoomJoined);
		socket.on("room:players", handleRoomPlayers);
		return () => {
			socket.off("room:joined", handleRoomJoined);
			socket.off("room:players", handleRoomPlayers);
		};
	}, [socket]);

	// Room settings
	useEffect(() => {
		function handleSettings(data: unknown) {
			const s = data as { mode?: string; private?: boolean } | null;
			if (!s) return;
			if (typeof s.mode === "string") setGameMode(s.mode);
			if (typeof s.private === "boolean") setIsPrivate(s.private);
		}
		socket.on("room:settings", handleSettings);
		return () => { socket.off("room:settings", handleSettings); };
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
		leaveRoomOnce();
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
					gameMode={gameMode}
					isPrivate={isPrivate}
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
