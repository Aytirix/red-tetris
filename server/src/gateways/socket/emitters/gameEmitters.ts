import type { Game } from "../../../core/Game.js";
import type { Board, OpponentBoard, PlayerGameState } from "../../../types/game/gameTypes.js";

function getOpponentBoards(
	state: Map<string, PlayerGameState>,
	currentSocketId: string,
): OpponentBoard[] {
	const opponents: OpponentBoard[] = [];

	for (const [socketId, playerState] of state) {
		if (socketId === currentSocketId)
			continue;
		opponents.push({
			username: playerState.player.getName(),
			board: playerState.board,
		});
	}
	return opponents;
}

export function emitGameStart(state: Map<string, PlayerGameState>, game: Game) : void {
	for (const [socketId, playerState] of state) {
		const socket = playerState.player.getSocket()
		if (!playerState.currentPiece)
			throw new Error("Missing current piece before game start emit");
		if (!playerState.nextPiece)
			throw new Error("Missing next piece before game start emit");
		socket.emit("game:start", {
			"board": playerState.board,
			"opponents": getOpponentBoards(state, socketId),
			"currentPiece": {
				"type": playerState.currentPiece.type
			},
			"nextPiece": {
				"type": playerState.nextPiece.type
			},
			"score": playerState.score,
			"level": 1,
			"spectator": playerState.spectator
		})
	}
}

export function getRenderedBoard(playerState: PlayerGameState): Board {
	const renderedBoard = playerState.board.map(row => [...row]);

	const piece = playerState.currentPiece;
	if (!piece)
		return renderedBoard;

	for (let y = 0; y < piece.shape.length; y++) {
		const pieceRow = piece.shape[y];
		if (!pieceRow)
			continue;

		for (let x = 0; x < pieceRow.length; x++) {
			if (pieceRow[x] !== 1)
				continue;

			const boardY = piece.getY() + y;
			const boardX = piece.getX() + x;
			const boardRow = renderedBoard[boardY];
			if (!boardRow || boardX < 0 || boardX >= boardRow.length)
				continue;

			boardRow[boardX] = piece.type;
		}
	}
	return renderedBoard;
}


export function emitGameUpdate(playerState: PlayerGameState, state: Map<string, PlayerGameState>) : void {
	const socket = playerState.player.getSocket()
	const socketId = playerState.player.getSocketId()
	if (!playerState.currentPiece)
		throw new Error("Missing current piece before game update emit");
	if (!playerState.nextPiece)
		throw new Error("Missing next piece before game update emit");
	socket.emit("game:update", {
		"board": getRenderedBoard(playerState),
		"opponents": getOpponentBoards(state, socketId),
		"currentPiece": {
			"type": playerState.currentPiece.type
		},
		"nextPiece": {
			"type": playerState.nextPiece.type
		},
		"score": playerState.score,
		"level": 1,
		"spectator": playerState.spectator
	})
}
