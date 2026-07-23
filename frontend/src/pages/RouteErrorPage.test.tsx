import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";

const ctx = vi.hoisted(() => ({ error: null as unknown }));

vi.mock("react-router-dom", async (importOriginal) => {
	const actual = await importOriginal<typeof import("react-router-dom")>();
	return { ...actual, useRouteError: () => ctx.error };
});

import { MemoryRouter } from "react-router-dom";
import RouteErrorPage from "./RouteErrorPage";

function renderError() {
	return render(<MemoryRouter><RouteErrorPage /></MemoryRouter>);
}

/** Objet reconnu par isRouteErrorResponse de react-router. */
function routeErrorResponse(status: number, statusText: string, data: unknown) {
	return { status, statusText, internal: false, data };
}

beforeEach(() => {
	ctx.error = null;
});

afterEach(cleanup);

describe("RouteErrorPage", () => {
	it("affiche un 500 generique quand l'erreur est inconnue", () => {
		renderError();

		// Le code apparait a la fois dans l'entete et dans la carte de statut.
		expect(screen.getAllByText("500")).toHaveLength(2);
		expect(screen.getByRole("heading", { name: "Erreur de routage" })).toBeInTheDocument();
	});

	it("detaille une reponse d'erreur du routeur", () => {
		ctx.error = routeErrorResponse(404, "Not Found", "route absente");
		renderError();

		expect(screen.getAllByText("404").length).toBeGreaterThan(0);
		expect(screen.getByRole("heading", { name: "Route introuvable" })).toBeInTheDocument();
		expect(screen.getByText("Not Found")).toBeInTheDocument();
	});

	it("distingue une erreur de navigation d'un 404", () => {
		ctx.error = routeErrorResponse(500, "Boom", null);
		renderError();

		expect(screen.getByRole("heading", { name: "Erreur de navigation" })).toBeInTheDocument();
	});

	it("retombe sur le resume par defaut quand le statusText est vide", () => {
		ctx.error = routeErrorResponse(503, "", null);
		renderError();

		expect(
			screen.getByText("Le frontend a rencontre un incident inattendu pendant le chargement de cette route."),
		).toBeInTheDocument();
	});

	it("affiche le message et la pile d'une erreur applicative en developpement", () => {
		const error = new Error("chargement impossible");
		error.stack = "Error: chargement impossible\n  at test";
		ctx.error = error;
		renderError();

		expect(screen.getByRole("heading", { name: "Erreur applicative" })).toBeInTheDocument();
		expect(screen.getByText("chargement impossible")).toBeInTheDocument();
		expect(screen.getByText(/at test/)).toBeInTheDocument();
	});

	it("propose des retours vers l'accueil et le theme", () => {
		renderError();

		expect(screen.getByRole("link", { name: "Retour a l'accueil" })).toHaveAttribute("href", "/");
		expect(screen.getByRole("link", { name: "Ouvrir le theme" })).toHaveAttribute("href", "/theme");
	});
});
