import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import type { GameBoardCell, GameStatePayload, OpponentBoard } from "../../types/game";
import { DEFAULT_KEY_BINDINGS } from "../../config/keyBindings";

const gameEvents = vi.hoisted(() => ({
	emitGameMove: vi.fn(),
	emitGameRotate: vi.fn(),
	emitGameDrop: vi.fn(),
	emitGameJoker: vi.fn(),
	emitSubscribeSpectator: vi.fn(),
	emitUnsubscribeSpectator: vi.fn(),
}));

// Les emetteurs sont mockes: le singleton socket ne doit jamais etre importe ici
// (il ouvrirait une vraie connexion reseau a l'import).
vi.mock("../../socket/events/game", () => gameEvents);

vi.mock("../../contexts/ShopContext", () => ({
	useShop: () => ({ equipped: "neon-gem" }),
}));

import GameView from "./GameView";

afterEach(cleanup);

function board(rows = 20, cols = 10) {
	return Array.from({ length: rows }, () => Array.from({ length: cols }, () => 0 as GameBoardCell));
}

function makeOpponents(count: number): OpponentBoard[] {
	return Array.from({ length: count }, (_, i) => ({
		username: `rival${i}`,
		board: board(),
		alive: true,
	}));
}

function makeState(overrides: Partial<GameStatePayload> = {}): GameStatePayload {
	return {
		board: board(),
		opponents: [],
		currentPiece: { type: "T" },
		nextPiece: { type: "I" },
		score: 1200,
		level: 3,
		spectator: false,
		ghost: [],
		mode: "classique",
		lines: 0,
		linesTarget: null,
		timeLeftMs: null,
		fade: null,
		jokersLeft: 0,
		theme: null,
		lockInMs: null,
		...overrides,
	};
}

function renderGameView(overrides: Partial<Parameters<typeof GameView>[0]> = {}) {
	return render(
		<GameView state={makeState()} roomName="room-42" {...overrides} />,
	);
}

beforeEach(() => {
	for (const fn of Object.values(gameEvents)) fn.mockClear();
});

