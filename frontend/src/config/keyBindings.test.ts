import { beforeEach, describe, expect, it, vi } from "vitest";
import {
	actionForCode,
	assignKey,
	DEFAULT_KEY_BINDINGS,
	formatKeyCode,
	GAME_ACTIONS,
	getLearnedKeyLabel,
	loadKeyBindings,
	loadKeyboardLayout,
	recordKeyLabel,
	resetLearnedLayout,
	saveKeyBindings,
	subscribeKeyLayout,
} from "./keyBindings";

beforeEach(() => {
	localStorage.clear();
	resetLearnedLayout();
	vi.restoreAllMocks();
});

describe("formatKeyCode", () => {
	it("rend les touches lisibles", () => {
		expect(formatKeyCode("Space")).toBe("Espace");
		expect(formatKeyCode("ArrowLeft")).toBe("←");
		expect(formatKeyCode("ArrowRight")).toBe("→");
		expect(formatKeyCode("ArrowUp")).toBe("↑");
		expect(formatKeyCode("ArrowDown")).toBe("↓");
		expect(formatKeyCode("KeyJ")).toBe("J");
		expect(formatKeyCode("Digit1")).toBe("1");
		expect(formatKeyCode("Numpad5")).toBe("Pavé 5");
		expect(formatKeyCode("ShiftLeft")).toBe("ShiftLeft");
	});
});

describe("loadKeyBindings", () => {
	it("renvoie les defauts sans configuration stockee", () => {
		expect(loadKeyBindings()).toEqual(DEFAULT_KEY_BINDINGS);
	});

	it("relit une configuration sauvegardee", () => {
		saveKeyBindings({ ...DEFAULT_KEY_BINDINGS, rotate: "KeyW" });
		expect(loadKeyBindings().rotate).toBe("KeyW");
	});

	it("complete une configuration partielle avec les defauts", () => {
		localStorage.setItem("keyBindings", JSON.stringify({ rotate: "KeyW" }));
		const bindings = loadKeyBindings();

		expect(bindings.rotate).toBe("KeyW");
		expect(bindings.moveLeft).toBe(DEFAULT_KEY_BINDINGS.moveLeft);
		// Aucune action ne doit rester sans touche.
		for (const action of GAME_ACTIONS) expect(bindings[action]).toBeTruthy();
	});

	it("ignore une configuration corrompue ou de mauvais type", () => {
		localStorage.setItem("keyBindings", "{pas du json");
		expect(loadKeyBindings()).toEqual(DEFAULT_KEY_BINDINGS);

		localStorage.setItem("keyBindings", JSON.stringify({ rotate: 42 }));
		expect(loadKeyBindings().rotate).toBe(DEFAULT_KEY_BINDINGS.rotate);

		localStorage.setItem("keyBindings", JSON.stringify("nope"));
		expect(loadKeyBindings()).toEqual(DEFAULT_KEY_BINDINGS);
	});

	it("survit a un localStorage indisponible", () => {
		vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
			throw new Error("blocked");
		});
		expect(loadKeyBindings()).toEqual(DEFAULT_KEY_BINDINGS);
	});

	it("n'explose pas si l'ecriture est refusee", () => {
		vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
			throw new Error("quota");
		});
		expect(() => saveKeyBindings(DEFAULT_KEY_BINDINGS)).not.toThrow();
	});
});

