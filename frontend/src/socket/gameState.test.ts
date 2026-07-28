import { describe, expect, it } from "vitest";
import { normalizeGameOver, normalizeGameState } from "./gameState";

const ROW = (...cells: unknown[]) => cells;

describe("normalizeGameState — garde-fous d'entree", () => {
	it("retourne null pour une valeur non objet", () => {
		expect(normalizeGameState(null)).toBeNull();
		expect(normalizeGameState(undefined)).toBeNull();
		expect(normalizeGameState("game")).toBeNull();
		expect(normalizeGameState(42)).toBeNull();
		expect(normalizeGameState(true)).toBeNull();
	});

	it("retourne null quand le plateau est absent ou invalide", () => {
		expect(normalizeGameState({})).toBeNull();
		expect(normalizeGameState({ board: null })).toBeNull();
		expect(normalizeGameState({ board: "board" })).toBeNull();
		expect(normalizeGameState({ board: [] })).toBeNull();
	});

	it("retourne null quand une ligne n'est pas un tableau", () => {
		expect(normalizeGameState({ board: [[0, 0], "nope"] })).toBeNull();
	});

	it("retourne null quand le plateau n'a aucune colonne", () => {
		expect(normalizeGameState({ board: [[], []] })).toBeNull();
	});

	it("retourne null quand les lignes n'ont pas toutes la meme largeur", () => {
		expect(normalizeGameState({ board: [[0, 0, 0], [0, 0]] })).toBeNull();
	});
});

describe("normalizeGameState — normalisation des cellules", () => {
	it("mappe les valeurs de compatibilite et les types de piece", () => {
		const state = normalizeGameState({
			board: [ROW(0, 1, 2, "penalty", "I", "Z", null, undefined, "X", {}, 7)],
		});

		expect(state).not.toBeNull();
		expect(state!.board[0]).toEqual([
			0,
			"I",
			"penalty",
			"penalty",
			"I",
			"Z",
			0,
			0,
			0,
			0,
			0,
		]);
	});

	it("accepte les cellules de spectre envoyees pour les adversaires", () => {
		const state = normalizeGameState({
			board: [ROW(0, "spectrum", "spectrum", 0, 0, 0, 0, 0, 0, 0, 0)],
		});

		expect(state!.board[0][1]).toBe("spectrum");
		expect(state!.board[0][2]).toBe("spectrum");
	});

	it("accepte les 7 types de pieces", () => {
		const state = normalizeGameState({ board: [ROW("I", "J", "L", "O", "S", "T", "Z")] });
		expect(state!.board[0]).toEqual(["I", "J", "L", "O", "S", "T", "Z"]);
	});
});

describe("normalizeGameState — valeurs par defaut", () => {
	it("remplit score/level/opponents/pieces/ghost quand ils sont absents", () => {
		const state = normalizeGameState({ board: [[0, 0]] })!;

		expect(state.score).toBe(0);
		expect(state.level).toBe(1);
		expect(state.opponents).toEqual([]);
		expect(state.currentPiece).toBeNull();
		expect(state.nextPiece).toBeNull();
		expect(state.spectator).toBe(false);
		expect(state.ghost).toEqual([]);
	});

	it("ignore un score et un level non numeriques", () => {
		const state = normalizeGameState({ board: [[0]], score: "1200", level: null })!;
		expect(state.score).toBe(0);
		expect(state.level).toBe(1);
	});

	it("conserve un score et un level numeriques (y compris 0)", () => {
		const state = normalizeGameState({ board: [[0]], score: 1200, level: 0 })!;
		expect(state.score).toBe(1200);
		expect(state.level).toBe(0);
	});
});

describe("normalizeGameState — pieces courante et suivante", () => {
	it("normalise une piece valide", () => {
		const state = normalizeGameState({
			board: [[0]],
			currentPiece: { type: "T", x: 4, y: 0 },
			nextPiece: { type: "O" },
		})!;

		expect(state.currentPiece).toEqual({ type: "T" });
		expect(state.nextPiece).toEqual({ type: "O" });
	});

	it("retourne null pour une piece mal formee", () => {
		const state = normalizeGameState({
			board: [[0]],
			currentPiece: { type: "W" },
			nextPiece: "O",
		})!;

		expect(state.currentPiece).toBeNull();
		expect(state.nextPiece).toBeNull();
	});

	it("retourne null pour une piece nulle ou sans type", () => {
		const state = normalizeGameState({ board: [[0]], currentPiece: null, nextPiece: {} })!;
		expect(state.currentPiece).toBeNull();
		expect(state.nextPiece).toBeNull();
	});
});

