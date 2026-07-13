import { BOARD_HEIGHT, BOARD_WIDTH, type Board, type Cell, type PieceType, type PlayerGameState } from "../types/game/gameTypes.js";
import type { Player } from "./Player.js";
import { pieces, PIECES_TYPES, type PieceCell, type PieceShape } from "../types/game/piecesGameTypes.js";
import { emitGameOver, emitGameStart, emitGameUpdate, getRenderedBoard } from "../gateways/socket/emitters/gameEmitters.js";
import { settleGameRewards } from "../services/shopService.js";
import { Piece } from "./Piece.js";
import type { Room } from "./room.js";

export class Game {
	public mode: "classique" | "ultra" | "sprint"
	public players: Player[];
	private room: Room;
	private state: Map<string, PlayerGameState>;
	private pieceQueue: PieceType[];
	private intervalId: NodeJS.Timeout | null;
	constructor (mode: "classique" | "ultra" | "sprint", players: Player[], room: Room) {
		this.mode = mode;
		this.players = players;
		this.room = room;
		this.state = new Map()
		this.pieceQueue = this.randomPiece()
		this.intervalId = null
		for (const player of players) {
			this.state.set(player.getSocketId(), {
					board: this.createBoard(),//fonction create board,
					score: 0,
					level: 1,
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
	canSpawn(playerStat: PlayerGameState) : boolean {
		const piece = playerStat.currentPiece
		if (!piece)
			return false

		for (let y = 0; y < piece.shape.length; y++) {
			const pieceRow = piece.shape[y]
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
	isSolo() : boolean {
		return this.players.length === 1
	}
	updateLevel(playerState: PlayerGameState) : void {
		if (!this.isSolo())
			return
		const nextLevel = Math.floor(playerState.score / 500) + 1
		if (nextLevel === playerState.level)
			return
		playerState.level = nextLevel
		this.restartTickInterval()
	}
	getTickSpeed() : number {
		if (!this.isSolo())
			return 400
		const playerState = [...this.state.values()][0]
		const level = playerState?.level ?? 1
		return Math.max(80, 400 - ((level - 1) * 40))
	}
	getPlayerStateBySocketId(socketId: string) : PlayerGameState | undefined {
		return this.state.get(socketId)
	}
	getState() : Map<string, PlayerGameState> {
		return this.state
	}
	restartTickInterval() : void {
		if (this.intervalId)
			clearInterval(this.intervalId)
		this.intervalId = setInterval(() => {
			this.tick()
		}, this.getTickSpeed())
	}
	clearLines(playerState: PlayerGameState) : void {
		let clearedLines = 0

		const newBoard = playerState.board.filter(row => {
			const isFull = row.every(cell => cell !== 0)
			if (isFull)
				clearedLines++
			return !isFull
		})
		const emptyRows: Cell[][] = Array.from(
			{ length: clearedLines },
			() => Array.from({ length: BOARD_WIDTH }, () => 0)
		)
		playerState.board = [...emptyRows, ...newBoard]
		playerState.score += clearedLines * 100
		this.updateLevel(playerState)
	}
	drop(socketId: string) : void {
		const playerState = this.state.get(socketId)
		if (!playerState || !playerState.currentPiece || !playerState.isAlive)
			return

		while (this.canMove(playerState, 0, 1))
			playerState.currentPiece.moveDown()
		const isGameOver = this.lockAndSpawnNext(playerState)
		if (!isGameOver) {
			emitGameUpdate(playerState, this.state)
			emitSpectatorForPlayer(playerState, this.state)
		}
	}
	move(socketId: string, direction: "left" | "right" | "down") : void {
		const playerState = this.state.get(socketId)
		if (!playerState || !playerState.currentPiece || !playerState.isAlive)
			return

		if (direction === "left" && this.canMove(playerState, -1, 0))
			playerState.currentPiece.moveLeft()
		else if (direction === "right" && this.canMove(playerState, 1, 0))
			playerState.currentPiece.moveRight()
		else if (direction === "down" && this.canMove(playerState, 0, 1))
			playerState.currentPiece.moveDown()

		emitGameUpdate(playerState, this.state)
		emitSpectatorForPlayer(playerState, this.state)
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
		if (!playerState || !playerState.currentPiece || !playerState.isAlive)
			return
		const rotate = playerState.currentPiece.getRotatedShape()
		if (!rotate)
			return
		if (this.canRotate(rotate, playerState)) {
			playerState.currentPiece.shape = rotate
			emitGameUpdate(playerState, this.state)
			emitSpectatorForPlayer(playerState, this.state)
		}
		} 
	start() : void {
		for (const [, playerStat] of this.state) {
			this.spawnPiece(playerStat)
			console.log("test")
		}
		emitGameStart(this.state, this)
		this.restartTickInterval()
	}
	spawnPiece(playerStat: PlayerGameState) : void {
		const currentType = this.getPieceQueue(playerStat.pieceIndex)
		const nextType = this.getPieceQueue((playerStat.pieceIndex + 1))
		const currentShape = pieces[currentType]
		const nextShape = pieces[nextType]
		playerStat.currentPiece = new Piece(currentShape, currentType)
		playerStat.nextPiece = new Piece(nextShape, nextType)
		if (!this.canSpawn(playerStat))
			playerStat.isAlive = false
	}
	checkGameOver() : boolean {
		const alivePlayers = [...this.state.values()].filter((playerState) => playerState.isAlive)
		const isSolo = this.players.length <= 1
		if ((isSolo && alivePlayers.length > 0) || (!isSolo && alivePlayers.length > 1))
			return false

		if (this.intervalId) {
			clearInterval(this.intervalId)
			this.intervalId = null
		}

		const winner = !isSolo && alivePlayers[0] ? alivePlayers[0].player.getName() : null
		// Crédit du butin: chaque joueur gagne son score final en berrys (persisté DB).
		// Appelé une seule fois par partie (interval nettoyé + break dans tick()).
		const rewardEntries = [...this.state.values()].map((playerState) => ({
			username: playerState.player.getName(),
			score: playerState.score,
			socket: playerState.player.getSocket(),
		}))
		void settleGameRewards(rewardEntries)
		emitGameOver(this.state, winner)
		return true
	}
	lockPiece(playerState: PlayerGameState) : void {
		playerState.board = getRenderedBoard(playerState)
	}
	lockAndSpawnNext(playerState: PlayerGameState) : boolean {
		this.lockPiece(playerState)
		this.clearLines(playerState)
		playerState.pieceIndex ++
		this.spawnPiece(playerState)
		return this.checkGameOver()
	}
	tick() : void {
		for (const [, playerState] of this.state) {
			let isGameOver: boolean = false
			if (!playerState.isAlive)
				continue
				const currentPiece = playerState.currentPiece
					if (currentPiece && this.canMove(playerState, 0, 1))
						currentPiece?.moveDown()
					else
						isGameOver = this.lockAndSpawnNext(playerState)
				if (isGameOver)
					break
				if (!isGameOver) {
					emitGameUpdate(playerState, this.state)
					emitSpectatorForPlayer(playerState, this.state)
				}
			}
	}
}
