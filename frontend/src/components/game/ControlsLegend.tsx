import { GAME_ACTIONS, GAME_ACTION_LABELS, loadKeyBindings } from "../../config/keyBindings";
import { useKeyLabel } from "../../hooks/useKeyLabel";
import type { GameMode } from "../../types/game";

type Props = {
	/** Mode de la partie : le joker n'existe qu'en mode invisible. */
	mode: GameMode;
};

// Résumé des touches configurées, affiché à droite du plateau pour le joueur ACTIF
// (ni spectateur, ni éliminé). Les libellés reflètent la disposition réelle du clavier
// (AZERTY/QWERTY) via useKeyLabel, comme le menu « Touches ».
export default function ControlsLegend({ mode }: Props) {
	const keyLabel = useKeyLabel();
	const bindings = loadKeyBindings();
	// Le joker ne sert QUE dans le mode invisible (révéler le plateau) : ailleurs la
	// touche ne fait rien, l'annoncer induirait le joueur en erreur. Le menu « Touches »
	// du dashboard, lui, la garde : on y configure tous les modes.
	const actions = GAME_ACTIONS.filter((action) => action !== "joker" || mode === "invisible");
	return (
		<div className="tetris-controls" aria-label="Touches configurées">
			<p className="tetris-controls__title">Touches</p>
			<ul className="tetris-controls__list">
				{actions.map((action) => (
					<li key={action} className="tetris-controls__row">
						<span className="tetris-controls__label">{GAME_ACTION_LABELS[action]}</span>
						<kbd className="tetris-controls__key">{keyLabel(bindings[action])}</kbd>
					</li>
				))}
			</ul>
		</div>
	);
}