describe("GameView — mapping clavier (exigence du sujet)", () => {
	it("ArrowLeft deplace la piece a gauche", () => {
		renderGameView();
		fireEvent.keyDown(window, { code: "ArrowLeft" });

		expect(gameEvents.emitGameMove).toHaveBeenCalledTimes(1);
		expect(gameEvents.emitGameMove).toHaveBeenCalledWith("left");
	});

	it("ArrowRight deplace la piece a droite", () => {
		renderGameView();
		fireEvent.keyDown(window, { code: "ArrowRight" });

		expect(gameEvents.emitGameMove).toHaveBeenCalledWith("right");
	});

	it("ArrowDown fait descendre la piece d'un cran", () => {
		renderGameView();
		fireEvent.keyDown(window, { code: "ArrowDown" });

		expect(gameEvents.emitGameMove).toHaveBeenCalledWith("down");
	});

	it("ArrowUp fait pivoter la piece", () => {
		renderGameView();
		fireEvent.keyDown(window, { code: "ArrowUp" });

		expect(gameEvents.emitGameRotate).toHaveBeenCalledTimes(1);
		expect(gameEvents.emitGameMove).not.toHaveBeenCalled();
	});

	it("KeyX fait aussi pivoter la piece", () => {
		renderGameView();
		fireEvent.keyDown(window, { code: "KeyX" });

		expect(gameEvents.emitGameRotate).toHaveBeenCalledTimes(1);
	});

	it("maintenir la rotation la repete rapidement (spam), un tapotement = 1 rotation", () => {
		vi.useFakeTimers();
		try {
			renderGameView();

			// Tapotement: keydown puis keyup avant le delai -> une seule rotation.
			fireEvent.keyDown(window, { code: "ArrowUp" });
			fireEvent.keyUp(window, { code: "ArrowUp" });
			vi.advanceTimersByTime(500);
			expect(gameEvents.emitGameRotate).toHaveBeenCalledTimes(1);

			gameEvents.emitGameRotate.mockClear();

			// Maintien: keydown sans keyup -> rotation immediate puis repetitions rapides.
			fireEvent.keyDown(window, { code: "ArrowUp" });
			expect(gameEvents.emitGameRotate).toHaveBeenCalledTimes(1);
			vi.advanceTimersByTime(130 + 45 * 4);
			expect(gameEvents.emitGameRotate.mock.calls.length).toBeGreaterThanOrEqual(5);

			// Relacher stoppe la repetition.
			fireEvent.keyUp(window, { code: "ArrowUp" });
			const stopped = gameEvents.emitGameRotate.mock.calls.length;
			vi.advanceTimersByTime(300);
			expect(gameEvents.emitGameRotate.mock.calls.length).toBe(stopped);
		} finally {
			vi.useRealTimers();
		}
	});

	it("maintenir la descente la repete rapidement, un tapotement = 1 case", () => {
		vi.useFakeTimers();
		try {
			renderGameView();

			// Tapotement: keydown puis keyup avant le delai -> une seule case.
			fireEvent.keyDown(window, { code: "ArrowDown" });
			fireEvent.keyUp(window, { code: "ArrowDown" });
			vi.advanceTimersByTime(500);
			expect(gameEvents.emitGameMove).toHaveBeenCalledTimes(1);

			gameEvents.emitGameMove.mockClear();

			// Maintien: descente immediate puis repetitions rapides.
			fireEvent.keyDown(window, { code: "ArrowDown" });
			expect(gameEvents.emitGameMove).toHaveBeenCalledTimes(1);
			vi.advanceTimersByTime(90 + 35 * 4);
			expect(gameEvents.emitGameMove.mock.calls.length).toBeGreaterThanOrEqual(5);

			// Relacher stoppe la repetition.
			fireEvent.keyUp(window, { code: "ArrowDown" });
			const stopped = gameEvents.emitGameMove.mock.calls.length;
			vi.advanceTimersByTime(300);
			expect(gameEvents.emitGameMove.mock.calls.length).toBe(stopped);
		} finally {
			vi.useRealTimers();
		}
	});

	// L'auto-repeat de l'OS doublerait la cadence de notre propre repetition.
	it("ignore l'auto-repeat de l'OS sur la descente", () => {
		renderGameView();
		fireEvent.keyDown(window, { code: "ArrowDown", repeat: true });

		expect(gameEvents.emitGameMove).not.toHaveBeenCalled();
	});

	// Alt-tab: le keyup n'arrive jamais, la piece continuerait de descendre au retour.
	it("stoppe la descente quand la fenetre perd le focus", () => {
		vi.useFakeTimers();
		try {
			renderGameView();
			fireEvent.keyDown(window, { code: "ArrowDown" });
			vi.advanceTimersByTime(90 + 35 * 3);
			gameEvents.emitGameMove.mockClear();

			fireEvent.blur(window);
			vi.advanceTimersByTime(500);

			expect(gameEvents.emitGameMove).not.toHaveBeenCalled();
		} finally {
			vi.useRealTimers();
		}
	});

	it("Espace declenche le hard drop", () => {
		renderGameView();
		fireEvent.keyDown(window, { code: "Space" });

		expect(gameEvents.emitGameDrop).toHaveBeenCalledTimes(1);
	});

	it("ignore la repetition automatique sur Espace", () => {
		renderGameView();
		fireEvent.keyDown(window, { code: "Space", repeat: true });

		expect(gameEvents.emitGameDrop).not.toHaveBeenCalled();
	});

	it("autorise la repetition sur les deplacements", () => {
		renderGameView();
		fireEvent.keyDown(window, { code: "ArrowLeft", repeat: true });

		expect(gameEvents.emitGameMove).toHaveBeenCalledWith("left");
	});

	it("ignore les touches non mappees", () => {
		renderGameView();
		fireEvent.keyDown(window, { code: "KeyQ" });
		fireEvent.keyDown(window, { code: "Enter" });

		expect(gameEvents.emitGameMove).not.toHaveBeenCalled();
		expect(gameEvents.emitGameRotate).not.toHaveBeenCalled();
		expect(gameEvents.emitGameDrop).not.toHaveBeenCalled();
	});

	it("retire l'ecoute clavier au demontage", () => {
		const { unmount } = renderGameView();
		unmount();
		fireEvent.keyDown(window, { code: "ArrowLeft" });

		expect(gameEvents.emitGameMove).not.toHaveBeenCalled();
	});

	it("desactive le clavier en mode spectateur", () => {
		renderGameView({ state: makeState({ spectator: "zoro" }) });

		fireEvent.keyDown(window, { code: "ArrowLeft" });
		fireEvent.keyDown(window, { code: "ArrowUp" });
		fireEvent.keyDown(window, { code: "Space" });

		expect(gameEvents.emitGameMove).not.toHaveBeenCalled();
		expect(gameEvents.emitGameRotate).not.toHaveBeenCalled();
		expect(gameEvents.emitGameDrop).not.toHaveBeenCalled();
	});
});

