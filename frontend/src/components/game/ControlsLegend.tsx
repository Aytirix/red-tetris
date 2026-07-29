import { GAME_ACTIONS, GAME_ACTION_LABELS, loadKeyBindings } from "../../config/keyBindings";
import { useKeyLabel } from "../../hooks/useKeyLabel";
import type { GameMode } from "../../types/game";

type Props = {
	/** Mode de la partie : le joker n'existe qu'en mode invisible. */
	mode: GameMode;
};
export default function ControlsLegend({ mode }: Props) {
	const keyLabel = useKeyLabel();
	const bindings = loadKeyBindings();
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
