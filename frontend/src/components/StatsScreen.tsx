import { useEffect, useMemo, useState } from "react";
import { useSocket } from "../contexts/SocketContext";
import { emitStatsGet } from "../socket/events/stats";
import {
	EMPTY_STATS,
	normalizeStatsError,
	normalizeStatsState,
	type FactionName,
	type LeaderboardEntry,
	type ModeLeaderboard,
	type StatsState,
} from "../socket/statsState";

const FACTION_LABEL: Record<FactionName, string> = { marine: "Marine", pirate: "Pirate" };
const FACTION_EMOJI: Record<FactionName, string> = { marine: "⚓", pirate: "🏴‍☠️" };

const MODE_LABEL: Record<string, string> = {
	classique: "Classique",
	sprint: "Sprint",
	ultra: "Ultra",
	suddendeath: "Sudden Death",
	invisible: "Invisible",
};

function modeLabel(mode: string): string {
	return MODE_LABEL[mode] ?? mode.charAt(0).toUpperCase() + mode.slice(1);
}

// Durée lisible: on n'affiche que les deux plus grosses unités pertinentes.
function formatDuration(ms: number): string {
	const totalSec = Math.floor(Math.max(0, ms) / 1000);
	const h = Math.floor(totalSec / 3600);
	const m = Math.floor((totalSec % 3600) / 60);
	const s = totalSec % 60;
	if (h > 0) return `${h} h ${m} min`;
	if (m > 0) return `${m} min ${s} s`;
	return `${s} s`;
}

function num(value: number): string {
	return value.toLocaleString("fr-FR");
}

function StatCard({ label, value, hint }: { label: string; value: string; hint?: string }) {
	return (
		<div className="stats-card">
			<span className="stats-card__value">{value}</span>
			<span className="stats-card__label">{label}</span>
			{hint && <span className="stats-card__hint">{hint}</span>}
		</div>
	);
}

function factionTag(faction: FactionName | null) {
	if (!faction) return null;
	return (
		<span className={`stats-tag stats-tag--${faction}`}>
			{FACTION_EMOJI[faction]} {FACTION_LABEL[faction]}
		</span>
	);
}

function Leaderboard({
	title,
	unit,
	entries,
}: {
	title: string;
	unit: string;
	entries: LeaderboardEntry[];
}) {
	return (
		<section className="stats-board" aria-label={title}>
			<h4 className="stats-board__title">{title}</h4>
			{entries.length === 0 ? (
				<p className="stats-empty">Aucune donnée pour l'instant.</p>
			) : (
				<ol className="stats-board__list">
					{entries.map((entry, index) => (
						<li key={`${entry.username}-${index}`} className="stats-board__row">
							<span className="stats-board__rank">{index + 1}</span>
							<span className="stats-board__name">
								{entry.username}
								{factionTag(entry.faction)}
							</span>
							<span className="stats-board__value">
								{num(entry.value)} {unit}
							</span>
						</li>
					))}
				</ol>
			)}
		</section>
	);
}

// Tableau du classement d'un mode (rôles ARIA « table » sur des div : la contrainte
// sujet interdit la balise <table>, pas la sémantique d'accessibilité).
function ModeTable({ board }: { board: ModeLeaderboard }) {
	return (
		<div className="stats-modetable" role="table" aria-label={`Classement ${modeLabel(board.mode)}`}>
			<div className="stats-modetable__row stats-modetable__row--head" role="row">
				<span role="columnheader">#</span>
				<span role="columnheader">Joueur</span>
				<span role="columnheader">Score</span>
				<span role="columnheader">Parties</span>
				<span role="columnheader">Lignes</span>
				<span role="columnheader">Tetris</span>
			</div>
			{board.entries.map((entry, index) => (
				<div key={entry.username} className="stats-modetable__row" role="row">
					<span className="stats-board__rank" role="cell">{index + 1}</span>
					<span className="stats-modetable__name" role="cell">
						{entry.username}
						{factionTag(entry.faction)}
					</span>
					<span role="cell">{num(entry.bestScore)}</span>
					<span role="cell">{num(entry.games)}</span>
					<span role="cell">{num(entry.lines)}</span>
					<span role="cell">{num(entry.tetris)}</span>
				</div>
			))}
		</div>
	);
}

