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

describe("GameBoard — fondu du mode invisible", () => {
	it("applique l'opacité de la grille fade cellule par cellule", () => {
		const board: GameBoardCell[][] = [["I", "O"], [0, "T"]];
		const fade = [[0.25, 1], [1, 0.5]];
		const { container } = render(<GameBoard board={board} cellSize={10} fade={fade} />);

		// Une couche coloree par case PLEINE (la case vide n'en a pas).
		const pieces = container.querySelectorAll<HTMLElement>(".tetris-cell__piece");
		expect(pieces).toHaveLength(3);
		expect(pieces[0].style.opacity).toBe("0.25");
		expect(pieces[1].style.opacity).toBe("1");
		expect(pieces[2].style.opacity).toBe("0.5");
	});

	it("ignore un fade absent", () => {
		const board: GameBoardCell[][] = [["I"]];
		const { container } = render(<GameBoard board={board} cellSize={10} fade={null} />);
		expect(container.querySelector(".tetris-cell__piece")).toBeNull();
	});
});

describe("GameBoard — retombée du mode Cascade", () => {
	const board: GameBoardCell[][] = [[0, 0], ["I", "T"]];

	it("marque les cases qui viennent de tomber et leur distance", () => {
		const { container } = render(
			<GameBoard
				board={board}
				cellSize={20}
				cascade={{ id: 1, cells: [{ x: 0, y: 1, rows: 3 }] }}
			/>,
		);

		const falling = container.querySelectorAll<HTMLElement>(".tetris-cell--falling");
		expect(falling).toHaveLength(1);
		// La distance pilote le point de départ de l'animation en CSS.
		expect(falling[0].style.getPropertyValue("--fall-rows")).toBe("3");
		// Durée bornée, proportionnelle à la distance.
		expect(falling[0].style.getPropertyValue("--fall-ms")).toBe("174ms");
	});

	it("ne marque pas les cases qui n'ont pas bougé", () => {
		const { container } = render(
			<GameBoard
				board={board}
				cellSize={20}
				cascade={{ id: 1, cells: [{ x: 0, y: 1, rows: 3 }] }}
			/>,
		);

		const cells = Array.from(container.querySelectorAll(".tetris-cell"));
		expect(cells[3].className).not.toContain("falling");
	});

	it("borne la durée pour qu'un gros effondrement ne fige pas le plateau", () => {
		const { container } = render(
			<GameBoard
				board={board}
				cellSize={20}
				cascade={{ id: 1, cells: [{ x: 0, y: 1, rows: 19 }] }}
			/>,
		);

		const falling = container.querySelector<HTMLElement>(".tetris-cell--falling")!;
		expect(falling.style.getPropertyValue("--fall-ms")).toBe("320ms");
	});

	// Reposer la même classe ne relance pas une animation CSS: seul un remontage
	// (donc une `key` différente) la rejoue.
	it("change la clé de rendu à chaque nouvelle retombée", () => {
		const { container, rerender } = render(
			<GameBoard board={board} cellSize={20} cascade={{ id: 1, cells: [{ x: 0, y: 1, rows: 2 }] }} />,
		);
		const first = container.querySelector(".tetris-cell--falling");

		rerender(
			<GameBoard board={board} cellSize={20} cascade={{ id: 2, cells: [{ x: 0, y: 1, rows: 2 }] }} />,
		);
		const second = container.querySelector(".tetris-cell--falling");

		expect(second).not.toBe(first);
	});

	it("ne rejoue rien tant que la retombée reste la même", () => {
		const cascade = { id: 1, cells: [{ x: 0, y: 1, rows: 2 }] };
		const { container, rerender } = render(<GameBoard board={board} cellSize={20} cascade={cascade} />);
		const first = container.querySelector(".tetris-cell--falling");

		rerender(<GameBoard board={board} cellSize={20} cascade={cascade} />);

		// Même élément du DOM: l'animation ne repart pas à chaque frame reçue.
		expect(container.querySelector(".tetris-cell--falling")).toBe(first);
	});

	it("n'anime rien sans retombée", () => {
		const { container } = render(<GameBoard board={board} cellSize={20} cascade={null} />);
		expect(container.querySelector(".tetris-cell--falling")).toBeNull();
	});
});