describe("GameView — plateau et HUD", () => {
	/** Force la taille du viewport jsdom pour tester le dimensionnement responsive. */
	function setViewport(width: number, height: number) {
		Object.defineProperty(window, "innerWidth", { value: width, configurable: true, writable: true });
		Object.defineProperty(window, "innerHeight", { value: height, configurable: true, writable: true });
	}

	// `window` est global a tout le fichier : sans restauration, la taille forcee
	// ici fausserait le calcul de repartition des adversaires des autres tests.
	const defaultViewport = { width: window.innerWidth, height: window.innerHeight };
	afterEach(() => {
		setViewport(defaultViewport.width, defaultViewport.height);
	});

	it("rend le plateau principal en 10x20 a la taille max sur un grand ecran", () => {
		setViewport(1920, 1200);
		const { container } = renderGameView();
		const grid = container.querySelector(".tetris-board") as HTMLElement;

		expect(grid.style.gridTemplateColumns).toBe("repeat(10, 38px)");
		expect(container.querySelectorAll(".tetris-board .tetris-cell")).toHaveLength(200);
	});

	// Regression: a 38 px figes, le plateau depassait le bas des ecrans de PC
	// portable peu hauts. La cellule doit se reduire pour tenir a l'ecran.
	it("reduit la cellule sur un ecran peu haut pour que le plateau tienne", () => {
		setViewport(1366, 700);
		const { container } = renderGameView();
		const grid = container.querySelector(".tetris-board") as HTMLElement;

		const cell = Number(/repeat\(10, (\d+)px\)/.exec(grid.style.gridTemplateColumns)?.[1]);
		expect(cell).toBeGreaterThan(0);
		expect(cell).toBeLessThan(38);
		// 20 lignes + gouttieres + cadre doivent tenir sous le HUD et les marges.
		expect(20 * cell + 19 * 2 + 22).toBeLessThanOrEqual(700 - 132);
	});

	// Le dimensionnement ne se fie plus a une estimation du HUD et des marges: il
	// MESURE la zone reservee au plateau (ResizeObserver), absente de jsdom — on la
	// simule ici pour verifier que la cellule suit la place reellement disponible.
	it("dimensionne la cellule sur la zone mesuree, pas sur le viewport", () => {
		const observers: Array<(entries: unknown[]) => void> = [];
		vi.stubGlobal("ResizeObserver", class {
			constructor(callback: (entries: unknown[]) => void) { observers.push(callback); }
			observe() {}
			disconnect() {}
		});
		try {
			// Viewport genereux: sans mesure, le repli donnerait la cellule maximale.
			setViewport(1920, 1200);
			const { container } = renderGameView();
			const grid = container.querySelector(".tetris-board") as HTMLElement;
			expect(grid.style.gridTemplateColumns).toBe("repeat(10, 38px)");

			// Zone reelle bien plus petite que ce que laissait croire le viewport.
			act(() => {
				for (const notify of observers) notify([{ contentRect: { width: 400, height: 420 } }]);
			});

			const cell = Number(/repeat\(10, (\d+)px\)/.exec(grid.style.gridTemplateColumns)?.[1]);
			expect(cell).toBe(18); // (420 - 22 - 19*2) / 20 = 18
			// Le plateau rendu tient dans la zone mesuree, en hauteur comme en largeur.
			expect(20 * cell + 19 * 2 + 22).toBeLessThanOrEqual(420);
			expect(10 * cell + 9 * 2 + 22).toBeLessThanOrEqual(400);
		} finally {
			vi.unstubAllGlobals();
		}
	});

	it("transmet la projection fantome de la piece courante", () => {
		const { container } = renderGameView({
			state: makeState({ ghost: [{ x: 0, y: 0 }], currentPiece: { type: "S" } }),
		});

		expect(container.querySelectorAll('.tetris-cell--ghost[data-piece="S"]')).toHaveLength(1);
	});

	it("n'affiche pas de fantome sans piece courante", () => {
		const { container } = renderGameView({
			state: makeState({ ghost: [{ x: 0, y: 0 }], currentPiece: null }),
		});

		expect(container.querySelectorAll(".tetris-cell--ghost")).toHaveLength(0);
	});

	it("affiche le score et masque le level en multijoueur", () => {
		const { container } = renderGameView({ roomName: "room-42" });

		expect(container.querySelector(".tetris-hud__score .tetris-hud__value")?.textContent).toBe(
			(1200).toLocaleString(),
		);
		expect(container.querySelector(".tetris-hud__level")).toBeNull();
	});

	it("affiche le level en solo", () => {
		const { container } = renderGameView({ roomName: "sologame_luffy" });

		expect(container.querySelector(".tetris-hud__level .tetris-hud__value")?.textContent).toBe("3");
	});

	it("affiche la prochaine piece", () => {
		const { container } = renderGameView();
		expect(container.querySelectorAll('.tetris-next .tetris-cell[data-piece="I"]')).toHaveLength(4);
	});

	it("applique le theme equipe sur la scene", () => {
		const { container } = renderGameView();
		const stage = container.querySelector(".tetris-stage") as HTMLElement;

		expect(stage.getAttribute("data-recipe")).toBe("neon");
		expect(stage.style.getPropertyValue("--piece-i")).toBe("#22E6E6");
	});
});

