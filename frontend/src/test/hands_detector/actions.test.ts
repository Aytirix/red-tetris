import { describe, expect, it } from "vitest";
import { COOLDOWN_MS, applyCooldowns } from "./actions";
import type { GameAction } from "./actions";
import {
	COOLDOWN_HARD_DROP_MS,
	COOLDOWN_MOVE_MS,
	COOLDOWN_RELEASE_BLOCK_MS,
	COOLDOWN_ROTATE_MS,
	COOLDOWN_SOFT_DROP_MS,
} from "./constants";

const ALL_ACTIONS: GameAction[] = ["LEFT", "RIGHT", "DOWN", "ROTATE", "DROP"];

describe("COOLDOWN_MS — table des cooldowns", () => {
	it("couvre toutes les actions du jeu", () => {
		expect(Object.keys(COOLDOWN_MS).sort()).toEqual([...ALL_ACTIONS].sort());
	});

	it("branche chaque action sur le bon reglage", () => {
		expect(COOLDOWN_MS.LEFT).toBe(COOLDOWN_MOVE_MS);
		expect(COOLDOWN_MS.RIGHT).toBe(COOLDOWN_MOVE_MS);
		expect(COOLDOWN_MS.DOWN).toBe(COOLDOWN_SOFT_DROP_MS);
		expect(COOLDOWN_MS.ROTATE).toBe(COOLDOWN_ROTATE_MS);
		expect(COOLDOWN_MS.DROP).toBe(COOLDOWN_HARD_DROP_MS);
	});
});

describe("applyCooldowns — cas de base", () => {
	it("ne declenche rien quand rien n'est demande", () => {
		const { fired, lastFiredAt } = applyCooldowns([], {}, 1000);
		expect(fired).toEqual([]);
		expect(lastFiredAt).toEqual({});
	});

	it("declenche une action jamais vue et memorise l'instant", () => {
		const { fired, lastFiredAt } = applyCooldowns(["LEFT"], {}, 1000);
		expect(fired).toEqual(["LEFT"]);
		expect(lastFiredAt.LEFT).toBe(1000);
	});

	it("preserve l'ordre des actions demandees", () => {
		const { fired } = applyCooldowns(["ROTATE", "LEFT", "DOWN"], {}, 1000);
		expect(fired).toEqual(["ROTATE", "LEFT", "DOWN"]);
	});

	it("ne mute pas la table d'instants recue", () => {
		const precedent: Partial<Record<GameAction, number>> = { LEFT: 500 };
		const { lastFiredAt } = applyCooldowns(["LEFT", "RIGHT"], precedent, 5000);
		expect(precedent).toEqual({ LEFT: 500 });
		expect(lastFiredAt).not.toBe(precedent);
	});

	it("conserve les instants des actions non demandees", () => {
		const { lastFiredAt } = applyCooldowns(["LEFT"], { DOWN: 42 }, 1000);
		expect(lastFiredAt.DOWN).toBe(42);
	});
});

