import type { GameBoard as Board } from "../../types/game";
import Cell from "./Cell";

type Props = {
	username: string;
	board: Board;
	cellSize?: number;
	clickable?: boolean;
	active?: boolean;
	onClick?: () => void;
};

export default function MiniBoard({
	username,
	board,
	cellSize = 10,
	clickable = false,
	active = false,
	onClick,
}: Props) {
	const rows = board.length;
	const cols = board[0]?.length ?? 0;

	const className = [
		"tetris-mini",
		clickable ? "tetris-mini--clickable" : "",
		active ? "tetris-mini--active" : "",
	].filter(Boolean).join(" ");

	const Wrapper = clickable ? "button" : "div";

	return (
		<Wrapper
			className={className}
			onClick={clickable ? onClick : undefined}
			type={clickable ? "button" : undefined}
		>
			<span
				className="tetris-mini__name"
				style={{ maxWidth: cols * cellSize }}
			>
				{username}
			</span>
			<div
				className="tetris-mini__grid"
				style={{
					gridTemplateColumns: `repeat(${cols}, ${cellSize}px)`,
					gridTemplateRows: `repeat(${rows}, ${cellSize}px)`,
				}}
			>
				{board.map((row, y) =>
					row.map((cell, x) => (
						<Cell key={`${y}-${x}`} cell={cell} size={cellSize} />
					))
				)}
			</div>
		</Wrapper>
	);
}
