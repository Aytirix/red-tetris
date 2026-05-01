import type { CSSProperties } from "react";
import { getCellTheme } from "../../config/gameConfig";
import type { GameBoardCell } from "../../types/game";

type Props = {
	cell: GameBoardCell;
	size?: number;
};

export default function Cell({ cell, size }: Props) {
	const isEmpty = cell === 0;
	const theme = getCellTheme(cell);

	const style: CSSProperties = {
		width: size ? `${size}px` : undefined,
		height: size ? `${size}px` : undefined,
	};

	if (!isEmpty) {
		style.backgroundImage = theme.gradient ?? theme.image ?? undefined;
		style.backgroundColor = theme.color ?? undefined;
		style.boxShadow = theme.glow;
		style.borderColor = theme.border;
	}

	return (
		<div
			className={`tetris-cell${isEmpty ? " tetris-cell--empty" : " tetris-cell--filled"}`}
			style={style}
		/>
	);
}
