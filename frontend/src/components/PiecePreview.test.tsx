import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render } from "@testing-library/react";
import PiecePreview from "./PiecePreview";
import { getPieceTheme } from "../config/pieceThemes";

afterEach(cleanup);

describe("PiecePreview", () => {
	it("rend les sept tetrominos par defaut", () => {
		const { container } = render(<PiecePreview themeId="neon-gem" />);

		expect(container.querySelectorAll(".piece-preview__glyph")).toHaveLength(7);
	});

	it("applique la recette et la palette du theme demande", () => {
		const { container } = render(<PiecePreview themeId="synthwave" />);
		const root = container.querySelector(".piece-preview") as HTMLElement;

		expect(root.getAttribute("data-recipe")).toBe("synth");
		expect(root.style.getPropertyValue("--piece-i")).toBe(getPieceTheme("synthwave").palette.I);
	});

	it("retombe sur le theme par defaut pour un identifiant inconnu", () => {
		const { container } = render(<PiecePreview themeId="inexistant" />);
		const root = container.querySelector(".piece-preview") as HTMLElement;

		expect(root.getAttribute("data-recipe")).toBe("neon");
	});

	it("n'affiche que les pieces demandees et respecte la taille de cellule", () => {
		const { container } = render(<PiecePreview themeId="neon-gem" pieces={["O"]} cellSize={24} />);

		const glyph = container.querySelector(".piece-preview__glyph") as HTMLElement;
		expect(glyph.style.gridTemplateColumns).toBe("repeat(2, 24px)");
		expect(glyph.style.gridTemplateRows).toBe("repeat(2, 24px)");
		expect(container.querySelectorAll('.tetris-cell--filled[data-piece="O"]')).toHaveLength(4);
	});

	it("dessine aussi les trous de la forme", () => {
		const { container } = render(<PiecePreview themeId="neon-gem" pieces={["T"]} />);

		// La forme T tronquee tient sur une grille 3x2: 4 cellules pleines, 2 trous.
		expect(container.querySelectorAll(".tetris-cell--filled")).toHaveLength(4);
		expect(container.querySelectorAll(".piece-preview__hole")).toHaveLength(2);
	});
});
