import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from "react";
import { useNavigate, type NavigateOptions, type To } from "react-router-dom";
import CloudTransition from "../components/CloudTransition";
export type TransitionPhase = "idle" | "cover" | "reveal";

type TransitionContextValue = {
	phase: TransitionPhase;
	navigateWithClouds: (to: To, options?: NavigateOptions) => void;
};

const TransitionContext = createContext<TransitionContextValue | null>(null);

// Les nuages de DÉMARRAGE (index.html) recouvrent déjà l'écran au premier chargement
// et ne sont retirés du DOM qu'une fois leur ouverture terminée. Tant qu'ils sont là,
// rejouer un cycle complet ferait DEUX animations pour une seule arrivée sur le site
// (cas typique: une URL qui redirige aussitôt — pseudo pris, partie privée…).
function bootCloudsStillOnScreen(): boolean {
	if (typeof document === "undefined") return false;
	return document.getElementById("boot-clouds") !== null;
}

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
		// Écran déjà masqué par les nuages de démarrage: on navigue DESSOUS, sans
		// rejouer de cycle. L'utilisateur ne voit qu'une seule animation.
		if (bootCloudsStillOnScreen()) {
			navigate(to, options);
			return;
		}
		// Couverture en cours: elle navigue à sa fin, il suffit de lui changer sa
		// destination. Repartir de zéro rejouerait l'animation depuis le début.
		if (phaseRef.current === "cover") {
			pending.current = { to, options };
			return;
		}
		// Dissipation en cours: la page qu'on veut déjà quitter vient d'être montée
		// sous les nuages. On la remplace SOUS eux, tant qu'ils masquent encore.
		// Sans ça la demande était purement et simplement perdue — c'est ce qui
		// laissait un joueur bloqué sur une room refusée (privée / pleine) après une
		// redirection depuis l'écran de pseudo.
		if (phaseRef.current === "reveal") {
			navigate(to, options);
			return;
		}
		pending.current = { to, options };
		setPhaseSafe("cover");
	}, [navigate, setPhaseSafe]);

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
