import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { Socket } from "socket.io";

vi.mock("../gateways/socket/emitters/gameEmitters.js", async (importOriginal) => {
	const actual = await importOriginal<typeof import("../gateways/socket/emitters/gameEmitters.js")>();
	return {
		...actual,
		emitGameStart: vi.fn(),
		emitGameUpdate: vi.fn(),
		emitGameOver: vi.fn(),
		emitPlayerEliminated: vi.fn(),
		emitSpectatorForPlayer: vi.fn(),
	};
});

vi.mock("../services/shopService.js", () => ({
	settleGameRewards: vi.fn(async () => undefined),
}));

import { Game } from "./Game.js";
import { Piece } from "./Piece.js";
import { Player } from "./Player.js";
import { Room } from "./room.js";
import { O } from "../types/game/piecesGameTypes.js";
import {
	BOARD_HEIGHT,
	BOARD_WIDTH,
	LINE_CLEAR_SCORES,
	type Board,
	type Cell,
	type GameMode,
	type PlayerGameState,
} from "../types/game/gameTypes.js";

function makeSocket(id: string): Socket {
	return { id, emit: vi.fn(), on: vi.fn(), join: vi.fn(), leave: vi.fn() } as unknown as Socket;
}

function emptyBoard(): Board {
	return Array.from({ length: BOARD_HEIGHT }, () =>
		Array.from({ length: BOARD_WIDTH }, () => 0 as Cell),
	);
}

/** Ligne pleine sauf les colonnes listees dans `holes`. */
function fullRow(holes: number[] = []): Cell[] {
	return Array.from({ length: BOARD_WIDTH }, (_v, x) => (holes.includes(x) ? 0 : ("I" as Cell)));
}

function setup(mode: GameMode = "cascade"): { game: Game; state: PlayerGameState } {
	const room = new Room("salle");
	const player = new Player("joueur", makeSocket("sock0"), "avatar", "pirate");
	room.addPlayer(player);
	const game = new Game(mode, [player], room);
	const state = game.getPlayerStateBySocketId("sock0")!;
	state.board = emptyBoard();
	return { game, state };
}

/**
 * Pose une rangee en la rattachant a une piece. Poser des cases SANS identifiant les
 * laisserait toutes rattachees a « aucune piece », donc soudees entre elles: le test
 * ne dirait plus rien du decoupage en pieces, qui est tout l'enjeu de la cascade.
 */
function putRow(state: PlayerGameState, y: number, row: Cell[], pieceId: number): void {
	state.board[y] = [...row];
	state.pieceIds[y] = row.map((cell) => (cell === 0 ? 0 : pieceId));
}

/** Pose une case isolee rattachee a la piece `pieceId`. */
function putCell(state: PlayerGameState, y: number, x: number, pieceId: number, cell: Cell = "T"): void {
	state.board[y]![x] = cell;
	state.pieceIds[y]![x] = pieceId;
}

/** Colonnes occupees d'une rangee, pour comparer des plateaux lisiblement. */
function filledColumns(state: PlayerGameState, y: number): number[] {
	const row = state.board[y] ?? [];
	return row.flatMap((cell, x) => (cell !== 0 ? [x] : []));
}

/**
 * Mode cascade: apres un nettoyage, les blocs qui ne reposent plus sur rien retombent
 * — par PIECE entiere, pas case par case — et peuvent completer de nouvelles rangees.
 * Chaque maillon de la chaine multiplie le bareme.
 */
