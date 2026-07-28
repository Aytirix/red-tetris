import {
	isGameMode,
	MAX_JOKERS,
	type CascadeFall,
	type GameBoard,
	type GameBoardCell,
	type GameMode,
	type GameOverPayload,
	type GameOverScore,
	type GamePiece,
	type GameStatePayload,
	type GhostCell,
	type OpponentBoard,
	type PieceType,
} from "../types/game";

const PIECE_TYPES: PieceType[] = ["I", "J", "L", "O", "S", "T", "Z"];

function isPieceType(v: unknown): v is PieceType {
	return typeof v === "string" && (PIECE_TYPES as string[]).includes(v);
}

function normalizeCell(raw: unknown): GameBoardCell {
	if (raw === 0 || raw === null || raw === undefined) return 0;
	if (raw === 1) return "I"; // compat: ancien bloc générique → traité comme I
	if (raw === 2) return "penalty"; // compat: ancien code pénalité
	if (raw === "penalty") return "penalty";
	if (raw === "spectrum") return "spectrum";
	if (raw === "garbage") return "garbage";
	if (isPieceType(raw)) return raw;
	return 0;
}

function normalizeBoard(raw: unknown): GameBoard | null {
	if (!Array.isArray(raw) || raw.length === 0) return null;
	const rows: GameBoard = [];
	for (const row of raw) {
		if (!Array.isArray(row)) return null;
		rows.push(row.map(normalizeCell));
	}
	const cols = rows[0].length;
	if (cols === 0) return null;
	for (const r of rows) if (r.length !== cols) return null;
	return rows;
}

function normalizePiece(raw: unknown): GamePiece | null {
	if (!raw || typeof raw !== "object") return null;
	const t = (raw as { type?: unknown }).type;
	if (!isPieceType(t)) return null;
	return { type: t };
}

function normalizeOpponents(raw: unknown): OpponentBoard[] {
	if (!Array.isArray(raw)) return [];
	const out: OpponentBoard[] = [];
	for (const o of raw) {
		if (!o || typeof o !== "object") continue;
		const username = (o as { username?: unknown }).username;
		const board = normalizeBoard((o as { board?: unknown }).board);
		if (typeof username !== "string" || !username) continue;
		if (!board) continue;
		// alive absent → considéré vivant (rétro-compat / robustesse).
		const alive = (o as { alive?: unknown }).alive !== false;
		out.push({ username, board, alive });
	}
	return out;
}

function normalizeSpectator(raw: unknown): false | string {
	if (typeof raw === "string" && raw.length > 0) return raw;
	return false;
}

function normalizeGhost(raw: unknown): GhostCell[] {
	if (!Array.isArray(raw)) return [];
	const out: GhostCell[] = [];
	for (const c of raw) {
		if (!c || typeof c !== "object") continue;
		const x = (c as { x?: unknown }).x;
		const y = (c as { y?: unknown }).y;
		if (typeof x === "number" && typeof y === "number") out.push({ x, y });
	}
	return out;
}

/**
 * Retombée du mode Cascade. Une distance nulle ou absurde ne donnerait aucune
 * animation visible : on écarte la case plutôt que d'en faire une case immobile.
 */
function normalizeCascade(raw: unknown, board: GameBoard): CascadeFall | null {
	if (!raw || typeof raw !== "object") return null;
	const id = (raw as { id?: unknown }).id;
	const rawCells = (raw as { cells?: unknown }).cells;
	if (typeof id !== "number" || !Number.isFinite(id)) return null;
	if (!Array.isArray(rawCells)) return null;
	const rows = board.length;
	const cols = board[0]?.length ?? 0;
	const cells: CascadeFall["cells"] = [];
	for (const c of rawCells) {
		if (!c || typeof c !== "object") continue;
		const { x, y, rows: fallen } = c as { x?: unknown; y?: unknown; rows?: unknown };
		if (typeof x !== "number" || typeof y !== "number" || typeof fallen !== "number") continue;
		// Hors plateau: une case animée à une position inexistante décalerait l'effet.
		if (x < 0 || x >= cols || y < 0 || y >= rows) continue;
		if (!Number.isFinite(fallen) || fallen <= 0) continue;
		cells.push({ x, y, rows: Math.min(rows, Math.trunc(fallen)) });
	}
	if (cells.length === 0) return null;
	return { id, cells };
}