describe("assignKey", () => {
	it("assigne une touche libre", () => {
		const next = assignKey(DEFAULT_KEY_BINDINGS, "joker", "KeyB");
		expect(next.joker).toBe("KeyB");
		expect(next.rotate).toBe(DEFAULT_KEY_BINDINGS.rotate);
	});

	it("ECHANGE les touches en cas de conflit (aucune action orpheline)", () => {
		const next = assignKey(DEFAULT_KEY_BINDINGS, "joker", DEFAULT_KEY_BINDINGS.rotate);

		expect(next.joker).toBe(DEFAULT_KEY_BINDINGS.rotate);
		expect(next.rotate).toBe(DEFAULT_KEY_BINDINGS.joker);
		// Toutes les actions ont encore une touche, et toutes sont distinctes.
		const codes = GAME_ACTIONS.map((a) => next[a]);
		expect(new Set(codes).size).toBe(GAME_ACTIONS.length);
	});

	it("ne modifie pas l'objet d'origine", () => {
		const original = { ...DEFAULT_KEY_BINDINGS };
		assignKey(original, "joker", "KeyB");
		expect(original).toEqual(DEFAULT_KEY_BINDINGS);
	});
});

describe("actionForCode", () => {
	it("retrouve l'action liee a une touche", () => {
		expect(actionForCode(DEFAULT_KEY_BINDINGS, "ArrowLeft")).toBe("moveLeft");
		expect(actionForCode(DEFAULT_KEY_BINDINGS, "ArrowDown")).toBe("softDrop");
		expect(actionForCode(DEFAULT_KEY_BINDINGS, "Space")).toBe("hardDrop");
		expect(actionForCode(DEFAULT_KEY_BINDINGS, "KeyJ")).toBe("joker");
	});

	it("renvoie null pour une touche non liee", () => {
		expect(actionForCode(DEFAULT_KEY_BINDINGS, "KeyQ")).toBeNull();
	});
});

describe("formatKeyCode — disposition clavier reelle", () => {
	// AZERTY: la touche PHYSIQUE "KeyW" porte un Z, "KeyA" porte un Q.
	const azerty = { get: (code: string) => ({ KeyW: "z", KeyA: "q", KeyJ: "j" })[code] };

	it("affiche la touche imprimee sur le clavier du joueur", () => {
		expect(formatKeyCode("KeyW", azerty)).toBe("Z");
		expect(formatKeyCode("KeyA", azerty)).toBe("Q");
	});

	it("retombe sur le libelle generique sans disposition connue", () => {
		expect(formatKeyCode("KeyW", null)).toBe("W");
		expect(formatKeyCode("KeyW")).toBe("W");
	});

	it("ignore une entree de disposition vide ou trop longue", () => {
		const bizarre = { get: () => "   " };
		expect(formatKeyCode("KeyW", bizarre)).toBe("W");
		const verbeux = { get: () => "Backspace" };
		expect(formatKeyCode("KeyW", verbeux)).toBe("W");
	});

	it("garde les libelles fixes des touches sans caractere imprime", () => {
		const piege = { get: () => "x" };
		expect(formatKeyCode("Space", piege)).toBe("Espace");
		expect(formatKeyCode("ArrowDown", piege)).toBe("↓");
	});
});

describe("loadKeyboardLayout", () => {
	it("renvoie null quand le navigateur n'expose pas l'API", async () => {
		await expect(loadKeyboardLayout()).resolves.toBeNull();
	});
});

