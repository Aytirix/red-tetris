export type PieceType = "I" | "J" | "L" | "O" | "S" | "T" | "Z";

export type GameBoardCell = 0 | PieceType | "penalty";

export type GameBoard = GameBoardCell[][];

export type OpponentBoard = {
	username: string;
	board: GameBoard;
	alive: boolean;
};

export type GamePiece = {
	type: PieceType;
};

export type GhostCell = { x: number; y: number };

export type GameStatePayload = {
	board: GameBoard;
	opponents: OpponentBoard[];
	currentPiece: GamePiece | null;
	nextPiece: GamePiece | null;
	score: number;
	level: number;
	spectator: false | string;
	ghost: GhostCell[];
};

export type GameOverScore = {
	username: string;
	score: number;
	level?: number;
};

export type GameOverPayload = {
	winner: string | null;
	scores: GameOverScore[];
};
