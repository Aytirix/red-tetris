import type { Game } from "../../../core/Game.js";
import { BOARD_HEIGHT, BOARD_WIDTH } from "../../../types/game/gameTypes.js";
import type { Player } from "../../../core/Player.js";
import type { Socket } from "socket.io";
import type { Board, Cell, OpponentBoard, PlayerGameState } from "../../../types/game/gameTypes.js";

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
import { spectatorSocketStore } from "../spectatorSocketStore.js";
import { userSocketStore } from "../userSocketStore.js";

/**
 * Spectre d'un plateau, tel que l'impose le sujet: pour chaque colonne on ne garde que
 * la hauteur du bloc le plus haut, remplie jusqu'en bas avec un marqueur neutre.
 * Un joueur ne doit voir ni les couleurs de ses adversaires, ni les trous sous leur pile.
 */
export function getSpectrumBoard(board: Board): Board {
	const spectrum: Board = Array.from(
		{ length: BOARD_HEIGHT },
		() => Array.from({ length: BOARD_WIDTH }, () => 0 as Cell),
	);

	for (let x = 0; x < BOARD_WIDTH; x++) {
		let top = -1;
		for (let y = 0; y < BOARD_HEIGHT; y++) {
			const row = board[y];
			if (row && row[x] !== 0) {
				top = y;
				break;
			}
		}
		if (top < 0)
			continue;
		for (let y = top; y < BOARD_HEIGHT; y++) {
			const row = spectrum[y];
			if (row)
				row[x] = "spectrum";
		}
	}
	return spectrum;
}

function getOpponentBoards(
	state: Map<string, PlayerGameState>,
	currentSocketId: string,
	options: { spectatorSocketId?: string; fullBoards?: boolean } = {},
): OpponentBoard[] {
	const opponents: OpponentBoard[] = [];

	for (const [socketId, playerState] of state) {
		if (socketId === currentSocketId)
			continue;
		// Un spectateur (ex: joueur mort) ne doit pas se voir lui-même sur le côté.
		if (options.spectatorSocketId && socketId === options.spectatorSocketId)
			continue;
		opponents.push({
			username: playerState.player.getName(),
			// Un joueur en jeu ne recoit que le spectre; un spectateur voit les vrais plateaux.
			board: options.fullBoards ? playerState.board : getSpectrumBoard(playerState.board),
			alive: playerState.isAlive,
		});
	}
	return opponents;
}

// Decompte de lancement (3-2-1) diffuse a tous les joueurs de la room, avant que la
// partie ne demarre reellement. value = le nombre a afficher (3, puis 2, puis 1).
export function emitCountdown(players: Player[], value: number) : void {
	for (const player of players)
		player.getSocket().emit("game:countdown", { value })
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

export function emitSpectatorGame(socket: Socket, game: Game, player: Player) : void {
	const playerState = game.getPlayerStateBySocketId(player.getSocketId())
	if (!playerState)
		return
	if (!playerState.currentPiece)
		throw new Error("Missing current piece before spectator game emit");
	if (!playerState.nextPiece)
		throw new Error("Missing next piece before spectator game emit");
	socket.emit("game:SpectatorGame", {
		"board": getRenderedBoard(playerState),
		"opponents": getOpponentBoards(game.getState(), player.getSocketId(), {
			spectatorSocketId: socket.id,
			fullBoards: true,
		}),
		"currentPiece": {
			"type": playerState.currentPiece.type
		},
		"nextPiece": {
			"type": playerState.nextPiece.type
			},
			"score": playerState.score,
			"level": playerState.level,
			"spectator": player.getName()
	})
}

export function emitSpectatorForPlayer(playerState: PlayerGameState, state: Map<string, PlayerGameState>) : void {
	for (const [spectatorSocketId, subscription] of spectatorSocketStore) {
		if (subscription.game.getState() !== state)
			continue
		if (subscription.player.getSocketId() !== playerState.player.getSocketId())
			continue
		const spectatorSession = userSocketStore.get(spectatorSocketId)
		if (!spectatorSession)
			continue
		emitSpectatorGame(spectatorSession.socket, subscription.game, subscription.player)
	}
}

// Élimination individuelle: un joueur a topped-out alors que la partie continue
// (d'autres joueurs sont encore vivants). On le notifie SEULEMENT lui, et on lui
// indique un joueur vivant à spectater par défaut (≠ lui-même).
export function emitPlayerEliminated(playerState: PlayerGameState, state: Map<string, PlayerGameState>) : void {
	let spectate: string | null = null
	for (const other of state.values()) {
		if (other.isAlive && other.player.getSocketId() !== playerState.player.getSocketId()) {
			spectate = other.player.getName()
			break
		}
	}
	playerState.player.getSocket().emit("game:eliminated", {
		"score": playerState.score,
		"level": playerState.level,
		"spectate": spectate,
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

	// Les spectateurs purs (arrives en cours de partie, jamais presents dans `state`)
	// doivent eux aussi recevoir la fin de partie: sans ca ils restent bloques sur un
	// plateau fige, sans recap ni retour au lobby.
	for (const [spectatorSocketId, subscription] of spectatorSocketStore) {
		if (subscription.game.getState() !== state)
			continue
		// Un joueur ELIMINE est a la fois dans `state` et abonne comme spectateur:
		// il vient deja d'etre notifie par la boucle ci-dessus, on ne double pas.
		if (state.has(spectatorSocketId))
			continue
		const spectatorSession = userSocketStore.get(spectatorSocketId)
		if (!spectatorSession)
			continue
		// Un spectateur n'a pas de niveau propre: seuls winner/scores sont exploites.
		spectatorSession.socket.emit("game:over", { winner, scores })
	}
}
