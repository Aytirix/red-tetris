import { useMemo, type CSSProperties } from "react";
import type { CascadeFall, GameBoard as Board, GhostCell, PieceType } from "../../types/game";
import Cell from "./Cell";

/** Traînée de vitesse laissée par une pièce lâchée d'un coup, dans UNE colonne. */
export type DropStreak = {
	/** Colonne du plateau. */
	x: number;
	/** Première et dernière rangée couvertes par la traînée (incluses). */
	fromY: number;
	toY: number;
};

/** Décompte avant verrouillage d'une pièce posée sur la pile. */
export type LockTimer = {
	/** Change à chaque nouvelle pièce posée : sert de `key` pour repartir de zéro. */
	id: number;
	/** Durée du sursis, fixée au moment où la pièce se pose. */
	ms: number;
	/** Cases de la pièce posée (= sa projection, qui coïncide avec elle). */
	cells: GhostCell[];
	piece: PieceType | null;
};

export type DropTrail = {
	/** Change à chaque chute : sert de `key` pour rejouer l'animation. */
	id: number;
	streaks: DropStreak[];
	/** Pièce lâchée : donne sa couleur à la traînée. */
	piece: PieceType | null;
};

/** `gap` et `padding` de `.tetris-board`, nécessaires au placement de la traînée. */
const BOARD_GAP = 2;
const BOARD_PADDING = 2;

type Props = {
	board: Board;
	cellSize?: number;
	ghost?: GhostCell[];
	ghostPiece?: PieceType | null;
	/** Mode invisible : opacité par cellule, alignée sur `board`. */
	fade?: number[][] | null;
	/** Traînée de vitesse à afficher (chute instantanée), null au repos. */
	dropTrail?: DropTrail | null;
	/** Fin de l'animation de traînée : l'appelant remet `dropTrail` à null. */
	onDropTrailEnd?: () => void;
	/** Décompte avant verrouillage, null tant que la pièce peut descendre. */
	lockTimer?: LockTimer | null;
	/** Mode Cascade : blocs qui viennent de retomber, à animer une fois. */
	cascade?: CascadeFall | null;
};

export default function GameBoard({ board, cellSize = 30, ghost, ghostPiece, fade, dropTrail, onDropTrailEnd, lockTimer, cascade }: Props) {
	const rows = board.length;
	const cols = board[0]?.length ?? 0;

	const ghostSet = useMemo(
		() => new Set((ghost ?? []).map((g) => `${g.y}-${g.x}`)),
		[ghost],
	);

	const fallMap = useMemo(
		() => new Map((cascade?.cells ?? []).map((c) => [`${c.y}-${c.x}`, c.rows])),
		[cascade],
	);

	const grid = (
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
					const cellOpacity = fade?.[y]?.[x];
					const fallRows = fallMap.get(`${y}-${x}`);
					return (
						<Cell
							// La `key` porte l'identifiant de la retombée pour les cases qui
							// tombent : reposer la même classe ne relance PAS une animation CSS,
							// il faut que React remonte l'élément.
							key={fallRows ? `${y}-${x}-c${cascade?.id}` : `${y}-${x}`}
							cell={cell}
							size={cellSize}
							ghost={isGhost ? ghostPiece : undefined}
							opacity={cellOpacity}
							fallRows={fallRows}
						/>
					);
				}),
			)}
		</div>
	);

	// La traînée est posée en SURCOUCHE absolue, pas dans la grille : un enfant placé
	// explicitement dans un `grid-template` plein décalerait les cellules auto-placées.
	// La couche est TOUJOURS rendue, même vide : la faire apparaître seulement pendant
	// la chute remonterait la grille (et ses ~200 cellules) à chaque pièce lâchée.
	const pitch = cellSize + BOARD_GAP;
	return (
		<div className="tetris-board-layer">
			{grid}
			{dropTrail && dropTrail.streaks.length > 0 && (
				<div
					key={dropTrail.id}
					className="tetris-drop-trail"
					aria-hidden="true"
					onAnimationEnd={onDropTrailEnd}
				>
					{dropTrail.streaks.map((streak) => (
						<span
							key={streak.x}
							className="tetris-drop-trail__streak"
							data-piece={dropTrail.piece ?? undefined}
							style={{
								left: `${BOARD_PADDING + streak.x * pitch}px`,
								top: `${BOARD_PADDING + streak.fromY * pitch}px`,
								width: `${cellSize}px`,
								height: `${(streak.toY - streak.fromY + 1) * pitch - BOARD_GAP}px`,
								["--cs"]: `${cellSize}px`,
							} as CSSProperties}
						/>
					))}
				</div>
			)}
			{lockTimer && lockTimer.cells.length > 0 && (
				<div key={lockTimer.id} className="tetris-lock-timer" aria-hidden="true">
					{lockTimer.cells.map((cell, index) => (
						<span
							// Indexé, PAS positionné : glisser la pièce pendant le sursis doit
							// déplacer les cases sans relancer le remplissage.
							key={index}
							className="tetris-lock-timer__cell"
							data-piece={lockTimer.piece ?? undefined}
							style={{
								left: `${BOARD_PADDING + cell.x * pitch}px`,
								top: `${BOARD_PADDING + cell.y * pitch}px`,
								width: `${cellSize}px`,
								height: `${cellSize}px`,
								["--cs"]: `${cellSize}px`,
								["--lock-ms"]: `${lockTimer.ms}ms`,
							} as CSSProperties}
						/>
					))}
				</div>
			)}
		</div>
	);
}