describe("GameView — adversaires", () => {
	it("n'affiche aucune colonne sans adversaire", () => {
		const { container } = renderGameView();
		expect(container.querySelectorAll(".tetris-opponents")).toHaveLength(0);
	});

	it("place les adversaires dans la colonne de gauche tant qu'elle n'est pas pleine", () => {
		const { container } = renderGameView({ state: makeState({ opponents: makeOpponents(4) }) });

		expect(
			container.querySelectorAll(".tetris-stage__side--left .tetris-mini"),
		).toHaveLength(4);
		expect(
			container.querySelectorAll(".tetris-stage__side--right .tetris-mini"),
		).toHaveLength(0);
	});

	it("deborde dans la colonne de droite une fois la gauche pleine", () => {
		const { container } = renderGameView({ state: makeState({ opponents: makeOpponents(8) }) });

		expect(
			container.querySelectorAll(".tetris-stage__side--left .tetris-mini"),
		).toHaveLength(6);
		expect(
			container.querySelectorAll(".tetris-stage__side--right .tetris-mini"),
		).toHaveLength(2);
		expect(container.querySelector(".tetris-opponents--right")).not.toBeNull();
	});
});

describe("GameView — mode spectateur", () => {
	it("affiche le bandeau spectateur", () => {
		renderGameView({ state: makeState({ spectator: "zoro", opponents: makeOpponents(2) }) });
		expect(screen.getByText("Spectator")).toBeInTheDocument();
		expect(screen.getByText("zoro")).toBeInTheDocument();
	});

	it("permet de changer de joueur observe", () => {
		const { container } = renderGameView({
			roomName: "room-42",
			state: makeState({ spectator: "rival0", opponents: makeOpponents(2) }),
		});

		const buttons = Array.from(container.querySelectorAll("button.tetris-mini"));
		expect(buttons).toHaveLength(2);

		(buttons[1] as HTMLButtonElement).click();
		expect(gameEvents.emitSubscribeSpectator).toHaveBeenCalledWith("room-42", "rival1");
	});

	it("ne rend pas les mini-boards cliquables pour un joueur", () => {
		const { container } = renderGameView({ state: makeState({ opponents: makeOpponents(2) }) });

		expect(container.querySelectorAll("button.tetris-mini")).toHaveLength(0);
		expect(gameEvents.emitSubscribeSpectator).not.toHaveBeenCalled();
	});
});

