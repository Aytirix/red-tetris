import { describe, expect, it } from "vitest";
import { normalizeShopError, normalizeShopState } from "./shopState";
import { DEFAULT_THEME_ID } from "../config/pieceThemes";

describe("normalizeShopState — garde-fous", () => {
	it("retourne null pour une valeur non objet", () => {
		expect(normalizeShopState(null)).toBeNull();
		expect(normalizeShopState(undefined)).toBeNull();
		expect(normalizeShopState("shop")).toBeNull();
		expect(normalizeShopState(12)).toBeNull();
	});

	it("retourne un etat par defaut coherent pour un objet vide", () => {
		expect(normalizeShopState({})).toEqual({
			berrys: 0,
			owned: [DEFAULT_THEME_ID],
			equipped: DEFAULT_THEME_ID,
			catalog: [],
		});
	});
});

describe("normalizeShopState — berrys", () => {
	it("tronque un solde decimal", () => {
		expect(normalizeShopState({ berrys: 1250.9 })!.berrys).toBe(1250);
	});

	it("remet a zero un solde negatif ou non numerique", () => {
		expect(normalizeShopState({ berrys: -50 })!.berrys).toBe(0);
		expect(normalizeShopState({ berrys: "1000" })!.berrys).toBe(0);
		expect(normalizeShopState({ berrys: null })!.berrys).toBe(0);
	});

	it("accepte un solde nul", () => {
		expect(normalizeShopState({ berrys: 0 })!.berrys).toBe(0);
	});
});

describe("normalizeShopState — themes possedes", () => {
	it("filtre les entrees non textuelles", () => {
		const state = normalizeShopState({ owned: ["synthwave", 42, null, "jewel"] })!;
		expect(state.owned).toEqual(["synthwave", "jewel", DEFAULT_THEME_ID]);
	});

	it("ajoute toujours le theme par defaut", () => {
		expect(normalizeShopState({ owned: [] })!.owned).toEqual([DEFAULT_THEME_ID]);
	});

	it("ne duplique pas le theme par defaut deja present", () => {
		const state = normalizeShopState({ owned: [DEFAULT_THEME_ID, "jewel"] })!;
		expect(state.owned).toEqual([DEFAULT_THEME_ID, "jewel"]);
	});

	it("retombe sur le theme par defaut quand owned n'est pas un tableau", () => {
		expect(normalizeShopState({ owned: "synthwave" })!.owned).toEqual([DEFAULT_THEME_ID]);
	});
});

describe("normalizeShopState — theme equipe", () => {
	it("conserve un theme equipe possede", () => {
		expect(normalizeShopState({ owned: ["jewel"], equipped: "jewel" })!.equipped).toBe("jewel");
	});

	it("retombe sur le theme par defaut si le theme equipe n'est pas possede", () => {
		expect(normalizeShopState({ owned: ["jewel"], equipped: "synthwave" })!.equipped).toBe(
			DEFAULT_THEME_ID,
		);
	});

	it("retombe sur le theme par defaut si equipped n'est pas une chaine", () => {
		expect(normalizeShopState({ equipped: 7 })!.equipped).toBe(DEFAULT_THEME_ID);
	});
});

describe("normalizeShopState — catalogue", () => {
	it("retourne un catalogue vide quand ce n'est pas un tableau", () => {
		expect(normalizeShopState({ catalog: {} })!.catalog).toEqual([]);
	});

	it("garde uniquement les entrees id/price valides", () => {
		const state = normalizeShopState({
			catalog: [
				{ id: "jewel", price: 4000 },
				{ id: "synthwave", price: 2500.7 },
				{ id: "gratuit", price: -10 },
				{ id: 42, price: 100 },
				{ id: "sans-prix" },
				{ price: 100 },
				null,
				"jewel",
			],
		})!;

		expect(state.catalog).toEqual([
			{ id: "jewel", price: 4000 },
			{ id: "synthwave", price: 2500 },
			{ id: "gratuit", price: 0 },
		]);
	});
});

describe("normalizeShopError", () => {
	it("retourne null pour une valeur non objet", () => {
		expect(normalizeShopError(null)).toBeNull();
		expect(normalizeShopError(undefined)).toBeNull();
		expect(normalizeShopError("boom")).toBeNull();
	});

	it("retourne le message quand il est textuel", () => {
		expect(normalizeShopError({ message: "Solde insuffisant" })).toBe("Solde insuffisant");
	});

	it("retourne un message generique quand le champ message est absent ou invalide", () => {
		expect(normalizeShopError({})).toBe("Opération impossible");
		expect(normalizeShopError({ message: 500 })).toBe("Opération impossible");
	});
});
