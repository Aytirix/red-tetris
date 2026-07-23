import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import MiniBoard from "./MiniBoard";
import type { GameBoard as Board, GameBoardCell } from "../../types/game";

afterEach(cleanup);

function emptyBoard(rows = 20, cols = 10): Board {
	return Array.from({ length: rows }, () => Array.from({ length: cols }, () => 0 as GameBoardCell));
}

describe("MiniBoard — rendu de base", () => {
	it("affiche le pseudo de l'adversaire", () => {
		render(<MiniBoard username="zoro" board={emptyBoard()} />);
		expect(screen.getByText("zoro")).toBeInTheDocument();
	});

	it("rend la grille complete de l'adversaire", () => {
		const { container } = render(<MiniBoard username="nami" board={emptyBoard()} />);
		expect(container.querySelectorAll(".tetris-cell")).toHaveLength(200);
	});

	it("utilise un div non cliquable par defaut", () => {
		const { container } = render(<MiniBoard username="nami" board={emptyBoard(1, 1)} />);
		const root = container.firstElementChild as HTMLElement;

		expect(root.tagName).toBe("DIV");
		expect(root.className).toBe("tetris-mini");
		expect(root.hasAttribute("type")).toBe(false);
	});

	it("dimensionne la grille selon cellSize", () => {
		const { container } = render(
			<MiniBoard username="nami" board={emptyBoard(4, 3)} cellSize={12} />,
		);
		const grid = container.querySelector(".tetris-mini__grid") as HTMLElement;
		const name = container.querySelector(".tetris-mini__name") as HTMLElement;

		expect(grid.style.gridTemplateColumns).toBe("repeat(3, 12px)");
		expect(grid.style.gridTemplateRows).toBe("repeat(4, 12px)");
		expect(name.style.maxWidth).toBe("36px");
	});

	it("supporte un plateau vide", () => {
		const { container } = render(<MiniBoard username="brook" board={[]} />);
		const name = container.querySelector(".tetris-mini__name") as HTMLElement;

		expect(container.querySelector(".tetris-mini__grid")).not.toBeNull();
		expect(container.querySelectorAll(".tetris-cell")).toHaveLength(0);
		expect(name.style.maxWidth).toBe("0");
	});
});

describe("MiniBoard — états", () => {
	it("ajoute la classe active quand le board est observe", () => {
		const { container } = render(
			<MiniBoard username="zoro" board={emptyBoard(1, 1)} active />,
		);
		expect((container.firstElementChild as HTMLElement).className).toBe(
			"tetris-mini tetris-mini--active",
		);
	});

	it("ajoute la classe dead quand le joueur est elimine", () => {
		const { container } = render(
			<MiniBoard username="zoro" board={emptyBoard(1, 1)} alive={false} />,
		);
		expect((container.firstElementChild as HTMLElement).className).toBe(
			"tetris-mini tetris-mini--dead",
		);
	});

	it("cumule les classes cliquable / active / mort", () => {
		const { container } = render(
			<MiniBoard username="zoro" board={emptyBoard(1, 1)} clickable active alive={false} />,
		);
		expect((container.firstElementChild as HTMLElement).className).toBe(
			"tetris-mini tetris-mini--clickable tetris-mini--active tetris-mini--dead",
		);
	});
});

describe("MiniBoard — interaction spectateur", () => {
	it("rend un bouton et declenche onClick quand cliquable", () => {
		const onClick = vi.fn();
		const { container } = render(
			<MiniBoard username="zoro" board={emptyBoard(1, 1)} clickable onClick={onClick} />,
		);
		const root = container.firstElementChild as HTMLButtonElement;

		expect(root.tagName).toBe("BUTTON");
		expect(root.getAttribute("type")).toBe("button");

		root.click();
		expect(onClick).toHaveBeenCalledTimes(1);
	});

	it("ignore onClick quand le board n'est pas cliquable", () => {
		const onClick = vi.fn();
		const { container } = render(
			<MiniBoard username="zoro" board={emptyBoard(1, 1)} onClick={onClick} />,
		);

		(container.firstElementChild as HTMLElement).click();
		expect(onClick).not.toHaveBeenCalled();
	});

	it("reste stable si cliquable sans handler", () => {
		const { container } = render(
			<MiniBoard username="zoro" board={emptyBoard(1, 1)} clickable />,
		);
		expect(() => (container.firstElementChild as HTMLElement).click()).not.toThrow();
	});
});
