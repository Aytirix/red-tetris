import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render } from "@testing-library/react";
import Cell from "./Cell";
import type { GameBoardCell, PieceType } from "../../types/game";

afterEach(cleanup);

type CellProps = { cell: GameBoardCell; size?: number; ghost?: PieceType; opacity?: number };

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

describe("Cell — mode invisible (opacité)", () => {
	it("garde le fond/quadrillage d'une case vide et n'efface que la couche colorée", () => {
		const el = renderCell({ cell: "I", size: 20, opacity: 0.4 });

		// La case elle-meme reste une case VIDE: a opacite 0 elle sera indiscernable.
		expect(el.className).toContain("tetris-cell--empty");
		expect(el.className).toContain("tetris-cell--fading");
		expect(el.style.opacity).toBe("");

		const piece = el.querySelector<HTMLElement>(".tetris-cell__piece")!;
		expect(piece.className).toContain("tetris-cell--filled");
		expect(piece.getAttribute("data-piece")).toBe("I");
		expect(piece.style.opacity).toBe("0.4");
	});

	it("est totalement identique a une case vide quand la piece a disparu", () => {
		const faded = renderCell({ cell: "I", size: 20, opacity: 0 });
		const empty = renderCell({ cell: 0, size: 20 });

		expect(faded.querySelector<HTMLElement>(".tetris-cell__piece")!.style.opacity).toBe("0");
		// Meme classe de fond que la case vide -> aucun "trou" dans la grille.
		expect(faded.className).toContain("tetris-cell--empty");
		expect(empty.className).toContain("tetris-cell--empty");
	});

	it("conserve la structure en couches meme a pleine visibilite (transition fluide)", () => {
		const el = renderCell({ cell: "I", size: 20, opacity: 1 });
		expect(el.querySelector<HTMLElement>(".tetris-cell__piece")!.style.opacity).toBe("1");
	});

	it("laisse les cases vides intactes", () => {
		const el = renderCell({ cell: 0, size: 20, opacity: 0.2 });
		expect(el.querySelector(".tetris-cell__piece")).toBeNull();
		expect(el.style.opacity).toBe("");
	});

	it("rend une cellule simple hors mode invisible", () => {
		const el = renderCell({ cell: "I", size: 20 });
		expect(el.className).toContain("tetris-cell--filled");
		expect(el.querySelector(".tetris-cell__piece")).toBeNull();
	});
});