function normalizeJokers(raw: unknown): number {
	if (typeof raw !== "number" || !Number.isFinite(raw)) return 0;
	return Math.max(0, Math.min(MAX_JOKERS, Math.trunc(raw)));
}

function normalizeMode(raw: unknown): GameMode {
	// Mode absent ou inconnu (vieux serveur / payload partiel) -> classique.
	if (typeof raw === "string" && isGameMode(raw)) return raw;
	return "classique";
}

/** Grille d'opacite du mode invisible; doit avoir exactement la taille du plateau. */
function normalizeFade(raw: unknown, board: GameBoard): number[][] | null {
	if (!Array.isArray(raw) || raw.length !== board.length) return null;
	const rows: number[][] = [];
	for (let y = 0; y < raw.length; y++) {
		const row = raw[y];
		const width = board[y]?.length ?? 0;
		if (!Array.isArray(row) || row.length !== width) return null;
		// Number.isFinite: NaN traverserait Math.min/max et produirait une opacite CSS
		// invalide -> la cellule redeviendrait VISIBLE alors qu'elle doit etre cachee.
		rows.push(row.map((value) => (
			typeof value === "number" && Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : 1
		)));
	}
	return rows;
}

export function normalizeGameState(raw: unknown): GameStatePayload | null {
	if (!raw || typeof raw !== "object") return null;
	const r = raw as Record<string, unknown>;
	const board = normalizeBoard(r.board);
	if (!board) return null;
	const score = typeof r.score === "number" ? r.score : 0;
	const level = typeof r.level === "number" ? r.level : 1;
	return {
		board,
		opponents: normalizeOpponents(r.opponents),
		currentPiece: normalizePiece(r.currentPiece),
		nextPiece: normalizePiece(r.nextPiece),
		score,
		level,
		spectator: normalizeSpectator(r.spectator),
		ghost: normalizeGhost(r.ghost),
		mode: normalizeMode(r.mode),
		lines: typeof r.lines === "number" ? r.lines : 0,
		// Compteurs d'affichage: un négatif ou un non-fini n'a pas de sens, et un
		// décimal afficherait « 3.0000001 Tetris ».
		tetris: typeof r.tetris === "number" && Number.isFinite(r.tetris) && r.tetris > 0
			? Math.trunc(r.tetris)
			: 0,
		linesTarget: typeof r.linesTarget === "number" ? r.linesTarget : null,
		timeLeftMs: typeof r.timeLeftMs === "number" ? r.timeLeftMs : null,
		fade: normalizeFade(r.fade, board),
		// Borne stricte: le HUD fait "★".repeat(jokersLeft), qui LEVE sur une valeur
		// negative et gele l'onglet sur une valeur enorme.
		jokersLeft: normalizeJokers(r.jokersLeft),
		theme: typeof r.theme === "string" && r.theme.length > 0 ? r.theme : null,
		// Negatif ou non fini -> pas de decompte plutot qu'une animation a duree absurde.
		lockInMs: typeof r.lockInMs === "number" && Number.isFinite(r.lockInMs) && r.lockInMs >= 0
			? r.lockInMs
			: null,
		// Compteur du mode Gruyère: un négatif ou un non-fini n'a aucun sens à
		// l'affichage -> pas de compteur plutôt qu'un "-3 restantes".
		garbageLeft: typeof r.garbageLeft === "number" && Number.isFinite(r.garbageLeft) && r.garbageLeft >= 0
			? Math.trunc(r.garbageLeft)
			: null,
		cascade: normalizeCascade(r.cascade, board),
	};
}

export function normalizeGameOver(raw: unknown): GameOverPayload | null {
	if (!raw || typeof raw !== "object") return null;
	const r = raw as Record<string, unknown>;
	const winner = typeof r.winner === "string" ? r.winner : null;
	const scoresRaw = Array.isArray(r.scores) ? r.scores : [];
	const scores: GameOverScore[] = [];
	for (const s of scoresRaw) {
		if (!s || typeof s !== "object") continue;
		const username = (s as { username?: unknown }).username;
		const score = (s as { score?: unknown }).score;
		const level = (s as { level?: unknown }).level;
		if (typeof username !== "string" || !username) continue;
		if (typeof score !== "number") continue;
		scores.push({
			username,
			score,
			...(typeof level === "number" ? { level } : {}),
		});
	}
	return { winner, scores };
}
