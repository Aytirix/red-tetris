import { describe, expect, it } from "vitest";
import {
	USER_RESULT_USERNAME_AVAILABLE_EVENT,
	hasUserFaction,
	normalizeUserFaction,
	normalizeUsernameAvailability,
} from "./userState";

describe("USER_RESULT_USERNAME_AVAILABLE_EVENT", () => {
	it("expose le nom d'evenement attendu par le backend", () => {
		expect(USER_RESULT_USERNAME_AVAILABLE_EVENT).toBe("user:ResultUsernameAvailable");
	});
});

describe("normalizeUserFaction", () => {
	it("reconnait les factions connues", () => {
		expect(normalizeUserFaction("pirate")).toBe("pirate");
		expect(normalizeUserFaction("marine")).toBe("marine");
	});

	it("est insensible a la casse", () => {
		expect(normalizeUserFaction("PIRATE")).toBe("pirate");
		expect(normalizeUserFaction("Marine")).toBe("marine");
	});

	it("retourne null pour une faction inconnue", () => {
		expect(normalizeUserFaction("revolutionnaire")).toBeNull();
		expect(normalizeUserFaction("")).toBeNull();
	});

	it("retourne null pour une valeur non textuelle", () => {
		expect(normalizeUserFaction(null)).toBeNull();
		expect(normalizeUserFaction(undefined)).toBeNull();
		expect(normalizeUserFaction(true)).toBeNull();
		expect(normalizeUserFaction(1)).toBeNull();
		expect(normalizeUserFaction({ faction: "pirate" })).toBeNull();
	});
});

describe("hasUserFaction", () => {
	it("est vrai pour true (ancien format booleen)", () => {
		expect(hasUserFaction(true)).toBe(true);
	});

	it("est vrai pour une faction connue", () => {
		expect(hasUserFaction("marine")).toBe(true);
	});

	it("est faux sinon", () => {
		expect(hasUserFaction(false)).toBe(false);
		expect(hasUserFaction(null)).toBe(false);
		expect(hasUserFaction("inconnu")).toBe(false);
	});
});

describe("normalizeUsernameAvailability", () => {
	it("retourne null pour une valeur non objet", () => {
		expect(normalizeUsernameAvailability(null)).toBeNull();
		expect(normalizeUsernameAvailability(undefined)).toBeNull();
		expect(normalizeUsernameAvailability("luffy")).toBeNull();
		expect(normalizeUsernameAvailability(0)).toBeNull();
	});

	it("retourne null quand available n'est pas booleen", () => {
		expect(normalizeUsernameAvailability({ available: "true", username: "luffy" })).toBeNull();
	});

	it("retourne null quand username n'est pas une chaine", () => {
		expect(normalizeUsernameAvailability({ available: true, username: 42 })).toBeNull();
		expect(normalizeUsernameAvailability({ available: true })).toBeNull();
	});

	it("normalise un utilisateur deja inscrit avec sa faction", () => {
		const result = normalizeUsernameAvailability({
			available: false,
			user_faction: "Pirate",
			username: "luffy",
		})!;

		expect(result.available).toBe(false);
		expect(result.isRegistered).toBe(true);
		expect(result.user_faction).toBe("pirate");
		expect(result.username).toBe("luffy");
		expect(result.raw).toEqual({
			available: false,
			user_faction: "Pirate",
			username: "luffy",
		});
	});

	it("normalise un pseudo libre sans faction", () => {
		const result = normalizeUsernameAvailability({
			available: true,
			user_faction: null,
			username: "nouveau",
		})!;

		expect(result.available).toBe(true);
		expect(result.isRegistered).toBe(false);
		expect(result.user_faction).toBeNull();
		expect(result.raw.user_faction).toBeNull();
	});

	it("gere l'ancien format booleen de user_faction", () => {
		const result = normalizeUsernameAvailability({
			available: false,
			user_faction: true,
			username: "ancien",
		})!;

		expect(result.isRegistered).toBe(true);
		expect(result.user_faction).toBeNull();
	});

	it("accepte un username vide tant que le type est correct", () => {
		const result = normalizeUsernameAvailability({ available: true, username: "" })!;
		expect(result).not.toBeNull();
		expect(result.username).toBe("");
		expect(result.raw.user_faction).toBeUndefined();
	});
});
