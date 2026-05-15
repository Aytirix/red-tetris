export type PieceType = "I" | "J" | "L" | "O" | "S" | "T" | "Z";

export type GameBoardCell = 0 | PieceType | "penalty";

export type GameBoard = GameBoardCell[][];

export type OpponentBoard = {
	username: string;
	board: GameBoard;
};

export type GamePiece = {
	type: PieceType;
};

export type GameStatePayload = {
	board: GameBoard;
	opponents: OpponentBoard[];
	currentPiece: GamePiece | null;
	nextPiece: GamePiece | null;
	score: number;
	level: number;
	spectator: false | string;
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
