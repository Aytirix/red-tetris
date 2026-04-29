import type { Game } from "../../../core/Game.js";
import type { PlayerGameState } from "../../../types/game/gameTypes.js";

export function emitGameStart(state: Map<string, PlayerGameState>, game: Game) : void {
	for (const [, playerState] of state) {
		const socket = playerState.player.getSocket()
		if (!playerState.currentPiece)
			throw new Error("Missing current piece before game start emit");
		if (!playerState.nextPiece)
			throw new Error("Missing next piece before game start emit");
		socket.emit("game:start", {
			"board": playerState.board,
			"currentPiece": {
				"type": playerState.currentPiece.type,
				"x": playerState.currentPiece.getX(),
				"y": playerState.currentPiece.getY(),
				"rotation": playerState.currentPiece.getRotate()
			},
			"nextPiece": {
				"type": playerState.nextPiece.type,
				"rotation": playerState.nextPiece.getRotate()
			}
		})
	}
}

export function emitGameUpdate(playerState: PlayerGameState) : void {
	const socket = playerState.player.getSocket()
	socket.emit("game:update", {
		
	})
}