describe("disposition APPRISE des frappes (sans API Keyboard Map)", () => {
	it("affiche la vraie touche apprise d'une frappe reelle (AZERTY: KeyA -> Q)", () => {
		// Sans rien appris, on retombe sur le libelle QWERTY generique.
		expect(formatKeyCode("KeyA")).toBe("A");
		// L'utilisateur presse la touche PHYSIQUE "KeyA" de son AZERTY: elle imprime "q".
		recordKeyLabel("KeyA", "q");
		expect(getLearnedKeyLabel("KeyA")).toBe("Q");
		expect(formatKeyCode("KeyA")).toBe("Q");
	});

	it("la disposition apprise PRIME sur l'API Keyboard Map", () => {
		recordKeyLabel("KeyW", "z");
		// Meme si une API renvoyait autre chose, l'appris (clavier reel) l'emporte.
		const menteur = { get: () => "x" };
		expect(formatKeyCode("KeyW", menteur)).toBe("Z");
	});

	it("persiste dans localStorage et se recharge", () => {
		recordKeyLabel("KeyA", "q");
		resetLearnedLayout(); // vide le cache memoire, force une relecture du storage
		expect(getLearnedKeyLabel("KeyA")).toBe("Q");
	});

	it("ignore les touches non imprimables et les codes non alphanumeriques", () => {
		recordKeyLabel("KeyA", "Shift"); // pas un caractere unique
		recordKeyLabel("ShiftLeft", "A"); // pas une touche Key*/Digit*
		recordKeyLabel("KeyA", "Dead");
		expect(getLearnedKeyLabel("KeyA")).toBeUndefined();
		expect(getLearnedKeyLabel("ShiftLeft")).toBeUndefined();
	});

	it("apprend aussi les chiffres (rangee du haut)", () => {
		recordKeyLabel("Digit1", "&"); // AZERTY: le "1" physique imprime "&" sans Shift
		expect(formatKeyCode("Digit1")).toBe("&");
	});

	it("notifie les abonnes quand une nouvelle touche est apprise", () => {
		const seen: string[] = [];
		const unsubscribe = subscribeKeyLayout(() => seen.push("tick"));
		recordKeyLabel("KeyA", "q");
		recordKeyLabel("KeyA", "q"); // meme valeur -> pas de nouvelle notification
		recordKeyLabel("KeyW", "z");
		unsubscribe();
		recordKeyLabel("KeyE", "e"); // plus abonne -> ignore
		expect(seen).toHaveLength(2);
	});

	it("survit a un localStorage indisponible sans planter", () => {
		vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
			throw new Error("quota");
		});
		expect(() => recordKeyLabel("KeyA", "q")).not.toThrow();
		// La valeur reste utilisable en memoire pour la session.
		expect(getLearnedKeyLabel("KeyA")).toBe("Q");
	});
});

describe("loadKeyBindings — deduplication (audit)", () => {
	it("repare une collision creee par le remplissage des defauts", () => {
		// moveLeft prend la touche par defaut de moveRight -> collision.
		localStorage.setItem("keyBindings", JSON.stringify({ moveLeft: DEFAULT_KEY_BINDINGS.moveRight }));

		const bindings = loadKeyBindings();

		expect(bindings.moveLeft).toBe(DEFAULT_KEY_BINDINGS.moveRight);
		// moveRight ne doit PAS rester sur la meme touche (il serait injouable).
		expect(bindings.moveRight).not.toBe(bindings.moveLeft);
		// AUCUNE action ne doit se retrouver sans touche: une chaine vide la rendrait
		// definitivement injouable (et serait captee par actionForCode("")).
		const codes = GAME_ACTIONS.map((a) => bindings[a]);
		expect(codes.every((code) => code.length > 0)).toBe(true);
		expect(new Set(codes).size).toBe(codes.length);
	});

	it("chaque action reste resolvable par actionForCode", () => {
		localStorage.setItem("keyBindings", JSON.stringify({ moveLeft: DEFAULT_KEY_BINDINGS.moveRight }));
		const bindings = loadKeyBindings();

		for (const action of GAME_ACTIONS)
			expect(actionForCode(bindings, bindings[action])).toBe(action);
		// Une touche vide ne doit correspondre a AUCUNE action.
		expect(actionForCode(bindings, "")).toBeNull();
	});

	it("resiste a une cascade de collisions", () => {
		localStorage.setItem("keyBindings", JSON.stringify({
			moveLeft: DEFAULT_KEY_BINDINGS.moveRight,
			rotate: DEFAULT_KEY_BINDINGS.softDrop,
		}));

		const bindings = loadKeyBindings();
		const codes = GAME_ACTIONS.map((a) => bindings[a]);

		expect(codes.every((code) => code.length > 0)).toBe(true);
		expect(new Set(codes).size).toBe(GAME_ACTIONS.length);
	});
});
