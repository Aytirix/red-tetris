import { memo, type CSSProperties } from "react";
import type { GameBoardCell, PieceType } from "../../types/game";

type Props = {
	cell: GameBoardCell;
	size?: number;
	/** Si défini sur une case vide → rendue en pièce fantôme (projection) de cette couleur. */
	ghost?: PieceType;
};

function Cell({ cell, size, ghost }: Props) {
	const isEmpty = cell === 0;
	const isGhost = isEmpty && ghost != null;
	// --cs = taille de cellule → met à l'échelle le biseau/halo en CSS.
	const style: CSSProperties | undefined = size
		? ({ width: `${size}px`, height: `${size}px`, ["--cs"]: `${size}px` } as CSSProperties)
		: undefined;

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
