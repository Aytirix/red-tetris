import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, act } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

import TestPage from "./TestPage";
import type { GameAction } from "./hands_detector";

// Le controleur de mains ouvre la webcam: on le remplace par une doublure dont
// on recupere le callback pour rejouer des gestes sans camera.
const handsMock = vi.hoisted(() => ({ useHandsController: vi.fn() }));

vi.mock("./hands_detector", () => ({
	useHandsController: handsMock.useHandsController,
}));

type HandsResult = {
	status: "idle" | "loading" | "running" | "error";
	error: string | null;
	hands: Array<{ handedness: "Left" | "Right"; landmarks: Array<{ x: number; y: number }> }>;
};

let dernierOnAction: ((action: GameAction) => void) | null = null;

function stubHands(resultat: Partial<HandsResult> = {}) {
	handsMock.useHandsController.mockImplementation((opts: { onAction: (a: GameAction) => void }) => {
		dernierOnAction = opts.onAction;
		return { status: "idle", error: null, hands: [], ...resultat };
	});
}

// ─── Pieces deterministes ─────────────────────────────────────────────────────
// TestPage tire ses pieces avec Math.random sur la liste ["I","O","T","S","Z","J","L"].

type PieceId = "I" | "O" | "T" | "S" | "Z" | "J" | "L";
const ORDRE: PieceId[] = ["I", "O", "T", "S", "Z", "J", "L"];

function tirageDe(id: PieceId): number {
	return (ORDRE.indexOf(id) + 0.5) / ORDRE.length;
}

let filePieces: PieceId[] = [];

function programmerPieces(...ids: PieceId[]) {
	filePieces = [...ids];
}

// ─── Lecture du plateau ───────────────────────────────────────────────────────

const COLS = 10;
const ROWS = 20;
const VIDE = "rgba(5, 8, 22, 0.92)";
const FANTOME = "rgba(255, 255, 255, 0.08)";
const COULEURS: Record<PieceId, string> = {
	I: "rgb(61, 231, 255)",
	O: "rgb(255, 215, 0)",
	T: "rgb(144, 105, 255)",
	S: "rgb(51, 255, 153)",
	Z: "rgb(255, 54, 95)",
	J: "rgb(77, 159, 255)",
	L: "rgb(255, 153, 51)",
};

function cellules(container: HTMLElement): HTMLElement[] {
	const grille = [...container.querySelectorAll("div")].find(el => el.children.length === ROWS * COLS);
	if (!grille) throw new Error("plateau introuvable");
	return [...grille.children] as HTMLElement[];
}

/** Indices (ligne * 10 + colonne) des cases pleines, hors fantome. */
function casesPleines(container: HTMLElement): number[] {
	return cellules(container)
		.map((cell, i) => ({ i, bg: cell.style.background }))
		.filter(({ bg }) => bg !== VIDE && bg !== FANTOME)
		.map(({ i }) => i);
}

function casesFantomes(container: HTMLElement): number[] {
	return cellules(container)
		.map((cell, i) => ({ i, bg: cell.style.background }))
		.filter(({ bg }) => bg === FANTOME)
		.map(({ i }) => i);
}

function couleurCase(container: HTMLElement, index: number): string {
	return cellules(container)[index].style.background;
}

function stat(label: string): string {
	const titre = screen.getByText(label);
	const bloc = titre.parentElement as HTMLElement;
	return bloc.querySelectorAll("p")[1].textContent ?? "";
}

function touche(key: string): boolean {
	return fireEvent.keyDown(window, { key });
}

function afficher() {
	return render(
		<MemoryRouter>
			<TestPage />
		</MemoryRouter>,
	);
}

function lancer() {
	fireEvent.click(screen.getByRole("button"));
}

// ─── Cycle de vie ─────────────────────────────────────────────────────────────

beforeEach(() => {
	vi.useFakeTimers();
	filePieces = [];
	vi.spyOn(Math, "random").mockImplementation(() => {
		const suivant = filePieces.shift();
		return tirageDe(suivant ?? "I");
	});
	stubHands();
});

afterEach(() => {
	cleanup();
	vi.useRealTimers();
	vi.restoreAllMocks();
	dernierOnAction = null;
});

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("TestPage — etat initial", () => {
	it("dessine un plateau vide de 20 x 10", () => {
		const { container } = afficher();

		expect(cellules(container)).toHaveLength(200);
		expect(casesPleines(container)).toEqual([]);
		expect(casesFantomes(container)).toEqual([]);
	});

	it("affiche des compteurs a zero et un bouton de lancement", () => {
		afficher();

		expect(stat("Score")).toBe("0");
		expect(stat("Lignes")).toBe("0");
		expect(stat("Niveau")).toBe("1");
		expect(screen.getByRole("button").textContent).toBe("Lancer");
		expect(screen.queryByText("GAME OVER")).toBeNull();
	});

	it("ignore les touches tant que la partie n'est pas lancee", () => {
		const { container } = afficher();

		expect(touche("ArrowLeft")).toBe(true);
		expect(touche(" ")).toBe(true);
		expect(casesPleines(container)).toEqual([]);
	});
});

