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
		// En mode invisible, le plateau de reference est le plateau MASQUE: sinon un
		// adversaire (ou un 2e onglet du meme joueur) lirait via le spectre la hauteur
		// exacte d'une pile que son proprietaire ne voit plus.
		const visibleBoard = maskFadedCells(
			playerState.board,
			playerState.player.getGame()?.getFadeGrid(playerState) ?? null,
		);
		opponents.push({
			username: playerState.player.getName(),
			// Un joueur en jeu ne recoit que le spectre; un spectateur voit les vrais plateaux.
			board: options.fullBoards ? visibleBoard : getSpectrumBoard(visibleBoard),
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
		const { rawFade, ...modeFields } = getModeFields(playerState)
		socket.emit("game:start", {
			"board": maskFadedCells(playerState.board, rawFade),
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
				"ghost": getVisibleGhostCells(playerState, modeFields.mode),
				...modeFields
		})
	}
}

/**
 * Champs specifiques au mode de jeu, ajoutes a chaque frame:
 * - mode       : le mode courant (le client adapte son HUD)
 * - lines      : lignes nettoyees par ce joueur
 * - linesTarget: objectif (sprint) ou null
 * - timeLeftMs : temps restant (ultra) ou null
 * - fade       : opacite par cellule (invisible) ou null
 * La Game est recuperee via le Player: les emetteurs ne la recoivent pas en parametre.
 */
function getModeFields(playerState: PlayerGameState) {
	const game = playerState.player.getGame();
	if (!game) {
		return {
			mode: "classique",
			lines: playerState.lines,
			linesTarget: null,
			timeLeftMs: null,
			rawFade: null,
			fade: null,
			jokersLeft: playerState.jokersLeft,
			theme: playerState.player.getTheme(),
		};
	}
	const fade = game.getFadeGrid(playerState);
	return {
		// Cosmetique du proprietaire du plateau affiche: un spectateur voit le theme
		// du joueur observe, pas le sien.
		theme: playerState.player.getTheme(),
		mode: game.getMode(),
		lines: playerState.lines,
		linesTarget: game.getLinesTarget(),
		timeLeftMs: game.getTimeLeftMs(),
		// `rawFade` sert au masquage du plateau, `fade` (assaini) part sur le reseau.
		rawFade: fade,
		fade: maskFadeGrid(fade),
		jokersLeft: playerState.jokersLeft,
	};
}

/**
 * Mode invisible: une cellule TOTALEMENT effacee ne doit pas partir sur le reseau.
 * Sinon l'invisibilite n'est qu'un style CSS, lisible dans le DOM (`data-piece`) ou
 * dans l'onglet Reseau. Les cellules encore partiellement visibles gardent leur type
 * puisqu'elles sont de toute facon a l'ecran.
 */
function maskFadedCells(board: Board, fade: number[][] | null): Board {
	if (!fade)
		return board;
	return board.map((row, y) => row.map((cell, x) => ((fade[y]?.[x] ?? 1) <= 0 ? 0 : cell)));
}

/**
 * Masquer le plateau ne suffit pas: `fade[y][x] === 0` signifie « case occupee mais
 * cachee », ce qui permet de reconstruire toute la pile invisible depuis les frames
 * reseau. Une case totalement effacee est deja envoyee VIDE dans le plateau, donc son
 * opacite n'a plus d'utilite: on la remet a 1 pour qu'elle soit indiscernable d'une
 * vraie case vide.
 */
function maskFadeGrid(fade: number[][] | null): number[][] | null {
	if (!fade)
		return null;
	return fade.map((row) => row.map((opacity) => (opacity <= 0 ? 1 : opacity)));
}

/**
 * La projection d'atterrissage est calculee sur le plateau REEL: l'afficher en mode
 * invisible revelerait la hauteur exacte de la pile cachee, colonne par colonne.
 */
function getVisibleGhostCells(playerState: PlayerGameState, mode: string): GhostCell[] {
	return mode === "invisible" ? [] : getGhostCells(playerState);
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
	const { rawFade, ...modeFields } = getModeFields(playerState)
	socket.emit("game:update", {
		"board": maskFadedCells(getRenderedBoard(playerState), rawFade),
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
			"ghost": getVisibleGhostCells(playerState, modeFields.mode),
			...modeFields
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
	const { rawFade, ...modeFields } = getModeFields(playerState)
	socket.emit("game:SpectatorGame", {
		"board": maskFadedCells(getRenderedBoard(playerState), rawFade),
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
			"spectator": player.getName(),
			"ghost": getVisibleGhostCells(playerState, modeFields.mode),
			...modeFields
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
	// Un joueur qui a QUITTE est hors classement (comme pour la designation du
	// vainqueur): sinon le podium le placerait 1er alors qu'un autre est sacre.
	const scores = [...state.values()]
		.filter((playerState) => !playerState.hasAbandoned)
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
