import type { GameOverPayload } from "../../types/game";

type PlayerProfile = {
	username: string;
	avatar: string;
	faction: "pirate" | "marine" | null;
};

type Props = {
	payload: GameOverPayload | null;
	playerName: string;
	players: PlayerProfile[];
	onLeave: () => void;
	onReplay: () => void;
};

function getInitials(username: string) {
	return username.slice(0, 2).toUpperCase();
}

function getPlayerAvatarSrc(profile: PlayerProfile | undefined) {
	if (!profile?.faction || !profile.avatar) return null;
	return `/img/avatar/${profile.faction}/${profile.avatar}.png`;
}

function podiumSlotClass(index: number) {
	if (index === 0) return "tetris-over__podium-slot tetris-over__podium-slot--first";
	if (index === 1) return "tetris-over__podium-slot tetris-over__podium-slot--second";
	return "tetris-over__podium-slot tetris-over__podium-slot--third";
}

export default function GameOverView({ payload, playerName, players, onLeave, onReplay }: Props) {
	const winner = payload?.winner ?? null;
	const scores = payload?.scores ?? [];
	const profileByName = new Map(players.map((p) => [p.username, p]));
	const rankedScores = scores.map((score, index) => ({
		...score,
		rank: index + 1,
		profile: profileByName.get(score.username),
	}));
	const podiumScores = rankedScores.slice(0, 3);
	const remainingScores = rankedScores.slice(3);
	const soloScore = rankedScores[0] ?? null;
	const isSolo = scores.length === 1;
	const isWinner = winner !== null && winner === playerName;
	const isDraw = winner === null && !isSolo;

	const title = isSolo ? "Résumé de partie" : isDraw ? "Égalité" : isWinner ? "Victoire" : "Game Over";
	const titleClass = isWinner || isSolo ? "tetris-over__title tetris-over__title--win" : "tetris-over__title";

	return (
		<div className="tetris-over">
			<div className="tetris-over__panel">
				<header className="tetris-over__header">
					<span className="tetris-over__eyebrow">{isSolo ? "Solo game" : "Classement final"}</span>
					<h1 className={titleClass}>{title}</h1>
				</header>

				{winner && !isSolo && (
					<p className="tetris-over__winner">
						<span>Gagnant</span>
						<strong>{winner}</strong>
					</p>
				)}

				{isSolo && soloScore && (
					<section className="tetris-over__solo-card">
						<div className="tetris-over__solo-avatar">
							{getPlayerAvatarSrc(soloScore.profile)
								? <img src={getPlayerAvatarSrc(soloScore.profile) ?? ""} alt={soloScore.username} draggable={false} />
								: <span>{getInitials(soloScore.username)}</span>
							}
						</div>
						<div className="tetris-over__solo-copy">
							<span>Score final</span>
							<strong>{soloScore.score.toLocaleString()}</strong>
							<p>{soloScore.username}</p>
						</div>
					</section>
				)}

				{!isSolo && podiumScores.length > 0 && (
					<section className="tetris-over__podium" aria-label="Podium">
						{podiumScores.map((s, index) => {
							const isMe = s.username === playerName;
							const avatarSrc = getPlayerAvatarSrc(s.profile);
							const cls = [
								podiumSlotClass(index),
								isMe ? "tetris-over__podium-slot--me" : "",
							].filter(Boolean).join(" ");

							return (
								<article key={s.username} className={cls}>
									<div className="tetris-over__podium-avatar">
										{avatarSrc
											? <img src={avatarSrc} alt={s.username} draggable={false} />
											: <span>{getInitials(s.username)}</span>
										}
									</div>
									<div className="tetris-over__podium-meta">
										<span className="tetris-over__podium-rank">#{s.rank}</span>
										<strong>{s.username}</strong>
										<span>{s.score.toLocaleString()}</span>
									</div>
									<div className="tetris-over__podium-base" />
								</article>
							);
						})}
					</section>
				)}

				{remainingScores.length > 0 && (
					<ol className="tetris-over__scores" start={4}>
						{remainingScores.map((s) => {
							const isMe = s.username === playerName;
							const avatarSrc = getPlayerAvatarSrc(s.profile);
							const cls = [
								"tetris-over__score",
								isMe ? "tetris-over__score--me" : "",
							].filter(Boolean).join(" ");

							return (
								<li key={s.username} className={cls}>
									<span className="tetris-over__rank">#{s.rank}</span>
									<span className="tetris-over__avatar">
										{avatarSrc
											? <img src={avatarSrc} alt={s.username} draggable={false} />
											: <span>{getInitials(s.username)}</span>
										}
									</span>
									<span className="tetris-over__name">{s.username}</span>
									<strong className="tetris-over__points">{s.score.toLocaleString()}</strong>
								</li>
							);
						})}
					</ol>
				)}

				<div className="tetris-over__actions">
					<button className="button button-ghost" onClick={onLeave}>
						Quitter
					</button>
					<button className="button button-primary" onClick={onReplay}>
						Rejouer
					</button>
				</div>
			</div>
		</div>
	);
}