describe("TestPage — apparition des pieces", () => {
	it("fait apparaitre la piece tiree, centree en haut", () => {
		programmerPieces("I");
		const { container } = afficher();

		lancer();

		// I horizontale, 4 cases de large: x = (10 - 4) / 2 = 3.
		expect(casesPleines(container)).toEqual([3, 4, 5, 6]);
		expect(couleurCase(container, 3)).toBe(COULEURS.I);
	});

	it("centre aussi les pieces plus etroites", () => {
		programmerPieces("O");
		const { container } = afficher();

		lancer();

		// O occupe 2 colonnes sur 2 lignes: x = (10 - 2) / 2 = 4.
		expect(casesPleines(container)).toEqual([4, 5, 14, 15]);
		expect(couleurCase(container, 4)).toBe(COULEURS.O);
	});

	it("projette une ombre de la piece a sa position de chute", () => {
		programmerPieces("I");
		const { container } = afficher();

		lancer();

		// Derniere ligne du plateau: 19 * 10 = 190.
		expect(casesFantomes(container)).toEqual([193, 194, 195, 196]);
	});
});

describe("TestPage — controles clavier", () => {
	it("deplace la piece a gauche et a droite", () => {
		programmerPieces("I");
		const { container } = afficher();
		lancer();

		expect(touche("ArrowLeft")).toBe(false);
		expect(casesPleines(container)).toEqual([2, 3, 4, 5]);

		touche("ArrowRight");
		touche("ArrowRight");
		expect(casesPleines(container)).toEqual([4, 5, 6, 7]);
	});

	it("bute contre les bords du plateau", () => {
		programmerPieces("I");
		const { container } = afficher();
		lancer();

		for (let i = 0; i < 10; i++) touche("ArrowLeft");
		expect(casesPleines(container)).toEqual([0, 1, 2, 3]);

		for (let i = 0; i < 20; i++) touche("ArrowRight");
		expect(casesPleines(container)).toEqual([6, 7, 8, 9]);
	});

	it("fait descendre la piece d'une ligne", () => {
		programmerPieces("I");
		const { container } = afficher();
		lancer();

		touche("ArrowDown");
		expect(casesPleines(container)).toEqual([13, 14, 15, 16]);
	});

	it("fait pivoter la piece", () => {
		programmerPieces("I");
		const { container } = afficher();
		lancer();

		touche("ArrowUp");
		// La barre devient verticale sur la colonne 3.
		expect(casesPleines(container)).toEqual([3, 13, 23, 33]);
	});

	it("pose la piece au sol avec la barre d'espace", () => {
		programmerPieces("I", "O");
		const { container } = afficher();
		lancer();

		touche(" ");
		// La barre est posee sur la derniere ligne, la piece suivante apparait.
		expect(casesPleines(container)).toEqual([4, 5, 14, 15, 193, 194, 195, 196]);
		expect(couleurCase(container, 193)).toBe(COULEURS.I);
		expect(couleurCase(container, 4)).toBe(COULEURS.O);
	});

	it("empile les pieces les unes sur les autres", () => {
		programmerPieces("I", "I", "I");
		const { container } = afficher();
		lancer();

		touche(" ");
		touche(" ");

		expect(casesPleines(container)).toEqual([3, 4, 5, 6, 183, 184, 185, 186, 193, 194, 195, 196]);
	});

	it("n'intercepte pas les touches qui ne servent pas au jeu", () => {
		programmerPieces("I");
		afficher();
		lancer();

		expect(touche("a")).toBe(true);
		expect(touche("Escape")).toBe(true);
		expect(touche("ArrowUp")).toBe(false);
	});
});

describe("TestPage — boucle de jeu", () => {
	it("fait tomber la piece toute seule", () => {
		programmerPieces("I");
		const { container } = afficher();
		lancer();

		act(() => { vi.advanceTimersByTime(800); });
		expect(casesPleines(container)).toEqual([13, 14, 15, 16]);

		act(() => { vi.advanceTimersByTime(800); });
		expect(casesPleines(container)).toEqual([23, 24, 25, 26]);
	});

	it("pose la piece quand elle touche le fond", () => {
		programmerPieces("I", "O");
		const { container } = afficher();
		lancer();

		act(() => { vi.advanceTimersByTime(800 * 20); });

		expect(casesPleines(container)).toContain(193);
		expect(couleurCase(container, 4)).toBe(COULEURS.O);
	});

	it("arrete la boucle une fois la partie finie", () => {
		programmerPieces();
		const { container } = afficher();
		lancer();

		for (let i = 0; i < 25; i++) touche(" ");
		const fige = casesPleines(container);

		act(() => { vi.advanceTimersByTime(10_000); });
		expect(casesPleines(container)).toEqual(fige);
	});
});