describe("GameView — résumé des touches", () => {
	it("affiche le résumé des touches pour le joueur actif", () => {
		renderGameView();
		expect(screen.getByLabelText("Touches configurées")).toBeInTheDocument();
	});

	it("ne l'affiche pas pour un spectateur", () => {
		renderGameView({ state: makeState({ spectator: "zoro", opponents: makeOpponents(2) }) });
		expect(screen.queryByLabelText("Touches configurées")).toBeNull();
	});

	// Le joker n'existe qu'en mode invisible: l'annoncer ailleurs promet une touche
	// qui ne fait rien.
	it("masque le joker hors du mode invisible", () => {
		renderGameView({ state: makeState({ mode: "classique" }) });
		const legend = screen.getByLabelText("Touches configurées");
		expect(within(legend).queryByText(/Joker/)).toBeNull();
	});

	it("affiche le joker en mode invisible", () => {
		renderGameView({ state: makeState({ mode: "invisible" }) });
		const legend = screen.getByLabelText("Touches configurées");
		expect(within(legend).getByText(/Joker/)).toBeInTheDocument();
	});
});

describe("GameView — traînée de vitesse (chute instantanée)", () => {
	// La pièce est téléportée en bas par le serveur: sans sillage, la chute est
	// invisible. Les bandes vont du fantôme vers le haut, une par colonne.
	it("dessine une traînée au-dessus du point d'atterrissage", () => {
		const { container } = renderGameView({
			state: makeState({ ghost: [{ x: 3, y: 18 }, { x: 4, y: 18 }] }),
		});

		expect(container.querySelectorAll(".tetris-drop-trail__streak")).toHaveLength(0);
		fireEvent.keyDown(window, { code: "Space" });

		const streaks = container.querySelectorAll(".tetris-drop-trail__streak");
		expect(streaks).toHaveLength(2);
		expect(gameEvents.emitGameDrop).toHaveBeenCalledTimes(1);
	});

	it("efface la traînée à la fin de l'animation", () => {
		const { container } = renderGameView({ state: makeState({ ghost: [{ x: 3, y: 18 }] }) });
		fireEvent.keyDown(window, { code: "Space" });
		expect(container.querySelectorAll(".tetris-drop-trail__streak")).toHaveLength(1);

		fireEvent.animationEnd(container.querySelector(".tetris-drop-trail") as Element);

		expect(container.querySelectorAll(".tetris-drop-trail__streak")).toHaveLength(0);
	});

	// Mode invisible: le serveur n'envoie pas le fantôme. Une traînée y révélerait la
	// position d'atterrissage, soit exactement ce que le mode cache.
	it("ne dessine rien sans projection fantôme (mode invisible)", () => {
		const { container } = renderGameView({ state: makeState({ mode: "invisible", ghost: [] }) });
		fireEvent.keyDown(window, { code: "Space" });

		expect(container.querySelectorAll(".tetris-drop-trail__streak")).toHaveLength(0);
		expect(gameEvents.emitGameDrop).toHaveBeenCalledTimes(1);
	});

	// Une pièce qui atterrit sur la toute premiere rangee n'a aucun sillage a montrer.
	it("ne dessine rien quand la pièce atterrit tout en haut", () => {
		const { container } = renderGameView({ state: makeState({ ghost: [{ x: 3, y: 0 }] }) });
		fireEvent.keyDown(window, { code: "Space" });

		expect(container.querySelectorAll(".tetris-drop-trail__streak")).toHaveLength(0);
	});
});

