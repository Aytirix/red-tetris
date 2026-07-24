import type { OpponentBoard } from "../../types/game";
import MiniBoard from "./MiniBoard";

type Props = {
	opponents: OpponentBoard[];
	clickable: boolean;
	currentSpectatorTarget?: string | null;
	onSelect?: (username: string) => void;
	scrollable?: boolean;
	className?: string;
	/** Taille de cellule des mini-plateaux, mise à l'échelle avec le plateau principal. */
	cellSize?: number;
};

export default function OpponentsColumn({
	opponents,
	clickable,
	currentSpectatorTarget,
	onSelect,
	scrollable = false,
	className,
	cellSize = 10,
}: Props) {
	if (opponents.length === 0) return null;

	const cls = [
		"tetris-opponents",
		scrollable ? "tetris-opponents--scroll" : "",
		className ?? "",
	].filter(Boolean).join(" ");

	return (
		<div className={cls}>
			{opponents.map((o) => (
				<MiniBoard
					key={o.username}
					username={o.username}
					board={o.board}
					cellSize={cellSize}
					clickable={clickable}
					active={currentSpectatorTarget === o.username}
					alive={o.alive}
					onClick={clickable && onSelect ? () => onSelect(o.username) : undefined}
				/>
			))}
		</div>
	);
}
