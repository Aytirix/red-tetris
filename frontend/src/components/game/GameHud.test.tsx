import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import GameHud from "./GameHud";

afterEach(cleanup);

describe("GameHud — score", () => {
	it("affiche toujours le score formate", () => {
		const { container } = render(<GameHud score={12345} level={3} showLevel={false} />);

		expect(screen.getByText("Score")).toBeInTheDocument();
		expect(container.querySelector(".tetris-hud__score .tetris-hud__value")?.textContent).toBe(
			(12345).toLocaleString(),
		);
	});

	it("affiche un score a zero", () => {
		const { container } = render(<GameHud score={0} level={1} showLevel={false} />);
		expect(container.querySelector(".tetris-hud__score .tetris-hud__value")?.textContent).toBe("0");
	});
});

describe("GameHud — level", () => {
	it("masque le level quand showLevel est faux (multi)", () => {
		const { container } = render(<GameHud score={10} level={7} showLevel={false} />);

		expect(container.querySelector(".tetris-hud__level")).toBeNull();
		expect(screen.queryByText("Level")).toBeNull();
	});

	it("affiche le level quand showLevel est vrai (solo)", () => {
		const { container } = render(<GameHud score={10} level={7} showLevel />);

		expect(screen.getByText("Level")).toBeInTheDocument();
		expect(container.querySelector(".tetris-hud__level .tetris-hud__value")?.textContent).toBe("7");
	});
});

describe("GameHud — bandeau spectateur", () => {
	it("n'affiche rien sans cible spectateur", () => {
		const { container } = render(<GameHud score={0} level={1} showLevel={false} />);
		expect(container.querySelector(".tetris-hud__spectator")).toBeNull();
	});

	it("n'affiche rien quand la cible est nulle", () => {
		const { container } = render(
			<GameHud score={0} level={1} showLevel={false} spectatorOf={null} />,
		);
		expect(container.querySelector(".tetris-hud__spectator")).toBeNull();
	});

	it("affiche le joueur observe", () => {
		const { container } = render(
			<GameHud score={0} level={1} showLevel={false} spectatorOf="luffy" />,
		);

		expect(screen.getByText("Spectator")).toBeInTheDocument();
		expect(container.querySelector(".tetris-hud__spectator .tetris-hud__value")?.textContent).toBe(
			"luffy",
		);
	});
});
