import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { AlertProvider } from "./Alert";
import { PIECE_THEMES } from "../config/pieceThemes";

const shop = vi.hoisted(() => ({
	state: {
		berrys: 0,
		owned: ["neon-gem"] as string[],
		equipped: "neon-gem",
		catalog: [] as { id: string; price: number }[],
		lastError: null as string | null,
		buy: vi.fn(),
		equip: vi.fn(),
		clearError: vi.fn(),
	},
}));

vi.mock("../contexts/ShopContext", () => ({
	useShop: () => shop.state,
}));

import ShopScreen from "./ShopScreen";

function renderShop() {
	return render(<AlertProvider><ShopScreen /></AlertProvider>);
}

/** Carte de la boutique correspondant au theme donne. */
function card(themeName: string): HTMLElement {
	return screen.getByText(themeName).closest("article") as HTMLElement;
}

beforeEach(() => {
	shop.state = {
		berrys: 0,
		owned: ["neon-gem"],
		equipped: "neon-gem",
		catalog: [],
		lastError: null,
		buy: vi.fn(),
		equip: vi.fn(),
		clearError: vi.fn(),
	};
});

afterEach(cleanup);

describe("ShopScreen", () => {
	it("liste tous les themes du catalogue local", () => {
		const { container } = renderShop();

		expect(container.querySelectorAll(".shop-card")).toHaveLength(PIECE_THEMES.length);
	});

	it("marque le theme equipe et desactive son bouton", () => {
		renderShop();
		const equipped = within(card("Neon Gem")).getByRole("button", { name: "✓ Équipé" });

		expect(equipped).toBeDisabled();
		expect(card("Neon Gem").className).toContain("shop-card--equipped");
	});

	it("propose d'equiper un theme deja possede", () => {
		shop.state.owned = ["neon-gem", "jewel"];
		renderShop();

		fireEvent.click(within(card("Joyaux")).getByRole("button", { name: "Équiper" }));

		expect(shop.state.equip).toHaveBeenCalledWith("jewel");
		expect(within(card("Joyaux")).getByText("Possédé")).toBeInTheDocument();
	});

	it("bloque l'achat quand le butin est insuffisant", () => {
		renderShop();

		const button = within(card("Joyaux")).getByRole("button", { name: "Butin insuffisant" });
		expect(button).toBeDisabled();
		expect(button).toHaveAttribute("title", "Butin insuffisant");
	});

	it("demande confirmation avant d'acheter puis relaie l'achat", async () => {
		shop.state.berrys = 10_000;
		renderShop();

		fireEvent.click(within(card("Joyaux")).getByRole("button", { name: /^Acheter · / }));

		expect(await screen.findByText("Débloquer « Joyaux » ?")).toBeInTheDocument();
		fireEvent.click(screen.getByRole("button", { name: "Acheter" }));

		await vi.waitFor(() => expect(shop.state.buy).toHaveBeenCalledWith("jewel"));
	});

	it("n'achete rien si la confirmation est annulee", async () => {
		shop.state.berrys = 10_000;
		renderShop();

		fireEvent.click(within(card("Joyaux")).getByRole("button", { name: /^Acheter · / }));
		fireEvent.click(await screen.findByRole("button", { name: "Annuler" }));

		await vi.waitFor(() => expect(screen.queryByText("Débloquer « Joyaux » ?")).toBeNull());
		expect(shop.state.buy).not.toHaveBeenCalled();
	});

	it("prefere le prix du catalogue serveur au prix local", () => {
		shop.state.berrys = 10_000;
		shop.state.catalog = [{ id: "jewel", price: 123 }];
		renderShop();

		expect(within(card("Joyaux")).getByText("123 ฿")).toBeInTheDocument();
		expect(within(card("Joyaux")).getByRole("button", { name: "Acheter · 123 ฿" })).toBeInTheDocument();
	});

	it("affiche l'erreur de la boutique et permet de la fermer", () => {
		shop.state.lastError = "Fonds insuffisants";
		renderShop();

		expect(screen.getByRole("alert")).toHaveTextContent("Fonds insuffisants");
		fireEvent.click(screen.getByRole("button", { name: "Fermer" }));

		expect(shop.state.clearError).toHaveBeenCalledTimes(1);
	});

	it("n'affiche pas de bandeau d'erreur en temps normal", () => {
		renderShop();

		expect(screen.queryByRole("alert")).toBeNull();
	});
});
