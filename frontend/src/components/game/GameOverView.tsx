import type { GameOverPayload } from "../../types/game";

type Props = {
	payload: GameOverPayload | null;
	playerName: string;
	onLeave: () => void;
};

export default function GameOverView({ payload, playerName, onLeave }: Props) {
	const winner = payload?.winner ?? null;
	const scores = payload?.scores ?? [];
	const isWinner = winner !== null && winner === playerName;
	const isDraw = winner === null;

	const title = isDraw ? "Égalité" : isWinner ? "Victoire" : "Game Over";
	const titleClass = isWinner ? "tetris-over__title tetris-over__title--win" : "tetris-over__title";

	return (
		<div className="tetris-over">
			<div className="tetris-over__panel">
				<h1 className={titleClass}>{title}</h1>

				{winner && (
					<p className="tetris-over__winner">
						<span>Gagnant</span>
						<strong>{winner}</strong>
					</p>
				)}

				{scores.length > 0 && (
					<ol className="tetris-over__scores">
						{scores.map((s, i) => {
							const isMe = s.username === playerName;
							const isFirst = i === 0;
							const cls = [
								"tetris-over__score",
								isMe ? "tetris-over__score--me" : "",
								isFirst ? "tetris-over__score--top" : "",
							].filter(Boolean).join(" ");
							return (
								<li key={s.username} className={cls}>
									<span className="tetris-over__rank">#{i + 1}</span>
									<span className="tetris-over__name">{s.username}</span>
									<strong className="tetris-over__points">{s.score.toLocaleString()}</strong>
								</li>
							);
						})}
					</ol>
				)}

				<div className="tetris-over__actions">
					<button className="button button-primary" onClick={onLeave}>
						Retour au dashboard
					</button>
				</div>
			</div>
		</div>
	);
}
