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
	emitSetPrivate,
} from "../socket/events/room";
import { useCloudNavigate } from "../transition/TransitionContext";
import { emitSubscribeSpectator, emitUnsubscribeSpectator } from "../socket/events/game";
import { normalizeGameOver, normalizeGameState } from "../socket/gameState";
import type { GameOverPayload, GameStatePayload } from "../types/game";
import GameView from "../components/game/GameView";
import GameOverView from "../components/game/GameOverView";

// ─── Types ───────────────────────────────────────────────────────────────────

type GameViewMode = "connecting" | "lobby" | "game";

// Parties solo: nom prefixe "sologame_", forcees privees et non modifiables.
const SOLO_PREFIX = "sologame_";

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
	isPrivate,
	isRoomLoading,
	gameSummary,
	onLeave,
}: {
	roomName: string;
	playerName: string;
	players: RoomPlayer[];
	isPrivate: boolean;
	isRoomLoading: boolean;
	gameSummary: GameOverPayload | null;
	onLeave: () => void;
}) {
	const isAdmin = !isRoomLoading && players[0]?.username === playerName;
	// Solo: acces verrouille sur "privee", non modifiable.
	const isSolo = roomName.startsWith(SOLO_PREFIX);
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
							<span className="game-lobby__setting-label">Accès</span>
							<button
								className={`game-lobby__privacy-btn${isPrivate || isSolo ? " game-lobby__privacy-btn--private" : ""}`}
								onClick={() => isAdmin && !isSolo && emitSetPrivate(!isPrivate)}
								disabled={controlsDisabled || isSolo}
							>
								{isPrivate || isSolo ? "🔒 Privée" : "🌐 Publique"}
							</button>
							{isSolo && (
								<span className="game-lobby__setting-hint">Partie solo — toujours privée</span>
							)}
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
	// Sorties vers le dashboard: transition « nuages ». navigate() reste utilisé pour
	// la normalisation d'URL (même page, pas de changement visuel de page).
	const cloudNavigate = useCloudNavigate();
	const [view, setView] = useState<GameViewMode>("connecting");
	const [players, setPlayers] = useState<RoomPlayer[]>([]);
	const [isPrivate, setIsPrivate] = useState(false);
	const [isRoomLoading, setIsRoomLoading] = useState(true);
	const [gameState, setGameState] = useState<GameStatePayload | null>(null);
	const [gameOver, setGameOver] = useState<GameOverPayload | null>(null);
	// Décompte 3-2-1 diffusé par le serveur entre room:start et le vrai démarrage.
	const [countdown, setCountdown] = useState<number | null>(null);
	// Élimination individuelle en multi (partie qui continue): déclenche l'overlay
	// "GAME OVER" zoom, puis bascule en spectateur à la fin de l'animation.
	const [eliminated, setEliminated] = useState(false);

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
	const eliminateSpectateRef = useRef<string | null>(null);
	// True dès qu'on a rejoint la room en tant que JOUEUR (≠ spectateur pur): permet
	// de distinguer un mort-devenu-spectateur d'un simple spectateur au moment de partir.
	const wasPlayerRef = useRef(false);
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
		}
		// Un joueur (même éliminé et devenu spectateur) doit quitter la room, pas
		// seulement se désabonner — sinon il resterait "fantôme" jusqu'à déconnexion.
		if (wasPlayerRef.current && roomNameRef.current) {
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
		eliminateSpectateRef.current = null;
		wasPlayerRef.current = false;
		setView("connecting");
		setPlayers([]);
		setIsRoomLoading(true);
		setGameState(null);
		setGameOver(null);
		setEliminated(false);
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
				wasPlayerRef.current = true;
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
			const s = data as { private?: boolean } | null;
			if (!s) return;
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
			cloudNavigate("/dashboard");
			void alert({
				title: "Expulsé de la salle",
				message: "Vous avez été retiré de la room par l'admin.",
				confirmLabel: "Compris",
				danger: true,
			});
		}

		function handleDenied() {
			hasLeftRoomRef.current = true;
			hasJoinedRoomRef.current = false;
			isSpectatorRef.current = false;
			setGameState(null);
			setGameOver(null);
			setPlayers([]);
			cloudNavigate("/dashboard");
			void alert({
				title: "Partie privée",
				message: "Cette partie est privée : vous ne pouvez pas la rejoindre.",
				confirmLabel: "Compris",
				danger: true,
			});
		}

		socket.on("room:kicked", handleKicked);
		socket.on("room:denied", handleDenied);
		return () => {
			socket.off("room:kicked", handleKicked);
			socket.off("room:denied", handleDenied);
		};
	}, [socket, navigate, alert]);

	// Game state events
	useEffect(() => {
		function handleStateUpdate(raw: unknown) {
			// On quitte: ignorer les frames en vol pour ne pas repasser sur "game"
			// devant la navigation differee (meme classe de course que le flash lobby).
			if (hasLeftRoomRef.current) return;
			const next = normalizeGameState(raw);
			if (!next) return;
			isSpectatorRef.current = next.spectator !== false;
			if (next.spectator === false) {
				lastPlayerLevelRef.current = next.level;
			}
			setCountdown(null);
			setGameState(next);
			setGameOver(null);
			setView("game");
		}
		function handleCountdown(raw: unknown) {
			if (hasLeftRoomRef.current) return;
			const value = (raw as { value?: unknown } | null)?.value;
			if (typeof value !== "number") return;
			// Overlay 3-2-1 par-dessus le lobby, jusqu'à l'arrivée de game:start.
			setGameOver(null);
			setCountdown(value);
		}
		function handleOver(raw: unknown) {
			// En quittant, le serveur renvoie game:over au partant. React Router v7
			// navigue via startTransition (basse priorite): sans ce garde, le setView
			// urgent ci-dessous passerait devant la navigation et ferait clignoter le
			// lobby avant le dashboard. hasLeftRoomRef est deja pose par leaveRoomOnce.
			if (hasLeftRoomRef.current) return;
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
			setEliminated(false);
			setView("lobby");
		}
		function handleEliminated(raw: unknown) {
			if (hasLeftRoomRef.current) return;
			// Le backend n'envoie ce signal qu'au joueur qui vient de topper alors
			// que la partie continue. On garde l'écran de jeu (dernière frame) et on
			// laisse l'overlay "GAME OVER" jouer; la bascule spectateur se fait à la
			// fin de l'animation (handleEliminationDone).
			const p = (raw ?? {}) as { spectate?: unknown };
			eliminateSpectateRef.current = typeof p.spectate === "string" ? p.spectate : null;
			isSpectatorRef.current = true;
			setEliminated(true);
			setView("game");
		}
		socket.on("game:countdown", handleCountdown);
		socket.on("game:start", handleStateUpdate);
		socket.on("game:update", handleStateUpdate);
		socket.on("game:SpectatorGame", handleStateUpdate);
		socket.on("game:over", handleOver);
		socket.on("game:eliminated", handleEliminated);
		return () => {
			socket.off("game:countdown", handleCountdown);
			socket.off("game:start", handleStateUpdate);
			socket.off("game:update", handleStateUpdate);
			socket.off("game:SpectatorGame", handleStateUpdate);
			socket.off("game:over", handleOver);
			socket.off("game:eliminated", handleEliminated);
		};
	}, [socket]);

	function handleLeave() {
		setCountdown(null);
		leaveRoomOnce();
		cloudNavigate("/dashboard");
	}

	// Fin de l'animation "GAME OVER": on s'abonne comme spectateur d'un joueur
	// encore vivant (nom fourni par le backend) et on retire l'overlay.
	function handleEliminationDone() {
		emitSubscribeSpectator(roomNameRef.current, eliminateSpectateRef.current);
		setEliminated(false);
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
					eliminated={eliminated}
					onEliminationDone={handleEliminationDone}
					onLeave={handleLeave}
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
			{countdown !== null && (
				<div className="game-countdown" role="status" aria-live="assertive">
					<span key={countdown} className="game-countdown__value">{countdown}</span>
					<span className="game-countdown__label">La partie commence…</span>
				</div>
			)}
		</div>
	);
}
