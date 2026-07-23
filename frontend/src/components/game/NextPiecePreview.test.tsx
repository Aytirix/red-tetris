import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import NextPiecePreview from "./NextPiecePreview";

afterEach(cleanup);

describe("NextPiecePreview — sans pièce", () => {
	it("affiche un tiret quand aucune piece n'est annoncee", () => {
		const { container } = render(<NextPiecePreview piece={null} />);

		expect(screen.getByText("Prochaine pièce")).toBeInTheDocument();
		expect(container.querySelector(".tetris-next__empty")?.textContent).toBe("—");
		expect(container.querySelector(".tetris-next__grid")).toBeNull();
	});
});

describe("NextPiecePreview — forme de la pièce", () => {
	it("rend la barre I sur une seule ligne de 4 cellules", () => {
		const { container } = render(<NextPiecePreview piece={{ type: "I" }} />);
		const grid = container.querySelector(".tetris-next__grid") as HTMLElement;

		expect(grid.style.gridTemplateColumns).toBe("repeat(4, 28px)");
		expect(grid.style.gridTemplateRows).toBe("repeat(1, 28px)");
		expect(container.querySelectorAll('.tetris-cell--filled[data-piece="I"]')).toHaveLength(4);
		expect(container.querySelectorAll(".tetris-next__hole")).toHaveLength(0);
	});

	it("rend le carre O en 2x2 plein", () => {
		const { container } = render(<NextPiecePreview piece={{ type: "O" }} />);
		const grid = container.querySelector(".tetris-next__grid") as HTMLElement;

		expect(grid.style.gridTemplateColumns).toBe("repeat(2, 28px)");
		expect(container.querySelectorAll(".tetris-cell--filled")).toHaveLength(4);
		expect(container.querySelectorAll(".tetris-next__hole")).toHaveLength(0);
	});

	it("rend les trous de la forme T", () => {
		const { container } = render(<NextPiecePreview piece={{ type: "T" }} />);
		const cells = Array.from(container.querySelector(".tetris-next__grid")!.children);

		expect(cells).toHaveLength(6);
		expect(cells.map((c) => c.className)).toEqual([
			"tetris-next__hole",
			"tetris-cell tetris-cell--filled",
			"tetris-next__hole",
			"tetris-cell tetris-cell--filled",
			"tetris-cell tetris-cell--filled",
			"tetris-cell tetris-cell--filled",
		]);
	});

	it("rend chaque type de piece avec exactement 4 blocs", () => {
		const types = ["I", "J", "L", "O", "S", "T", "Z"] as const;
		for (const type of types) {
			const { container } = render(<NextPiecePreview piece={{ type }} />);
			expect(container.querySelectorAll(`.tetris-cell--filled[data-piece="${type}"]`)).toHaveLength(
				4,
			);
			cleanup();
		}
	});

	it("applique la taille de cellule personnalisee", () => {
		const { container } = render(<NextPiecePreview piece={{ type: "Z" }} cellSize={16} />);
		const grid = container.querySelector(".tetris-next__grid") as HTMLElement;
		const filled = container.querySelector(".tetris-cell--filled") as HTMLElement;

		expect(grid.style.gridTemplateColumns).toBe("repeat(3, 16px)");
		expect(filled.style.getPropertyValue("--cs")).toBe("16px");
	});
});
