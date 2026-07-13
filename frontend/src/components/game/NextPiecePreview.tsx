import type { CSSProperties } from "react";
import { PIECE_SHAPES, trimShape } from "../../config/gameConfig";
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

function Shape({ type, cellSize }: { type: GamePiece["type"]; cellSize: number }) {
	const shape = trimShape(PIECE_SHAPES[type]);
	const rows = shape.length;
	const cols = shape[0].length;

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
							data-piece={type}
							style={{ ["--cs"]: `${cellSize}px` } as CSSProperties}
						/>
					) : (
						<div key={`${y}-${x}`} className="tetris-next__hole" />
					),
				),
			)}
		</div>
	);
}
