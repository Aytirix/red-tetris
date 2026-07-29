import type { Piece } from "../../core/Piece.js";
import type { Player } from "../../core/Player.js";
import type { PieceShape } from "./piecesGameTypes.js";

export const BOARD_WIDTH = 10;
export const BOARD_HEIGHT = 20;

// Modes de jeu disponibles. "classique" = regles de base (survie / dernier debout).
export const GAME_MODES = ["classique", "sprint", "ultra", "suddendeath", "invisible", "cascade", "cheese"] as const;
export type GameMode = (typeof GAME_MODES)[number];

export function isGameMode(value: string): value is GameMode {
	return (GAME_MODES as readonly string[]).includes(value);
}

// Bareme de score du Tetris Guideline (indexe par nombre de lignes nettoyees d'un
// SEUL coup, 0 a 4), multiplie par le niveau. La prime aux multi-lignes est la
// mecanique centrale du jeu: un Tetris rapporte 8x un Single, pas 4x, ce qui
// recompense le joueur qui creuse un puits et attend la barre I au lieu d'aplanir.
export const LINE_CLEAR_SCORES = [0, 100, 300, 500, 800] as const;
// Points par case gagnee volontairement (bareme Guideline, NON multiplie par le
// niveau): descendre soi-meme la piece rapporte un peu, la lacher d'un coup rapporte
// le double — c'est ce qui recompense le joueur qui ne laisse pas la gravite faire.
export const SOFT_DROP_POINTS_PER_CELL = 1;
export const HARD_DROP_POINTS_PER_CELL = 2;
// Lignes a nettoyer pour monter d'un niveau. Le niveau se calculait avant sur le
// score (500 pts = 5 lignes a 100 pts/ligne); on garde exactement la meme cadence de
// difficulte, mais adossee aux LIGNES: le score n'est plus proportionnel aux lignes
// (multi-lignes et multiplicateur de niveau), il ferait exploser la vitesse.
export const LINES_PER_LEVEL = 5;

// Sursis d'ajustement d'une piece qui vient de toucher la pile, exprime en FRACTION
// d'une frame de gravite: il suit donc la meme acceleration que la chute (plus le
// niveau monte, moins on a de temps), tout en restant nettement plus confortable
// qu'une frame seche. Le sujet (V.1.1) exige au minimum la frame suivante; un facteur
// > 1 la respecte toujours.
export const LOCK_GRACE_FACTOR = 1.75;
// Plancher: aux niveaux les plus rapides (frame a 80 ms), 1,75 frame ne laisserait pas
// le temps de reagir. En dessous de ce seuil le jeu devient injouable, pas difficile.
export const LOCK_GRACE_MIN_MS = 250;
// Nombre de fois qu'une piece peut reprendre sa chute apres avoir touche la pile (et
// donc relancer son sursis). Sans ce plafond, spammer la rotation d'une piece posee
// suffit a la faire leviter indefiniment: le wall kick vertical la decolle, le sursis
// repart, elle ne se verrouille jamais. 15, comme le Tetris Guideline.
export const MAX_LOCK_RESETS = 15;

// Sprint: premier a nettoyer 40 lignes.
export const SPRINT_TARGET_LINES = 40;
// Ultra: 2 minutes, meilleur score.
export const ULTRA_DURATION_MS = 120_000;
// Sudden death: vitesse maximale des le depart (une seule vie, le plus endurant gagne).
export const SUDDEN_DEATH_TICK_MS = 120;
// Invisible: une piece verrouillee s'efface progressivement et disparait apres 3s.
export const INVISIBLE_FADE_MS = 3_000;
// Invisible: chaque ligne completee redonne 2s de visibilite totale (cumulables).
export const INVISIBLE_REVEAL_PER_LINE_MS = 2_000;
// Invisible: plafond de visibilite "en banque". Sans lui, un joueur qui enchaine
// les lignes garderait le plateau visible en permanence et annulerait le mode.
export const INVISIBLE_REVEAL_CAP_MS = 6_000;
// Invisible: jokers par partie, chacun revelant le plateau 3s a la demande.
export const INVISIBLE_JOKER_COUNT = 3;
export const INVISIBLE_JOKER_REVEAL_MS = 3_000;