describe("GameView — decompte avant verrouillage", () => {
	// Une piece posee sur la pile n'est verrouillee qu'au tick SUIVANT: la jauge rend
	// ce sursis visible, sur la duree exacte envoyee par le serveur.
	const grounded = { lockInMs: 300, ghost: [{ x: 3, y: 19 }, { x: 4, y: 19 }] };

	it("remplit les cases de la piece posee sur la duree du sursis", () => {
		const { container } = renderGameView({ state: makeState(grounded) });

		const cells = container.querySelectorAll<HTMLElement>(".tetris-lock-timer__cell");
		expect(cells).toHaveLength(2);
		expect(cells[0].style.getPropertyValue("--lock-ms")).toBe("300ms");
	});

	it("n'affiche rien tant que la piece peut descendre", () => {
		const { container } = renderGameView({
			state: makeState({ lockInMs: null, ghost: [{ x: 3, y: 19 }] }),
		});

		expect(container.querySelectorAll(".tetris-lock-timer__cell")).toHaveLength(0);
	});

	// Glisser la piece pendant le sursis ne repousse PAS le verrouillage: la jauge doit
	// suivre la piece sans repartir de zero ni changer de duree.
	it("suit la piece qui glisse sans relancer le decompte", () => {
		const { container, rerender } = render(
			<GameView state={makeState(grounded)} roomName="room-42" />,
		);

		rerender(
			<GameView
				state={makeState({ lockInMs: 120, ghost: [{ x: 5, y: 19 }, { x: 6, y: 19 }] })}
				roomName="room-42"
			/>,
		);

		const cells = container.querySelectorAll<HTMLElement>(".tetris-lock-timer__cell");
		expect(cells).toHaveLength(2);
		// Position suivie…
		expect(cells[0].style.left).not.toBe("");
		// …mais duree figee a celle du premier contact.
		expect(cells[0].style.getPropertyValue("--lock-ms")).toBe("300ms");
	});

	it("disparait des que la piece repart en chute", () => {
		const { container, rerender } = render(
			<GameView state={makeState(grounded)} roomName="room-42" />,
		);
		expect(container.querySelectorAll(".tetris-lock-timer__cell")).toHaveLength(2);

		rerender(<GameView state={makeState({ lockInMs: null })} roomName="room-42" />);

		expect(container.querySelectorAll(".tetris-lock-timer__cell")).toHaveLength(0);
	});

	// Mode invisible: pas de fantome envoye, donc aucune case a marquer.
	it("n'affiche rien sans projection fantome (mode invisible)", () => {
		const { container } = renderGameView({
			state: makeState({ mode: "invisible", lockInMs: 300, ghost: [] }),
		});

		expect(container.querySelectorAll(".tetris-lock-timer__cell")).toHaveLength(0);
	});
});

describe("GameView — bouton Rejouer (solo)", () => {
	it("affiche Rejouer en solo et appelle onRestart au clic", () => {
		const onRestart = vi.fn();
		renderGameView({ roomName: "sologame_abc", onRestart });

		const btn = screen.getByRole("button", { name: "🔄 Rejouer" });
		btn.click();
		expect(onRestart).toHaveBeenCalledTimes(1);
	});

	it("ne montre pas Rejouer hors solo", () => {
		renderGameView({ roomName: "room-42", onRestart: vi.fn() });
		expect(screen.queryByRole("button", { name: "🔄 Rejouer" })).toBeNull();
	});
});

