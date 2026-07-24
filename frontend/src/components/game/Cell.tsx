import { memo, type CSSProperties } from "react";
import type { GameBoardCell, PieceType } from "../../types/game";

type Props = {
	cell: GameBoardCell;
	size?: number;
	/** Si défini sur une case vide → rendue en pièce fantôme (projection) de cette couleur. */
	ghost?: PieceType;
	/** Mode invisible : opacité de la couche colorée (1 = pleine, 0 = invisible mais solide). */
	opacity?: number;
};

function Cell({ cell, size, ghost, opacity }: Props) {
	const isEmpty = cell === 0;
	const isGhost = isEmpty && ghost != null;
	// --cs = taille de cellule → met à l'échelle le biseau/halo en CSS.
	const style: CSSProperties | undefined = size
		? ({ width: `${size}px`, height: `${size}px`, ["--cs"]: `${size}px` } as CSSProperties)
		: undefined;

	// Mode invisible : une case pleine est rendue en DEUX couches — le fond et le
	// quadrillage d'une case vide dessous, la couleur de la pièce au-dessus. Seule
	// cette couche colorée s'efface : à opacité 0 la case est indiscernable d'une
	// case vide, sinon le "trou" laissé dans la grille trahirait la pièce.
	// La structure est stable dès que `opacity` est fourni (donc pendant tout le mode),
	// pour que la transition CSS puisse animer le fondu sans remontage du DOM.
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
		: `tetris-cell ${isEmpty ? "tetris-cell--empty" : "tetris-cell--filled"}`;
	const dataPiece = isGhost ? ghost : isEmpty ? undefined : cell;

	return <div className={className} data-piece={dataPiece} style={style} />;
}

// Mémoïsé: props primitives → évite de re-render les ~200 cellules à chaque tick
// alors que seules quelques cases (dont la projection) changent. Rendu couleur/
// relief piloté par le CSS via data-piece + le thème équipé (data-recipe).
export default memo(Cell);