describe("normalizeGameState — adversaires", () => {
	it("retourne un tableau vide quand opponents n'est pas un tableau", () => {
		expect(normalizeGameState({ board: [[0]], opponents: "nope" })!.opponents).toEqual([]);
	});

	it("considere un adversaire vivant quand alive est absent", () => {
		const state = normalizeGameState({
			board: [[0]],
			opponents: [{ username: "luffy", board: [[0, "I"]] }],
		})!;

		expect(state.opponents).toEqual([
			{ username: "luffy", board: [[0, "I"]], alive: true },
		]);
	});

	it("respecte alive: false", () => {
		const state = normalizeGameState({
			board: [[0]],
			opponents: [{ username: "zoro", board: [[0]], alive: false }],
		})!;

		expect(state.opponents[0].alive).toBe(false);
	});

	it("ignore les entrees invalides (non objet, sans pseudo, plateau invalide)", () => {
		const state = normalizeGameState({
			board: [[0]],
			opponents: [
				null,
				"nami",
				42,
				{ username: "", board: [[0]] },
				{ username: 7, board: [[0]] },
				{ username: "sanji" },
				{ username: "usopp", board: [] },
				{ username: "robin", board: [[0], [0, 0]] },
				{ username: "chopper", board: [[0]] },
			],
		})!;

		expect(state.opponents).toHaveLength(1);
		expect(state.opponents[0].username).toBe("chopper");
	});
});

describe("normalizeGameState — spectateur", () => {
	it("retourne le pseudo observe quand c'est une chaine non vide", () => {
		expect(normalizeGameState({ board: [[0]], spectator: "luffy" })!.spectator).toBe("luffy");
	});

	it("retourne false pour une chaine vide ou une valeur non textuelle", () => {
		expect(normalizeGameState({ board: [[0]], spectator: "" })!.spectator).toBe(false);
		expect(normalizeGameState({ board: [[0]], spectator: true })!.spectator).toBe(false);
		expect(normalizeGameState({ board: [[0]], spectator: null })!.spectator).toBe(false);
	});
});

describe("normalizeGameState — projection fantome", () => {
	it("retourne un tableau vide quand ghost n'est pas un tableau", () => {
		expect(normalizeGameState({ board: [[0]], ghost: { x: 1, y: 2 } })!.ghost).toEqual([]);
	});

	it("garde uniquement les cellules avec x et y numeriques", () => {
		const state = normalizeGameState({
			board: [[0]],
			ghost: [
				{ x: 1, y: 2 },
				{ x: "1", y: 2 },
				{ x: 1 },
				{ y: 2 },
				null,
				"ghost",
				{ x: 0, y: 0 },
			],
		})!;

		expect(state.ghost).toEqual([
			{ x: 1, y: 2 },
			{ x: 0, y: 0 },
		]);
	});
});

describe("normalizeGameState — payload complet", () => {
	it("normalise un etat de partie realiste", () => {
		const board = Array.from({ length: 20 }, () => Array.from({ length: 10 }, () => 0));
		const state = normalizeGameState({
			board,
			opponents: [{ username: "zoro", board, alive: true }],
			currentPiece: { type: "S" },
			nextPiece: { type: "L" },
			score: 4200,
			level: 5,
			spectator: false,
			ghost: [{ x: 3, y: 19 }],
		})!;

		expect(state.board).toHaveLength(20);
		expect(state.board[0]).toHaveLength(10);
		expect(state.opponents).toHaveLength(1);
		expect(state.currentPiece).toEqual({ type: "S" });
		expect(state.nextPiece).toEqual({ type: "L" });
		expect(state.score).toBe(4200);
		expect(state.level).toBe(5);
		expect(state.spectator).toBe(false);
		expect(state.ghost).toEqual([{ x: 3, y: 19 }]);
	});
});

describe("normalizeGameOver", () => {
	it("retourne null pour une valeur non objet", () => {
		expect(normalizeGameOver(null)).toBeNull();
		expect(normalizeGameOver(undefined)).toBeNull();
		expect(normalizeGameOver("over")).toBeNull();
		expect(normalizeGameOver(0)).toBeNull();
	});

	it("retourne un gagnant null et des scores vides pour un objet vide", () => {
		expect(normalizeGameOver({})).toEqual({ winner: null, scores: [] });
	});

	it("ignore un gagnant non textuel", () => {
		expect(normalizeGameOver({ winner: 42 })!.winner).toBeNull();
		expect(normalizeGameOver({ winner: null })!.winner).toBeNull();
	});

	it("conserve le gagnant et les scores valides", () => {
		expect(
			normalizeGameOver({
				winner: "luffy",
				scores: [
					{ username: "luffy", score: 5000, level: 7 },
					{ username: "zoro", score: 3000 },
				],
			}),
		).toEqual({
			winner: "luffy",
			scores: [
				{ username: "luffy", score: 5000, level: 7 },
				{ username: "zoro", score: 3000 },
			],
		});
	});

	it("omet le level quand il n'est pas numerique", () => {
		const result = normalizeGameOver({ scores: [{ username: "nami", score: 10, level: "3" }] })!;
		expect(result.scores[0]).toEqual({ username: "nami", score: 10 });
		expect("level" in result.scores[0]).toBe(false);
	});

	it("ignore les scores mal formes", () => {
		const result = normalizeGameOver({
			scores: [
				null,
				"score",
				{ username: "", score: 1 },
				{ username: 1, score: 1 },
				{ username: "sanji" },
				{ username: "brook", score: "12" },
				{ username: "franky", score: 0 },
			],
		})!;

		expect(result.scores).toEqual([{ username: "franky", score: 0 }]);
	});

	it("retourne des scores vides quand scores n'est pas un tableau", () => {
		expect(normalizeGameOver({ winner: "luffy", scores: "nope" })!.scores).toEqual([]);
	});
});