// Cheese: nombre total de lignes de gruyere (percees d'un trou) a creuser pour
// gagner la course.
export const CHEESE_TOTAL_GARBAGE = 20;
// Cheese: combien sont posees sur le plateau au coup d'envoi. Les autres attendent
// leur tour: le plateau ne peut pas commencer avec 20 rangees sur 20.
export const CHEESE_START_GARBAGE = 10;
// Cheese: lignes de gruyere a creuser pour que le plateau remonte d'une rangee.
// La cadence est plus lente que la destruction (2 pour 1): le joueur gagne du
// terrain en avancant, sinon la course serait interminable.
export const CHEESE_CLEARS_PER_RISE = 2;

export type PieceType = "I" | "J" | "L" | "O" | "S" | "T" | "Z";

export type currentPiece = {
	type: PieceType;
};

// "spectrum": cellule du spectre envoye aux adversaires (hauteur de pile, sans couleur).
// "garbage" : gruyere du mode cheese. Contrairement a "penalty" (pleine et
// indestructible), une rangee de gruyere est percee et se nettoie normalement:
// c'est l'objectif du mode, pas une sanction.
export type Cell = 0 | PieceType | "penalty" | "spectrum" | "garbage";

export type Board = Cell [][];

export type OpponentBoard = {
	username: string;
	board: Board;
	alive: boolean;
};

/**
 * Mode cascade: retombee de blocs a animer par le client. Le serveur n'envoie que le
 * plateau FINAL (les blocs y sont deja arrives): sans la distance parcourue, le client
 * ne peut que les faire apparaitre d'un coup. `id` change a chaque nouvelle retombee,
 * ce qui permet de ne jouer l'animation qu'une fois meme si l'info reste dans les
 * frames suivantes.
 */
export type CascadeFall = {
	id: number;
	/** Position d'ARRIVEE de la case, et nombre de rangees qu'elle vient de descendre. */
	cells: { x: number; y: number; rows: number }[];
};

export type PlayerGameState = {
	board: Board;
	score: number;
	level: number;
	// Total de lignes nettoyees (objectif du mode sprint).
	lines: number;
	// Nombre de « Tetris » realises (4 lignes nettoyees d'un coup). Statistiques.
	tetris: number;
	// Instant de verrouillage (ms) de chaque cellule, aligne sur `board`. 0 = pas de
	// verrouillage horodate (case vide ou ligne de penalite). Sert au fondu du mode
	// invisible; decale en meme temps que le plateau (lignes completees / penalites).
	lockedAt: number[][];
	// Identifiant de la PIECE qui a pose chaque cellule, aligne sur `board` (0 = case
	// vide). Le mode cascade s'en sert pour faire retomber les pieces une par une:
	// regrouper les cases simplement collees les unes aux autres ne marche pas, la pile
	// d'une vraie partie ne formant qu'un seul bloc soude — plus rien ne tomberait
	// jamais. Chaque rangee ajoutee (penalite, gruyere) recoit aussi son identifiant.
	pieceIds: number[][];
	// Derniere retombee de blocs (mode cascade), null si le dernier verrouillage n'en a
	// pas produit. Reste dans les frames jusqu'au verrouillage suivant: le client s'en
	// sert une fois, via l'identifiant.
	cascade: CascadeFall | null;
	// Mode invisible: jokers restants (revelation a la demande).
	jokersLeft: number;
	// Mode invisible: instant a partir duquel le fondu reprend. Sert de PLANCHER a
	// l'horodatage des pieces posees pendant une revelation, pour qu'elles
	// disparaissent avec les autres et non avant.
	revealUntil: number;
	// Instant (ms) ou la piece courante a touche la pile, null si elle peut encore
	// descendre. Le sujet (V.1.1) exige qu'une piece au contact ne se fige qu'a la
	// frame SUIVANTE: on mesure donc le sursis depuis le contact reel, et non depuis
	// le dernier tick — sinon une piece posee juste avant un tick n'aurait quasiment
	// aucun temps d'ajustement.
	groundedAt: number | null;
	// Sursis deja consommes par la piece courante (voir MAX_LOCK_RESETS).
	lockResets: number;
	// Mode cheese: lignes de gruyere DETRUITES (objectif: CHEESE_TOTAL_GARBAGE) et
	// lignes deja SERVIES, c'est-a-dire posees sur le plateau (les autres attendent
	// leur tour en coulisse). Le client n'affiche que le reste a creuser.
	garbageCleared: number;
	garbageServed: number;
	pieceIndex: number
	player: Player;
	isAlive: boolean;
	// Depart volontaire (room:leave / deconnexion), distinct d'un top-out: un joueur
	// parti ne peut pas remporter une partie au score.
	hasAbandoned: boolean;
	spectator: boolean | string;
	currentPiece?: Piece;
	nextPiece?: Piece;
}
