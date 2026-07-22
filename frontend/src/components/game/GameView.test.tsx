import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { GameBoardCell, GameStatePayload, OpponentBoard } from "../../types/game";

const gameEvents = vi.hoisted(() => ({
	emitGameMove: vi.fn(),
	emitGameRotate: vi.fn(),
	emitGameDrop: vi.fn(),
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
		...overrides,
	};
}

function renderGameView(overrides: Partial<Parameters<typeof GameView>[0]> = {}) {
	return render(
		<GameView state={makeState()} roomName="room-42" playerName="luffy" {...overrides} />,
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
	it("rend le plateau principal en 10x20 avec la taille de cellule du jeu", () => {
		const { container } = renderGameView();
		const grid = container.querySelector(".tetris-board") as HTMLElement;

		expect(grid.style.gridTemplateColumns).toBe("repeat(10, 38px)");
		expect(container.querySelectorAll(".tetris-board .tetris-cell")).toHaveLength(200);
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
