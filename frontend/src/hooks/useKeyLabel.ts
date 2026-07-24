import { useCallback, useEffect, useState } from "react";
import { formatKeyCode, loadKeyboardLayout, subscribeKeyLayout, type KeyboardLayoutMap } from "../config/keyBindings";

/**
 * Renvoie une fonction qui traduit un `KeyboardEvent.code` en libellé affichable,
 * dans la disposition clavier réelle du joueur (AZERTY : "KeyW" → « Z »).
 * Deux sources : l'API Keyboard Map quand elle existe, et surtout la disposition
 * APPRISE des frappes réelles (indépendante de l'API). Jamais rien de vide.
 */
export function useKeyLabel(): (code: string) => string {
	const [layout, setLayout] = useState<KeyboardLayoutMap | null>(null);
	// Compteur bumpé à chaque nouvelle touche apprise → force un re-render pour
	// rafraîchir les libellés déjà affichés (ex. écran des touches, HUD joker).
	const [, setLearnVersion] = useState(0);

	useEffect(() => {
		let cancelled = false;
		void loadKeyboardLayout().then((map) => {
			if (!cancelled) setLayout(map);
		});
		const unsubscribe = subscribeKeyLayout(() => setLearnVersion((v) => v + 1));
		return () => {
			cancelled = true;
			unsubscribe();
		};
	}, []);

	return useCallback((code: string) => formatKeyCode(code, layout), [layout]);
}