describe("mode cascade", () => {
	beforeEach(() => {
		vi.useFakeTimers();
		vi.clearAllMocks();
		vi.spyOn(console, "log").mockImplementation(() => undefined);
	});

	afterEach(() => {
		vi.useRealTimers();
		vi.restoreAllMocks();
	});

	it("fait retomber un bloc reste en l'air apres un nettoyage", () => {
		const { game, state } = setup();
		// Une case isolee tout en haut, une rangee pleine tout en bas.
		putCell(state, 0, 3, 1);
		putRow(state, BOARD_HEIGHT - 1, fullRow(), 2);

		expect(game.clearLines(state)).toBe(1);

		// La case a traverse tout le plateau vide et repose maintenant sur le sol.
		expect(filledColumns(state, 0)).toEqual([]);
		expect(filledColumns(state, BOARD_HEIGHT - 1)).toEqual([3]);
	});

	it("enchaine les nettoyages declenches par la retombee", () => {
		const { game, state } = setup();
		// Rangee pleine en bas; juste au-dessus une rangee trouee en colonne 0, et le
		// bouchon de cette colonne flotte deux rangees plus haut, isole du reste.
		putRow(state, BOARD_HEIGHT - 1, fullRow(), 2);
		putRow(state, BOARD_HEIGHT - 2, fullRow([0]), 2);
		putCell(state, BOARD_HEIGHT - 4, 0, 3);

		// 1er maillon: la rangee du bas. 2e maillon: le bouchon retombe dans le trou
		// et complete la rangee suivante.
		expect(game.clearLines(state)).toBe(2);
		expect(state.lines).toBe(2);
		expect(state.board.every((row) => row.every((cell) => cell === 0))).toBe(true);
	});

	it("multiplie le bareme par le rang du maillon", () => {
		const { game, state } = setup();
		putRow(state, BOARD_HEIGHT - 1, fullRow(), 2);
		putRow(state, BOARD_HEIGHT - 2, fullRow([0]), 2);
		putCell(state, BOARD_HEIGHT - 4, 0, 3);

		game.clearLines(state);

		// Deux salves d'une ligne: 100 x1 (niveau 1) puis 100 x2 pour le 2e maillon.
		const single = LINE_CLEAR_SCORES[1]!;
		expect(state.score).toBe(single * 1 + single * 2);
	});

	// Le choix de jeu du mode: une piece tombe ENTIERE. Une granularite a la case
	// reboucherait tous les trous a chaque ligne faite et rendrait le mode deux fois
	// plus permissif que le classique.
	it("garde le trou qu'un bloc recouvre: une piece tombe d'un seul tenant", () => {
		const { game, state } = setup();
		// Un pont horizontal de 3 cases pose sur deux piliers, avec un vide dessous.
		putRow(state, BOARD_HEIGHT - 1, fullRow(), 1);
		// Les 3 cases du pont appartiennent a la MEME piece: elles tombent ensemble.
		putCell(state, BOARD_HEIGHT - 3, 2, 2, "L");
		putCell(state, BOARD_HEIGHT - 3, 3, 2, "L");
		putCell(state, BOARD_HEIGHT - 3, 4, 2, "L");

		game.clearLines(state);

		// Le pont est descendu d'une rangee (la ligne nettoyee), pas plus: il touche
		// le sol par ses extremites et le trou du milieu est conserve.
		expect(filledColumns(state, BOARD_HEIGHT - 1)).toEqual([2, 3, 4]);
		expect(filledColumns(state, BOARD_HEIGHT - 2)).toEqual([]);
	});

	/**
	 * Une rangee de penalite est une unite au meme titre qu'une piece. Disloquee, ses
	 * cases se repartiraient sur plusieurs rangees — et comme clearLines refuse toute
	 * rangee contenant une case de penalite, une seule salve en condamnerait quatre au
	 * lieu d'une. Indestructible, pas contagieuse.
	 */
	it("garde une rangee de penalite d'un seul tenant", () => {
		const { game, state } = setup();
		// Sol troue en colonne 5, rangee pleine juste au-dessus (elle part), puis la
		// rangee de penalite qui surplombe le tout.
		putRow(state, BOARD_HEIGHT - 1, fullRow([5]), 1);
		putRow(state, BOARD_HEIGHT - 2, fullRow(), 2);
		putRow(state, BOARD_HEIGHT - 3, game.createPenaltyLine(), 3);

		game.clearLines(state);

		// La penalite est descendue d'un cran, entiere: aucune de ses cases n'est
		// tombee dans le trou de la colonne 5.
		const penaltyRows = state.board
			.flatMap((row, y) => (row.some((cell) => cell === "penalty") ? [y] : []));
		expect(penaltyRows).toHaveLength(1);
		expect(state.board[penaltyRows[0]!]!.every((cell) => cell === "penalty")).toBe(true);
	});

	/**
	 * Non-regression: la cascade ne se declenchait quasiment jamais en partie reelle.
	 *
	 * Les amas etaient decoupes par simple CONTACT entre cases. Or dans une vraie
	 * partie la pile est un unique bloc soude: il suffisait qu'UNE case de ce bloc
	 * repose sur du plein pour que tout soit immobilise. Ici, deux morceaux de pieces
	 * DIFFERENTES sont cote a cote: celui de gauche est retenu, celui de droite
	 * surplombe un trou et doit tomber sans lui.
	 */
	it("fait tomber un morceau de piece meme colle a un morceau qui, lui, est retenu", () => {
		const { game, state } = setup();
		// Derniere rangee trouee en colonne 9; celle du dessus est pleine (elle part).
		putRow(state, BOARD_HEIGHT - 1, fullRow([9]), 1);
		putRow(state, BOARD_HEIGHT - 2, fullRow(), 2);
		// Deux cases voisines, issues de deux pieces distinctes.
		putCell(state, BOARD_HEIGHT - 3, 8, 3, "T");
		putCell(state, BOARD_HEIGHT - 3, 9, 4, "S");

		// La case de la colonne 9 tombe dans le trou et complete la derniere rangee.
		expect(game.clearLines(state)).toBe(2);
		// Ne reste que la case retenue (colonne 8), posee au sol.
		expect(filledColumns(state, BOARD_HEIGHT - 1)).toEqual([8]);
	});

	it("laisse le plateau intact quand aucune rangee n'est completee", () => {
		const { game, state } = setup();
		putCell(state, 5, 4, 1, "S");

		expect(game.clearLines(state)).toBe(0);
		// Sans nettoyage, pas de gravite: une piece en l'air n'est PAS aspiree vers le bas.
		expect(filledColumns(state, 5)).toEqual([4]);
	});

	it("n'applique la gravite qu'en mode cascade", () => {
		const { game, state } = setup("classique");
		putCell(state, 0, 3, 1);
		putRow(state, BOARD_HEIGHT - 1, fullRow(), 2);

		expect(game.clearLines(state)).toBe(1);
		// Mode classique: la case flottante descend d'une rangee (le bloc retire) et
		// reste en l'air.
		expect(filledColumns(state, 1)).toEqual([3]);
		expect(filledColumns(state, BOARD_HEIGHT - 1)).toEqual([]);
	});

	it("deplace les horodatages avec les blocs (fondu du mode invisible)", () => {
		const { game, state } = setup();
		putCell(state, 0, 3, 1);
		state.lockedAt[0]![3] = 1234;
		putRow(state, BOARD_HEIGHT - 1, fullRow(), 2);

		game.clearLines(state);

		expect(state.lockedAt[BOARD_HEIGHT - 1]![3]).toBe(1234);
		expect(state.lockedAt[0]![3]).toBe(0);
	});

	// Les tests ci-dessus appellent clearLines directement. Celui-ci passe par le VRAI
	// chemin de jeu (chute instantanee -> verrouillage -> nettoyage -> cascade ->
	// piece suivante): c'est lui qui prouve que le mode fonctionne en partie, et pas
	// seulement quand on appelle la fonction a la main.
	it("enchaine pour de vrai quand le joueur lache une piece", () => {
		const { game, state } = setup();
		// Rangee du bas trouee en colonne 5, celle du dessus trouee en colonnes 0-1.
		putRow(state, BOARD_HEIGHT - 1, fullRow([5]), 1);
		putRow(state, BOARD_HEIGHT - 2, fullRow([0, 1]), 2);
		// Une case en l'air dans la colonne 5, qui ne retombera qu'a la cascade.
		putCell(state, BOARD_HEIGHT - 6, 5, 3);
		// Piece O (carre 2x2) amenee au-dessus des colonnes 0-1.
		const piece = new Piece(O, "O");
		while (piece.getX() > 0) piece.moveLeft();
		state.currentPiece = piece;
		state.nextPiece = new Piece(O, "O");

		game.drop("sock0");

		// 1er maillon: le O bouche les colonnes 0-1 et complete l'avant-derniere rangee.
		// 2e maillon: la case en l'air retombe dans le trou laisse en colonne 5 et
		// complete la derniere. Sans cascade, une seule ligne serait partie.
		expect(state.lines).toBe(2);
		// Il ne reste que la moitie haute du O, posee au sol.
		expect(filledColumns(state, BOARD_HEIGHT - 1)).toEqual([0, 1]);
		expect(filledColumns(state, BOARD_HEIGHT - 2)).toEqual([]);
		// La partie continue normalement: une nouvelle piece a bien ete servie.
		expect(state.currentPiece).toBeDefined();
		expect(state.isAlive).toBe(true);
	});

	// Le plateau envoye au client montre les blocs DEJA arrives: sans la distance
	// parcourue, ils apparaitraient d'un coup a leur nouvelle place. Ces tests
	// verrouillent l'information d'animation.
	describe("information d'animation", () => {
		it("indique de combien de rangees chaque case est tombee", () => {
			const { game, state } = setup();
			putCell(state, 0, 3, 1);
			putRow(state, BOARD_HEIGHT - 1, fullRow(), 2);

			game.clearLines(state);

			// La case est passee de la rangee 0 a la derniere: elle a traverse tout le plateau.
			expect(state.cascade?.cells).toEqual([
				{ x: 3, y: BOARD_HEIGHT - 1, rows: BOARD_HEIGHT - 1 },
			]);
		});

		it("compte aussi le decalage du nettoyage, pas seulement la gravite", () => {
			const { game, state } = setup();
			// Un bloc pose juste au-dessus de la rangee nettoyee: il ne descend que d'un
			// cran, mais il descend — le client doit l'animer aussi.
			putRow(state, BOARD_HEIGHT - 1, fullRow(), 2);
			putCell(state, BOARD_HEIGHT - 2, 4, 2);

			game.clearLines(state);

			expect(state.cascade?.cells).toEqual([
				{ x: 4, y: BOARD_HEIGHT - 1, rows: 1 },
			]);
		});

		it("change d'identifiant a chaque retombee (sinon l'animation ne rejoue pas)", () => {
			const { game, state } = setup();
			putCell(state, 0, 3, 1);
			putRow(state, BOARD_HEIGHT - 1, fullRow(), 2);
			game.clearLines(state);
			const first = state.cascade?.id;

			putRow(state, BOARD_HEIGHT - 1, fullRow(), 2);
			game.clearLines(state);

			expect(first).toBeDefined();
			expect(state.cascade?.id).not.toBe(first);
		});

		it("efface la retombee precedente quand plus rien ne tombe", () => {
			const { game, state } = setup();
			putCell(state, 0, 3, 1);
			putRow(state, BOARD_HEIGHT - 1, fullRow(), 2);
			game.clearLines(state);
			expect(state.cascade).not.toBeNull();

			// Nettoyage suivant sans rien au-dessus: sans remise a zero, le client
			// rejouerait la chute d'avant.
			putRow(state, BOARD_HEIGHT - 1, fullRow(), 2);
			game.clearLines(state);

			expect(state.cascade).toBeNull();
		});

		it("ne produit aucune information d'animation hors mode cascade", () => {
			const { game, state } = setup("classique");
			putCell(state, 0, 3, 1);
			putRow(state, BOARD_HEIGHT - 1, fullRow(), 2);

			game.clearLines(state);

			expect(state.cascade).toBeNull();
		});
	});

	it("envoie a l'adversaire les lignes de TOUTE la chaine", () => {
		const room = new Room("salle");
		const players = [
			new Player("joueur0", makeSocket("sock0"), "avatar", "pirate"),
			new Player("joueur1", makeSocket("sock1"), "avatar", "marine"),
		];
		for (const player of players) room.addPlayer(player);
		const game = new Game("cascade", players, room);
		const attacker = game.getPlayerStateBySocketId("sock0")!;
		const victim = game.getPlayerStateBySocketId("sock1")!;
		attacker.board = emptyBoard();
		victim.board = emptyBoard();

		putRow(attacker, BOARD_HEIGHT - 1, fullRow(), 1);
		putRow(attacker, BOARD_HEIGHT - 2, fullRow([0]), 2);
		putCell(attacker, BOARD_HEIGHT - 4, 0, 3);

		const cleared = game.clearLines(attacker);
		game.addPenaltyToOpponents(attacker, cleared - 1);

		// 2 lignes au total sur la chaine -> 1 ligne de penalite (regle n-1 du sujet).
		expect(victim.board[BOARD_HEIGHT - 1]!.every((cell) => cell === "penalty")).toBe(true);
		expect(victim.board[BOARD_HEIGHT - 2]!.every((cell) => cell === 0)).toBe(true);
	});
});
