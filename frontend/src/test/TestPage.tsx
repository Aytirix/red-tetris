import { useReducer, useEffect, useRef, useCallback } from "react";
import { Link } from "react-router-dom";
import { useHandsController } from "./hands_detector";
import type { GameAction } from "./hands_detector";

// ─── Constants ────────────────────────────────────────────────────────────────

const COLS = 10;
const ROWS = 20;
const CELL = 28;
const CAMERA_WIDTH = 480;
const CAMERA_HEIGHT = 360;

type PieceId = "I" | "O" | "T" | "S" | "Z" | "J" | "L";

const SHAPES: Record<PieceId, number[][]> = {
	I: [[1, 1, 1, 1]],
	O: [[1, 1], [1, 1]],
	T: [[0, 1, 0], [1, 1, 1]],
	S: [[0, 1, 1], [1, 1, 0]],
	Z: [[1, 1, 0], [0, 1, 1]],
	J: [[1, 0, 0], [1, 1, 1]],
	L: [[0, 0, 1], [1, 1, 1]],
};

const COLORS: Record<PieceId, string> = {
	I: "#3de7ff",
	O: "#ffd700",
	T: "#9069ff",
	S: "#33ff99",
	Z: "#ff365f",
	J: "#4d9fff",
	L: "#ff9933",
};

const IDS: PieceId[] = ["I", "O", "T", "S", "Z", "J", "L"];
const LINE_SCORE = [0, 100, 300, 500, 800];

// ─── Types ────────────────────────────────────────────────────────────────────

type Cell = string | null;
type Board = Cell[][];
type Piece = { id: PieceId; shape: number[][]; x: number; y: number };
type Status = "idle" | "playing" | "gameover";
type State = { board: Board; piece: Piece | null; score: number; lines: number; status: Status };
type Action = { type: "START" | "TICK" | "LEFT" | "RIGHT" | "DOWN" | "ROTATE" | "DROP" };

// ─── Pure helpers ─────────────────────────────────────────────────────────────

function emptyBoard(): Board {
	return Array.from({ length: ROWS }, () => Array<Cell>(COLS).fill(null));
}

function spawnPiece(): Piece {
	const id = IDS[Math.floor(Math.random() * IDS.length)];
	const shape = SHAPES[id];
	return { id, shape, x: Math.floor((COLS - shape[0].length) / 2), y: 0 };
}

function rotateCW(shape: number[][]): number[][] {
	return shape[0].map((_, c) => shape.map(row => row[c]).reverse());
}

function valid(board: Board, piece: Piece, dx = 0, dy = 0, shape = piece.shape): boolean {
	for (let r = 0; r < shape.length; r++)
		for (let c = 0; c < shape[r].length; c++) {
			if (!shape[r][c]) continue;
			const nx = piece.x + c + dx;
			const ny = piece.y + r + dy;
			if (nx < 0 || nx >= COLS || ny >= ROWS) return false;
			if (ny >= 0 && board[ny][nx]) return false;
		}
	return true;
}

function lock(board: Board, piece: Piece): Board {
	const b = board.map(r => [...r]);
	for (let r = 0; r < piece.shape.length; r++)
		for (let c = 0; c < piece.shape[r].length; c++)
			if (piece.shape[r][c] && piece.y + r >= 0)
				b[piece.y + r][piece.x + c] = COLORS[piece.id];
	return b;
}

function sweep(board: Board): { board: Board; cleared: number } {
	const kept = board.filter(row => row.some(c => c === null));
	const cleared = ROWS - kept.length;
	const pad = Array.from({ length: cleared }, () => Array<Cell>(COLS).fill(null));
	return { board: [...pad, ...kept], cleared };
}

function landPiece(state: State, piece: Piece): State {
	const locked = lock(state.board, piece);
	const { board, cleared } = sweep(locked);
	const next = spawnPiece();
	if (!valid(board, next))
		return { ...state, board: locked, piece: null, status: "gameover" };
	return {
		...state,
		board,
		piece: next,
		score: state.score + (LINE_SCORE[cleared] ?? 0),
		lines: state.lines + cleared,
	};
}

// ─── Reducer ──────────────────────────────────────────────────────────────────

const INIT: State = { board: emptyBoard(), piece: null, score: 0, lines: 0, status: "idle" };

