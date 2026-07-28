import { GAME_MODE_LABELS, MAX_JOKERS, type GameMode } from "../../types/game";

type Props = {
	score: number;
	level: number;
	showLevel: boolean;
	spectatorOf?: string | null;
	mode?: GameMode;
	lines?: number;
	/** « Tetris » réussis : 4 lignes nettoyées d'un seul coup. */
	tetris?: number;
	linesTarget?: number | null;
	timeLeftMs?: number | null;
	/** Mode Gruyère : rangées trouées restant à creuser. */
	garbageLeft?: number | null;
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
	tetris = 0,
	linesTarget = null,
	timeLeftMs = null,
	garbageLeft = null,
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

			{/* Compteurs de partie, côte à côte pour ne pas rallonger le HUD (la place
			    qu'il prend est autant de hauteur en moins pour le plateau).
			    En sprint, l'objectif se greffe sur le compteur de lignes plutôt que
			    d'ajouter une deuxième ligne « Lignes » juste à côté. */}
			<div className="tetris-hud__stats">
				{/* Le badge de mode partage la colonne gauche avec les compteurs : à côté
				    d'eux plutôt qu'au-dessus, sinon le HUD gagne une rangée entière. */}
				{mode !== "classique" && (
					<span className="tetris-hud__mode badge">{GAME_MODE_LABELS[mode]}</span>
				)}
				<div className="tetris-hud__lines">
					<span className="tetris-hud__label">Lignes</span>
					<strong className="tetris-hud__value">
						{linesTarget != null ? `${lines} / ${linesTarget}` : lines}
					</strong>
				</div>
				<div className="tetris-hud__tetris">
					<span className="tetris-hud__label">Tetris</span>
					<strong className="tetris-hud__value">{tetris}</strong>
				</div>
			</div>

			{/* Ultra : temps restant. */}
			{timeLeftMs != null && (
				<div className={`tetris-hud__timer${isUrgent ? " tetris-hud__timer--urgent" : ""}`}>
					<span className="tetris-hud__label">Temps</span>
					<strong className="tetris-hud__value">{formatTimeLeft(timeLeftMs)}</strong>
				</div>
			)}

			{/* Gruyère : rangées trouées restant à creuser (celles encore en coulisse
			    comprises), donc un compteur qui ne fait que descendre. */}
			{garbageLeft != null && (
				<div className="tetris-hud__garbage">
					{/* Pas « Gruyère » : le badge de mode porte déjà ce nom, deux fois le
					    même mot dans le HUD ne dit pas ce que compte le nombre. */}
					<span className="tetris-hud__label">À creuser</span>
					<strong className="tetris-hud__value">{garbageLeft}</strong>
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

			{showLevel && (
				<div className="tetris-hud__level">
					<span className="tetris-hud__label">Level</span>
					<strong className="tetris-hud__value">{level}</strong>
				</div>
			)}
		</div>
	);
}