describe("applyCooldowns — anti-spam par action", () => {
	it("bloque une repetition avant la fin du cooldown", () => {
		const t = 10_000;
		const { fired } = applyCooldowns(["LEFT"], { LEFT: t }, t + COOLDOWN_MOVE_MS - 1);
		expect(fired).toEqual([]);
	});

	it("re-arme pile a la fin du cooldown", () => {
		const t = 10_000;
		const { fired, lastFiredAt } = applyCooldowns(["LEFT"], { LEFT: t }, t + COOLDOWN_MOVE_MS);
		expect(fired).toEqual(["LEFT"]);
		expect(lastFiredAt.LEFT).toBe(t + COOLDOWN_MOVE_MS);
	});

	it("laisse l'instant intact quand l'action est bloquee", () => {
		const t = 10_000;
		const { lastFiredAt } = applyCooldowns(["LEFT"], { LEFT: t }, t + 10);
		expect(lastFiredAt.LEFT).toBe(t);
	});

	it("compte les cooldowns separement par action", () => {
		const t = 10_000;
		const { fired } = applyCooldowns(["LEFT", "RIGHT"], { LEFT: t }, t + 10);
		expect(fired).toEqual(["RIGHT"]);
	});

	it("re-arme la descente avant le deplacement lateral", () => {
		// Le soft drop est plus reactif que le deplacement: a t + COOLDOWN_SOFT_DROP_MS
		// seule la descente doit repasser.
		const t = 10_000;
		const { fired } = applyCooldowns(
			["LEFT", "DOWN"],
			{ LEFT: t, DOWN: t },
			t + COOLDOWN_SOFT_DROP_MS,
		);
		expect(fired).toEqual(["DOWN"]);
	});

	it("laisse la rotation passer a chaque frame", () => {
		const t = 10_000;
		const premier = applyCooldowns(["ROTATE"], {}, t);
		expect(premier.fired).toEqual(["ROTATE"]);
		// Meme timestamp: la rotation n'a aucun cooldown, elle doit repasser.
		const second = applyCooldowns(["ROTATE"], premier.lastFiredAt, t);
		expect(second.fired).toEqual(["ROTATE"]);
	});
});

describe("applyCooldowns — blocage apres un hard drop", () => {
	it("gele les autres actions juste apres le drop", () => {
		const t = 10_000;
		const { fired, lastFiredAt } = applyCooldowns(
			["LEFT", "RIGHT", "DOWN", "ROTATE"],
			{ DROP: t },
			t + COOLDOWN_RELEASE_BLOCK_MS - 1,
		);
		expect(fired).toEqual([]);
		// Rien n'est arme pendant le gel: la table reste celle du drop.
		expect(lastFiredAt).toEqual({ DROP: t });
	});

	it("libere les autres actions des la fin du gel", () => {
		const t = 10_000;
		const { fired } = applyCooldowns(
			["LEFT", "ROTATE"],
			{ DROP: t },
			t + COOLDOWN_RELEASE_BLOCK_MS,
		);
		expect(fired).toEqual(["LEFT", "ROTATE"]);
	});

	it("n'active le gel que si un drop a deja eu lieu", () => {
		// Sans DROP memorise, `now - 0` depasse largement le gel a t = 10 000.
		const { fired } = applyCooldowns(["LEFT"], {}, 10_000);
		expect(fired).toEqual(["LEFT"]);
	});

	it("bloque le drop lui-meme par son propre cooldown", () => {
		const t = 10_000;
		expect(applyCooldowns(["DROP"], { DROP: t }, t + COOLDOWN_HARD_DROP_MS - 1).fired)
			.toEqual([]);
		expect(applyCooldowns(["DROP"], { DROP: t }, t + COOLDOWN_HARD_DROP_MS).fired)
			.toEqual(["DROP"]);
	});

	it("enchaine correctement drop puis deplacement puis nouveau drop", () => {
		const t = 10_000;
		let table: Partial<Record<GameAction, number>> = {};

		const drop = applyCooldowns(["DROP"], table, t);
		expect(drop.fired).toEqual(["DROP"]);
		table = drop.lastFiredAt;

		const pendantLeGel = applyCooldowns(["LEFT"], table, t + 100);
		expect(pendantLeGel.fired).toEqual([]);
		table = pendantLeGel.lastFiredAt;

		const apresLeGel = applyCooldowns(["LEFT"], table, t + COOLDOWN_RELEASE_BLOCK_MS + 1);
		expect(apresLeGel.fired).toEqual(["LEFT"]);
		table = apresLeGel.lastFiredAt;

		const dropTropTot = applyCooldowns(["DROP"], table, t + COOLDOWN_HARD_DROP_MS - 1);
		expect(dropTropTot.fired).toEqual([]);

		const dropSuivant = applyCooldowns(["DROP"], table, t + COOLDOWN_HARD_DROP_MS);
		expect(dropSuivant.fired).toEqual(["DROP"]);
		expect(dropSuivant.lastFiredAt.DROP).toBe(t + COOLDOWN_HARD_DROP_MS);
	});
});
