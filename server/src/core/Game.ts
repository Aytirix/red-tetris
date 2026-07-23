import { BOARD_HEIGHT, BOARD_WIDTH, type Board, type Cell, type PieceType, type PlayerGameState } from "../types/game/gameTypes.js";
import type { Player } from "./Player.js";
import { pieces, PIECES_TYPES, type PieceCell, type PieceShape } from "../types/game/piecesGameTypes.js";
import { emitGameOver, emitGameStart, emitGameUpdate, emitPlayerEliminated, emitSpectatorForPlayer, getRenderedBoard } from "../gateways/socket/emitters/gameEmitters.js";
import { settleGameRewards } from "../services/shopService.js";
import { spectatorSocketStore } from "../gateways/socket/spectatorSocketStore.js";
import { Piece } from "./Piece.js";
import type { Room } from "./room.js";

export class Game {
	// Wall kicks a la rotation: decalages HORIZONTAUX uniquement, du plus petit au plus
	// grand. (0,0) = rotation en place; ±1/±2/±3 en x pour decoller la piece d'un mur ou
	// d'une pile. Seul le I (large de 4) atteint ±3; les pieces 3-larges trouvent toujours
	// a ±2 au plus. Aucun decalage vertical: une piece ne doit jamais "sauter" vers le
	// haut en tournant.
	private static readonly ROTATION_KICKS: ReadonlyArray<readonly [number, number]> = [
		[0, 0], [-1, 0], [1, 0], [-2, 0], [2, 0], [-3, 0], [3, 0],
	]
	public mode: "classique"
	public players: Player[];
	private room: Room;
	private state: Map<string, PlayerGameState>;
	private pieceQueue: PieceType[];
	private intervalId: NodeJS.Timeout | null;
	// checkGameOver() est appelable depuis plusieurs chemins (verrouillage de piece,
	// depart d'un joueur): ce drapeau garantit qu'une partie ne se termine qu'une fois,
	// donc pas de double game:over ni de double credit de berrys.
	private isOver: boolean;
	constructor (mode: "classique", players: Player[], room: Room) {
		this.mode = mode;
		this.players = players;
		this.room = room;
		this.state = new Map()
		this.pieceQueue = this.randomPiece()
		this.intervalId = null
		this.isOver = false
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
	// Verifie qu'une forme tient sur le plateau a la position de la piece decalee de
	// (offsetX, offsetY). Base commune de canRotate et des wall kicks.
	canPlaceShape(shape: PieceCell[][], playerStat: PlayerGameState, offsetX: number, offsetY: number) : boolean {
		const piece = playerStat.currentPiece
		if (!piece)
			return false

		for (let y = 0; y < shape.length; y++) {
			const pieceRow = shape[y]
			if (!pieceRow)
				continue
			for (let x = 0; x < pieceRow.length; x++) {
				if (pieceRow[x] !== 1)
					continue

				const nextY = piece.getY() + y + offsetY
				const nextX = piece.getX() + x + offsetX
				if (nextX < 0 || nextX >= BOARD_WIDTH || nextY < 0 || nextY >= BOARD_HEIGHT)
					return false

				const boardRow = playerStat.board[nextY]
				if (!boardRow || boardRow[nextX] !== 0)
					return false
			}
		}
		return true
	}
	canRotate(rotatedShape: PieceCell[][], playerStat: PlayerGameState) : boolean {
		return this.canPlaceShape(rotatedShape, playerStat, 0, 0)
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
	clearLines(playerState: PlayerGameState) : number {
		let clearedLines = 0

		const newBoard = playerState.board.filter(row => {
			const hasPenalty = row.some(cell => cell === "penalty")
			const isFull = !hasPenalty && row.every(cell => cell !== 0)
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
		return clearedLines
	}
	createPenaltyLine() : Cell[] {
		// Lignes de pénalité pleines et indestructibles (sujet) : aucune brèche.
		// clearLines() les exclut déjà via le marqueur "penalty" ; les rendre pleines
		// garantit qu'elles ne peuvent jamais être complétées ni nettoyées.
		return Array.from({ length: BOARD_WIDTH }, () => "penalty")
	}
	addPenaltyLines(playerState: PlayerGameState, count: number) : void {
		if (count <= 0)
			return
		const penaltyCount = Math.min(count, BOARD_HEIGHT)
		// Les `penaltyCount` lignes du HAUT sortent du terrain. Si elles portent le
		// moindre bloc, la pile a ete poussee au-dela du plafond => top-out. Sans ca la
		// penalite "nettoierait" gratuitement le sommet d'une pile haute au lieu d'etre
		// punitive (une pile au plafond survivait a une salve de penalites).
		const toppedOut = playerState.board
			.slice(0, penaltyCount)
			.some((row) => row.some((cell) => cell !== 0))
		const penaltyLines = Array.from(
			{ length: penaltyCount },
			() => this.createPenaltyLine()
		)
		playerState.board = [
			...playerState.board.slice(penaltyCount),
			...penaltyLines,
		]
		if (toppedOut) {
			playerState.isAlive = false
			return
		}
		// Le plateau vient de remonter de penaltyCount: la piece en vol doit remonter
		// avec lui. Sinon elle se retrouve incrustee DANS les lignes de penalite et,
		// au verrouillage, getRenderedBoard ecrase des cellules "penalty": la ligne
		// perd son marqueur, redevient nettoyable par clearLines et n'est donc plus
		// indestructible (et le joueur gagne des cases gratuites).
		const piece = playerState.currentPiece
		if (!piece)
			return
		while (piece.getY() > 0 && !this.canMove(playerState, 0, 0))
			piece.translate(0, -1)
	}
	addPenaltyToOpponents(sourcePlayerState: PlayerGameState, penaltyCount: number) : void {
		if (this.isSolo() || penaltyCount <= 0)
			return
		// Une penalite peut TUER (pile poussee au-dela du plafond): on collecte les
		// victimes pour les notifier comme n'importe quelle elimination.
		const eliminated: PlayerGameState[] = []
		for (const [, playerState] of this.state) {
			if (playerState === sourcePlayerState)
				continue
			if (!playerState.isAlive)
				continue
			this.addPenaltyLines(playerState, penaltyCount)
			// Emettre le plateau final AVANT toute elimination: la victime (et ses
			// spectateurs) doivent voir les lignes qui viennent de la tuer.
			emitGameUpdate(playerState, this.state)
			emitSpectatorForPlayer(playerState, this.state)
			if (!playerState.isAlive)
				eliminated.push(playerState)
		}
		if (eliminated.length === 0)
			return
		// Si ces morts terminent la partie, emitGameOver s'en charge pour tout le monde.
		if (this.checkGameOver())
			return
		for (const victim of eliminated)
			emitPlayerEliminated(victim, this.state)
	}
	drop(socketId: string) : void {
		const playerState = this.state.get(socketId)
		if (!playerState || !playerState.currentPiece || !playerState.isAlive)
			return

		while (this.canMove(playerState, 0, 1))
			playerState.currentPiece.moveDown()
		const isGameOver = this.lockAndSpawnNext(playerState)
		if (!isGameOver && playerState.isAlive) {
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
		// Wall kicks: si la forme pivotee deborde a la position actuelle (piece collee a
		// un mur, au sol ou a une pile), on essaie de la decaler avant d'abandonner la
		// rotation. Ordre = deplacement croissant, horizontal d'abord (le plus courant),
		// puis un cran vers le haut. Le premier decalage qui tient est applique.
		for (const [dx, dy] of Game.ROTATION_KICKS) {
			if (!this.canPlaceShape(rotate, playerState, dx, dy))
				continue
			playerState.currentPiece.translate(dx, dy)
			playerState.currentPiece.shape = rotate
			emitGameUpdate(playerState, this.state)
			emitSpectatorForPlayer(playerState, this.state)
			return
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
	// Depart d'un joueur pendant la partie (room:leave / disconnect). Sans ca la Room est
	// supprimee du store alors que l'interval de gravite tourne toujours, et les sockets
	// partis continuent de recevoir des game:update.
	abandon(socketId: string) : void {
		const playerState = this.state.get(socketId)
		if (!playerState || !playerState.isAlive)
			return
		playerState.isAlive = false
		this.checkGameOver()
	}
	checkGameOver() : boolean {
		if (this.isOver)
			return true
		const alivePlayers = [...this.state.values()].filter((playerState) => playerState.isAlive)
		const isSolo = this.players.length <= 1
		if ((isSolo && alivePlayers.length > 0) || (!isSolo && alivePlayers.length > 1))
			return false
		this.isOver = true

		if (this.intervalId) {
			clearInterval(this.intervalId)
			this.intervalId = null
		}

		// Fin de partie: rouvrir la room (retour salon) et détacher la game terminée.
		// Sinon un joueur qui ACTUALISE pendant le game over reviendrait dans le visuel
		// de partie (room encore "playing" → joined=false → spectateur) au lieu du lobby.
		this.room.setStatus("waiting")
		this.room.setGame(null)

		const winner = !isSolo && alivePlayers[0] ? alivePlayers[0].player.getName() : null
		// Crédit du butin: chaque joueur gagne son score final en berrys (persisté DB).
		// Appelé une seule fois par partie (interval nettoyé + break dans tick()).
		const rewardEntries = [...this.state.values()].map((playerState) => ({
			username: playerState.player.getName(),
			score: playerState.score,
			socket: playerState.player.getSocket(),
		}))
		void settleGameRewards(rewardEntries)
		// emitGameOver notifie AUSSI les spectateurs purs (jamais presents dans state):
		// la purge des abonnements doit donc venir APRES, sinon ils resteraient bloques
		// sur l'ecran de jeu fige, sans recap ni retour lobby. Le finally garantit que
		// la purge a lieu meme si une emission leve: un abonnement fantome bloquerait
		// game:move/rotate/drop du socket concerne a la partie suivante.
		try {
			emitGameOver(this.state, winner)
		} finally {
			for (const [spectatorSocketId, subscription] of spectatorSocketStore) {
				if (subscription.game === this)
					spectatorSocketStore.delete(spectatorSocketId)
			}
		}
		return true
	}
	lockPiece(playerState: PlayerGameState) : void {
		playerState.board = getRenderedBoard(playerState)
	}
	lockAndSpawnNext(playerState: PlayerGameState) : boolean {
		this.lockPiece(playerState)
		const clearedLines = this.clearLines(playerState)
		// Sujet : les adversaires reçoivent n-1 lignes de pénalité (0 pour 1 ligne
		// complétée). Le garde `<= 0` dans addPenaltyToOpponents absorbe le cas 0.
		this.addPenaltyToOpponents(playerState, clearedLines - 1)
		playerState.pieceIndex ++
		this.spawnPiece(playerState)
		const justEliminated = !playerState.isAlive
		const isGameOver = this.checkGameOver()
		// Mort individuelle mais partie non terminée: notifier ce joueur (game over
		// perso + passage spectateur côté client). Si la partie est finie, emitGameOver
		// (déjà émis par checkGameOver) s'en charge pour tout le monde.
		if (justEliminated && !isGameOver)
			emitPlayerEliminated(playerState, this.state)
		return isGameOver
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
				if (!isGameOver && playerState.isAlive) {
					emitGameUpdate(playerState, this.state)
					emitSpectatorForPlayer(playerState, this.state)
				}
			}
	}
}