function reducer(state: State, action: Action): State {
	if (action.type === "START")
		return { board: emptyBoard(), piece: spawnPiece(), score: 0, lines: 0, status: "playing" };

	if (state.status !== "playing" || !state.piece) return state;
	const p = state.piece;

	switch (action.type) {
		case "LEFT":   return valid(state.board, p, -1) ? { ...state, piece: { ...p, x: p.x - 1 } } : state;
		case "RIGHT":  return valid(state.board, p,  1) ? { ...state, piece: { ...p, x: p.x + 1 } } : state;
		case "DOWN":   return valid(state.board, p, 0, 1) ? { ...state, piece: { ...p, y: p.y + 1 } } : state;
		case "ROTATE": {
			const s = rotateCW(p.shape);
			return valid(state.board, p, 0, 0, s) ? { ...state, piece: { ...p, shape: s } } : state;
		}
		case "DROP": {
			let ny = p.y;
			while (valid(state.board, p, 0, ny - p.y + 1)) ny++;
			return landPiece(state, { ...p, y: ny });
		}
		case "TICK":
			return valid(state.board, p, 0, 1)
				? { ...state, piece: { ...p, y: p.y + 1 } }
				: landPiece(state, p);
	}
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function TestPage() {
	const [state, dispatch] = useReducer(reducer, INIT);
	const videoRef = useRef<HTMLVideoElement | null>(null);
	const statusRef = useRef(state.status);
	statusRef.current = state.status;

	const handleHandAction = useCallback((action: GameAction) => {
		if (statusRef.current === "playing") dispatch({ type: action });
	}, []);

	const hands = useHandsController({
		enabled: true,
		videoRef,
		onAction: handleHandAction,
	});

	// Game loop — speed increases every 5 lines
	useEffect(() => {
		if (state.status !== "playing") return;
		const speed = Math.max(80, 800 - Math.floor(state.lines / 5) * 60);
		const id = setInterval(() => dispatch({ type: "TICK" }), speed);
		return () => clearInterval(id);
	}, [state.status, state.lines]);

	// Keyboard controls
	useEffect(() => {
		if (state.status !== "playing") return;
		function onKey(e: KeyboardEvent) {
			switch (e.key) {
				case "ArrowLeft":  dispatch({ type: "LEFT" });   break;
				case "ArrowRight": dispatch({ type: "RIGHT" });  break;
				case "ArrowDown":  dispatch({ type: "DOWN" });   break;
				case "ArrowUp":    dispatch({ type: "ROTATE" }); break;
				case " ":          dispatch({ type: "DROP" });   break;
				default: return;
			}
			e.preventDefault();
		}
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	}, [state.status]);

	// Build display board: ghost + active piece overlaid
	const display = state.board.map(r => [...r]);
	if (state.piece) {
		const p = state.piece;

		// Ghost piece
		let ghostY = p.y;
		while (valid(state.board, p, 0, ghostY - p.y + 1)) ghostY++;
		if (ghostY !== p.y)
			for (let r = 0; r < p.shape.length; r++)
				for (let c = 0; c < p.shape[r].length; c++)
					if (p.shape[r][c]) {
						const ny = ghostY + r;
						const nx = p.x + c;
						if (ny >= 0 && ny < ROWS && nx >= 0 && nx < COLS && !display[ny][nx])
							display[ny][nx] = "ghost";
					}

		// Active piece
		for (let r = 0; r < p.shape.length; r++)
			for (let c = 0; c < p.shape[r].length; c++)
				if (p.shape[r][c]) {
					const ny = p.y + r;
					const nx = p.x + c;
					if (ny >= 0 && ny < ROWS && nx >= 0 && nx < COLS)
						display[ny][nx] = COLORS[p.id];
				}
	}

	const level = Math.floor(state.lines / 5) + 1;

	return (
		<div style={{
			minHeight: "100vh",
			display: "flex",
			flexDirection: "column",
			alignItems: "center",
			justifyContent: "center",
			gap: "1.5rem",
			padding: "2rem",
		}}>
			<h1 style={{ margin: 0, fontSize: "2rem", letterSpacing: "0.15em" }}>TETRIS</h1>

			<div style={{ display: "flex", alignItems: "flex-start", gap: "2rem" }}>

				{/* ── Board ── */}
				<div style={{
					display: "grid",
					gridTemplateColumns: `repeat(${COLS}, ${CELL}px)`,
					gap: "1px",
					padding: "1px",
					background: "rgba(255,255,255,0.08)",
					border: "1px solid rgba(255,255,255,0.12)",
					borderRadius: "4px",
				}}>
					{display.flat().map((cell, i) => (
						<div key={i} style={{
							width: CELL,
							height: CELL,
							background: cell === "ghost"
								? "rgba(255,255,255,0.08)"
								: cell
									? cell
									: "rgba(5,8,22,0.92)",
							boxShadow: cell && cell !== "ghost"
								? `inset 0 0 0 1px rgba(255,255,255,0.18), 0 0 10px ${cell}55`
								: undefined,
						}} />
					))}
				</div>

				{/* ── Side panel ── */}
				<div style={{ display: "flex", flexDirection: "column", gap: "1rem", width: "130px" }}>

					{[
						{ label: "Score", value: state.score },
						{ label: "Lignes", value: state.lines },
						{ label: "Niveau", value: level },
					].map(({ label, value }) => (
						<div key={label} style={{
							padding: "0.75rem 1rem",
							border: "1px solid rgba(255,255,255,0.1)",
							borderRadius: "8px",
							background: "rgba(255,255,255,0.04)",
						}}>
							<p style={{ margin: 0, fontSize: "0.68rem", letterSpacing: "0.15em", textTransform: "uppercase", color: "var(--color-secondary)", opacity: 0.75 }}>
								{label}
							</p>
							<p style={{ margin: "0.2rem 0 0", fontSize: "1.25rem", fontWeight: 700 }}>
								{value}
							</p>
						</div>
					))}

					{state.status === "gameover" && (
						<p style={{ color: "var(--color-primary)", fontWeight: 700, textAlign: "center", margin: 0, fontSize: "0.9rem", letterSpacing: "0.1em" }}>
							GAME OVER
						</p>
					)}

					<button
						className="button button-primary"
						style={{ width: "100%" }}
						onClick={() => dispatch({ type: "START" })}
					>
						{state.status === "idle" ? "Lancer" : "Rejouer"}
					</button>

					<div style={{ fontSize: "0.7rem", color: "rgba(255,255,255,0.55)", lineHeight: 1.4 }}>
						{hands.status === "loading" && "Caméra en cours..."}
						{hands.status === "running" && "Mains actives"}
						{hands.status === "error" && (
							<span style={{ color: "var(--color-primary)" }}>
								Erreur : {hands.error}
							</span>
						)}
					</div>

					<div style={{ fontSize: "0.7rem", color: "rgba(255,255,255,0.3)", lineHeight: 2, marginTop: "0.25rem" }}>
						<div>← → Déplacer</div>
						<div>↑ Tourner</div>
						<div>↓ Descendre</div>
						<div>Espace Drop</div>
					</div>

					<Link to="/" style={{ fontSize: "0.8rem", color: "rgba(255,255,255,0.35)", display: "block", marginTop: "0.5rem" }}>
						← Accueil
					</Link>
				</div>

				{/* ── Webcam + debug landmarks ── */}
				<div style={{
					position: "relative",
					width: CAMERA_WIDTH,
					height: CAMERA_HEIGHT,
					borderRadius: "8px",
					overflow: "hidden",
					border: "1px solid rgba(255,255,255,0.12)",
					background: "rgba(0,0,0,0.4)",
					transform: "scaleX(-1)",
				}}>
					<video
						ref={videoRef}
						autoPlay
						playsInline
						muted
						style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
					/>
					{hands.hands.map((h, hi) => {
						const color = h.handedness === "Right" ? "#3de7ff" : "#ff365f";
						return (
							<div key={hi} style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
								{h.landmarks.map((lm, li) => (
									<div key={li} style={{
										position: "absolute",
										left: 0,
										top: 0,
										width: 8,
										height: 8,
										borderRadius: "50%",
										background: color,
										transform: `translate3d(${lm.x * CAMERA_WIDTH}px, ${lm.y * CAMERA_HEIGHT}px, 0) translate(-50%, -50%)`,
										willChange: "transform",
										boxShadow: `0 0 6px ${color}`,
									}} />
								))}
							</div>
						);
					})}
				</div>

			</div>
		</div>
	);
}
