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

// --- Disposition APPRISE ------------------------------------------------------
// L'API Keyboard Map (navigator.keyboard) n'est pas exposée par tous les navigateurs
// (absente sur Chrome/Linux ici). Sans elle, "KeyA" s'affichait "A" alors qu'un clavier
// AZERTY imprime un "Q" sur cette touche physique.
// Parade indépendante de l'API: `KeyboardEvent.key` donne le caractère RÉELLEMENT imprimé
// (« q » pour la touche physique "KeyA" en AZERTY). On mémorise `code → caractère` à chaque
// frappe et on le persiste, pour afficher la vraie touche du clavier du joueur.
const LAYOUT_STORAGE_KEY = "keyLayout";
let learnedLayout: Record<string, string> | null = null;
const layoutSubscribers = new Set<() => void>();

function loadLearnedLayout(): Record<string, string> {
	if (learnedLayout) return learnedLayout;
	learnedLayout = {};
	try {
		const raw = localStorage.getItem(LAYOUT_STORAGE_KEY);
		if (raw) {
			const parsed: unknown = JSON.parse(raw);
			if (parsed && typeof parsed === "object") {
				for (const [code, value] of Object.entries(parsed as Record<string, unknown>))
					if (typeof value === "string" && value.length > 0) learnedLayout[code] = value;
			}
		}
	} catch {
		// localStorage indisponible / JSON corrompu : on repart d'une carte vide.
	}
	return learnedLayout;
}

/**
 * Mémorise le caractère imprimé d'une touche physique, appris d'une frappe réelle.
 * Seules les touches alphanumériques bénéficient de la disposition (AZERTY/QWERTY) ;
 * les touches spéciales (Espace, flèches, Shift…) ont un libellé fixe.
 */
export function recordKeyLabel(code: string, key: string): void {
	if (!code.startsWith("Key") && !code.startsWith("Digit")) return;
	// `key` doit être un unique caractère imprimable ("q", "1"…), pas "Shift"/"Dead"/etc.
	if (typeof key !== "string" || key.length !== 1) return;
	const normalized = key.toUpperCase();
	const map = loadLearnedLayout();
	if (map[code] === normalized) return;
	map[code] = normalized;
	try {
		localStorage.setItem(LAYOUT_STORAGE_KEY, JSON.stringify(map));
	} catch {
		// Persistance impossible : la carte reste valable pour la session en cours.
	}
	for (const notify of layoutSubscribers) notify();
}

/** Caractère appris pour une touche physique, ou undefined si jamais frappée. */
export function getLearnedKeyLabel(code: string): string | undefined {
	return loadLearnedLayout()[code];
}

/** Vide le cache mémoire de la disposition apprise (isolation des tests). */
export function resetLearnedLayout(): void {
	learnedLayout = null;
}

/** S'abonne aux mises à jour de la disposition apprise (pour re-render). */
export function subscribeKeyLayout(callback: () => void): () => void {
	layoutSubscribers.add(callback);
	return () => layoutSubscribers.delete(callback);
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

	// 1) Disposition APPRISE des frappes réelles : la plus fiable (reflète le vrai
	//    clavier du joueur même quand l'API Keyboard Map est absente du navigateur).
	const learned = getLearnedKeyLabel(code);
	if (learned) return learned;

	// 2) API Keyboard Map, quand le navigateur l'expose.
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