describe("GameView — quitter et élimination", () => {
	it("n'affiche pas le bouton quitter sans handler", () => {
		const { container } = renderGameView();
		expect(container.querySelector(".tetris-stage__leave")).toBeNull();
	});

	it("appelle onLeave au clic sur quitter", () => {
		const onLeave = vi.fn();
		renderGameView({ onLeave });

		screen.getByRole("button", { name: "Quitter la partie" }).click();
		expect(onLeave).toHaveBeenCalledTimes(1);
	});

	it("n'affiche pas l'overlay tant que le joueur est en vie", () => {
		const { container } = renderGameView();
		expect(container.querySelector(".tetris-gameover-overlay")).toBeNull();
	});

	it("affiche l'overlay GAME OVER et notifie la fin d'animation", () => {
		const onEliminationDone = vi.fn();
		const { container } = renderGameView({ eliminated: true, onEliminationDone });

		const overlay = container.querySelector(".tetris-gameover-overlay__text") as HTMLElement;
		expect(overlay.textContent).toBe("GAME OVER");

		fireEvent.animationEnd(overlay);
		expect(onEliminationDone).toHaveBeenCalledTimes(1);
	});
});

describe("GameView — secousse à la réception de lignes de pénalité", () => {
	const base = { roomName: "room-42" } as const;

	function penaltyBoard(penaltyCount: number, rows = 20, cols = 10): GameBoardCell[][] {
		const b = board(rows, cols);
		for (let y = rows - penaltyCount; y < rows; y++)
			b[y] = Array.from({ length: cols }, () => "penalty" as GameBoardCell);
		return b;
	}

	function wrapOf(container: HTMLElement) {
		return container.querySelector(".tetris-stage__board-wrap") as HTMLElement;
	}

	it("ne secoue pas au premier rendu, même si le plateau est déjà pénalisé", () => {
		const { container } = render(<GameView state={makeState({ board: penaltyBoard(2) })} {...base} />);
		expect(wrapOf(container).className).not.toContain("--shake");
	});

	it("secoue le plateau quand le nombre de lignes de pénalité augmente", () => {
		const { container, rerender } = render(
			<GameView state={makeState({ board: penaltyBoard(0) })} {...base} />,
		);
		expect(wrapOf(container).className).not.toContain("--shake");

		rerender(<GameView state={makeState({ board: penaltyBoard(1) })} {...base} />);
		expect(wrapOf(container).className).toContain("--shake");
	});

	it("ne secoue pas quand le nombre de lignes de pénalité est inchangé", () => {
		const { container, rerender } = render(
			<GameView state={makeState({ board: penaltyBoard(1) })} {...base} />,
		);
		rerender(<GameView state={makeState({ board: penaltyBoard(1), score: 999 })} {...base} />);
		expect(wrapOf(container).className).not.toContain("--shake");
	});

	it("ne secoue pas quand on change de plateau observe (bascule spectateur)", () => {
		const { container, rerender } = render(
			<GameView state={makeState({ board: penaltyBoard(0), spectator: "zoro" })} {...base} />,
		);
		// Nouvelle cible deja penalisee: on rebase, on ne crie pas "penalite recue".
		rerender(<GameView state={makeState({ board: penaltyBoard(4), spectator: "sanji" })} {...base} />);
		expect(wrapOf(container).className).not.toContain("--shake");

		// Une vraie penalite sur la MEME cible secoue toujours.
		rerender(<GameView state={makeState({ board: penaltyBoard(5), spectator: "sanji" })} {...base} />);
		expect(wrapOf(container).className).toContain("--shake");
	});

	it("relance l'animation quand une 2e salve arrive avant la fin de la 1re", () => {
		const { container, rerender } = render(
			<GameView state={makeState({ board: penaltyBoard(0) })} {...base} />,
		);
		rerender(<GameView state={makeState({ board: penaltyBoard(1) })} {...base} />);
		const first = wrapOf(container).className;
		expect(first).toContain("--shake");

		// Sans fin d'animation entre les deux: la classe doit CHANGER, sinon le
		// navigateur ne rejouerait pas la secousse.
		rerender(<GameView state={makeState({ board: penaltyBoard(3) })} {...base} />);
		const second = wrapOf(container).className;
		expect(second).toContain("--shake");
		expect(second).not.toBe(first);
	});

	it("retire la classe de secousse à la fin de l'animation", () => {
		const { container, rerender } = render(
			<GameView state={makeState({ board: penaltyBoard(0) })} {...base} />,
		);
		rerender(<GameView state={makeState({ board: penaltyBoard(1) })} {...base} />);
		expect(wrapOf(container).className).toContain("--shake");

		fireEvent.animationEnd(wrapOf(container));
		expect(wrapOf(container).className).not.toContain("--shake");
	});
});