describe("normalizeGameState — champs de mode", () => {
	const base = { board: [[0, 0], [0, 0]], score: 0, level: 1 };

	it("retombe sur classique quand le mode est absent ou inconnu", () => {
		expect(normalizeGameState(base)!.mode).toBe("classique");
		expect(normalizeGameState({ ...base, mode: "hardcore" })!.mode).toBe("classique");
	});

	it("lit mode, lignes, objectif et chrono", () => {
		const state = normalizeGameState({
			...base,
			mode: "sprint",
			lines: 12,
			linesTarget: 40,
			timeLeftMs: 5000,
		})!;

		expect(state.mode).toBe("sprint");
		expect(state.lines).toBe(12);
		expect(state.linesTarget).toBe(40);
		expect(state.timeLeftMs).toBe(5000);
	});

	it("met des valeurs neutres quand les champs de mode manquent", () => {
		const state = normalizeGameState(base)!;
		expect(state.lines).toBe(0);
		expect(state.linesTarget).toBeNull();
		expect(state.timeLeftMs).toBeNull();
		expect(state.fade).toBeNull();
	});

	it("accepte une grille fade alignee sur le plateau et borne les valeurs", () => {
		const state = normalizeGameState({ ...base, mode: "invisible", fade: [[0.5, 2], [-1, "x"]] })!;
		expect(state.fade).toEqual([[0.5, 1], [0, 1]]);
	});

	it("rejette une grille fade de mauvaise taille", () => {
		expect(normalizeGameState({ ...base, fade: [[1, 1]] })!.fade).toBeNull();
		expect(normalizeGameState({ ...base, fade: [[1], [1]] })!.fade).toBeNull();
		expect(normalizeGameState({ ...base, fade: "nope" })!.fade).toBeNull();
	});
});

describe("normalizeGameState — jokers", () => {
	const base = { board: [[0, 0], [0, 0]], score: 0, level: 1 };

	it("lit le nombre de jokers restants", () => {
		expect(normalizeGameState({ ...base, mode: "invisible", jokersLeft: 2 })!.jokersLeft).toBe(2);
	});

	it("retombe a 0 si absent ou invalide", () => {
		expect(normalizeGameState(base)!.jokersLeft).toBe(0);
		expect(normalizeGameState({ ...base, jokersLeft: "trois" })!.jokersLeft).toBe(0);
	});
});

describe("normalizeGameState — sursis avant verrouillage", () => {
	const base = { board: [[0, 0], [0, 0]], score: 0, level: 1 };

	it("lit le sursis envoye par le serveur", () => {
		expect(normalizeGameState({ ...base, lockInMs: 240 })!.lockInMs).toBe(240);
		expect(normalizeGameState({ ...base, lockInMs: 0 })!.lockInMs).toBe(0);
	});

	it("vaut null si absent (piece encore en chute)", () => {
		expect(normalizeGameState(base)!.lockInMs).toBeNull();
		expect(normalizeGameState({ ...base, lockInMs: null })!.lockInMs).toBeNull();
	});

	// Une duree negative ou NaN produirait une animation CSS a duree invalide: la jauge
	// se remplirait instantanement, donnant une echeance fausse au joueur.
	it("ignore les durees absurdes", () => {
		expect(normalizeGameState({ ...base, lockInMs: -50 })!.lockInMs).toBeNull();
		expect(normalizeGameState({ ...base, lockInMs: NaN })!.lockInMs).toBeNull();
		expect(normalizeGameState({ ...base, lockInMs: "400" })!.lockInMs).toBeNull();
	});
});

describe("normalizeGameState — valeurs hostiles (audit)", () => {
	const base = { board: [[0, 0], [0, 0]], score: 0, level: 1 };

	it("borne jokersLeft (un negatif ferait planter le rendu du HUD)", () => {
		expect(normalizeGameState({ ...base, jokersLeft: -1 })!.jokersLeft).toBe(0);
		expect(normalizeGameState({ ...base, jokersLeft: 1e9 })!.jokersLeft).toBe(3);
		expect(normalizeGameState({ ...base, jokersLeft: 2.7 })!.jokersLeft).toBe(2);
		expect(normalizeGameState({ ...base, jokersLeft: NaN })!.jokersLeft).toBe(0);
	});

	it("neutralise NaN dans la grille de fondu (sinon la case redevient visible)", () => {
		const state = normalizeGameState({ ...base, fade: [[NaN, 1], [1, 1]] })!;
		expect(state.fade![0][0]).toBe(1);
		expect(Number.isNaN(state.fade![0][0])).toBe(false);
	});
});
