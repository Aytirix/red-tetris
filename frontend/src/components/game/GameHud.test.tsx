import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import GameHud, { formatTimeLeft } from "./GameHud";

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

describe("GameHud — modes de jeu", () => {
	it("affiche la progression de lignes en sprint", () => {
		render(<GameHud score={0} level={1} showLevel={false} mode="sprint" lines={12} linesTarget={40} />);

		expect(screen.getByText("Lignes")).toBeInTheDocument();
		expect(screen.getByText("12 / 40")).toBeInTheDocument();
		expect(screen.getByText("Sprint")).toBeInTheDocument();
	});

	it("affiche le compteur de lignes seul hors sprint (pas d'objectif)", () => {
		const { container } = render(<GameHud score={0} level={1} showLevel={false} lines={7} />);

		expect(container.querySelector(".tetris-hud__lines .tetris-hud__value")?.textContent).toBe("7");
		expect(container.querySelector(".tetris-hud__mode")).toBeNull();
	});

	it("affiche le chrono en ultra et le passe en urgent sous 10s", () => {
		const { container, rerender } = render(
			<GameHud score={0} level={1} showLevel={false} mode="ultra" timeLeftMs={65_000} />,
		);
		expect(screen.getByText("1:05")).toBeInTheDocument();
		expect(container.querySelector(".tetris-hud__timer--urgent")).toBeNull();

		rerender(<GameHud score={0} level={1} showLevel={false} mode="ultra" timeLeftMs={9_000} />);
		expect(screen.getByText("0:09")).toBeInTheDocument();
		expect(container.querySelector(".tetris-hud__timer--urgent")).not.toBeNull();
	});

	it("formate le temps restant en mm:ss", () => {
		expect(formatTimeLeft(0)).toBe("0:00");
		expect(formatTimeLeft(1_000)).toBe("0:01");
		expect(formatTimeLeft(120_000)).toBe("2:00");
		expect(formatTimeLeft(-500)).toBe("0:00");
	});

	it("affiche les rangees de gruyere restantes en mode cheese", () => {
		const { container } = render(
			<GameHud score={0} level={1} showLevel={false} mode="cheese" garbageLeft={14} />,
		);

		expect(screen.getByText("À creuser")).toBeInTheDocument();
		expect(container.querySelector(".tetris-hud__garbage .tetris-hud__value")?.textContent).toBe("14");
	});

	// Zero doit s'afficher (course terminee), pas disparaitre comme une valeur absente.
	it("affiche encore le compteur a zero", () => {
		const { container } = render(
			<GameHud score={0} level={1} showLevel={false} mode="cheese" garbageLeft={0} />,
		);
		expect(container.querySelector(".tetris-hud__garbage .tetris-hud__value")?.textContent).toBe("0");
	});

	it("n'affiche aucun compteur de gruyere hors mode cheese", () => {
		const { container } = render(<GameHud score={0} level={1} showLevel={false} />);
		expect(container.querySelector(".tetris-hud__garbage")).toBeNull();
	});
});

describe("GameHud — compteurs de partie", () => {
	it("affiche les lignes et les Tetris dans tous les modes", () => {
		const { container } = render(
			<GameHud score={0} level={1} showLevel={false} lines={23} tetris={4} />,
		);

		expect(screen.getByText("Lignes")).toBeInTheDocument();
		expect(screen.getByText("Tetris")).toBeInTheDocument();
		expect(container.querySelector(".tetris-hud__lines .tetris-hud__value")?.textContent).toBe("23");
		expect(container.querySelector(".tetris-hud__tetris .tetris-hud__value")?.textContent).toBe("4");
	});

	// Zéro doit s'afficher: un compteur qui apparaît au premier Tetris ferait bouger
	// la largeur du HUD en pleine partie.
	it("affiche les compteurs a zero en debut de partie", () => {
		const { container } = render(<GameHud score={0} level={1} showLevel={false} />);

		expect(container.querySelector(".tetris-hud__lines .tetris-hud__value")?.textContent).toBe("0");
		expect(container.querySelector(".tetris-hud__tetris .tetris-hud__value")?.textContent).toBe("0");
	});

	// En sprint l'objectif se greffe sur le compteur de lignes: deux blocs « Lignes »
	// cote a cote n'auraient aucun sens.
	it("ne duplique pas le compteur de lignes en sprint", () => {
		const { container } = render(
			<GameHud score={0} level={1} showLevel={false} mode="sprint" lines={12} linesTarget={40} tetris={2} />,
		);

		expect(screen.getAllByText("Lignes")).toHaveLength(1);
		expect(container.querySelector(".tetris-hud__lines .tetris-hud__value")?.textContent).toBe("12 / 40");
		expect(container.querySelector(".tetris-hud__tetris .tetris-hud__value")?.textContent).toBe("2");
	});
});
