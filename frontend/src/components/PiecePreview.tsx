import type { CSSProperties } from "react";
import { PIECE_SHAPES, trimShape } from "../config/gameConfig";
import { getPieceTheme, themeCssVars } from "../config/pieceThemes";
import type { PieceType } from "../types/game";

type Props = {
	themeId: string;
	pieces?: PieceType[];
	cellSize?: number;
};

const DEFAULT_PIECES: PieceType[] = ["I", "T", "S", "O", "L", "Z", "J"];

// Aperçu d'un thème: rend quelques tetrominos avec le même rendu CSS que le jeu
// (data-recipe + variables de couleur). Réutilisé dans la boutique.
export default function PiecePreview({ themeId, pieces = DEFAULT_PIECES, cellSize = 16 }: Props) {
	const theme = getPieceTheme(themeId);
	return (
		<div
			className="piece-preview"
			data-recipe={theme.recipe}
			style={themeCssVars(theme) as CSSProperties}
		>
			{pieces.map((p) => (
				<PieceGlyph key={p} type={p} cellSize={cellSize} />
			))}
		</div>
	);
}

function PieceGlyph({ type, cellSize }: { type: PieceType; cellSize: number }) {
	const shape = trimShape(PIECE_SHAPES[type]);
	const cols = shape[0].length;
	const rows = shape.length;
	return (
		<div
			className="piece-preview__glyph"
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
						<div key={`${y}-${x}`} className="piece-preview__hole" />
					),
				),
			)}
		</div>
	);
}
