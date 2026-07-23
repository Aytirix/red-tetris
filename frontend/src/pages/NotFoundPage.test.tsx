import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import NotFoundPage from "./NotFoundPage";

afterEach(cleanup);

describe("NotFoundPage", () => {
	it("annonce l'erreur 404", () => {
		render(<MemoryRouter><NotFoundPage /></MemoryRouter>);

		expect(screen.getByText("Route introuvable")).toBeInTheDocument();
		expect(screen.getByRole("heading", { name: "Signal perdu dans la grille" })).toBeInTheDocument();
	});

	it("propose un retour a l'accueil", () => {
		render(<MemoryRouter><NotFoundPage /></MemoryRouter>);

		expect(screen.getByRole("link", { name: "Retour a l'accueil" })).toHaveAttribute("href", "/");
	});
});
