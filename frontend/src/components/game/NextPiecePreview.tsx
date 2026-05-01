import { PIECE_SHAPES, getCellTheme } from "../../config/gameConfig";
import type { GamePiece } from "../../types/game";

type Props = {
	piece: GamePiece | null;
	cellSize?: number;
};

export default function NextPiecePreview({ piece, cellSize = 28 }: Props) {
	return (
		<div className="tetris-next">
			<span className="tetris-next__label">Prochaine pièce</span>
			<div className="tetris-next__frame">
				{piece ? <Shape type={piece.type} cellSize={cellSize} /> : <span className="tetris-next__empty">—</span>}
			</div>
		</div>
	);
}

function trimShape(shape: number[][]): number[][] {
	let top = shape.length, bottom = -1, left = shape[0].length, right = -1;
	for (let y = 0; y < shape.length; y++) {
		for (let x = 0; x < shape[y].length; x++) {
			if (shape[y][x]) {
				if (y < top) top = y;
				if (y > bottom) bottom = y;
				if (x < left) left = x;
				if (x > right) right = x;
			}
		}
	}
	if (bottom === -1) return shape;
	const out: number[][] = [];
	for (let y = top; y <= bottom; y++) out.push(shape[y].slice(left, right + 1));
	return out;
}

function Shape({ type, cellSize }: { type: GamePiece["type"]; cellSize: number }) {
	const shape = trimShape(PIECE_SHAPES[type]);
	const rows = shape.length;
	const cols = shape[0].length;
	const theme = getCellTheme(type);

	return (
		<div
			className="tetris-next__grid"
			style={{
				gridTemplateColumns: `repeat(${cols}, ${cellSize}px)`,
				gridTemplateRows: `repeat(${rows}, ${cellSize}px)`,
			}}
		>
			{shape.map((row, y) =>
				row.map((v, x) =>
					v ? (
						<div
							key={`${y}-${x}`}
							className="tetris-cell tetris-cell--filled"
							style={{
								background: theme.gradient ?? theme.color,
								boxShadow: theme.glow,
								borderColor: theme.border,
							}}
						/>
					) : (
						<div key={`${y}-${x}`} className="tetris-next__hole" />
					)
				)
			)}
		</div>
	);
}
