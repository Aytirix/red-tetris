import {
	isGameMode,
	MAX_JOKERS,
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
		linesTarget: typeof r.linesTarget === "number" ? r.linesTarget : null,
		timeLeftMs: typeof r.timeLeftMs === "number" ? r.timeLeftMs : null,
		fade: normalizeFade(r.fade, board),
		// Borne stricte: le HUD fait "★".repeat(jokersLeft), qui LEVE sur une valeur
		// negative et gele l'onglet sur une valeur enorme.
		jokersLeft: normalizeJokers(r.jokersLeft),
		theme: typeof r.theme === "string" && r.theme.length > 0 ? r.theme : null,
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
