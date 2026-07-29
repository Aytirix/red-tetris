import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from "react";
import { useNavigate, type NavigateOptions, type To } from "react-router-dom";
import CloudTransition from "../components/CloudTransition";
export type TransitionPhase = "idle" | "cover" | "reveal";

type TransitionContextValue = {
	phase: TransitionPhase;
	navigateWithClouds: (to: To, options?: NavigateOptions) => void;
};

const TransitionContext = createContext<TransitionContextValue | null>(null);

export function TransitionProvider({ children }: { children: ReactNode }) {
	const navigate = useNavigate();
	const [phase, setPhase] = useState<TransitionPhase>("idle");
	// Miroir synchrone de `phase` pour garder les callbacks (deps []) à jour sans
	// re-créer les handlers à chaque frame.
	const phaseRef = useRef<TransitionPhase>("idle");
	const pending = useRef<{ to: To; options?: NavigateOptions } | null>(null);

	const setPhaseSafe = useCallback((next: TransitionPhase) => {
		phaseRef.current = next;
		setPhase(next);
	}, []);

	const navigateWithClouds = useCallback((to: To, options?: NavigateOptions) => {
		// Une transition déjà en cours ne doit pas en déclencher une autre.
		if (phaseRef.current !== "idle") return;
		pending.current = { to, options };
		setPhaseSafe("cover");
	}, [setPhaseSafe]);

	// Fin de la couverture : l'écran est masqué, on effectue la vraie navigation
	// puis on lance la dissipation.
	const handleCoverDone = useCallback(() => {
		if (phaseRef.current !== "cover") return;
		const next = pending.current;
		pending.current = null;
		if (next) navigate(next.to, next.options);
		setPhaseSafe("reveal");
	}, [navigate, setPhaseSafe]);

	const handleRevealDone = useCallback(() => {
		if (phaseRef.current !== "reveal") return;
		setPhaseSafe("idle");
	}, [setPhaseSafe]);

	return (
		<TransitionContext.Provider value={{ phase, navigateWithClouds }}>
			{children}
			<CloudTransition phase={phase} onCoverDone={handleCoverDone} onRevealDone={handleRevealDone} />
		</TransitionContext.Provider>
	);
}

// Remplace useNavigate côté pages : déclenche la transition nuages avant de naviguer.
// Repli sur une navigation directe si aucun provider (certains contextes de test).
export function useCloudNavigate(): (to: To, options?: NavigateOptions) => void {
	const ctx = useContext(TransitionContext);
	const navigate = useNavigate();
	return ctx ? ctx.navigateWithClouds : navigate;
}
