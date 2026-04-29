import { BOARD_HEIGHT, BOARD_WIDTH, type Board, type Cell, type PieceType, type PlayerGameState } from "../types/game/gameTypes.js";
import type { Player } from "./Player.js";
import { pieces, PIECES_TYPES } from "../types/game/piecesGameTypes.js";
import { emitGameStart } from "../gateways/socket/emitters/gameEmitters.js";
import { Piece } from "./Piece.js";

export class Game {
	public mode: "Classique" | "Ultra" | "Sprint"
	public players: Player[];
	private state: Map<string, PlayerGameState>;
	private pieceQueue: PieceType[];
	constructor (mode: "Classique" | "Ultra" | "Sprint", players: Player[]) {
		this.mode = mode;
		this.players = players;
		this.state = new Map()
		this.pieceQueue = this.randomPiece()
		for (const player of players) {
			this.state.set(player.getSocketId(), {
				board: this.createBoard(),//fonction create board,
				score: 0,
				pieceIndex: 0,
				player: player,
				isAlive: true,
			});
			player.setGame(this)
			player.setInGame(true)
		}
	}
	createBoard() : Board {
		const board: Board = Array.from({length: BOARD_HEIGHT}, () => Array.from({length: BOARD_WIDTH}, () => 0))
		return board;
	}
	getPieceQueue(index: number) : PieceType {
		const piece = this.pieceQueue[index]
		if (!piece)
			throw new Error("No piece type available in PIECES_TYPES")
		return piece
	}
	randomPiece() : PieceType[] {
		const pieces: PieceType[] = []
		for (let i = 0; i < 20; i++) {
			const randomIndex = Math.floor(Math.random() * PIECES_TYPES.length)
			const randomPiece : PieceType | undefined = PIECES_TYPES[randomIndex]
			if (!randomPiece)
				throw new Error("No piece type available in PIECES_TYPES")
			pieces.push(randomPiece)
		}
		return pieces
	}
	start() : void {
		for (const [, playerStat] of this.state) {
			this.spawnPiece(playerStat)
		}
		emitGameStart(this.state, this)
		const intervalID = setInterval(() => {
			this.tick()
		},1000)
	}
	spawnPiece(playerStat: PlayerGameState) : void {
		const currentType = this.getPieceQueue(playerStat.pieceIndex)
		const nextType = this.getPieceQueue((playerStat.pieceIndex + 1))
		const currentShape = pieces[currentType]
		const nextShape = pieces[nextType]
		playerStat.currentPiece = new Piece(currentShape, currentType)
		playerStat.nextPiece = new Piece(nextShape, nextType)
	}
	tick() : void {

	}
}