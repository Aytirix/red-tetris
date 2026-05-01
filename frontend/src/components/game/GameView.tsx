import { useEffect, useMemo } from "react";
import type { GameStatePayload } from "../../types/game";
import { emitGameDrop, emitGameMove, emitGameRotate, emitSubscribeSpectator } from "../../socket/events/game";
import GameBoard from "./GameBoard";
import GameHud from "./GameHud";
import NextPiecePreview from "./NextPiecePreview";
import OpponentsColumn from "./OpponentsColumn";

const MAIN_CELL_SIZE = 38;
const MINI_CELL_SIZE = 10;
const MINI_HEADER_PX = 22;
const MINI_GAP_PX = 12;
const MINI_PADDING_PX = 18;

type Props = {
	state: GameStatePayload;
	roomName: string;
	playerName: string;
};

export default function GameView({ state, roomName, playerName }: Props) {
	const isSpectator = state.spectator !== false;
	const spectatorOf = isSpectator ? (state.spectator as string) : null;
	const isSolo = roomName.startsWith("sologame_");
	const showLevel = isSolo;

	const boardRows = state.board.length;
	const mainBoardHeightPx = boardRows * MAIN_CELL_SIZE;

	// Split opponents: left column fills until full (2 minis per row), then right (under next piece)
	const { left, right } = useMemo(() => {
		if (state.opponents.length === 0) return { left: [], right: [] };
		const oppRows = state.opponents[0].board.length;
		const miniHeight = oppRows * MINI_CELL_SIZE + MINI_HEADER_PX + MINI_PADDING_PX;
		const rowsAvail = Math.max(
			1,
			Math.floor((mainBoardHeightPx + MINI_GAP_PX) / (miniHeight + MINI_GAP_PX))
		);
		const fitLeft = rowsAvail * 2;
		return {
			left: state.opponents.slice(0, fitLeft),
			right: state.opponents.slice(fitLeft),
		};
	}, [state.opponents, mainBoardHeightPx]);

	// Keyboard input — only for player (non-spectator)
	useEffect(() => {
		if (isSpectator) return;
		function onKey(e: KeyboardEvent) {
			if (e.repeat && e.code === "Space") return;
			switch (e.code) {
				case "ArrowLeft":
					e.preventDefault();
					emitGameMove("left");
					break;
				case "ArrowRight":
					e.preventDefault();
					emitGameMove("right");
					break;
				case "ArrowDown":
					e.preventDefault();
					emitGameMove("down");
					break;
				case "ArrowUp":
				case "KeyX":
					e.preventDefault();
					emitGameRotate();
					break;
				case "Space":
					e.preventDefault();
					emitGameDrop();
					break;
			}
		}
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	}, [isSpectator]);

	function handleSpectatorSelect(username: string) {
		if (!isSpectator) return;
		emitSubscribeSpectator(roomName, username);
	}

	return (
		<div className="tetris-stage">
			<div className="tetris-stage__inner">
				{/* Left column — first opponents */}
				<aside
					className="tetris-stage__side tetris-stage__side--left"
					style={{ maxHeight: mainBoardHeightPx }}
				>
					<OpponentsColumn
						opponents={left}
						clickable={isSpectator}
						currentSpectatorTarget={spectatorOf}
						onSelect={handleSpectatorSelect}
					/>
				</aside>

				{/* Center — main board with score on top, level top-right */}
				<div className="tetris-stage__center">
					<GameHud
						score={state.score}
						level={state.level}
						showLevel={showLevel}
						spectatorOf={spectatorOf}
					/>
					<div className="tetris-stage__board-wrap">
						<GameBoard board={state.board} cellSize={MAIN_CELL_SIZE} />
					</div>
				</div>

				{/* Right column — next piece, then overflow opponents */}
				<aside
					className="tetris-stage__side tetris-stage__side--right"
					style={{ maxHeight: mainBoardHeightPx }}
				>
					<NextPiecePreview piece={state.nextPiece} />
					<OpponentsColumn
						opponents={right}
						clickable={isSpectator}
						currentSpectatorTarget={spectatorOf}
						onSelect={handleSpectatorSelect}
						scrollable
						className="tetris-opponents--right"
					/>
				</aside>
			</div>
			{/* avoid unused warning for player name in this component scope */}
			<span hidden>{playerName}</span>
		</div>
	);
}
