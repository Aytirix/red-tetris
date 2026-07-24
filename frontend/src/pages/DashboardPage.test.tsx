import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { createFakeSocket, type FakeSocket } from "../../test/fakeSocket";
import { AlertProvider } from "../components/Alert";

const ctx = vi.hoisted(() => ({
	socket: null as unknown as FakeSocket,
	navigate: null as unknown as ReturnType<typeof vi.fn>,
	faction: null as string | null,
	berrys: 0,
}));

const roomEvents = vi.hoisted(() => ({
	emitSubscribeRooms: vi.fn(),
	emitUnsubscribeRooms: vi.fn(),
	emitJoinRoom: vi.fn(),
	emitLeaveRoom: vi.fn(),
	emitKickPlayer: vi.fn(),
	emitStartGame: vi.fn(),
	emitSetGameMode: vi.fn(),
	emitSetPrivate: vi.fn(),
}));

vi.mock("../socket/events/room", () => roomEvents);
vi.mock("../contexts/SocketContext", () => ({
	useSocket: () => ({ socket: ctx.socket, isConnected: true }),
}));
vi.mock("../contexts/WsStateContext", () => ({
	useWsSession: () => ({ faction: ctx.faction, lastUsernameAvailability: null }),
}));
vi.mock("../contexts/ShopContext", () => ({
	useShop: () => ({
		berrys: ctx.berrys,
		owned: ["neon-gem"],
		equipped: "neon-gem",
		catalog: [],
		lastError: null,
		buy: vi.fn(),
		equip: vi.fn(),
		clearError: vi.fn(),
	}),
}));
vi.mock("react-router-dom", () => ({
	useNavigate: () => ctx.navigate,
}));

import DashboardPage, { toRoomId } from "./DashboardPage";

function renderDashboard() {
	return render(<AlertProvider><DashboardPage /></AlertProvider>);
}

function goToMultiplayer() {
	fireEvent.click(screen.getByRole("button", { name: "Multijoueur" }));
}

function navigatedPath(): string {
	return ctx.navigate.mock.calls[0][0] as string;
}

beforeEach(() => {
	ctx.socket = createFakeSocket();
	ctx.navigate = vi.fn();
	ctx.faction = null;
	ctx.berrys = 0;
	localStorage.clear();
	localStorage.setItem("username", "luffy");
	for (const fn of Object.values(roomEvents)) fn.mockClear();
	vi.restoreAllMocks();
});

afterEach(cleanup);

describe("DashboardPage — vue d'accueil", () => {
	it("affiche le camp pirate par defaut", () => {
		renderDashboard();

		expect(screen.getByText("Pirates")).toBeInTheDocument();
		expect(screen.getByRole("button", { name: "Solo" })).toBeInTheDocument();
	});

	it("affiche le camp marine quand la session le precise", () => {
		ctx.faction = "marine";
		renderDashboard();

		expect(screen.getByText("Marines")).toBeInTheDocument();
	});

	it("affiche le solde de berrys formate", () => {
		ctx.berrys = 12_345;
		renderDashboard();

		// textContent brut: toLocaleString() insere une espace fine insecable.
		expect(screen.getByTitle("Cumul de tes scores de fin de partie").textContent).toBe(
			`${(12345).toLocaleString()} ฿`,
		);
	});

	it("affiche le solde et les acces boutique/touches", () => {
		renderDashboard();

		expect(screen.getByRole("button", { name: "🛒 Boutique" })).toBeInTheDocument();
		expect(screen.getByRole("button", { name: "⌨ Touches" })).toBeInTheDocument();
		expect(screen.getByTitle("Cumul de tes scores de fin de partie")).toBeInTheDocument();
	});

	it("lance une partie solo dans une room dediee", () => {
		vi.spyOn(Math, "random").mockReturnValue(0.5);
		renderDashboard();

		fireEvent.click(screen.getByRole("button", { name: "Solo" }));

		expect(navigatedPath()).toMatch(/^\/sologame_[a-z0-9]+\/luffy$/);
	});
});

