// Touches de jeu personnalisables, persistées en localStorage.
// On stocke des `KeyboardEvent.code` (indépendants de la disposition clavier).

export type GameAction = "moveLeft" | "moveRight" | "softDrop" | "rotate" | "hardDrop" | "joker";

// Ordre d'AFFICHAGE dans le menu des touches (n'affecte pas les actions elles-memes).
export const GAME_ACTIONS: GameAction[] = [
	"moveLeft",
	"moveRight",
	"rotate",
	"softDrop",
	"hardDrop",
	"joker",
];

// Libelles explicites: "chute rapide" = descendre PLUS VITE (fleche du bas),
// a ne pas confondre avec "faire tomber d'un coup" (espace), qui pose la piece
// instantanement tout en bas.
export const GAME_ACTION_LABELS: Record<GameAction, string> = {
	moveLeft: "Déplacer à gauche",
	moveRight: "Déplacer à droite",
	softDrop: "Accélérer la chute",
	rotate: "Rotation",
	hardDrop: "Faire tomber la pièce",
	joker: "Joker (mode invisible)",
};

export const DEFAULT_KEY_BINDINGS: Record<GameAction, string> = {
	moveLeft: "ArrowLeft",
	moveRight: "ArrowRight",
	softDrop: "ArrowDown",
	rotate: "ArrowUp",
	hardDrop: "Space",
	joker: "KeyJ",
};

export type KeyBindings = Record<GameAction, string>;

const STORAGE_KEY = "keyBindings";

// On stocke le `code` (touche PHYSIQUE) pour que le jeu se comporte pareil quelle que
// soit la disposition. Mais l'AFFICHER brut est trompeur: en AZERTY, la touche
// physique "KeyW" porte un Z. L'API Keyboard Map donne le vrai caractère imprimé.
export type KeyboardLayoutMap = { get(code: string): string | undefined };

type NavigatorWithKeyboard = Navigator & {
	keyboard?: { getLayoutMap?: () => Promise<KeyboardLayoutMap> };
};

/** Disposition clavier réelle, ou null si le navigateur ne l'expose pas. */
export async function loadKeyboardLayout(): Promise<KeyboardLayoutMap | null> {
	if (typeof navigator === "undefined") return null;
	const withKeyboard = navigator as NavigatorWithKeyboard;
	if (!withKeyboard.keyboard?.getLayoutMap) return null;
	try {
		return await withKeyboard.keyboard.getLayoutMap();
	} catch {
		// Permission refusée / API indisponible: on retombe sur le libellé générique.
		return null;
	}
}

/**
 * Libellé lisible d'un `KeyboardEvent.code`, dans la disposition du joueur quand
 * elle est connue (AZERTY : "KeyW" → « Z »).
 */
export function formatKeyCode(code: string, layout?: KeyboardLayoutMap | null): string {
	// Touches sans caractère imprimé: la disposition n'apporte rien.
	if (code === "Space") return "Espace";
	if (code === "ArrowLeft") return "←";
	if (code === "ArrowRight") return "→";
	if (code === "ArrowUp") return "↑";
	if (code === "ArrowDown") return "↓";

	const printed = layout?.get(code);
	if (printed && printed.trim().length > 0 && printed.trim().length <= 2)
		return printed.trim().toUpperCase();

	if (code.startsWith("Key")) return code.slice(3);
	if (code.startsWith("Digit")) return code.slice(5);
	if (code.startsWith("Numpad")) return `Pavé ${code.slice(6)}`;
	return code;
}

export function loadKeyBindings(): KeyBindings {
	const bindings = { ...DEFAULT_KEY_BINDINGS };
	let raw: string | null = null;
	try {
		raw = localStorage.getItem(STORAGE_KEY);
	} catch {
		// localStorage indisponible (mode privé strict) : on garde les défauts.
		return bindings;
	}
	if (!raw) return bindings;
	try {
		const parsed: unknown = JSON.parse(raw);
		if (!parsed || typeof parsed !== "object") return bindings;
		for (const action of GAME_ACTIONS) {
			const value = (parsed as Record<string, unknown>)[action];
			// Toute entrée absente/invalide retombe sur le défaut: une config partielle
			// ou corrompue ne doit jamais rendre une action injouable.
			if (typeof value === "string" && value.length > 0)
				bindings[action] = value;
		}
	} catch {
		return bindings;
	}
	return dedupe(bindings);
}

/**
 * Repare une configuration ou deux actions partagent la meme touche (config
 * partielle relue avec des defauts, ou fichier bricole a la main): l'action
 * suivante recupere son defaut, sinon elle serait definitivement injouable.
 */
function dedupe(bindings: KeyBindings): KeyBindings {
	const used = new Set<string>();
	const fixed = { ...bindings };
	// Réservoir = les touches par défaut. Il y en a exactement autant que d'actions et
	// elles sont distinctes, donc il en reste TOUJOURS une libre : aucune action ne
	// peut se retrouver sans touche (une touche vide la rendrait injouable).
	const pool = GAME_ACTIONS.map((action) => DEFAULT_KEY_BINDINGS[action]);
	for (const action of GAME_ACTIONS) {
		if (!used.has(fixed[action])) {
			used.add(fixed[action]);
			continue;
		}
		const fallback = pool.find((code) => !used.has(code)) ?? fixed[action];
		fixed[action] = fallback;
		used.add(fallback);
	}
	return fixed;
}

export function saveKeyBindings(bindings: KeyBindings): void {
	try {
		localStorage.setItem(STORAGE_KEY, JSON.stringify(bindings));
	} catch {
		// Écriture impossible: la config reste valable pour la session en cours.
	}
}

/**
 * Assigne `code` à `action`. Si la touche est déjà prise par une autre action, les
 * deux sont ÉCHANGÉES : on ne peut donc jamais laisser une action sans touche.
 */
export function assignKey(bindings: KeyBindings, action: GameAction, code: string): KeyBindings {
	const next = { ...bindings };
	const previous = next[action];
	for (const other of GAME_ACTIONS) {
		if (other !== action && next[other] === code)
			next[other] = previous;
	}
	next[action] = code;
	return next;
}

/** Action associée à un `KeyboardEvent.code`, ou null. */
export function actionForCode(bindings: KeyBindings, code: string): GameAction | null {
	for (const action of GAME_ACTIONS) {
		if (bindings[action] === code)
			return action;
	}
	return null;
}
