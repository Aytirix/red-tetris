import type { Game } from "../../../core/Game.js";
import { BOARD_HEIGHT, BOARD_WIDTH } from "../../../types/game/gameTypes.js";
import type { Board, OpponentBoard, PlayerGameState } from "../../../types/game/gameTypes.js";

type GhostCell = { x: number; y: number };

// Projection d'atterrissage (ghost piece): descend la pièce courante au plus bas
// possible SANS la muter, et renvoie les cellules occupées à cet endroit.
// Utilise playerState.board (verrouillé, sans la pièce) pour la collision.
function getGhostCells(playerState: PlayerGameState): GhostCell[] {
	const piece = playerState.currentPiece;
	if (!piece)
		return [];
	const board = playerState.board;

	const collides = (offY: number): boolean => {
		for (let y = 0; y < piece.shape.length; y++) {
			const row = piece.shape[y];
			if (!row)
				continue;
			for (let x = 0; x < row.length; x++) {
				if (row[x] !== 1)
					continue;
				const ny = piece.getY() + y + offY;
				const nx = piece.getX() + x;
				if (nx < 0 || nx >= BOARD_WIDTH || ny < 0 || ny >= BOARD_HEIGHT)
					return true;
				const boardRow = board[ny];
				if (!boardRow || boardRow[nx] !== 0)
					return true;
			}
		}
		return false;
	};

	let drop = 0;
	while (!collides(drop + 1))
		drop++;

	const cells: GhostCell[] = [];
	for (let y = 0; y < piece.shape.length; y++) {
		const row = piece.shape[y];
		if (!row)
			continue;
		for (let x = 0; x < row.length; x++) {
			if (row[x] === 1)
				cells.push({ x: piece.getX() + x, y: piece.getY() + y + drop });
		}
	}
	return cells;
}

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
				"level": playerState.level,
				"spectator": playerState.spectator,
				"ghost": getGhostCells(playerState)
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
			"level": playerState.level,
			"spectator": playerState.spectator,
			"ghost": getGhostCells(playerState)
	})
}

export function emitGameOver(state: Map<string, PlayerGameState>, winner: string | null) : void {
	const scores = [...state.values()]
		.map((playerState) => ({
			username: playerState.player.getName(),
			score: playerState.score,
		}))
		.sort((a, b) => b.score - a.score)

	for (const playerState of state.values()) {
		playerState.player.getSocket().emit("game:over", {
			winner,
			scores,
			level: playerState.level,
		})
	}
}
