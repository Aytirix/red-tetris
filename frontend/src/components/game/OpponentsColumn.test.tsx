import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import OpponentsColumn from "./OpponentsColumn";
import type { GameBoard as Board, GameBoardCell, OpponentBoard } from "../../types/game";

afterEach(cleanup);

function board(rows = 2, cols = 2): Board {
	return Array.from({ length: rows }, () => Array.from({ length: cols }, () => 0 as GameBoardCell));
}

function opponents(...names: string[]): OpponentBoard[] {
	return names.map((username) => ({ username, board: board(), alive: true }));
}

describe("OpponentsColumn — liste vide", () => {
	it("ne rend rien quand il n'y a aucun adversaire", () => {
		const { container } = render(<OpponentsColumn opponents={[]} clickable={false} />);
		expect(container.firstChild).toBeNull();
	});
});

describe("OpponentsColumn — rendu", () => {
	it("rend un mini-board par adversaire", () => {
		const { container } = render(
			<OpponentsColumn opponents={opponents("zoro", "nami", "usopp")} clickable={false} />,
		);

		expect(container.querySelectorAll(".tetris-mini")).toHaveLength(3);
		expect(screen.getByText("zoro")).toBeInTheDocument();
		expect(screen.getByText("nami")).toBeInTheDocument();
		expect(screen.getByText("usopp")).toBeInTheDocument();
	});

	it("utilise la classe de base sans option", () => {
		const { container } = render(
			<OpponentsColumn opponents={opponents("zoro")} clickable={false} />,
		);
		expect((container.firstElementChild as HTMLElement).className).toBe("tetris-opponents");
	});

	it("ajoute les classes scroll et personnalisee", () => {
		const { container } = render(
			<OpponentsColumn
				opponents={opponents("zoro")}
				clickable={false}
				scrollable
				className="tetris-opponents--right"
			/>,
		);
		expect((container.firstElementChild as HTMLElement).className).toBe(
			"tetris-opponents tetris-opponents--scroll tetris-opponents--right",
		);
	});

	it("marque les joueurs elimines", () => {
		const list: OpponentBoard[] = [
			{ username: "zoro", board: board(), alive: false },
			{ username: "nami", board: board(), alive: true },
		];
		const { container } = render(<OpponentsColumn opponents={list} clickable={false} />);

		const minis = Array.from(container.querySelectorAll(".tetris-mini"));
		expect(minis[0].className).toContain("tetris-mini--dead");
		expect(minis[1].className).not.toContain("tetris-mini--dead");
	});
});

describe("OpponentsColumn — mode spectateur", () => {
	it("rend des boutons et remonte la selection", () => {
		const onSelect = vi.fn();
		const { container } = render(
			<OpponentsColumn opponents={opponents("zoro", "nami")} clickable onSelect={onSelect} />,
		);

		const buttons = Array.from(container.querySelectorAll("button.tetris-mini"));
		expect(buttons).toHaveLength(2);

		(buttons[1] as HTMLButtonElement).click();
		expect(onSelect).toHaveBeenCalledTimes(1);
		expect(onSelect).toHaveBeenCalledWith("nami");
	});

	it("met en avant la cible actuellement observee", () => {
		const { container } = render(
			<OpponentsColumn
				opponents={opponents("zoro", "nami")}
				clickable
				currentSpectatorTarget="nami"
			/>,
		);

		const minis = Array.from(container.querySelectorAll(".tetris-mini"));
		expect(minis[0].className).not.toContain("tetris-mini--active");
		expect(minis[1].className).toContain("tetris-mini--active");
	});

	it("n'attache aucun handler sans onSelect", () => {
		const { container } = render(<OpponentsColumn opponents={opponents("zoro")} clickable />);
		expect(() => (container.querySelector("button.tetris-mini") as HTMLElement).click()).not.toThrow();
	});

	it("ne rend pas de bouton hors mode spectateur", () => {
		const onSelect = vi.fn();
		const { container } = render(
			<OpponentsColumn opponents={opponents("zoro")} clickable={false} onSelect={onSelect} />,
		);

		expect(container.querySelector("button")).toBeNull();
		(container.querySelector(".tetris-mini") as HTMLElement).click();
		expect(onSelect).not.toHaveBeenCalled();
	});
});
