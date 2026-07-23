import type {
	GameBoard,
	GameBoardCell,
	GameOverPayload,
	GameOverScore,
	GamePiece,
	GameStatePayload,
	GhostCell,
	OpponentBoard,
	PieceType,
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
