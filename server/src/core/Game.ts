import {
	BOARD_HEIGHT,
	BOARD_WIDTH,
	CHEESE_CLEARS_PER_RISE,
	CHEESE_START_GARBAGE,
	CHEESE_TOTAL_GARBAGE,
	INVISIBLE_FADE_MS,
	INVISIBLE_JOKER_COUNT,
	INVISIBLE_JOKER_REVEAL_MS,
	INVISIBLE_REVEAL_CAP_MS,
	HARD_DROP_POINTS_PER_CELL,
	INVISIBLE_REVEAL_PER_LINE_MS,
	LINE_CLEAR_SCORES,
	LINES_PER_LEVEL,
	LOCK_GRACE_FACTOR,
	LOCK_GRACE_MIN_MS,
	SOFT_DROP_POINTS_PER_CELL,
	sendsPenaltyLines,
	SPRINT_TARGET_LINES,
	SUDDEN_DEATH_TICK_MS,
	ULTRA_DURATION_MS,
	type Board,
	type CascadeFall,
	type Cell,
	type GameMode,
	type PieceType,
	type PlayerGameState,
} from "../types/game/gameTypes.js";
import type { Player } from "./Player.js";
import { pieces, PIECES_TYPES, type PieceCell, type PieceShape } from "../types/game/piecesGameTypes.js";
import { emitGameOver, emitGameStart, emitGameUpdate, emitPlayerEliminated, emitSpectatorForPlayer, getRenderedBoard } from "../gateways/socket/emitters/gameEmitters.js";
import { settleGameRewards } from "../services/shopService.js";
import { spectatorSocketStore } from "../gateways/socket/spectatorSocketStore.js";
import { Piece } from "./Piece.js";
import type { Room } from "./room.js";

/** Amas de cellules soudees, deplace d'un bloc par la gravite du mode cascade. */
type BlockGroup = { x: number; y: number }[];

export class Game {
	private static readonly ROTATION_KICKS: ReadonlyArray<readonly [number, number]> = [
		[0, 0],
		[-1, 0], [1, 0],
		[-2, 0], [2, 0],
		[0, -1], [-1, -1], [1, -1],
		[0, -2],
		[-3, 0], [3, 0],
	]
	public mode: GameMode
	public players: Player[];
	private room: Room;
	private state: Map<string, PlayerGameState>;
	private pieceQueue: PieceType[];
	private intervalId: NodeJS.Timeout | null;
	private isOver: boolean;
	// Mode ultra: instant (ms) de fin de la partie. null pour les autres modes.
	private deadline: number | null;
	// Horodatage de création de la partie : sert à calculer la durée jouée (stats).
	private readonly startedAt: number;
	private lastTickAt: number;
	private readonly garbageHoles: number[];
	// Distributeur d'identifiants de piece (voir PlayerGameState.pieceIds). Partage par
	// tous les joueurs: seule l'egalite de deux identifiants d'un MEME plateau compte.
	private nextPieceId: number;
	// Distributeur d'identifiants de retombee (voir CascadeFall).
	private nextCascadeId: number;
	constructor (mode: GameMode, players: Player[], room: Room) {
		this.mode = mode;
		this.players = players;
		this.room = room;
		this.state = new Map()
		this.pieceQueue = this.randomPiece()
		this.intervalId = null
		this.isOver = false
		this.deadline = null
		this.startedAt = Date.now()
		this.lastTickAt = this.startedAt
		this.garbageHoles = Game.makeGarbageHoles(CHEESE_TOTAL_GARBAGE)
		this.nextPieceId = 0
		this.nextCascadeId = 0
		for (const player of players) {
			this.state.set(player.getSocketId(), {
					board: this.createBoard(),//fonction create board,
					score: 0,
					level: 1,
					lines: 0,
					tetris: 0,
					lockedAt: this.createLockGrid(),
					pieceIds: this.createLockGrid(),
					cascade: null,
					jokersLeft: INVISIBLE_JOKER_COUNT,
					revealUntil: 0,
					groundedAt: null,
					deepestY: -1,
					garbageCleared: 0,
					garbageServed: 0,
					pieceIndex: 0,
				player: player,
				isAlive: true,
				hasAbandoned: false,
				spectator: false,
			});
			player.setGame(this)
		}
	}
	createBoard() : Board {
		const board: Board = Array.from({length: BOARD_HEIGHT}, () => Array.from({length: BOARD_WIDTH}, () => 0))
		return board;
	}
	// Grille d'horodatage / d'identifiants de piece alignee sur le plateau (0 = aucun).
	createLockGrid() : number[][] {
		return Array.from({ length: BOARD_HEIGHT }, () => Array.from({ length: BOARD_WIDTH }, () => 0))
	}
	createEmptyLockRow() : number[] {
		return Array.from({ length: BOARD_WIDTH }, () => 0)
	}
	// Colonnes trouees du gruyere, jamais deux fois de suite la meme (voir garbageHoles).
	private static makeGarbageHoles(count: number) : number[] {
		const holes: number[] = []
		let previous = -1
		for (let i = 0; i < count; i++) {
			// Tirage parmi les BOARD_WIDTH - 1 colonnes AUTRES que la precedente: decaler
			// d'au moins 1 (modulo la largeur) donne exactement cette distribution.
			const offset = previous < 0
				? Math.floor(Math.random() * BOARD_WIDTH)
				: 1 + Math.floor(Math.random() * (BOARD_WIDTH - 1))
			const hole = previous < 0 ? offset : (previous + offset) % BOARD_WIDTH
			holes.push(hole)
			previous = hole
		}
		return holes
	}
	getMode() : GameMode {
		return this.mode
	}
	// Temps restant (ms) en mode ultra, null sinon. Envoye au client pour le chrono.
	getTimeLeftMs() : number | null {
		if (this.deadline === null)
			return null
		return Math.max(0, this.deadline - Date.now())
	}
	// Objectif de lignes du mode sprint, null pour les autres modes.
	getLinesTarget() : number | null {
		return this.mode === "sprint" ? SPRINT_TARGET_LINES : null
	}
	getGarbageLeft(playerState: PlayerGameState) : number | null {
		if (this.mode !== "cheese")
			return null
		return Math.max(0, CHEESE_TOTAL_GARBAGE - playerState.garbageCleared)
	}
	/** Opacite de chaque cellule verrouillee (mode invisible), null dans les autres modes. */
	getFadeGrid(playerState: PlayerGameState) : number[][] | null {
		if (this.mode !== "invisible")
			return null
		const now = Date.now()
		return playerState.lockedAt.map((row) => row.map((lockedAt) => {
			if (lockedAt === 0)
				return 1
			return Math.min(1, Math.max(0, 1 - (now - lockedAt) / INVISIBLE_FADE_MS))
		}))
	}

