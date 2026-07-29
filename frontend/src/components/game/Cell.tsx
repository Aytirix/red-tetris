import { memo, type CSSProperties } from "react";
import type { GameBoardCell, PieceType } from "../../types/game";

type Props = {
	cell: GameBoardCell;
	size?: number;
	/** Si défini sur une case vide → rendue en pièce fantôme (projection) de cette couleur. */
	ghost?: PieceType;
	/** Mode invisible : opacité de la couche colorée (1 = pleine, 0 = invisible mais solide). */
	opacity?: number;
	/** Mode Cascade : nombre de rangees que la case vient de descendre. */
	fallRows?: number;
};

function Cell({ cell, size, ghost, opacity, fallRows }: Props) {
	const isEmpty = cell === 0;
	const isGhost = isEmpty && ghost != null;
	const isFalling = !isEmpty && fallRows != null && fallRows > 0;
	const style: CSSProperties | undefined = size || isFalling
		? ({
			...(size ? { width: `${size}px`, height: `${size}px`, ["--cs"]: `${size}px` } : {}),
			...(isFalling
				? {
					["--fall-rows"]: fallRows,
					["--fall-ms"]: `${Math.min(320, 90 + fallRows * 28)}ms`,
				}
				: {}),
		} as CSSProperties)
		: undefined;
	if (!isEmpty && opacity != null) {
		return (
			<div className="tetris-cell tetris-cell--empty tetris-cell--fading" style={style}>
				<div
					className="tetris-cell tetris-cell--filled tetris-cell__piece"
					data-piece={cell}
					style={{ opacity }}
				/>
			</div>
		);
	}

	const className = isGhost
		? "tetris-cell tetris-cell--ghost"
		: `tetris-cell ${isEmpty ? "tetris-cell--empty" : "tetris-cell--filled"}${isFalling ? " tetris-cell--falling" : ""}`;
	const dataPiece = isGhost ? ghost : isEmpty ? undefined : cell;

	return <div className={className} data-piece={dataPiece} style={style} />;
}
export default memo(Cell);
