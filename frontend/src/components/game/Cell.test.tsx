import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render } from "@testing-library/react";
import Cell from "./Cell";
import type { GameBoardCell, PieceType } from "../../types/game";

afterEach(cleanup);

type CellProps = { cell: GameBoardCell; size?: number; ghost?: PieceType };

function renderCell(props: CellProps) {
	const { container } = render(<Cell {...props} />);
	return container.firstElementChild as HTMLElement;
}

describe("Cell — cellule vide", () => {
	it("rend une cellule vide sans data-piece", () => {
		const el = renderCell({ cell: 0 });

		expect(el.className).toBe("tetris-cell tetris-cell--empty");
		expect(el.hasAttribute("data-piece")).toBe(false);
	});

	it("n'applique aucun style inline sans taille", () => {
		const el = renderCell({ cell: 0 });
		expect(el.getAttribute("style")).toBeNull();
	});
});

describe("Cell — cellule pleine", () => {
	it("rend chaque type de piece avec son data-piece", () => {
		const types: PieceType[] = ["I", "J", "L", "O", "S", "T", "Z"];
		for (const type of types) {
			const el = renderCell({ cell: type });
			expect(el.className).toBe("tetris-cell tetris-cell--filled");
			expect(el.getAttribute("data-piece")).toBe(type);
			cleanup();
		}
	});

	it("rend une ligne de penalite", () => {
		const el = renderCell({ cell: "penalty" });

		expect(el.className).toBe("tetris-cell tetris-cell--filled");
		expect(el.getAttribute("data-piece")).toBe("penalty");
	});
});

describe("Cell — pièce fantôme", () => {
	it("rend la projection uniquement sur une case vide", () => {
		const el = renderCell({ cell: 0, ghost: "T" });

		expect(el.className).toBe("tetris-cell tetris-cell--ghost");
		expect(el.getAttribute("data-piece")).toBe("T");
	});

	it("ignore le fantome quand la case est deja occupee", () => {
		const el = renderCell({ cell: "S", ghost: "T" });

		expect(el.className).toBe("tetris-cell tetris-cell--filled");
		expect(el.getAttribute("data-piece")).toBe("S");
	});
});

describe("Cell — dimensions", () => {
	it("applique la taille et la variable CSS --cs", () => {
		const el = renderCell({ cell: "I", size: 38 });

		expect(el.style.width).toBe("38px");
		expect(el.style.height).toBe("38px");
		expect(el.style.getPropertyValue("--cs")).toBe("38px");
	});

	it("ignore une taille nulle (pas de style inline)", () => {
		const el = renderCell({ cell: "I", size: 0 });
		expect(el.getAttribute("style")).toBeNull();
	});
});
