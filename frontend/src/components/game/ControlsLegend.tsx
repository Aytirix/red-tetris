import { GAME_ACTIONS, GAME_ACTION_LABELS, loadKeyBindings } from "../../config/keyBindings";
import { useKeyLabel } from "../../hooks/useKeyLabel";

// Résumé des touches configurées, affiché à droite du plateau pour le joueur ACTIF
// (ni spectateur, ni éliminé). Les libellés reflètent la disposition réelle du clavier
// (AZERTY/QWERTY) via useKeyLabel, comme le menu « Touches ».
export default function ControlsLegend() {
	const keyLabel = useKeyLabel();
	const bindings = loadKeyBindings();
	return (
		<div className="tetris-controls" aria-label="Touches configurées">
			<p className="tetris-controls__title">Touches</p>
			<ul className="tetris-controls__list">
				{GAME_ACTIONS.map((action) => (
					<li key={action} className="tetris-controls__row">
						<span className="tetris-controls__label">{GAME_ACTION_LABELS[action]}</span>
						<kbd className="tetris-controls__key">{keyLabel(bindings[action])}</kbd>
					</li>
				))}
			</ul>
		</div>
	);
}
