import type { TransitionPhase } from "../transition/TransitionContext";

type Props = {
	phase: TransitionPhase;
	onCoverDone: () => void;
	onRevealDone: () => void;
};

// Overlay de transition « nuages », 100% CSS (aucun canvas/SVG) :
// deux bancs de nuages (haut + bas) qui se rejoignent pour recouvrir l'écran puis
// s'écartent, plus un voile qui pilote le timing (son animationend fait avancer la phase).
export default function CloudTransition({ phase, onCoverDone, onRevealDone }: Props) {
	if (phase === "idle") return null;
	return (
		<div className={`cloud-transition cloud-transition--${phase}`} aria-hidden="true">
			<div className="cloud-transition__bank cloud-transition__bank--top" />
			<div className="cloud-transition__bank cloud-transition__bank--bottom" />
			<div
				className="cloud-transition__veil"
				onAnimationEnd={phase === "cover" ? onCoverDone : onRevealDone}
			/>
		</div>
	);
}
