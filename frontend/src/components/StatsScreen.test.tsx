import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";

// Socket factice : capture les handlers enregistrés pour pouvoir les déclencher.
const bus = vi.hoisted(() => ({
	handlers: new Map<string, (payload?: unknown) => void>(),
}));

vi.mock("../contexts/SocketContext", () => ({
	useSocket: () => ({
		socket: {
			on: (event: string, cb: (payload?: unknown) => void) => bus.handlers.set(event, cb),
			off: (event: string) => bus.handlers.delete(event),
			emit: vi.fn(),
		},
	}),
}));

const emitStatsGet = vi.hoisted(() => vi.fn());
vi.mock("../socket/events/stats", () => ({ emitStatsGet }));

import StatsScreen from "./StatsScreen";

const FULL = {
	me: {
		username: "luffy", faction: "pirate", totalGames: 10, wins: 7, losses: 3,
		winRate: 0.7, bestScore: 4200, totalLines: 88, totalTetris: 12, playtimeMs: 3_725_000,
	},
	leaderboards: {
		topScore: [{ username: "luffy", faction: "pirate", value: 4200 }],
		topWins: [{ username: "zoro", faction: "pirate", value: 5 }],
		topTetris: [],
		topLines: [],
	},
	factions: {
		factions: [
			{ faction: "pirate", wins: 20, losses: 5, tetris: 8, lines: 120, bestScore: 4200 },
			{ faction: "marine", wins: 12, losses: 9, tetris: 3, lines: 90, bestScore: 3100 },
		],
		leader: "pirate",
	},
	modes: [
		{
			mode: "classique",
			entries: [
				{ username: "luffy", faction: "pirate", bestScore: 4200, games: 15, lines: 200, tetris: 15 },
				{ username: "zoro", faction: "pirate", bestScore: 3000, games: 8, lines: 90, tetris: 4 },
			],
		},
		{
			mode: "sprint",
			entries: [{ username: "garp", faction: "marine", bestScore: 1500, games: 5, lines: 40, tetris: 1 }],
		},
	],
};

function emitState(payload: unknown) {
	act(() => bus.handlers.get("stats:State")?.(payload));
}

beforeEach(() => {
	bus.handlers.clear();
	emitStatsGet.mockClear();
});

afterEach(() => cleanup());

describe("StatsScreen", () => {
	it("demande les stats au montage", () => {
		render(<StatsScreen />);
		expect(emitStatsGet).toHaveBeenCalled();
	});

	it("affiche un état de chargement avant réception", () => {
		render(<StatsScreen />);
		expect(screen.getByText("Chargement…")).toBeTruthy();
	});

	it("rend les stats individuelles reçues", () => {
		render(<StatsScreen />);
		emitState(FULL);
		expect(screen.getByText("7 / 3")).toBeTruthy();
		expect(screen.getByText("70 % de victoires")).toBeTruthy();
		// Temps de jeu: 3 725 000 ms -> 1 h 2 min
		expect(screen.getByText("1 h 2 min")).toBeTruthy();
	});

	it("met en avant le meilleur camp", () => {
		render(<StatsScreen />);
		emitState(FULL);
		const leader = document.querySelector(".stats-leader--pirate") as HTMLElement;
		expect(leader).toBeTruthy();
		expect(within(leader).getByText("20 victoires cumulées")).toBeTruthy();
	});

	it("liste les classements", () => {
		render(<StatsScreen />);
		emitState(FULL);
		const board = screen.getByLabelText("🏆 Meilleurs scores");
		expect(within(board).getByText("luffy")).toBeTruthy();
		expect(within(board).getByText("4 200 pts")).toBeTruthy();
	});

	it("affiche le classement du premier mode par défaut", () => {
		render(<StatsScreen />);
		emitState(FULL);
		const region = screen.getByRole("region", { name: "Classement par mode" });
		expect(within(region).getByRole("tab", { name: "Classique" })).toBeTruthy();
		expect(within(region).getByRole("tab", { name: "Sprint" })).toBeTruthy();
		// Classique actif par défaut → luffy figure dans le tableau, pas garp (mode sprint).
		expect(within(region).getByText("luffy")).toBeTruthy();
		expect(within(region).queryByText("garp")).toBeNull();
	});

	it("change de tableau quand on sélectionne un autre mode", () => {
		render(<StatsScreen />);
		emitState(FULL);
		const region = screen.getByRole("region", { name: "Classement par mode" });

		fireEvent.click(within(region).getByRole("tab", { name: "Sprint" }));

		expect(within(region).getByText("garp")).toBeTruthy();
		expect(within(region).queryByText("luffy")).toBeNull();
	});

	it("montre des états vides quand il n'y a aucune donnée", () => {
		render(<StatsScreen />);
		emitState({});
		expect(
			screen.getByText("Joue une partie pour voir apparaître tes statistiques ici."),
		).toBeTruthy();
		expect(screen.getByText("Aucune partie enregistrée pour l'instant.")).toBeTruthy();
	});

	it("affiche une erreur serveur", () => {
		render(<StatsScreen />);
		act(() => bus.handlers.get("stats:Error")?.({ message: "Lecture impossible" }));
		expect(screen.getByRole("alert").textContent).toContain("Lecture impossible");
	});
});
