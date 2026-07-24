import { GAME_MODE_LABELS, MAX_JOKERS, type GameMode } from "../../types/game";

type Props = {
	score: number;
	level: number;
	showLevel: boolean;
	spectatorOf?: string | null;
	mode?: GameMode;
	lines?: number;
	linesTarget?: number | null;
	timeLeftMs?: number | null;
	jokersLeft?: number;
	/** Touche configurée pour le joker, affichée en indice. */
	jokerKey?: string;
};

/** mm:ss à partir d'un reste en millisecondes (chrono du mode ultra). */
export function formatTimeLeft(ms: number): string {
	const totalSeconds = Math.max(0, Math.ceil(ms / 1000));
	const minutes = Math.floor(totalSeconds / 60);
	const seconds = totalSeconds % 60;
	return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

export default function GameHud({
	score,
	level,
	showLevel,
	spectatorOf,
	mode = "classique",
	lines = 0,
	linesTarget = null,
	timeLeftMs = null,
	jokersLeft = 0,
	jokerKey,
}: Props) {
	// Le chrono passe en rouge sur les 10 dernières secondes.
	const isUrgent = timeLeftMs != null && timeLeftMs <= 10_000;

	return (
		<div className="tetris-hud">
			{spectatorOf && (
				<div className="tetris-hud__spectator">
					<span className="tetris-hud__label">Spectator</span>
					<strong className="tetris-hud__value">{spectatorOf}</strong>
				</div>
			)}
			<div className="tetris-hud__score">
				<span className="tetris-hud__label">Score</span>
				<strong className="tetris-hud__value">{score.toLocaleString()}</strong>
			</div>

			{/* Sprint : progression vers l'objectif de lignes. */}
			{linesTarget != null && (
				<div className="tetris-hud__objective">
					<span className="tetris-hud__label">Lignes</span>
					<strong className="tetris-hud__value">{lines} / {linesTarget}</strong>
				</div>
			)}

			{/* Ultra : temps restant. */}
			{timeLeftMs != null && (
				<div className={`tetris-hud__timer${isUrgent ? " tetris-hud__timer--urgent" : ""}`}>
					<span className="tetris-hud__label">Temps</span>
					<strong className="tetris-hud__value">{formatTimeLeft(timeLeftMs)}</strong>
				</div>
			)}

			{/* Invisible : jokers restants (révélation à la demande). */}
			{mode === "invisible" && (
				<div className="tetris-hud__jokers">
					<span className="tetris-hud__label">
						Jokers{jokerKey ? ` · ${jokerKey}` : ""}
					</span>
					<strong className="tetris-hud__value">
						{"★".repeat(jokersLeft)}{"☆".repeat(Math.max(0, MAX_JOKERS - jokersLeft))}
					</strong>
				</div>
			)}

			{mode !== "classique" && (
				<span className="tetris-hud__mode badge">{GAME_MODE_LABELS[mode]}</span>
			)}

			{showLevel && (
				<div className="tetris-hud__level">
					<span className="tetris-hud__label">Level</span>
					<strong className="tetris-hud__value">{level}</strong>
				</div>
			)}
		</div>
	);
}
