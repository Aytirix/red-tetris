import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render } from "@testing-library/react";
import GameBoard from "./GameBoard";
import type { GameBoard as Board, GameBoardCell } from "../../types/game";

afterEach(cleanup);

function emptyBoard(rows = 20, cols = 10): Board {
	return Array.from({ length: rows }, () => Array.from({ length: cols }, () => 0 as GameBoardCell));
}

describe("GameBoard — grille", () => {
	it("rend 10x20 = 200 cellules", () => {
		const { container } = render(<GameBoard board={emptyBoard()} />);
		expect(container.querySelectorAll(".tetris-cell")).toHaveLength(200);
	});

	it("configure la grille CSS selon la taille de cellule", () => {
		const { container } = render(<GameBoard board={emptyBoard()} cellSize={38} />);
		const grid = container.querySelector(".tetris-board") as HTMLElement;

		expect(grid.style.gridTemplateColumns).toBe("repeat(10, 38px)");
		expect(grid.style.gridTemplateRows).toBe("repeat(20, 38px)");
	});

	it("utilise 30px comme taille de cellule par defaut", () => {
		const { container } = render(<GameBoard board={emptyBoard(2, 3)} />);
		const grid = container.querySelector(".tetris-board") as HTMLElement;

		expect(grid.style.gridTemplateColumns).toBe("repeat(3, 30px)");
		expect(container.querySelectorAll(".tetris-cell")).toHaveLength(6);
	});

	it("supporte un plateau vide sans planter", () => {
		const { container } = render(<GameBoard board={[]} />);
		const grid = container.querySelector(".tetris-board");

		expect(grid).not.toBeNull();
		expect(container.querySelectorAll(".tetris-cell")).toHaveLength(0);
	});

	it("propage le contenu des cellules", () => {
		const board: Board = [
			[0, "I", "penalty"],
			["Z", 0, 0],
		];
		const { container } = render(<GameBoard board={board} />);
		const cells = Array.from(container.querySelectorAll(".tetris-cell"));

		expect(cells.map((c) => c.getAttribute("data-piece"))).toEqual([
			null,
			"I",
			"penalty",
			"Z",
			null,
			null,
		]);
	});
});

describe("GameBoard — pièce fantôme", () => {
	it("marque les cases fantomes indiquees par le serveur", () => {
		const { container } = render(
			<GameBoard
				board={emptyBoard(2, 3)}
				ghost={[
					{ x: 0, y: 1 },
					{ x: 2, y: 1 },
				]}
				ghostPiece="T"
			/>,
		);

		const cells = Array.from(container.querySelectorAll(".tetris-cell"));
		expect(cells.map((c) => c.className)).toEqual([
			"tetris-cell tetris-cell--empty",
			"tetris-cell tetris-cell--empty",
			"tetris-cell tetris-cell--empty",
			"tetris-cell tetris-cell--ghost",
			"tetris-cell tetris-cell--empty",
			"tetris-cell tetris-cell--ghost",
		]);
		expect(container.querySelectorAll('.tetris-cell--ghost[data-piece="T"]')).toHaveLength(2);
	});

	it("n'affiche aucun fantome sans ghostPiece", () => {
		const { container } = render(
			<GameBoard board={emptyBoard(2, 2)} ghost={[{ x: 0, y: 0 }]} ghostPiece={null} />,
		);
		expect(container.querySelectorAll(".tetris-cell--ghost")).toHaveLength(0);
	});

	it("n'affiche aucun fantome quand la liste ghost est absente", () => {
		const { container } = render(<GameBoard board={emptyBoard(2, 2)} ghostPiece="I" />);
		expect(container.querySelectorAll(".tetris-cell--ghost")).toHaveLength(0);
	});

	it("ne remplace pas une case deja occupee par un fantome", () => {
		const board: Board = [["I", 0]];
		const { container } = render(
			<GameBoard board={board} ghost={[{ x: 0, y: 0 }]} ghostPiece="T" />,
		);

		const cells = Array.from(container.querySelectorAll(".tetris-cell"));
		expect(cells[0].className).toBe("tetris-cell tetris-cell--filled");
		expect(cells[0].getAttribute("data-piece")).toBe("I");
		expect(container.querySelectorAll(".tetris-cell--ghost")).toHaveLength(0);
	});
});
