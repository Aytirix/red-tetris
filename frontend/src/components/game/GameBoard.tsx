import { useMemo } from "react";
import type { GameBoard as Board, GhostCell, PieceType } from "../../types/game";
import Cell from "./Cell";

type Props = {
	board: Board;
	cellSize?: number;
	ghost?: GhostCell[];
	ghostPiece?: PieceType | null;
};

export default function GameBoard({ board, cellSize = 30, ghost, ghostPiece }: Props) {
	const rows = board.length;
	const cols = board[0]?.length ?? 0;

	const ghostSet = useMemo(
		() => new Set((ghost ?? []).map((g) => `${g.y}-${g.x}`)),
		[ghost],
	);

	return (
		<div
			className="tetris-board"
			style={{
				gridTemplateColumns: `repeat(${cols}, ${cellSize}px)`,
				gridTemplateRows: `repeat(${rows}, ${cellSize}px)`,
			}}
		>
			{board.map((row, y) =>
				row.map((cell, x) => {
					const isGhost = cell === 0 && ghostPiece != null && ghostSet.has(`${y}-${x}`);
					return (
						<Cell
							key={`${y}-${x}`}
							cell={cell}
							size={cellSize}
							ghost={isGhost ? ghostPiece : undefined}
						/>
					);
				}),
			)}
		</div>
	);
}