describe("DashboardPage — boutique", () => {
	it("bascule vers la boutique sans quitter le dashboard", () => {
		renderDashboard();

		fireEvent.click(screen.getByRole("button", { name: "🛒 Boutique" }));

		expect(screen.getByText("Thèmes de pièces")).toBeInTheDocument();
		// Le solde reste visible en boutique (necessaire pour acheter).
		expect(screen.getByTitle("Cumul de tes scores de fin de partie")).toBeInTheDocument();
	});

	it("revient au jeu depuis la boutique", () => {
		renderDashboard();
		fireEvent.click(screen.getByRole("button", { name: "🛒 Boutique" }));

		fireEvent.click(screen.getByRole("button", { name: "← Jouer" }));

		expect(screen.getByRole("button", { name: "Solo" })).toBeInTheDocument();
	});
});

describe("DashboardPage — multijoueur", () => {
	it("s'abonne a la liste des salles et affiche un chargement", () => {
		renderDashboard();
		goToMultiplayer();

		expect(roomEvents.emitSubscribeRooms).toHaveBeenCalledTimes(1);
		expect(screen.getByText("Recherche de salles…")).toBeInTheDocument();
	});

	it("affiche les salles recues en masquant les parties solo", () => {
		renderDashboard();
		goToMultiplayer();

		act(() => {
			ctx.socket.receive("room:list", [
				{ roomId: "Mugiwara", playerCount: 2, maxPlayers: 4, mode: "classic" },
				{ roomId: "sologame_abc", playerCount: 1 },
			]);
		});

		expect(screen.getByText("Mugiwara")).toBeInTheDocument();
		expect(screen.queryByText("sologame_abc")).toBeNull();
		expect(screen.getByText("2/4")).toBeInTheDocument();
		expect(screen.getByText("classic")).toBeInTheDocument();
	});

	it("indique quand aucune salle n'est disponible", () => {
		renderDashboard();
		goToMultiplayer();

		act(() => { ctx.socket.receive("room:list", []); });

		expect(screen.getByText("Aucune salle disponible")).toBeInTheDocument();
	});

	it("ignore une liste de salles mal formee", () => {
		renderDashboard();
		goToMultiplayer();

		act(() => { ctx.socket.receive("room:list", null); });

		expect(screen.getByText("Recherche de salles…")).toBeInTheDocument();
	});

	it("rejoint une salle existante", () => {
		renderDashboard();
		goToMultiplayer();
		act(() => { ctx.socket.receive("room:list", [{ roomId: "Mugiwara", playerCount: 1 }]); });

		fireEvent.click(screen.getByRole("button", { name: "Rejoindre" }));

		expect(ctx.navigate).toHaveBeenCalledWith("/Mugiwara/luffy");
	});

	it("cree une salle avec un nom d'equipage encore libre", () => {
		vi.spyOn(Math, "random").mockReturnValue(0);
		renderDashboard();
		goToMultiplayer();
		act(() => { ctx.socket.receive("room:list", [{ roomId: "Mugiwara", playerCount: 1 }]); });

		fireEvent.click(screen.getByRole("button", { name: "+ Créer une salle" }));

		expect(navigatedPath()).not.toBe("/Mugiwara/luffy");
		expect(navigatedPath()).toMatch(/\/luffy$/);
	});

	it("se desabonne en revenant a l'accueil", () => {
		renderDashboard();
		goToMultiplayer();

		fireEvent.click(screen.getByTitle("Retour"));

		expect(roomEvents.emitUnsubscribeRooms).toHaveBeenCalledTimes(1);
		expect(screen.getByRole("button", { name: "Solo" })).toBeInTheDocument();
	});

	it("se desabonne quand l'onglet est ferme", () => {
		renderDashboard();
		goToMultiplayer();

		fireEvent(window, new Event("beforeunload"));

		expect(roomEvents.emitUnsubscribeRooms).toHaveBeenCalledTimes(1);
	});

	it("se desabonne au demontage", () => {
		const { unmount } = renderDashboard();
		goToMultiplayer();
		unmount();

		expect(roomEvents.emitUnsubscribeRooms).toHaveBeenCalledTimes(1);
		expect(ctx.socket.listenerCount("room:list")).toBe(0);
	});

	it("n'ecoute pas la liste des salles depuis la boutique", () => {
		renderDashboard();
		goToMultiplayer();
		roomEvents.emitSubscribeRooms.mockClear();

		fireEvent.click(screen.getByRole("button", { name: "🛒 Boutique" }));

		expect(roomEvents.emitSubscribeRooms).not.toHaveBeenCalled();
		expect(ctx.socket.listenerCount("room:list")).toBe(0);
	});
});

