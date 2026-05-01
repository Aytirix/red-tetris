type Props = {
	score: number;
	level: number;
	showLevel: boolean;
	spectatorOf?: string | null;
};

export default function GameHud({ score, level, showLevel, spectatorOf }: Props) {
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
			{showLevel && (
				<div className="tetris-hud__level">
					<span className="tetris-hud__label">Level</span>
					<strong className="tetris-hud__value">{level}</strong>
				</div>
			)}
		</div>
	);
}
