import { afterEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { TransitionProvider, useCloudNavigate } from "./TransitionContext";

function Probe() {
	const go = useCloudNavigate();
	return <button onClick={() => go("/next")}>go</button>;
}

// Bouton présent sur /next: sert à demander une navigation ALORS QUE la dissipation
// est encore en cours (cas d'une room refusée juste après l'arrivée sur la page).
function ProbeAway() {
	const go = useCloudNavigate();
	return <button onClick={() => go("/away")}>quitter</button>;
}

function setup() {
	return render(
		<MemoryRouter initialEntries={["/"]}>
			<TransitionProvider>
				<Routes>
					<Route path="/" element={<><Probe /><p>home</p></>} />
					<Route path="/next" element={<><ProbeAway /><p>next</p></>} />
					<Route path="/away" element={<p>away</p>} />
				</Routes>
			</TransitionProvider>
		</MemoryRouter>,
	);
}

function veil(container: HTMLElement): HTMLElement {
	return container.querySelector(".cloud-transition__veil") as HTMLElement;
}

afterEach(cleanup);

describe("TransitionProvider / useCloudNavigate", () => {
	it("déroule cover → navigation → reveal → idle", () => {
		const { container } = setup();
		expect(screen.getByText("home")).toBeInTheDocument();
		expect(container.querySelector(".cloud-transition")).toBeNull();

		// 1) Déclenche: les nuages recouvrent, mais la page n'a pas encore changé.
		fireEvent.click(screen.getByText("go"));
		expect(container.querySelector(".cloud-transition--cover")).not.toBeNull();
		expect(screen.getByText("home")).toBeInTheDocument();
		expect(screen.queryByText("next")).toBeNull();

		// 2) Fin de la couverture: navigation réelle + passage en reveal.
		fireEvent.animationEnd(veil(container));
		expect(screen.getByText("next")).toBeInTheDocument();
		expect(container.querySelector(".cloud-transition--reveal")).not.toBeNull();

		// 3) Fin de la dissipation: retour à idle, overlay démonté.
		fireEvent.animationEnd(veil(container));
		expect(container.querySelector(".cloud-transition")).toBeNull();
		expect(screen.getByText("next")).toBeInTheDocument();
	});

	it("ignore un second déclenchement pendant qu'une transition est en cours", () => {
		const { container } = setup();

		fireEvent.click(screen.getByText("go"));
		// Toujours en cover: un nouveau clic ne doit pas relancer/empiler la transition.
		fireEvent.click(screen.getByText("go"));
		expect(container.querySelector(".cloud-transition--cover")).not.toBeNull();

		fireEvent.animationEnd(veil(container));
		expect(screen.getByText("next")).toBeInTheDocument();
	});

	it("navigue quand même si la demande arrive pendant la dissipation", () => {
		const { container } = setup();

		fireEvent.click(screen.getByText("go"));
		fireEvent.animationEnd(veil(container));
		expect(container.querySelector(".cloud-transition--reveal")).not.toBeNull();

		// Demande émise sous les nuages qui s'écartent (room refusée, expulsion…):
		// elle doit aboutir, pas être avalée.
		fireEvent.click(screen.getByText("quitter"));
		expect(screen.getByText("away")).toBeInTheDocument();
		expect(screen.queryByText("next")).toBeNull();

		fireEvent.animationEnd(veil(container));
		expect(container.querySelector(".cloud-transition")).toBeNull();
		expect(screen.getByText("away")).toBeInTheDocument();
	});

	it("ne rejoue pas de cycle tant que les nuages de démarrage sont à l'écran", () => {
		const boot = document.createElement("div");
		boot.id = "boot-clouds";
		document.body.appendChild(boot);
		try {
			const { container } = setup();

			fireEvent.click(screen.getByText("go"));

			// L'écran est déjà masqué par l'overlay de démarrage: navigation immédiate,
			// aucune seconde animation.
			expect(screen.getByText("next")).toBeInTheDocument();
			expect(container.querySelector(".cloud-transition")).toBeNull();
		} finally {
			boot.remove();
		}
	});
});
