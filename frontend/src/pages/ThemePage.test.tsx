import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import ThemePage from "./ThemePage";

function renderThemePage() {
	return render(<MemoryRouter><ThemePage /></MemoryRouter>);
}

afterEach(cleanup);

describe("ThemePage", () => {
	it("presente la direction visuelle du projet", () => {
		renderThemePage();

		expect(screen.getByRole("heading", { name: "Red Piece" })).toBeInTheDocument();
		expect(screen.getByRole("heading", { name: "Un systeme unique pour tout le site" })).toBeInTheDocument();
	});

	it("liste les piliers du systeme visuel", () => {
		const { container } = renderThemePage();

		expect(container.querySelectorAll(".feature-card")).toHaveLength(3);
		expect(screen.getByText("Palette centralisee")).toBeInTheDocument();
	});

	it("affiche les statuts systeme et les tokens de theme", () => {
		const { container } = renderThemePage();

		expect(container.querySelectorAll(".preview-grid .mini-card")).toHaveLength(4);
		expect(container.querySelectorAll(".token-item")).toHaveLength(5);
		expect(screen.getByText("--color-primary")).toBeInTheDocument();
		expect(screen.getByText("#ff365f")).toBeInTheDocument();
	});

	it("ramene au lobby", () => {
		renderThemePage();

		expect(screen.getByRole("link", { name: "Retour au Lobby" })).toHaveAttribute("href", "/");
	});
});
