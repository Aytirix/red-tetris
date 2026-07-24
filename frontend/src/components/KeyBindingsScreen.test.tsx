import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import KeyBindingsScreen from "./KeyBindingsScreen";
import {
	DEFAULT_KEY_BINDINGS,
	GAME_ACTIONS,
	GAME_ACTION_LABELS,
	loadKeyBindings,
} from "../config/keyBindings";

beforeEach(() => localStorage.clear());
afterEach(cleanup);

describe("KeyBindingsScreen", () => {
	it("liste toutes les actions avec leur touche courante", () => {
		render(<KeyBindingsScreen />);

		// Libelles lus depuis la config: une reformulation ne doit pas casser le test.
		for (const action of GAME_ACTIONS)
			expect(screen.getByText(GAME_ACTION_LABELS[action])).toBeInTheDocument();
		expect(screen.getByText("←")).toBeInTheDocument();
		expect(screen.getByText("Espace")).toBeInTheDocument();
		expect(screen.getByText("J")).toBeInTheDocument();
	});

	it("capture une nouvelle touche et la persiste", () => {
		render(<KeyBindingsScreen />);

		fireEvent.click(screen.getByLabelText("Changer la touche : Joker (mode invisible)"));
		expect(screen.getByText("Appuie sur une touche…")).toBeInTheDocument();

		fireEvent.keyDown(window, { code: "KeyB" });

		expect(screen.getByText("B")).toBeInTheDocument();
		expect(loadKeyBindings().joker).toBe("KeyB");
	});

	it("echange les touches en cas de conflit", () => {
		render(<KeyBindingsScreen />);

		fireEvent.click(screen.getByLabelText("Changer la touche : Joker (mode invisible)"));
		fireEvent.keyDown(window, { code: "ArrowUp" });

		const saved = loadKeyBindings();
		expect(saved.joker).toBe("ArrowUp");
		expect(saved.rotate).toBe(DEFAULT_KEY_BINDINGS.joker);
	});

	it("annule la capture avec Echap", () => {
		render(<KeyBindingsScreen />);

		fireEvent.click(screen.getByLabelText("Changer la touche : Rotation"));
		fireEvent.keyDown(window, { code: "Escape" });

		expect(screen.queryByText("Appuie sur une touche…")).toBeNull();
		expect(loadKeyBindings().rotate).toBe(DEFAULT_KEY_BINDINGS.rotate);
	});

	it("reinitialise aux valeurs par defaut", () => {
		render(<KeyBindingsScreen />);
		fireEvent.click(screen.getByLabelText("Changer la touche : Joker (mode invisible)"));
		fireEvent.keyDown(window, { code: "KeyB" });
		expect(loadKeyBindings().joker).toBe("KeyB");

		fireEvent.click(screen.getByRole("button", { name: "Réinitialiser" }));

		expect(loadKeyBindings()).toEqual(DEFAULT_KEY_BINDINGS);
		expect(screen.getByText("J")).toBeInTheDocument();
	});
});

describe("KeyBindingsScreen — libelles et ordre", () => {
	it("nomme sans ambiguite les deux descentes", () => {
		const { container } = render(<KeyBindingsScreen />);

		const labels = [...container.querySelectorAll(".keys-row__label")].map((n) => n.textContent);
		expect(labels).toEqual([
			"Déplacer à gauche",
			"Déplacer à droite",
			"Rotation",
			GAME_ACTION_LABELS.softDrop,
			GAME_ACTION_LABELS.hardDrop,
			"Joker (mode invisible)",
		]);
	});

	it("garde les touches standard: ↓ accelere, Espace fait tomber", () => {
		render(<KeyBindingsScreen />);

		const rows = screen.getAllByRole("button", { name: /^Changer la touche/ });
		expect(rows[3].textContent).toBe("↓");      // Accélérer la chute
		expect(rows[4].textContent).toBe("Espace"); // Faire tomber d'un coup
	});
});

describe("KeyBindingsScreen — robustesse de la capture (audit)", () => {
	it("ignore l'autorepeat (touche maintenue pour ouvrir la capture)", () => {
		render(<KeyBindingsScreen />);
		fireEvent.click(screen.getByLabelText(`Changer la touche : ${GAME_ACTION_LABELS.rotate}`));

		fireEvent.keyDown(window, { code: "Enter", repeat: true });

		expect(loadKeyBindings().rotate).toBe(DEFAULT_KEY_BINDINGS.rotate);
		expect(screen.getByText("Appuie sur une touche…")).toBeInTheDocument();
	});

	it("ignore une touche sans code exploitable", () => {
		render(<KeyBindingsScreen />);
		fireEvent.click(screen.getByLabelText(`Changer la touche : ${GAME_ACTION_LABELS.rotate}`));

		fireEvent.keyDown(window, { code: "" });
		fireEvent.keyDown(window, { code: "Unidentified" });

		expect(loadKeyBindings().rotate).toBe(DEFAULT_KEY_BINDINGS.rotate);
	});
});