describe("DashboardPage — ecran Touches", () => {
	it("ouvre l'ecran des touches depuis le coin haut-droite", () => {
		renderDashboard();

		fireEvent.click(screen.getByRole("button", { name: "⌨ Touches" }));

		expect(screen.getByText("Touches du jeu")).toBeInTheDocument();
		expect(screen.getByRole("button", { name: "← Jouer" })).toBeInTheDocument();
	});

	it("epure l'ecran: ni boutique ni solde", () => {
		renderDashboard();

		fireEvent.click(screen.getByRole("button", { name: "⌨ Touches" }));

		expect(screen.queryByRole("button", { name: "🛒 Boutique" })).toBeNull();
		expect(screen.queryByTitle("Cumul de tes scores de fin de partie")).toBeNull();
	});

	it("revient au jeu depuis les touches", () => {
		renderDashboard();
		fireEvent.click(screen.getByRole("button", { name: "⌨ Touches" }));

		fireEvent.click(screen.getByRole("button", { name: "← Jouer" }));

		expect(screen.getByRole("button", { name: "Solo" })).toBeInTheDocument();
	});
});

describe("DashboardPage — barre selon l'ecran", () => {
	it("garde boutique et touches en multijoueur, mais masque le solde", () => {
		renderDashboard();
		goToMultiplayer();

		expect(screen.getByRole("button", { name: "🛒 Boutique" })).toBeInTheDocument();
		expect(screen.getByRole("button", { name: "⌨ Touches" })).toBeInTheDocument();
		expect(screen.queryByTitle("Cumul de tes scores de fin de partie")).toBeNull();
	});
});

describe("DashboardPage — noms de salle valides", () => {
	it("normalise les espaces des noms d'equipage (sinon le join est refuse)", () => {
		expect(toRoomId("Straw Hat")).toBe("Straw_Hat");
		expect(toRoomId("SH Fleet")).toBe("SH_Fleet");
		expect(toRoomId("Germa 66")).toBe("Germa_66");
		// Charset serveur: [a-zA-Z0-9_], 15 max.
		expect(toRoomId("un nom vraiment tres long")).toHaveLength(15);
		expect(/^[a-zA-Z0-9_]{1,15}$/.test(toRoomId("Big Mom"))).toBe(true);
	});

	it("ne genere jamais un nom de salle refuse par le serveur", () => {
		// Balaye les tirages possibles: aucun nom d'equipage ne doit sortir invalide.
		for (let i = 0; i < 60; i++) {
			vi.spyOn(Math, "random").mockReturnValue(i / 60);
			cleanup();
			renderDashboard();
			goToMultiplayer();
			// La liste doit etre arrivee: le bouton est desactive tant qu'elle charge.
			act(() => { ctx.socket.receive("room:list", []); });
			ctx.navigate.mockClear();
			fireEvent.click(screen.getByRole("button", { name: "+ Créer une salle" }));

			const path = ctx.navigate.mock.calls[0][0] as string;
			const roomId = path.split("/")[1];
			expect(/^[a-zA-Z0-9_]{1,15}$/.test(roomId)).toBe(true);
		}
	});
});