// Écran des statistiques, rendu À L'INTÉRIEUR du dashboard (même fond parallax).
// Contrainte sujet: aucune balise <table> — tout est bâti en grille CSS / listes.
export default function StatsScreen() {
	const { socket } = useSocket();
	const [stats, setStats] = useState<StatsState>(EMPTY_STATS);
	const [loaded, setLoaded] = useState(false);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		function onState(raw: unknown) {
			const next = normalizeStatsState(raw);
			if (!next) return;
			setStats(next);
			setLoaded(true);
			setError(null);
		}
		function onError(raw: unknown) {
			const message = normalizeStatsError(raw);
			if (message) setError(message);
		}
		function onConnect() {
			emitStatsGet();
		}
		socket.on("stats:State", onState);
		socket.on("stats:Error", onError);
		socket.on("connect", onConnect);
		emitStatsGet();
		return () => {
			socket.off("stats:State", onState);
			socket.off("stats:Error", onError);
			socket.off("connect", onConnect);
		};
	}, [socket]);

	const { me, leaderboards, factions, modes } = stats;

	// Le camp qui mène, mis en avant (« le meilleur camp »).
	const leader = factions.leader;
	const leaderAgg = useMemo(
		() => factions.factions.find((f) => f.faction === leader) ?? null,
		[factions, leader],
	);

	// Mode sélectionné dans le classement par mode ; à défaut, le premier mode dispo.
	const [selectedMode, setSelectedMode] = useState<string | null>(null);
	const activeMode = modes.find((m) => m.mode === selectedMode) ?? modes[0] ?? null;

	return (
		<div className="stats-screen">
			<div className="stats-screen__head">
				<p className="eyebrow">Statistiques</p>
				<h2 className="stats-screen__title">Tableau de bord</h2>
				<p className="stats-screen__hint">
					Tes performances, les classements globaux et la rivalité des camps.
				</p>
			</div>

			{error && (
				<div className="stats-error" role="alert">
					{error}
				</div>
			)}

			{/* ── A. Statistiques individuelles ── */}
			<section className="stats-section" aria-label="Mes statistiques">
				<h3 className="stats-section__title">Mes statistiques</h3>
				{me ? (
					<div className="stats-cards">
						<StatCard label="Parties jouées" value={num(me.totalGames)} />
						<StatCard
							label="Victoires / Défaites"
							value={`${num(me.wins)} / ${num(me.losses)}`}
							hint={`${Math.round(me.winRate * 100)} % de victoires`}
						/>
						<StatCard label="Meilleur score" value={num(me.bestScore)} />
						<StatCard label="Lignes totales" value={num(me.totalLines)} />
						<StatCard label="Tetris" value={num(me.totalTetris)} hint="4 lignes d'un coup" />
						<StatCard label="Temps de jeu" value={formatDuration(me.playtimeMs)} />
					</div>
				) : (
					<p className="stats-empty">
						{loaded
							? "Joue une partie pour voir apparaître tes statistiques ici."
							: "Chargement…"}
					</p>
				)}
			</section>

			{/* ── C. Le meilleur camp ── */}
			<section className="stats-section" aria-label="Rivalité des camps">
				<h3 className="stats-section__title">Le meilleur camp</h3>
				{leader && leaderAgg ? (
					<div className={`stats-leader stats-leader--${leader}`}>
						<span className="stats-leader__crown">👑</span>
						<span className="stats-leader__name">
							{FACTION_EMOJI[leader]} {FACTION_LABEL[leader]}
						</span>
						<span className="stats-leader__detail">{num(leaderAgg.wins)} victoires cumulées</span>
					</div>
				) : (
					<p className="stats-empty">Aucun camp en tête pour l'instant — à égalité ou sans victoire.</p>
				)}
				{factions.factions.length > 0 && (
					<div className="stats-factions">
						{factions.factions.map((f) => (
							<div key={f.faction} className={`stats-faction stats-faction--${f.faction}`}>
								<div className="stats-faction__head">
									<span className="stats-faction__name">
										{FACTION_EMOJI[f.faction]} {FACTION_LABEL[f.faction]}
									</span>
									{leader === f.faction && <span className="stats-faction__badge">En tête</span>}
								</div>
								<div className="stats-faction__grid">
									<StatCard label="Victoires" value={num(f.wins)} />
									<StatCard label="Défaites" value={num(f.losses)} />
									<StatCard label="Tetris" value={num(f.tetris)} />
									<StatCard label="Lignes" value={num(f.lines)} />
									<StatCard label="Meilleur score" value={num(f.bestScore)} />
								</div>
							</div>
						))}
					</div>
				)}
			</section>

			{/* ── B. Classements globaux ── */}
			<section className="stats-section" aria-label="Classements globaux">
				<h3 className="stats-section__title">Classements</h3>
				<div className="stats-boards">
					<Leaderboard title="🏆 Meilleurs scores" unit="pts" entries={leaderboards.topScore} />
					<Leaderboard title="⚔️ Victoires" unit="V" entries={leaderboards.topWins} />
					<Leaderboard title="🧱 Tetris" unit="" entries={leaderboards.topTetris} />
					<Leaderboard title="📏 Lignes" unit="" entries={leaderboards.topLines} />
				</div>
			</section>

			{/* ── D. Classement par mode de jeu (sélecteur + tableau du mode) ── */}
			<section className="stats-section" aria-label="Classement par mode">
				<h3 className="stats-section__title">Classement par mode</h3>
				{modes.length === 0 || !activeMode ? (
					<p className="stats-empty">Aucune partie enregistrée pour l'instant.</p>
				) : (
					<>
						<div className="stats-modetabs" role="tablist" aria-label="Choix du mode">
							{modes.map((m) => {
								const isActive = activeMode.mode === m.mode;
								return (
									<button
										key={m.mode}
										type="button"
										role="tab"
										aria-selected={isActive}
										className={`stats-modetab${isActive ? " stats-modetab--active" : ""}`}
										onClick={() => setSelectedMode(m.mode)}
									>
										{modeLabel(m.mode)}
									</button>
								);
							})}
						</div>
						<ModeTable board={activeMode} />
					</>
				)}
			</section>
		</div>
	);
}
