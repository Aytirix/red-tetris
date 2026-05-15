import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ClipLoader } from "react-spinners";
import { useSocket } from "../contexts/SocketContext";
import { useWsSession } from "../contexts/WsStateContext";
import { useAlert } from "../components/Alert";
import { normalizeUsernameAvailability } from "../socket/userState";
import {
	emitJoinRoom,
	emitLeaveRoom,
	emitKickPlayer,
	emitStartGame,
	emitSetGameMode,
	emitSetPrivate,
} from "../socket/events/room";
import { emitSubscribeSpectator, emitUnsubscribeSpectator } from "../socket/events/game";
import { normalizeGameOver, normalizeGameState } from "../socket/gameState";
import type { GameOverPayload, GameStatePayload } from "../types/game";
import GameView from "../components/game/GameView";
import GameOverView from "../components/game/GameOverView";

// ─── Types ───────────────────────────────────────────────────────────────────

type GameViewMode = "connecting" | "lobby" | "game";

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

// ─── Lobby ───────────────────────────────────────────────────────────────────

function LobbyView({
	roomName,
	playerName,
	players,
	gameMode,
	isPrivate,
	isRoomLoading,
	gameSummary,
	onLeave,
}: {
	roomName: string;
	playerName: string;
	players: RoomPlayer[];
	gameMode: string;
	isPrivate: boolean;
	isRoomLoading: boolean;
	gameSummary: GameOverPayload | null;
	onLeave: () => void;
}) {
	const isAdmin = !isRoomLoading && players[0]?.username === playerName;
	const controlsDisabled = isRoomLoading || !isAdmin;
	const statusLabel = isRoomLoading ? "Connexion" : isAdmin ? "Admin" : "Joueur";
	const playerCountLabel = isRoomLoading
		? "Chargement"
		: `${players.length} joueur${players.length > 1 ? "s" : ""}`;
	const hasGameSummary = !!gameSummary && gameSummary.scores.some((score) => score.username === playerName);

	return (
		<div className="game-lobby">
			<div className={`game-lobby__shell${hasGameSummary ? " game-lobby__shell--with-summary" : ""}`}>
				<div className="game-lobby__card" aria-busy={isRoomLoading}>
					<header className="game-lobby__header">
						<div className="game-lobby__header-left">
							<span className="eyebrow">Salle</span>
							<h1 className="game-lobby__room-name">{roomName}</h1>
						</div>
						<div className="game-lobby__header-right">
							<span className={[
								"game-lobby__status-badge",
								isAdmin ? "game-lobby__status-badge--admin" : "",
								isRoomLoading ? "game-lobby__status-badge--loading" : "",
							].filter(Boolean).join(" ")}>
								{statusLabel}
							</span>
							<span className="game-lobby__player-count-badge">
								{isRoomLoading && <ClipLoader color="var(--color-secondary)" size={11} />}
								{playerCountLabel}
							</span>
						</div>
					</header>

					<ul className="game-lobby__player-list" aria-busy={isRoomLoading}>
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

						{isRoomLoading && players.length === 0 && (
							Array.from({ length: 2 }).map((_, i) => (
								<li key={i} className="game-lobby__player-item game-lobby__player-item--loading" aria-hidden="true">
									<div className="game-lobby__player-avatar game-lobby__skeleton" />
									<div className="game-lobby__loading-lines">
										<span className="game-lobby__loading-line game-lobby__loading-line--name" />
										<span className="game-lobby__loading-line game-lobby__loading-line--meta" />
									</div>
								</li>
							))
						)}

						{!isRoomLoading && players.length === 0 && (
							<li className="game-lobby__player-empty">
								<span>Aucun joueur connecté.</span>
							</li>
						)}
					</ul>

					<div className={`game-lobby__settings${isRoomLoading ? " game-lobby__settings--loading" : ""}`}>
						<div className="game-lobby__setting">
							<span className="game-lobby__setting-label">Mode de jeu</span>
							<div className="game-lobby__mode-list">
								{GAME_MODES.map((m) => (
									<button
										key={m.id}
										className={`game-lobby__mode-btn${gameMode === m.id ? " game-lobby__mode-btn--active" : ""}`}
										onClick={() => isAdmin && emitSetGameMode(m.id)}
										disabled={controlsDisabled}
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
								disabled={controlsDisabled}
							>
								{isPrivate ? "🔒 Privée" : "🌐 Publique"}
							</button>
						</div>
					</div>

					<footer className="game-lobby__footer">
						{isRoomLoading ? (
							<div className="game-lobby__waiting-hint">
								<ClipLoader color="var(--color-secondary)" size={13} />
								<span>Chargement de la room…</span>
							</div>
						) : !isAdmin && (
							<div className="game-lobby__waiting-hint">
								<ClipLoader color="var(--color-secondary)" size={13} />
								<span>En attente de l'admin…</span>
							</div>
						)}
						<div className="game-lobby__footer-actions">
							<button className="button button-ghost" onClick={onLeave}>
								Quitter
							</button>
							{(isRoomLoading || isAdmin) && (
								<button className="button button-primary" onClick={emitStartGame} disabled={isRoomLoading}>
									▶ Lancer
								</button>
							)}
						</div>
					</footer>
				</div>

				<GameOverView
					payload={gameSummary}
					playerName={playerName}
					players={players}
				/>
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
	const { alert } = useAlert();
	const navigate = useNavigate();
	const [view, setView] = useState<GameViewMode>("connecting");
	const [players, setPlayers] = useState<RoomPlayer[]>([]);
	const [gameMode, setGameMode] = useState("classic");
	const [isPrivate, setIsPrivate] = useState(false);
	const [isRoomLoading, setIsRoomLoading] = useState(true);
	const [gameState, setGameState] = useState<GameStatePayload | null>(null);
	const [gameOver, setGameOver] = useState<GameOverPayload | null>(null);

	const roomName = rawRoom.slice(0, MAX_NAME_LENGTH);

	useEffect(() => {
		if (rawRoom !== roomName) {
			navigate(`/${roomName}/${playerName}`, { replace: true });
		}
	}, []); // eslint-disable-line react-hooks/exhaustive-deps

	const rawRoomRef = useRef(rawRoom);
	const roomNameRef = useRef(roomName);
	const playerNameRef = useRef(playerName);
	const hasJoinedRoomRef = useRef(false);
	const hasLeftRoomRef = useRef(false);
	const isSpectatorRef = useRef(false);
	const lastPlayerLevelRef = useRef(1);
	useEffect(() => { rawRoomRef.current = rawRoom; }, [rawRoom]);
	useEffect(() => { roomNameRef.current = roomName; }, [roomName]);
	useEffect(() => { playerNameRef.current = playerName; }, [playerName]);

	const joinRoomOnce = useCallback(() => {
		if (hasJoinedRoomRef.current || hasLeftRoomRef.current) return;
		const currentRoom = roomNameRef.current;
		if (!currentRoom || rawRoomRef.current !== currentRoom) return;

		emitJoinRoom(currentRoom);
		setIsRoomLoading(true);
		hasJoinedRoomRef.current = true;
	}, []);

	const leaveRoomOnce = useCallback(() => {
		if (hasLeftRoomRef.current) return;

		hasLeftRoomRef.current = true;
		if (isSpectatorRef.current) {
			emitUnsubscribeSpectator();
		} else if (roomNameRef.current) {
			emitLeaveRoom();
		}
		hasJoinedRoomRef.current = false;
	}, []);

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

	useEffect(() => {
		if (rawRoom !== roomName) return;
		const username = playerName.trim();
		if (!roomName || !username) return;

		hasJoinedRoomRef.current = false;
		hasLeftRoomRef.current = false;
		isSpectatorRef.current = false;
		setView("connecting");
		setPlayers([]);
		setIsRoomLoading(true);
		setGameState(null);
		setGameOver(null);
		lastPlayerLevelRef.current = 1;

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

	// Room events — including spectator detection on room:joined { joined: false }
	useEffect(() => {
		type RawPlayer = { username: string; avatar?: string; faction?: string };

		function parsePlayer(p: RawPlayer): RoomPlayer {
			const faction = p.faction === "pirate" || p.faction === "marine" ? p.faction : null;
			return { username: p.username, avatar: p.avatar ?? "", faction };
		}

		function handleRoomJoined(room: unknown) {
			const r = room as { players?: RawPlayer[]; joined?: boolean } | null;
			if (r?.players) setPlayers(r.players.map(parsePlayer));
			setIsRoomLoading(false);

			if (r && r.joined === false) {
				// Game already running → become spectator on first available player
				isSpectatorRef.current = true;
				emitSubscribeSpectator(roomNameRef.current, null);
				setView("game");
			} else {
				isSpectatorRef.current = false;
				setView("lobby");
			}
		}
		function handleRoomPlayers(data: unknown) {
			const list = data as RawPlayer[] | null;
			if (Array.isArray(list)) {
				setPlayers(list.map(parsePlayer));
				setIsRoomLoading(false);
			}
		}
		socket.on("room:joined", handleRoomJoined);
		socket.on("room:players", handleRoomPlayers);
		return () => {
			socket.off("room:joined", handleRoomJoined);
			socket.off("room:players", handleRoomPlayers);
		};
	}, [socket]);

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

	useEffect(() => {
		function handleKicked() {
			hasLeftRoomRef.current = true;
			hasJoinedRoomRef.current = false;
			isSpectatorRef.current = false;
			setGameState(null);
			setGameOver(null);
			setPlayers([]);
			navigate("/dashboard");
			void alert({
				title: "Expulsé de la salle",
				message: "Vous avez été retiré de la room par l'admin.",
				confirmLabel: "Compris",
				danger: true,
			});
		}

		socket.on("room:kicked", handleKicked);
		return () => { socket.off("room:kicked", handleKicked); };
	}, [socket, navigate, alert]);

	// Game state events
	useEffect(() => {
		function handleStateUpdate(raw: unknown) {
			const next = normalizeGameState(raw);
			if (!next) return;
			isSpectatorRef.current = next.spectator !== false;
			if (next.spectator === false) {
				lastPlayerLevelRef.current = next.level;
			}
			setGameState(next);
			setGameOver(null);
			setView("game");
		}
		function handleOver(raw: unknown) {
			const payload = normalizeGameOver(raw);
			const nextPayload = payload && payload.scores.length === 1
				? {
					...payload,
					scores: [{
						...payload.scores[0],
						level: payload.scores[0].level ?? lastPlayerLevelRef.current,
					}],
				}
				: payload;
			setGameOver(nextPayload);
			setGameState(null);
			setView("lobby");
		}
		socket.on("game:start", handleStateUpdate);
		socket.on("game:update", handleStateUpdate);
		socket.on("game:SpectatorGame", handleStateUpdate);
		socket.on("game:over", handleOver);
		return () => {
			socket.off("game:start", handleStateUpdate);
			socket.off("game:update", handleStateUpdate);
			socket.off("game:SpectatorGame", handleStateUpdate);
			socket.off("game:over", handleOver);
		};
	}, [socket]);

	function handleLeave() {
		leaveRoomOnce();
		navigate("/dashboard");
	}

	return (
		<div className="game-page">
			{view === "connecting" && (
				<div className="tetris-stage tetris-stage--waiting">
					<div className="tetris-stage__waiting">
						<ClipLoader color="var(--color-secondary)" size={26} />
						<span>Connexion à la room…</span>
					</div>
				</div>
			)}
			{view === "lobby" && (
				<LobbyView
					roomName={roomName}
					playerName={playerName}
					players={players}
					gameMode={gameMode}
					isPrivate={isPrivate}
					isRoomLoading={isRoomLoading}
					gameSummary={gameOver}
					onLeave={handleLeave}
				/>
			)}
			{view === "game" && gameState && (
				<GameView
					state={gameState}
					roomName={roomName}
					playerName={playerName}
				/>
			)}
			{view === "game" && !gameState && (
				<div className="tetris-stage tetris-stage--waiting">
					<div className="tetris-stage__waiting">
						<ClipLoader color="var(--color-secondary)" size={26} />
						<span>Chargement de la partie…</span>
					</div>
				</div>
			)}
		</div>
	);
}
