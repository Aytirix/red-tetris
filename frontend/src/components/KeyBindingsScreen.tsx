import { useEffect, useState } from "react";
import {
	assignKey,
	DEFAULT_KEY_BINDINGS,
	GAME_ACTIONS,
	GAME_ACTION_LABELS,
	loadKeyBindings,
	saveKeyBindings,
	type GameAction,
	type KeyBindings,
} from "../config/keyBindings";
import { useKeyLabel } from "../hooks/useKeyLabel";

// Écran de configuration des touches, rendu À L'INTÉRIEUR du dashboard (même fond
// parallax, pas de navigation) — comme la boutique.
export default function KeyBindingsScreen() {
	const [bindings, setBindings] = useState<KeyBindings>(() => loadKeyBindings());
	// Action en cours de réassignation : la prochaine touche pressée lui est attribuée.
	const [capturing, setCapturing] = useState<GameAction | null>(null);
	// Affiche la touche telle qu'elle est imprimee sur le clavier du joueur.
	const keyLabel = useKeyLabel();

	useEffect(() => {
		if (!capturing) return;
		function onKey(event: KeyboardEvent) {
			event.preventDefault();
			// L'autorepeat (touche maintenue) reassignerait l'action a la touche qui a
			// servi a ouvrir la capture au clavier (Entree/Espace).
			if (event.repeat) return;
			if (event.code === "Escape") {
				setCapturing(null);
				return;
			}
			// Certains claviers virtuels/IME n'exposent pas de code: on ignore, sinon
			// l'action se retrouverait liee a une touche vide (bouton blanc, injouable).
			if (!event.code || event.code === "Unidentified") return;
			setBindings((current) => {
				const next = assignKey(current, capturing as GameAction, event.code);
				saveKeyBindings(next);
				return next;
			});
			setCapturing(null);
		}
		// capture: true → on intercepte avant tout autre handler de la page.
		window.addEventListener("keydown", onKey, true);
		return () => window.removeEventListener("keydown", onKey, true);
	}, [capturing]);

	function handleReset() {
		setBindings({ ...DEFAULT_KEY_BINDINGS });
		saveKeyBindings({ ...DEFAULT_KEY_BINDINGS });
		setCapturing(null);
	}

	return (
		<div className="keys-screen">
			<div className="keys-screen__head">
				<p className="eyebrow">Contrôles</p>
				<h2 className="keys-screen__title">Touches du jeu</h2>
				<p className="keys-screen__hint">
					Clique sur une touche pour la changer, puis appuie sur la nouvelle. Échap pour annuler.
				</p>
			</div>

			<div className="keys-screen__list">
				{GAME_ACTIONS.map((action) => (
					<div key={action} className="keys-row">
						<span className="keys-row__label">{GAME_ACTION_LABELS[action]}</span>
						<button
							className={`keys-row__key${capturing === action ? " keys-row__key--capturing" : ""}`}
							onClick={() => setCapturing(action)}
							aria-label={`Changer la touche : ${GAME_ACTION_LABELS[action]}`}
						>
							{capturing === action ? "Appuie sur une touche…" : keyLabel(bindings[action])}
						</button>
					</div>
				))}
			</div>

			<div className="keys-screen__actions">
				<button className="button button-ghost" onClick={handleReset}>
					Réinitialiser
				</button>
			</div>
		</div>
	);
}