	/** Rend le plateau visible pendant `durationMs`, puis laisse le fondu reprendre. */
	grantReveal(playerState: PlayerGameState, durationMs: number) : void {
		if (this.mode !== "invisible" || durationMs <= 0)
			return
		const now = Date.now()
		const extended = Math.max(playerState.revealUntil, now) + durationMs
		const fadeStart = Math.min(extended, now + INVISIBLE_REVEAL_CAP_MS)
		playerState.revealUntil = fadeStart
		for (const row of playerState.lockedAt) {
			for (let x = 0; x < row.length; x++) {
				if (row[x] !== 0)
					row[x] = fadeStart
			}
		}
	}

	/** Joker: revelation a la demande, en nombre limite par partie. */
	useJoker(socketId: string) : boolean {
		const playerState = this.state.get(socketId)
		if (!playerState || !playerState.isAlive)
			return false
		if (this.mode !== "invisible" || playerState.jokersLeft <= 0)
			return false
		const now = Date.now()
		const current = Math.max(playerState.revealUntil, now)
		const granted = Math.min(current + INVISIBLE_JOKER_REVEAL_MS, now + INVISIBLE_REVEAL_CAP_MS)
		if (granted - current < INVISIBLE_JOKER_REVEAL_MS / 2)
			return false
		playerState.jokersLeft--
		this.grantReveal(playerState, INVISIBLE_JOKER_REVEAL_MS)
		return true
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
		// Sudden death: vitesse constante au maximum, la progression de niveau ne doit
		// pas relancer l'interval avec une autre cadence.
		if (this.mode === "suddendeath")
			return
		if (!this.isSolo())
			return
		const nextLevel = Math.floor(playerState.lines / LINES_PER_LEVEL) + 1
		if (nextLevel === playerState.level)
			return
		playerState.level = nextLevel
		this.restartTickInterval()
	}
	/** Sursis accorde a une piece qui vient de toucher la pile, mesure depuis le contact. */
	getLockGraceMs() : number {
		return Math.max(LOCK_GRACE_MIN_MS, Math.round(this.getTickSpeed() * LOCK_GRACE_FACTOR))
	}
	/** Met a jour l'instant de contact avec la pile. */
	refreshLockState(playerState: PlayerGameState) : void {
		if (!playerState.currentPiece) {
			playerState.groundedAt = null
			return
		}
		// Le sursis ne repart QUE si la piece a gagne du terrain, c'est a dire atteint une
		// rangee ou elle n'etait jamais passee. Sans ca, pivoter une piece posee la decolle
		// (wall kick vertical), remet le compteur a zero et la fait leviter indefiniment:
		// la partie ne peut alors plus se terminer.
		const y = playerState.currentPiece.getY()
		if (y > playerState.deepestY) {
			playerState.deepestY = y
			playerState.groundedAt = null
		}
		// Une piece decollee sans avoir progresse garde son horodatage de contact: elle se
		// verrouillera des qu'elle retouchera la pile, sans nouveau sursis.
		if (this.canMove(playerState, 0, 1))
			return
		if (playerState.groundedAt === null)
			playerState.groundedAt = Date.now()
	}
	/** Temps restant (ms) avant verrouillage, ou null si la piece peut encore descendre. */
	getLockDelayMs(playerState: PlayerGameState) : number | null {
		if (!playerState.isAlive || !playerState.currentPiece)
			return null
		if (this.canMove(playerState, 0, 1))
			return null
		const now = Date.now()
		const graceEnd = (playerState.groundedAt ?? now) + this.getLockGraceMs()
		const tickSpeed = this.getTickSpeed()
		const ticksAhead = Math.max(1, Math.ceil((graceEnd - this.lastTickAt) / tickSpeed))
		return Math.max(0, this.lastTickAt + ticksAhead * tickSpeed - now)
	}
	/** La piece doit-elle se figer a ce tick ? Sans piece courante, oui (il faut en faire apparaitre une). */
	private shouldLockNow(playerState: PlayerGameState) : boolean {
		if (!playerState.currentPiece)
			return true
		this.refreshLockState(playerState)
		if (playerState.groundedAt === null)
			return false
		return Date.now() - playerState.groundedAt >= this.getLockGraceMs()
	}
	getTickSpeed() : number {
		// Sudden death: vitesse maximale des la premiere piece, pour tout le monde.
		if (this.mode === "suddendeath")
			return SUDDEN_DEATH_TICK_MS
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
		// Le compte a rebours du prochain tick repart de maintenant.
		this.lastTickAt = Date.now()
		this.intervalId = setInterval(() => {
			try {
				this.tick()
			} catch (error) {
				this.abortOnFailure(error)
			}
		}, this.getTickSpeed())
	}
	private abortOnFailure(error: unknown) : void {
		console.error(`Game tick failed in room "${this.room.name}":`, error)
		const wasAlreadyOver = this.isOver
		this.haltGravity()
		this.room.setStatus("waiting")
		this.room.setGame(null)
		if (!wasAlreadyOver) {
			try {
				emitGameOver(this.state, null)
			} catch (emitError) {
				console.error("emitGameOver failed while aborting game:", emitError)
			}
		}
		this.purgeSpectators()
	}
	private purgeSpectators() : void {
		for (const [spectatorSocketId, subscription] of spectatorSocketStore) {
			if (subscription.game === this)
				spectatorSocketStore.delete(spectatorSocketId)
		}
	}
	/** Retire les rangees completes et fait redescendre le reste d'un bloc. */
	private collapseFullRows(
		playerState: PlayerGameState,
		fallBy: number[][] | null = null,
	) : { cleared: number; garbage: number } {
		let cleared = 0
		let garbage = 0
		const keptRows: Cell[][] = []
		const keptLocks: number[][] = []
		const keptIds: number[][] = []
		// Rangee d'origine de chaque rangee conservee: la difference avec sa position
		// finale donne de combien elle vient de descendre (info d'animation).
		const keptFalls: number[][] = []
		const keptY: number[] = []
		for (let y = 0; y < playerState.board.length; y++) {
			const row = playerState.board[y]
			if (!row)
				continue
			const hasPenalty = row.some(cell => cell === "penalty")
			const isFull = !hasPenalty && row.every(cell => cell !== 0)
			if (isFull) {
				cleared++
				if (row.some(cell => cell === "garbage"))
					garbage++
				continue
			}
			keptRows.push(row)
			keptLocks.push(playerState.lockedAt[y] ?? this.createEmptyLockRow())
			keptIds.push(playerState.pieceIds[y] ?? this.createEmptyLockRow())
			if (fallBy) {
				keptFalls.push(fallBy[y] ?? this.createEmptyLockRow())
				keptY.push(y)
			}
		}
		if (fallBy) {
			// Une rangee conservee finit a l'index `cleared + i`: elle a donc descendu
			// d'autant de rangees que de lignes nettoyees SOUS elle.
			for (let i = 0; i < keptFalls.length; i++) {
				const shift = cleared + i - (keptY[i] ?? 0)
				if (shift === 0)
					continue
				const fallRow = keptFalls[i]!
				const boardRow = keptRows[i]!
				for (let x = 0; x < fallRow.length; x++) {
					if (boardRow[x] !== 0)
						fallRow[x] = (fallRow[x] ?? 0) + shift
				}
			}
			fallBy.length = 0
			fallBy.push(
				...Array.from({ length: cleared }, () => this.createEmptyLockRow()),
				...keptFalls,
			)
		}
		const emptyRows: Cell[][] = Array.from(
			{ length: cleared },
			() => Array.from({ length: BOARD_WIDTH }, () => 0)
		)
		const emptyLocks: number[][] = Array.from(
			{ length: cleared },
			() => this.createEmptyLockRow()
		)
		playerState.board = [...emptyRows, ...keptRows]
		playerState.lockedAt = [...emptyLocks, ...keptLocks]
		playerState.pieceIds = [
			...Array.from({ length: cleared }, () => this.createEmptyLockRow()),
			...keptIds,
		]
		return { cleared, garbage }
	}
	clearLines(playerState: PlayerGameState) : number {
		let totalCleared = 0
		let chain = 0
		const fallBy = this.mode === "cascade" ? this.createLockGrid() : null
		for (;;) {
			const { cleared, garbage } = this.collapseFullRows(playerState, fallBy)
			if (cleared === 0)
				break
			chain++
			totalCleared += cleared
			playerState.garbageCleared += garbage
			const clearIndex = Math.min(cleared, LINE_CLEAR_SCORES.length - 1)
			// Le rang de la chaine multiplie le bareme: c'est TOUTE la recompense du mode
			// cascade (une meme salve vaut le double au 2e maillon, le triple au 3e).
			playerState.score += LINE_CLEAR_SCORES[clearIndex]! * playerState.level * chain
			// Un « Tetris » = 4 lignes nettoyées d'un seul coup (le maximum). On compte
			// l'événement, pas les lignes, pour la statistique dédiée.
			if (cleared === 4)
				playerState.tetris++
			// Mode invisible: chaque ligne completee redonne 2s de visibilite totale, qui
			// s'estompe ensuite progressivement comme une brique posee.
			this.grantReveal(playerState, cleared * INVISIBLE_REVEAL_PER_LINE_MS)
			if (this.mode !== "cascade")
				break
			// Cascade: les blocs restes en l'air retombent, ce qui peut completer de
			// nouvelles rangees -> on repasse par collapseFullRows pour le maillon suivant.
			this.applyStickyGravity(playerState, fallBy)
		}
		// Remplace la retombee precedente, meme par `null`: sans ca un verrouillage sans
		// chute rejouerait l'animation de la fois d'avant.
		if (fallBy)
			playerState.cascade = this.buildCascadeFall(playerState, fallBy)
		playerState.lines += totalCleared
		this.updateLevel(playerState)
		// Cheese: le plateau remonte au rythme des rangees creusees, jusqu'a ce que les
		// CHEESE_TOTAL_GARBAGE aient toutes ete servies.
		if (this.mode === "cheese")
			this.serveCheeseGarbage(playerState)
		return totalCleared
	}
	/** Traduit la grille des distances parcourues en liste de cases a animer, ou null si rien n'a bouge. */
	private buildCascadeFall(playerState: PlayerGameState, fallBy: number[][]) : CascadeFall | null {
		const cells: CascadeFall["cells"] = []
		for (let y = 0; y < fallBy.length; y++) {
			const fallRow = fallBy[y]
			const boardRow = playerState.board[y]
			if (!fallRow || !boardRow)
				continue
			for (let x = 0; x < fallRow.length; x++) {
				const rows = fallRow[x] ?? 0
				// Une case vide n'a rien a animer: la distance qu'elle porte est le reliquat
				// d'un bloc qui l'a quittee.
				if (rows > 0 && boardRow[x] !== 0)
					cells.push({ x, y, rows })
			}
		}
		if (cells.length === 0)
			return null
		return { id: ++this.nextCascadeId, cells }
	}
	/** Mode cascade : chaque amas encore soude retombe jusqu'a reposer sur quelque chose. */
	private applyStickyGravity(playerState: PlayerGameState, fallBy: number[][] | null = null) : void {
		for (;;) {
			// Du plus bas au plus haut: un amas ne peut pas descendre tant que celui d'en
			// dessous n'a pas libere la place, on economise donc des passes entieres.
			const groups = this.findBlockGroups(playerState.board, playerState.pieceIds)
				.sort((a, b) => Game.groupBottom(b) - Game.groupBottom(a))
			let moved = false
			for (const group of groups) {
				if (!this.canGroupFall(playerState.board, group))
					continue
				if (this.dropGroup(playerState, group, fallBy))
					moved = true
			}
			if (!moved)
				return
		}
	}
	/** Rangee la plus basse occupee par un amas (sert a les traiter de bas en haut). */
	private static groupBottom(group: BlockGroup) : number {
		return group.reduce((lowest, cell) => Math.max(lowest, cell.y), -1)
	}
	/** Decoupe le plateau en amas : cellules voisines issues de la meme piece. */
	private findBlockGroups(board: Board, pieceIds: number[][]) : BlockGroup[] {
		const seen = board.map((row) => row.map(() => false))
		const isFilled = (x: number, y: number) => (board[y]?.[x] ?? 0) !== 0
		const isSeen = (x: number, y: number) => seen[y]?.[x] === true
		const pieceIdAt = (x: number, y: number) => pieceIds[y]?.[x] ?? 0
		const markSeen = (x: number, y: number) => {
			const row = seen[y]
			if (row)
				row[x] = true
		}
		const groups: BlockGroup[] = []
		for (let y = 0; y < board.length; y++) {
			for (let x = 0; x < BOARD_WIDTH; x++) {
				if (!isFilled(x, y) || isSeen(x, y))
					continue
				const group: BlockGroup = []
				const groupId = pieceIdAt(x, y)
				const queue: { x: number; y: number }[] = [{ x, y }]
				markSeen(x, y)
				while (queue.length > 0) {
					const cell = queue.pop()!
					group.push(cell)
					for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
						const nextX = cell.x + dx
						const nextY = cell.y + dy
						if (nextX < 0 || nextX >= BOARD_WIDTH || nextY < 0 || nextY >= board.length)
							continue
						if (!isFilled(nextX, nextY) || isSeen(nextX, nextY))
							continue
						// Une case voisine posee par une AUTRE piece appartient a un autre amas.
						if (pieceIdAt(nextX, nextY) !== groupId)
							continue
						markSeen(nextX, nextY)
						queue.push({ x: nextX, y: nextY })
					}
				}
				groups.push(group)
			}
		}
		return groups
	}
	/** Un amas tombe si AUCUNE de ses cases n'a le sol, ou une case etrangere, dessous. */
	private canGroupFall(board: Board, group: BlockGroup) : boolean {
		const inGroup = new Set(group.map((cell) => `${cell.y}:${cell.x}`))
		for (const cell of group) {
			const belowY = cell.y + 1
			if (belowY >= board.length)
				return false
			// Une case du MEME amas ne le bloque pas: il descend d'un seul tenant.
			if (inGroup.has(`${belowY}:${cell.x}`))
				continue
			if ((board[belowY]?.[cell.x] ?? 0) !== 0)
				return false
		}
		return true
	}
	/** Descend un amas d'une rangee, horodatages compris (fondu du mode invisible). */
	private dropGroup(
		playerState: PlayerGameState,
		group: BlockGroup,
		fallBy: number[][] | null = null,
	) : boolean {
		// Du bas vers le haut: descendre d'abord la case la plus basse libere la place
		// de celle du dessus, sinon on ecraserait une case du meme amas.
		const cells = [...group].sort((a, b) => b.y - a.y)
		let moved = false
		for (const cell of cells) {
			const fromRow = playerState.board[cell.y]
			const toRow = playerState.board[cell.y + 1]
			const fromLocks = playerState.lockedAt[cell.y]
			const toLocks = playerState.lockedAt[cell.y + 1]
			const fromIds = playerState.pieceIds[cell.y]
			const toIds = playerState.pieceIds[cell.y + 1]
			if (!fromRow || !toRow || !fromLocks || !toLocks || !fromIds || !toIds)
				continue
			toRow[cell.x] = fromRow[cell.x] ?? 0
			fromRow[cell.x] = 0
			toLocks[cell.x] = fromLocks[cell.x] ?? 0
			fromLocks[cell.x] = 0
			toIds[cell.x] = fromIds[cell.x] ?? 0
			fromIds[cell.x] = 0
			// La distance parcourue suit la case: elle cumule le decalage du nettoyage
			// et chaque cran gagne par la gravite.
			const fromFalls = fallBy?.[cell.y]
			const toFalls = fallBy?.[cell.y + 1]
			if (fromFalls && toFalls) {
				toFalls[cell.x] = (fromFalls[cell.x] ?? 0) + 1
				fromFalls[cell.x] = 0
			}
			cell.y++
			moved = true
		}
		return moved
	}
	/** Mode cheese : sert les rangees de gruyere dues au joueur. */
	private serveCheeseGarbage(playerState: PlayerGameState) : void {
		// Toute rangee servie est soit encore sur le plateau, soit deja creusee.
		const onBoard = playerState.garbageServed - playerState.garbageCleared
		const target = Math.min(
			CHEESE_TOTAL_GARBAGE,
			Math.max(
				CHEESE_START_GARBAGE + Math.floor(playerState.garbageCleared / CHEESE_CLEARS_PER_RISE),
				onBoard === 0 ? playerState.garbageServed + 1 : 0,
			),
		)
		while (playerState.garbageServed < target) {
			this.raiseBoard(playerState, [this.createGarbageLine(playerState.garbageServed)])
			playerState.garbageServed++
			// Une remontee peut pousser la pile au-dela du plafond: inutile d'en servir
			// d'autres a un joueur deja mort.
			if (!playerState.isAlive)
				return
		}
	}
	/** Pose les CHEESE_START_GARBAGE rangees visibles au coup d'envoi (plateau vide). */
	private setupCheeseGarbage(playerState: PlayerGameState) : void {
		for (let i = 0; i < CHEESE_START_GARBAGE; i++) {
			this.raiseBoard(playerState, [this.createGarbageLine(playerState.garbageServed)])
			playerState.garbageServed++
		}
	}
	/** Rangee de gruyere: pleine sauf UN trou, et nettoyable (contrairement a "penalty"). */
	createGarbageLine(index: number) : Cell[] {
		const hole = this.garbageHoles[index % this.garbageHoles.length] ?? 0
		return Array.from({ length: BOARD_WIDTH }, (_v, x) => (x === hole ? 0 : "garbage"))
	}
	createPenaltyLine() : Cell[] {
		return Array.from({ length: BOARD_WIDTH }, () => "penalty")
	}
	/** Fait remonter le plateau de `lines.length` rangees et pose `lines` tout en bas. */
	private raiseBoard(playerState: PlayerGameState, lines: Cell[][]) : void {
		if (lines.length === 0)
			return
		const count = Math.min(lines.length, BOARD_HEIGHT)
		const toppedOut = playerState.board
			.slice(0, count)
			.some((row) => row.some((cell) => cell !== 0))
		playerState.board = [
			...playerState.board.slice(count),
			...lines.slice(0, count),
		]
		// Meme decalage sur les horodatages. Les lignes ajoutees n'en portent pas (0):
		// elles restent donc toujours visibles, meme en mode invisible.
		playerState.lockedAt = [
			...playerState.lockedAt.slice(count),
			...Array.from({ length: count }, () => this.createEmptyLockRow()),
		]
		// Une rangee ajoutee est une unite a part entiere: elle tombe d'un seul tenant
		// en mode cascade, et ne se colle pas a la piece qui la surplombe.
		playerState.pieceIds = [
			...playerState.pieceIds.slice(count),
			...lines.slice(0, count).map((line) => {
				const lineId = ++this.nextPieceId
				return line.map((cell) => (cell === 0 ? 0 : lineId))
			}),
		]
		if (toppedOut) {
			playerState.isAlive = false
			return
		}
		const piece = playerState.currentPiece
		if (!piece)
			return
		while (piece.getY() > 0 && !this.canMove(playerState, 0, 0))
			piece.translate(0, -1)
	}
	addPenaltyLines(playerState: PlayerGameState, count: number) : void {
		if (count <= 0)
			return
		const penaltyCount = Math.min(count, BOARD_HEIGHT)
		this.raiseBoard(
			playerState,
			Array.from({ length: penaltyCount }, () => this.createPenaltyLine()),
		)
	}
	addPenaltyToOpponents(sourcePlayerState: PlayerGameState, penaltyCount: number) : void {
		// Le filtre par mode est ICI et non chez l'appelant: c'est le seul point d'entree
		// de l'attaque, donc la seule garantie qu'aucun chemin (present ou futur) ne
		// puisse envoyer des lignes dans un mode qui promet le contraire.
		if (!sendsPenaltyLines(this.mode) || this.isSolo() || penaltyCount <= 0)
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

		// Distance parcourue: la chute instantanee rapporte le double du soft drop par
		// case, donc rien du tout sur une piece deja posee.
		let dropped = 0
		while (this.canMove(playerState, 0, 1)) {
			playerState.currentPiece.moveDown()
			dropped++
		}
		playerState.score += dropped * HARD_DROP_POINTS_PER_CELL
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
		else if (direction === "down" && this.canMove(playerState, 0, 1)) {
			playerState.currentPiece.moveDown()
			// Une case DESCENDUE, pas une touche pressee: marteler la touche contre le sol
			// ne rapporte rien.
			playerState.score += SOFT_DROP_POINTS_PER_CELL
		}

		// Le sursis court depuis le contact: une piece que le joueur vient de poser lui-meme
		// obtient une frame pleine, comme celle amenee au contact par la gravite.
		this.refreshLockState(playerState)
		emitGameUpdate(playerState, this.state)
		emitSpectatorForPlayer(playerState, this.state)
	}
	randomPiece() : PieceType[] {
		const remainingTypes: PieceType[] = [...PIECES_TYPES]
		const bag: PieceType[] = []
		for (let i = 0; i < PIECES_TYPES.length; i++) {
			const randomIndex = Math.floor(Math.random() * remainingTypes.length)
			const randomPiece : PieceType | undefined = remainingTypes[randomIndex]
			if (!randomPiece)
				throw new Error("No piece type available in PIECES_TYPES")
			remainingTypes.splice(randomIndex, 1)
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
		for (const [dx, dy] of Game.ROTATION_KICKS) {
			if (!this.canPlaceShape(rotate, playerState, dx, dy))
				continue
			playerState.currentPiece.translate(dx, dy)
			playerState.currentPiece.shape = rotate
			this.refreshLockState(playerState)
			emitGameUpdate(playerState, this.state)
			emitSpectatorForPlayer(playerState, this.state)
			return
		}
	} 
	start() : void {
		// Ultra: le chrono demarre avec la partie (2 minutes, meilleur score).
		if (this.mode === "ultra")
			this.deadline = Date.now() + ULTRA_DURATION_MS
		for (const [, playerStat] of this.state) {
			// Cheese: le gruyere est pose AVANT la premiere piece, sinon celle-ci
			// apparaitrait puis se ferait remonter par le plateau qu'on souleve.
			if (this.mode === "cheese")
				this.setupCheeseGarbage(playerStat)
			this.spawnPiece(playerStat)
		}
		emitGameStart(this.state, this)
		this.restartTickInterval()
	}
	stop() : void {
		this.haltGravity()
		this.purgeSpectators()
	}
	private haltGravity() : void {
		this.isOver = true
		if (this.intervalId) {
			clearInterval(this.intervalId)
			this.intervalId = null
		}
	}
	spawnPiece(playerStat: PlayerGameState) : void {
		const currentType = this.getPieceQueue(playerStat.pieceIndex)
		const nextType = this.getPieceQueue((playerStat.pieceIndex + 1))
		const currentShape = pieces[currentType]
		const nextShape = pieces[nextType]
		playerStat.currentPiece = new Piece(currentShape, currentType)
		playerStat.nextPiece = new Piece(nextShape, nextType)
		// Nouvelle piece: elle n'a rien touche, le sursis de la precedente ne la suit pas.
		playerStat.groundedAt = null
		// -1 et non 0: la piece apparait en y=0, qui doit compter comme une progression.
		playerStat.deepestY = -1
		if (!this.canSpawn(playerStat))
			playerStat.isAlive = false
	}
	abandon(socketId: string) : void {
		const playerState = this.state.get(socketId)
		if (!playerState || !playerState.isAlive)
			return
		playerState.isAlive = false
		playerState.hasAbandoned = true
		this.checkGameOver()
	}
	// Vainqueur au score (mode ultra a l'expiration du chrono). null si personne.
	private getBestScorer(states: PlayerGameState[]) : string | null {
		let best: PlayerGameState | null = null
		// Un joueur qui a QUITTE la partie est hors classement: sinon, en ultra, il
		// suffirait de marquer puis de partir pour etre sacre vainqueur.
		for (const playerState of states.filter((s) => !s.hasAbandoned)) {
			if (!best || playerState.score > best.score)
				best = playerState
		}
		return best ? best.player.getName() : null
	}
	checkGameOver() : boolean {
		if (this.isOver)
			return true
		const states = [...this.state.values()]
		const alivePlayers = states.filter((playerState) => playerState.isAlive)
		const isSolo = this.players.length <= 1
		let modeWinner: string | null = null
		let endedByMode = false

		// Sprint: le premier a atteindre l'objectif termine la partie. Un joueur MORT
		// ne peut pas gagner, meme s'il a franchi l'objectif en topant-out.
		if (this.mode === "sprint") {
			const finisher = states.find((playerState) =>
				playerState.isAlive && playerState.lines >= SPRINT_TARGET_LINES)
			if (finisher) {
				endedByMode = true
				modeWinner = finisher.player.getName()
			}
		}
		if (!endedByMode && this.mode === "cheese") {
			const finisher = states.find((playerState) =>
				playerState.isAlive && playerState.garbageCleared >= CHEESE_TOTAL_GARBAGE)
			if (finisher) {
				endedByMode = true
				modeWinner = isSolo ? null : finisher.player.getName()
			}
		}
		if (!endedByMode && this.deadline !== null) {
			const expired = Date.now() >= this.deadline
			if (!expired && alivePlayers.length > 0)
				return false
			endedByMode = true
			modeWinner = isSolo ? null : this.getBestScorer(states)
		}

		if (!endedByMode && ((isSolo && alivePlayers.length > 0) || (!isSolo && alivePlayers.length > 1)))
			return false
		this.isOver = true

		if (this.intervalId) {
			clearInterval(this.intervalId)
			this.intervalId = null
		}
		this.room.setStatus("waiting")
		this.room.setGame(null)

		// Un mode a decide du vainqueur (sprint/ultra); sinon regle de survie habituelle.
		const winner = endedByMode
			? modeWinner
			: (!isSolo && alivePlayers[0] ? alivePlayers[0].player.getName() : null)
		const hadWinner = winner !== null
		const durationMs = Math.max(0, Date.now() - this.startedAt)
		const rewardEntries = [...this.state.values()].map((playerState) => ({
			username: playerState.player.getName(),
			score: playerState.score,
			socket: playerState.player.getSocket(),
			faction: playerState.player.getFaction(),
			mode: this.mode,
			lines: playerState.lines,
			tetris: playerState.tetris,
			level: playerState.level,
			won: hadWinner && playerState.player.getName() === winner,
			hadWinner,
			durationMs,
		}))
		void settleGameRewards(rewardEntries)
		try {
			emitGameOver(this.state, winner)
		} finally {
			this.purgeSpectators()
		}
		return true
	}
	lockPiece(playerState: PlayerGameState) : void {
		const previousBoard = playerState.board
		playerState.board = getRenderedBoard(playerState)
		const now = Math.max(Date.now(), playerState.revealUntil)
		// Meme marquage pour l'identite de la piece: les cases qu'elle vient de remplir
		// forment desormais une unite qui tombera d'un seul tenant en mode cascade.
		const pieceId = ++this.nextPieceId
		for (let y = 0; y < playerState.board.length; y++) {
			const row = playerState.board[y]
			const previousRow = previousBoard[y]
			const lockRow = playerState.lockedAt[y]
			const idRow = playerState.pieceIds[y]
			if (!row || !previousRow || !lockRow || !idRow)
				continue
			for (let x = 0; x < row.length; x++) {
				if (previousRow[x] === 0 && row[x] !== 0) {
					lockRow[x] = now
					idRow[x] = pieceId
				}
			}
		}
	}
	lockAndSpawnNext(playerState: PlayerGameState) : boolean {
		this.lockPiece(playerState)
		const clearedLines = this.clearLines(playerState)
		// Sujet : les adversaires reçoivent n-1 lignes de pénalité (0 pour 1 ligne
		// complétée). Le garde `<= 0` dans addPenaltyToOpponents absorbe le cas 0, et
		// son garde de mode les modes qui n'envoient rien (voir PENALTY_SENDING_MODES).
		this.addPenaltyToOpponents(playerState, clearedLines - 1)
		playerState.pieceIndex ++
		this.spawnPiece(playerState)
		const justEliminated = !playerState.isAlive
		const isGameOver = this.checkGameOver()
		if (justEliminated && !isGameOver)
			emitPlayerEliminated(playerState, this.state)
		return isGameOver
	}
	tick() : void {
		this.lastTickAt = Date.now()
		if (this.deadline !== null && this.checkGameOver())
			return
		for (const [, playerState] of this.state) {
			if (!playerState.isAlive)
				continue
			const currentPiece = playerState.currentPiece
			if (currentPiece && this.canMove(playerState, 0, 1)) {
				currentPiece.moveDown()
				this.refreshLockState(playerState)
			}
			else if (this.shouldLockNow(playerState) && this.lockAndSpawnNext(playerState))
				return
			// Un joueur peut etre mort SANS que la partie se termine (elimination en
			// multi): plus rien a lui envoyer, il bascule spectateur.
			if (!playerState.isAlive)
				continue
			emitGameUpdate(playerState, this.state)
			emitSpectatorForPlayer(playerState, this.state)
		}
	}
}
