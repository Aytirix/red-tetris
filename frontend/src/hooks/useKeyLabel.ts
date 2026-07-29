import { useCallback, useEffect, useState } from "react";
import { formatKeyCode, loadKeyboardLayout, subscribeKeyLayout, type KeyboardLayoutMap } from "../config/keyBindings";

/** Traduit un `KeyboardEvent.code` en libelle affichable selon la disposition reelle. */
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
