import { useCallback, useEffect, useState } from "react";
import { formatKeyCode, loadKeyboardLayout, type KeyboardLayoutMap } from "../config/keyBindings";

/**
 * Renvoie une fonction qui traduit un `KeyboardEvent.code` en libellé affichable,
 * dans la disposition clavier réelle du joueur (AZERTY : "KeyW" → « Z »).
 * Tant que la disposition n'est pas chargée — ou si le navigateur ne l'expose pas —
 * on affiche le libellé générique, jamais rien de vide.
 */
export function useKeyLabel(): (code: string) => string {
	const [layout, setLayout] = useState<KeyboardLayoutMap | null>(null);

	useEffect(() => {
		let cancelled = false;
		void loadKeyboardLayout().then((map) => {
			if (!cancelled) setLayout(map);
		});
		return () => { cancelled = true; };
	}, []);

	return useCallback((code: string) => formatKeyCode(code, layout), [layout]);
}
