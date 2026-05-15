import { BOARD_HEIGHT, BOARD_WIDTH, type Board, type Cell, type PieceType, type PlayerGameState } from "../types/game/gameTypes.js";
import type { Player } from "./Player.js";
import { pieces, PIECES_TYPES, type PieceCell, type PieceShape } from "../types/game/piecesGameTypes.js";
import { emitGameStart, emitGameUpdate, getRenderedBoard } from "../gateways/socket/emitters/gameEmitters.js";
import { Piece } from "./Piece.js";

export class Game {
	public mode: "classique" | "ultra" | "sprint"
	public players: Player[];
	private state: Map<string, PlayerGameState>;
	private pieceQueue: PieceType[];
	constructor (mode: "classique" | "ultra" | "sprint", players: Player[]) {
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
				spectator: false,
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
		this.ensurePieceQueue(index)
		const piece = this.pieceQueue[index]
		if (!piece)
			throw new Error("No piece type available in PIECES_TYPES")
		return piece
	}
	ensurePieceQueue(index: number) : void {
		while (this.pieceQueue.length <= index)
			this.pieceQueue.push(...this.randomPiece())
	}
	canMove(playerState: PlayerGameState, dx: number, dy: number) : boolean {
		const piece = playerState.currentPiece
		if (!piece)
			return false

		for (let y = 0; y < piece.shape.length; y++) {
			const pieceRow = piece.shape[y]
			if (!pieceRow)
				continue
			for (let x = 0; x < pieceRow.length; x++) {
				if (pieceRow[x] !== 1)
					continue

				const nextY = piece.getY() + y + dy
				const nextX = piece.getX() + x + dx
				if (nextX < 0 || nextX >= BOARD_WIDTH || nextY < 0 || nextY >= BOARD_HEIGHT)
					return false

				const boardRow = playerState.board[nextY]
				if (!boardRow || boardRow[nextX] !== 0)
					return false
			}
		}
		return true
	}
	canRotate(rotatedShape: PieceCell[][], playerStat: PlayerGameState) : boolean {
		const piece = playerStat.currentPiece
		if (!piece)
			return false

		for (let y = 0; y < rotatedShape.length; y++) {
			const pieceRow = rotatedShape[y]
			if (!pieceRow)
				continue
			for (let x = 0; x < pieceRow.length; x++) {
				if (pieceRow[x] !== 1)
					continue

				const nextY = piece.getY() + y
				const nextX = piece.getX() + x
				if (nextX < 0 || nextX >= BOARD_WIDTH || nextY < 0 || nextY >= BOARD_HEIGHT)
					return false

				const boardRow = playerStat.board[nextY]
				if (!boardRow || boardRow[nextX] !== 0)
					return false
			}
		}
		return true
	}
	move(socketId: string, direction: "left" | "right" | "down") : void {
		const playerState = this.state.get(socketId)
		if (!playerState || !playerState.currentPiece)
			return

		if (direction === "left" && this.canMove(playerState, -1, 0))
			playerState.currentPiece.moveLeft()
		else if (direction === "right" && this.canMove(playerState, 1, 0))
			playerState.currentPiece.moveRight()
		else if (direction === "down" && this.canMove(playerState, 0, 1))
			playerState.currentPiece.moveDown()

		emitGameUpdate(playerState, this.state)
	}
	randomPiece() : PieceType[] {
		const pieces: PieceType[] = ["I", "J", "L", "O", "S", "T", "Z"]
		const bag: PieceType[] = []
		for (let i = 0; i < 7; i++) {
			const randomIndex = Math.floor(Math.random() * pieces.length)
			const randomPiece : PieceType | undefined = pieces[randomIndex]
			if (!randomPiece)
				throw new Error("No piece type available in PIECES_TYPES")
			pieces.splice(randomIndex, 1)
			bag.push(randomPiece)
		}
		return bag
	}
	rotate(socketId: string) : void {
		const playerState = this.state.get(socketId)
		if (!playerState || !playerState.currentPiece)
			return
	const rotate = playerState.currentPiece.getRotatedShape()
		if (!rotate)
			return
		if (this.canRotate(rotate, playerState))
			playerState.currentPiece.shape = rotate
			emitGameUpdate(playerState, this.state)
		} 
	drop(socketId: string) : void {
		const playerState = this.state.get(socketId)
		if (!playerState || !playerState.currentPiece)
			return

		while (this.canMove(playerState, 0, 1))
			playerState.currentPiece.moveDown()
		this.lockPiece(playerState)
		playerState.pieceIndex ++
		this.spawnPiece(playerState)
		emitGameUpdate(playerState, this.state)
	}
	start() : void {
		for (const [, playerStat] of this.state) {
			this.spawnPiece(playerStat)
		}
		emitGameStart(this.state, this)
		const intervalID = setInterval(() => {
			this.tick()
		},300)
	}
	spawnPiece(playerStat: PlayerGameState) : void {
		const currentType = this.getPieceQueue(playerStat.pieceIndex)
		const nextType = this.getPieceQueue((playerStat.pieceIndex + 1))
		const currentShape = pieces[currentType]
		const nextShape = pieces[nextType]
		playerStat.currentPiece = new Piece(currentShape, currentType)
		playerStat.nextPiece = new Piece(nextShape, nextType)
	}
	lockPiece(playerState: PlayerGameState) : void {
		playerState.board = getRenderedBoard(playerState)
	}
	tick() : void {
		for (const [, playerState] of this.state) {
			if (!playerState.isAlive)
				break
			const currentPiece = playerState.currentPiece
				if (currentPiece && this.canMove(playerState, 0, 1))
					currentPiece?.moveDown()
				else {
					this.lockPiece(playerState)
					playerState.pieceIndex ++
					this.spawnPiece(playerState)
				}
			emitGameUpdate(playerState, this.state)
		}
	}
}
