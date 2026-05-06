import type { Game } from "../../../core/Game.js";
import type { OpponentBoard, PlayerGameState } from "../../../types/game/gameTypes.js";

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
			}
		})
	}
}

export function emitGameUpdate(playerState: PlayerGameState, state: Map<string, PlayerGameState>) : void {
	const socket = playerState.player.getSocket()
	if (!playerState.currentPiece)
		throw new Error("Missing current piece before game update emit");
	if (!playerState.nextPiece)
		throw new Error("Missing next piece before game update emit");
	socket.emit("game:update", {
		
	})
}
