import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { AlertProvider, useAlert } from "./Alert";
import { renderHook } from "@testing-library/react";
import type { ReactNode } from "react";

function wrapper({ children }: { children: ReactNode }) {
	return <AlertProvider>{children}</AlertProvider>;
}

afterEach(cleanup);

describe("Alert — alert()", () => {
	it("n'affiche aucune boite tant que rien n'est demande", () => {
		render(<AlertProvider><span>contenu</span></AlertProvider>);

		expect(screen.getByText("contenu")).toBeInTheDocument();
		expect(screen.queryByRole("button")).toBeNull();
	});

	it("affiche titre, message et bouton OK par defaut", async () => {
		const { result } = renderHook(() => useAlert(), { wrapper });

		act(() => { void result.current.alert({ title: "Bravo", message: "Partie gagnée" }); });

		expect(await screen.findByText("Bravo")).toBeInTheDocument();
		expect(screen.getByText("Partie gagnée")).toBeInTheDocument();
		expect(screen.getByRole("button", { name: "OK" })).toBeInTheDocument();
		expect(screen.getByText("Info")).toBeInTheDocument();
	});

	it("resout la promesse et referme la boite au clic", async () => {
		const { result } = renderHook(() => useAlert(), { wrapper });
		const resolved = vi.fn();

		act(() => { void result.current.alert({ title: "Bravo" }).then(resolved); });
		fireEvent.click(await screen.findByRole("button", { name: "OK" }));

		await vi.waitFor(() => expect(resolved).toHaveBeenCalledTimes(1));
		expect(screen.queryByText("Bravo")).toBeNull();
	});

	it("bascule en presentation dangereuse et accepte un libelle personnalise", async () => {
		const { result } = renderHook(() => useAlert(), { wrapper });

		act(() => {
			void result.current.alert({ title: "Expulsé", confirmLabel: "Compris", danger: true });
		});

		expect(await screen.findByText("Attention")).toBeInTheDocument();
		expect(screen.getByRole("button", { name: "Compris" })).toBeInTheDocument();
	});
});

describe("Alert — confirm()", () => {
	it("propose deux boutons et renvoie true sur confirmation", async () => {
		const { result } = renderHook(() => useAlert(), { wrapper });
		const answer = vi.fn();

		act(() => { void result.current.confirm({ title: "Supprimer ?" }).then(answer); });

		expect(await screen.findByRole("button", { name: "Annuler" })).toBeInTheDocument();
		fireEvent.click(screen.getByRole("button", { name: "Confirmer" }));

		await vi.waitFor(() => expect(answer).toHaveBeenCalledWith(true));
	});

	it("renvoie false a l'annulation", async () => {
		const { result } = renderHook(() => useAlert(), { wrapper });
		const answer = vi.fn();

		act(() => { void result.current.confirm({ title: "Supprimer ?" }).then(answer); });
		fireEvent.click(await screen.findByRole("button", { name: "Annuler" }));

		await vi.waitFor(() => expect(answer).toHaveBeenCalledWith(false));
		expect(screen.queryByText("Supprimer ?")).toBeNull();
	});

	it("accepte des libelles personnalises", async () => {
		const { result } = renderHook(() => useAlert(), { wrapper });

		act(() => {
			void result.current.confirm({
				title: "Acheter ?",
				confirmLabel: "Acheter",
				cancelLabel: "Plus tard",
				danger: false,
			});
		});

		expect(await screen.findByRole("button", { name: "Acheter" })).toBeInTheDocument();
		expect(screen.getByRole("button", { name: "Plus tard" })).toBeInTheDocument();
		expect(screen.getByText("Info")).toBeInTheDocument();
	});
});

describe("Alert — garde-fou", () => {
	it("refuse d'etre utilise hors du provider", () => {
		expect(() => renderHook(() => useAlert())).toThrowError(
			"useAlert must be used within AlertProvider",
		);
	});
});
