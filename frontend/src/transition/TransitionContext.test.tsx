import { afterEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { TransitionProvider, useCloudNavigate } from "./TransitionContext";

function Probe() {
	const go = useCloudNavigate();
	return <button onClick={() => go("/next")}>go</button>;
}

function setup() {
	return render(
		<MemoryRouter initialEntries={["/"]}>
			<TransitionProvider>
				<Routes>
					<Route path="/" element={<><Probe /><p>home</p></>} />
					<Route path="/next" element={<p>next</p>} />
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
});