describe("TestPage — score et lignes", () => {
	it("compte 100 points pour une ligne completee", () => {
		// I sur les colonnes 0-3, I sur les colonnes 4-7, O sur les colonnes 8-9.
		programmerPieces("I", "I", "O", "T");
		const { container } = afficher();
		lancer();

		for (let i = 0; i < 3; i++) touche("ArrowLeft");
		touche(" ");
		touche("ArrowRight");
		touche(" ");
		for (let i = 0; i < 4; i++) touche("ArrowRight");
		touche(" ");

		expect(stat("Score")).toBe("100");
		expect(stat("Lignes")).toBe("1");
		// La ligne pleine a disparu, la moitie haute du O est retombee en bas.
		expect(casesPleines(container).filter(i => i >= 190)).toEqual([198, 199]);
	});

	it("ne marque rien quand la ligne reste incomplete", () => {
		programmerPieces("I", "I");
		afficher();
		lancer();

		touche(" ");
		expect(stat("Score")).toBe("0");
		expect(stat("Lignes")).toBe("0");
	});
});

describe("TestPage — fin de partie", () => {
	it("declare la partie perdue quand la pile atteint le haut", () => {
		programmerPieces();
		const { container } = afficher();
		lancer();

		for (let i = 0; i < 25; i++) touche(" ");

		expect(screen.getByText("GAME OVER")).toBeInTheDocument();
		expect(screen.getByRole("button").textContent).toBe("Rejouer");
		// Plus aucune piece active: la colonne du haut est figee.
		expect(casesPleines(container)).toContain(3);
		expect(casesFantomes(container)).toEqual([]);
	});

	it("ignore les commandes apres la fin de partie", () => {
		programmerPieces();
		const { container } = afficher();
		lancer();
		for (let i = 0; i < 25; i++) touche(" ");
		const fige = casesPleines(container);

		touche("ArrowLeft");
		touche("ArrowUp");
		touche(" ");

		expect(casesPleines(container)).toEqual(fige);
	});

	it("repart de zero quand on rejoue", () => {
		programmerPieces();
		const { container } = afficher();
		lancer();
		for (let i = 0; i < 25; i++) touche(" ");
		expect(screen.getByText("GAME OVER")).toBeInTheDocument();

		programmerPieces("O");
		lancer();

		expect(screen.queryByText("GAME OVER")).toBeNull();
		expect(stat("Score")).toBe("0");
		expect(stat("Lignes")).toBe("0");
		expect(casesPleines(container)).toEqual([4, 5, 14, 15]);
	});
});

describe("TestPage — pilotage par les mains", () => {
	it("applique les gestes pendant la partie", () => {
		programmerPieces("I");
		const { container } = afficher();
		lancer();

		act(() => { dernierOnAction?.("LEFT"); });
		expect(casesPleines(container)).toEqual([2, 3, 4, 5]);

		act(() => { dernierOnAction?.("ROTATE"); });
		expect(casesPleines(container)).toEqual([2, 12, 22, 32]);

		act(() => { dernierOnAction?.("DROP"); });
		expect(casesPleines(container).filter(i => i >= 160)).toEqual([162, 172, 182, 192]);
	});

	it("ignore les gestes hors partie", () => {
		programmerPieces("I");
		const { container } = afficher();

		act(() => { dernierOnAction?.("DROP"); });
		expect(casesPleines(container)).toEqual([]);
	});
});

describe("TestPage — retour camera", () => {
	it("n'affiche aucun message au repos", () => {
		afficher();

		expect(screen.queryByText("Caméra en cours...")).toBeNull();
		expect(screen.queryByText("Mains actives")).toBeNull();
	});

	it("annonce le chargement de la camera", () => {
		stubHands({ status: "loading" });
		afficher();

		expect(screen.getByText("Caméra en cours...")).toBeInTheDocument();
	});

	it("annonce que les mains sont actives", () => {
		stubHands({ status: "running" });
		afficher();

		expect(screen.getByText("Mains actives")).toBeInTheDocument();
	});

	it("affiche le message d'erreur de la camera", () => {
		stubHands({ status: "error", error: "Permission denied" });
		afficher();

		expect(screen.getByText(/Permission denied/)).toBeInTheDocument();
	});

	it("dessine un repere par landmark, colore selon la main", () => {
		stubHands({
			status: "running",
			hands: [
				{ handedness: "Right", landmarks: [{ x: 0.5, y: 0.25 }, { x: 0, y: 0 }] },
				{ handedness: "Left", landmarks: [{ x: 1, y: 1 }] },
			],
		});
		const { container } = afficher();

		const points = [...container.querySelectorAll("div")].filter(
			el => el.style.borderRadius === "50%",
		) as HTMLElement[];
		expect(points).toHaveLength(3);
		expect(points[0].style.background).toBe("rgb(61, 231, 255)");
		expect(points[2].style.background).toBe("rgb(255, 54, 95)");
		// Coordonnees normalisees projetees sur la zone camera 640 x 480.
		expect(points[0].style.transform).toContain("translate3d(320px, 120px, 0)");
	});

	it("branche la camera sur une balise video et propose un retour a l'accueil", () => {
		const { container } = afficher();

		expect(container.querySelector("video")).not.toBeNull();
		const lien = screen.getByRole("link");
		expect(lien.getAttribute("href")).toBe("/");
	});
});
