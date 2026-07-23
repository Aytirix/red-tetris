import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

// La modale charge DocsWsPage en import dynamique: on le remplace par un
// composant inerte pour ne pas tirer le singleton socket dans ce test.
vi.mock("../pages/DocsWsPage", () => ({
	default: () => <p>documentation ws</p>,
}));

import DevToolsMenu from "./DevToolsMenu";

afterEach(() => {
	cleanup();
	document.body.style.overflow = "";
});

describe("DevToolsMenu", () => {
	it("affiche le declencheur en mode developpement", () => {
		render(<DevToolsMenu />);

		expect(screen.getByLabelText("Ouvrir les outils de développement")).toBeInTheDocument();
	});

	it("garde la modale fermee au depart", () => {
		const { container } = render(<DevToolsMenu />);
		const modal = container.querySelector(".dev-tools-modal") as HTMLElement;

		expect(modal.className).not.toContain("is-open");
		expect(modal).toHaveAttribute("aria-hidden", "true");
		expect(document.body.style.overflow).toBe("");
	});

	it("ouvre la modale et bloque le defilement du body", async () => {
		const { container } = render(<DevToolsMenu />);

		fireEvent.click(screen.getByLabelText("Ouvrir les outils de développement"));

		expect((container.querySelector(".dev-tools-modal") as HTMLElement).className).toContain("is-open");
		expect(document.body.style.overflow).toBe("hidden");
		expect(await screen.findByText("documentation ws")).toBeInTheDocument();
	});

	it("ferme la modale avec le bouton Fermer et restaure le defilement", () => {
		const { container } = render(<DevToolsMenu />);
		fireEvent.click(screen.getByLabelText("Ouvrir les outils de développement"));

		fireEvent.click(screen.getByRole("button", { name: "Fermer" }));

		expect((container.querySelector(".dev-tools-modal") as HTMLElement).className).not.toContain("is-open");
		expect(document.body.style.overflow).toBe("");
	});

	it("ferme la modale avec la touche Echap", () => {
		const { container } = render(<DevToolsMenu />);
		fireEvent.click(screen.getByLabelText("Ouvrir les outils de développement"));

		fireEvent.keyDown(window, { key: "Escape" });

		expect((container.querySelector(".dev-tools-modal") as HTMLElement).className).not.toContain("is-open");
	});

	it("ignore les autres touches", () => {
		const { container } = render(<DevToolsMenu />);
		fireEvent.click(screen.getByLabelText("Ouvrir les outils de développement"));

		fireEvent.keyDown(window, { key: "a" });

		expect((container.querySelector(".dev-tools-modal") as HTMLElement).className).toContain("is-open");
	});

	it("ferme la modale au clic sur l'arriere-plan mais pas sur le panneau", () => {
		const { container } = render(<DevToolsMenu />);
		fireEvent.click(screen.getByLabelText("Ouvrir les outils de développement"));

		fireEvent.click(container.querySelector(".dev-tools-modal-panel") as HTMLElement);
		expect((container.querySelector(".dev-tools-modal") as HTMLElement).className).toContain("is-open");

		fireEvent.click(container.querySelector(".dev-tools-modal") as HTMLElement);
		expect((container.querySelector(".dev-tools-modal") as HTMLElement).className).not.toContain("is-open");
	});
});
