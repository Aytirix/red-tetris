import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";

vi.mock("../hooks/useAuthGuard", () => ({ useAuthGuard: vi.fn() }));
vi.mock("../components/DevToolsMenu", () => ({
	default: () => <span data-testid="dev-tools" />,
}));

import RootLayout from "./RootLayout";
import { useAuthGuard } from "../hooks/useAuthGuard";

function renderAt(pathname: string) {
	return render(
		<MemoryRouter initialEntries={[pathname]}>
			<Routes>
				<Route path="/" element={<RootLayout />}>
					<Route index element={<p>page</p>} />
					<Route path="*" element={<p>page</p>} />
				</Route>
			</Routes>
		</MemoryRouter>,
	);
}

afterEach(cleanup);

describe("RootLayout", () => {
	it("active la garde d'authentification sur toutes les pages", () => {
		renderAt("/theme");

		expect(useAuthGuard).toHaveBeenCalled();
	});

	it("monte toujours le menu outils de developpement", () => {
		renderAt("/theme");

		expect(screen.getByTestId("dev-tools")).toBeInTheDocument();
	});

	it("rend l'accueil en plein ecran, sans conteneur de page", () => {
		const { container } = renderAt("/");

		expect(container.querySelector("main")).toBeNull();
		expect(screen.getByText("page")).toBeInTheDocument();
	});

	it("rend le dashboard en plein ecran", () => {
		const { container } = renderAt("/dashboard");

		expect(container.querySelector("main")).toBeNull();
	});

	it("rend une page de jeu (2 segments) en plein ecran", () => {
		const { container } = renderAt("/room-42/luffy");

		expect(container.querySelector("main")).toBeNull();
	});

	it("encadre les autres pages dans un conteneur .page", () => {
		const { container } = renderAt("/theme");

		expect(container.querySelector("main")?.className).toBe("page");
	});

	it("elargit le conteneur pour la documentation WS", () => {
		const { container } = renderAt("/docs-ws");

		expect(container.querySelector("main")?.className).toBe("page page-wide");
	});

	it("ouvre les nuages de démarrage après le premier paint", async () => {
		const open = vi.fn();
		window.__openBootClouds = open;

		renderAt("/");

		await vi.waitFor(() => expect(open).toHaveBeenCalledTimes(1));
		delete window.__openBootClouds;
	});
});