describe("GameView — touches personnalisables et joker", () => {
	beforeEach(() => localStorage.clear());

	it("declenche le joker sur la touche par defaut", () => {
		render(<GameView state={makeState({ mode: "invisible", jokersLeft: 3 })} roomName="salle" />);

		fireEvent.keyDown(window, { code: "KeyJ" });

		expect(gameEvents.emitGameJoker).toHaveBeenCalledTimes(1);
	});

	it("ne repete pas le joker si la touche reste enfoncee", () => {
		render(<GameView state={makeState({ mode: "invisible" })} roomName="salle" />);

		fireEvent.keyDown(window, { code: "KeyJ" });
		fireEvent.keyDown(window, { code: "KeyJ", repeat: true });

		expect(gameEvents.emitGameJoker).toHaveBeenCalledTimes(1);
	});

	it("respecte une touche reassignee par le joueur", () => {
		localStorage.setItem("keyBindings", JSON.stringify({ ...DEFAULT_KEY_BINDINGS, rotate: "KeyW" }));
		render(<GameView state={makeState()} roomName="salle" />);

		fireEvent.keyDown(window, { code: "KeyW" });
		expect(gameEvents.emitGameRotate).toHaveBeenCalledTimes(1);

		// L'ancienne touche n'agit plus.
		fireEvent.keyDown(window, { code: "ArrowUp" });
		expect(gameEvents.emitGameRotate).toHaveBeenCalledTimes(1);
	});

	it("affiche les jokers restants et la touche associee en mode invisible", () => {
		render(<GameView state={makeState({ mode: "invisible", jokersLeft: 2 })} roomName="salle" />);

		expect(screen.getByText("Jokers · J")).toBeInTheDocument();
		expect(screen.getByText("★★☆")).toBeInTheDocument();
	});

	it("n'affiche pas les jokers hors mode invisible", () => {
		const { container } = render(<GameView state={makeState()} roomName="salle" />);
		expect(container.querySelector(".tetris-hud__jokers")).toBeNull();
	});
});

describe("GameView — cosmetique en spectateur", () => {
	it("affiche le theme DU JOUEUR OBSERVE, pas le sien", () => {
		const { container } = render(
			<GameView
				state={makeState({ spectator: "zoro", theme: "synthwave" })}
				roomName="salle"
			/>,
		);

		// Le contexte boutique local est "neon-gem" (mock) -> on doit voir "synth".
		expect((container.querySelector(".tetris-stage") as HTMLElement).getAttribute("data-recipe")).toBe("synth");
	});

	it("retombe sur son propre theme si le serveur n'en fournit pas", () => {
		const { container } = render(
			<GameView state={makeState({ spectator: "zoro", theme: null })} roomName="salle" />,
		);

		expect((container.querySelector(".tetris-stage") as HTMLElement).getAttribute("data-recipe")).toBe("neon");
	});

	it("garde son propre theme sur son propre plateau", () => {
		const { container } = render(
			<GameView state={makeState({ theme: "synthwave" })} roomName="salle" />,
		);

		expect((container.querySelector(".tetris-stage") as HTMLElement).getAttribute("data-recipe")).toBe("neon");
	});
});
