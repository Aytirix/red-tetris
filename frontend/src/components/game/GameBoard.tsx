import type { GameBoard as Board } from "../../types/game";
import Cell from "./Cell";

type Props = {
	board: Board;
	cellSize?: number;
};

export default function GameBoard({ board, cellSize = 30 }: Props) {
	const rows = board.length;
	const cols = board[0]?.length ?? 0;
	return (
		<div
			className="tetris-board"
			style={{
				gridTemplateColumns: `repeat(${cols}, ${cellSize}px)`,
				gridTemplateRows: `repeat(${rows}, ${cellSize}px)`,
			}}
		>
			{board.map((row, y) =>
				row.map((cell, x) => (
					<Cell key={`${y}-${x}`} cell={cell} />
				))
			)}
		</div>
	);
}
