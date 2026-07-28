import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { createFakeSocket, type FakeSocket } from "../../test/fakeSocket";
import { AlertProvider } from "../components/Alert";
import type { NormalizedUsernameAvailability } from "../socket/userState";
import { GAME_MODES } from "../types/game";

// Le socket est injecte via le contexte: on remplace le contexte plutot que
// socket.io-client, pour ne jamais charger le singleton reseau.
const ctx = vi.hoisted(() => ({
	socket: null as unknown as FakeSocket,
	params: { roomName: "room-42", playerName: "luffy" } as Record<string, string>,
	session: { faction: null as string | null, lastUsernameAvailability: null as unknown },
	navigate: null as unknown as ReturnType<typeof vi.fn>,
}));

const roomEvents = vi.hoisted(() => ({
	emitJoinRoom: vi.fn(),
	emitLeaveRoom: vi.fn(),
	emitKickPlayer: vi.fn(),
	emitStartGame: vi.fn(),
	emitSetGameMode: vi.fn(),
	emitSetPrivate: vi.fn(),
	emitSubscribeRooms: vi.fn(),
	emitUnsubscribeRooms: vi.fn(),
}));

const gameEvents = vi.hoisted(() => ({
	emitGameMove: vi.fn(),
	emitGameRotate: vi.fn(),
	emitGameDrop: vi.fn(),
	emitSubscribeSpectator: vi.fn(),
	emitUnsubscribeSpectator: vi.fn(),
}));

vi.mock("../socket/events/room", () => roomEvents);
vi.mock("../socket/events/game", () => gameEvents);
vi.mock("../contexts/SocketContext", () => ({
	useSocket: () => ({ socket: ctx.socket, isConnected: true }),
}));
vi.mock("../contexts/WsStateContext", () => ({
	useWsSession: () => ctx.session,
}));
vi.mock("../contexts/ShopContext", () => ({
	useShop: () => ({ equipped: "neon-gem" }),
}));
vi.mock("react-router-dom", () => ({
	useParams: () => ctx.params,
	useNavigate: () => ctx.navigate,
}));

import GamePage from "./GamePage";

function availability(overrides: Partial<NormalizedUsernameAvailability> = {}): NormalizedUsernameAvailability {
	return {
		available: true,
		isRegistered: true,
		user_faction: "pirate",
		username: "luffy",
		raw: { available: true, user_faction: "pirate", username: "luffy" },
		...overrides,
	};
}

function emptyBoard(rows = 20, cols = 10) {
	return Array.from({ length: rows }, () => Array.from({ length: cols }, () => 0));
}

function renderGamePage() {
	return render(
		<AlertProvider>
			<GamePage />
		</AlertProvider>,
	);
}

/** Simule un message serveur en laissant React appliquer les setState. */
function receive(event: string, ...args: unknown[]) {
	act(() => { ctx.socket.receive(event, ...args); });
}

/** Amene la page dans le lobby avec la liste de joueurs donnee. */
function joinLobby(players: { username: string; avatar?: string; faction?: string }[]) {
	receive("room:joined", { players, joined: true });
}

beforeEach(() => {
	ctx.socket = createFakeSocket();
	ctx.params = { roomName: "room-42", playerName: "luffy" };
	ctx.session = { faction: null, lastUsernameAvailability: null };
	ctx.navigate = vi.fn();
	for (const fn of Object.values(roomEvents)) fn.mockClear();
	for (const fn of Object.values(gameEvents)) fn.mockClear();
});

afterEach(cleanup);

describe("GamePage — connexion et join de room", () => {
	it("affiche l'ecran de connexion et n'emet pas de join sans reponse d'auth", () => {
		renderGamePage();

		expect(screen.getByText("Connexion à la room…")).toBeInTheDocument();
		expect(roomEvents.emitJoinRoom).not.toHaveBeenCalled();
	});

	it("rejoint la room quand le pseudo est confirme disponible et enregistre", () => {
		renderGamePage();
		receive("user:ResultUsernameAvailable", { available: true, user_faction: "pirate", username: "luffy" });

		expect(roomEvents.emitJoinRoom).toHaveBeenCalledWith("room-42");
	});

	it("ne rejoint qu'une seule fois meme si l'auth est confirmee plusieurs fois", () => {
		renderGamePage();
		const payload = { available: true, user_faction: "pirate", username: "luffy" };
		receive("user:ResultUsernameAvailable", payload);
		receive("user:ResultUsernameAvailable", payload);

		expect(roomEvents.emitJoinRoom).toHaveBeenCalledTimes(1);
	});

	it("ignore une reponse d'auth concernant un autre pseudo", () => {
		renderGamePage();
		receive("user:ResultUsernameAvailable", { available: true, user_faction: "pirate", username: "zoro" });

		expect(roomEvents.emitJoinRoom).not.toHaveBeenCalled();
	});

	it("rejoint immediatement si la session porte deja la disponibilite du pseudo", () => {
		ctx.session = { faction: "pirate", lastUsernameAvailability: availability() };
		renderGamePage();

		expect(roomEvents.emitJoinRoom).toHaveBeenCalledWith("room-42");
	});

	it("attend la faction quand le pseudo est libre mais pas encore enregistre", () => {
		ctx.session = {
			faction: null,
			lastUsernameAvailability: availability({ isRegistered: false, user_faction: null }),
		};
		renderGamePage();

		expect(roomEvents.emitJoinRoom).not.toHaveBeenCalled();
	});

	it("ne rejoint pas si le pseudo n'est plus disponible", () => {
		ctx.session = {
			faction: "pirate",
			lastUsernameAvailability: availability({ available: false }),
		};
		renderGamePage();

		expect(roomEvents.emitJoinRoom).not.toHaveBeenCalled();
	});

	it("tronque un nom de room trop long et redirige sans rejoindre", () => {
		ctx.params = { roomName: "une-room-avec-un-nom-beaucoup-trop-long", playerName: "luffy" };
		ctx.session = { faction: "pirate", lastUsernameAvailability: availability() };
		renderGamePage();

		expect(ctx.navigate).toHaveBeenCalledWith("/une-room-avec-u/luffy", { replace: true });
		expect(roomEvents.emitJoinRoom).not.toHaveBeenCalled();
	});
});

describe("GamePage — lobby", () => {
	it("affiche la room et ses joueurs a la reception de room:joined", () => {
		renderGamePage();
		joinLobby([
			{ username: "luffy", avatar: "luffy", faction: "pirate" },
			{ username: "zoro", avatar: "zoro", faction: "pirate" },
		]);

		expect(screen.getByRole("heading", { name: "room-42" })).toBeInTheDocument();
		expect(screen.getByText("2 joueurs")).toBeInTheDocument();
		expect(screen.getByText("Admin", { selector: ".game-lobby__status-badge" })).toBeInTheDocument();
	});

	it("met a jour la liste sur room:players", () => {
		const { container } = renderGamePage();
		joinLobby([{ username: "luffy", faction: "pirate" }]);
		receive("room:players", [
			{ username: "luffy", avatar: "luffy", faction: "pirate" },
			{ username: "nami", avatar: "nami", faction: "marine" },
			{ username: "koby", faction: null },
		]);

		expect(container.querySelectorAll(".game-lobby__player-item")).toHaveLength(3);
		expect(screen.getByText("3 joueurs")).toBeInTheDocument();
		// Sans faction, l'avatar retombe sur les initiales.
		expect(screen.getByText("KO")).toBeInTheDocument();
	});

	it("affiche un etat vide quand la room ne contient personne", () => {
		const { container } = renderGamePage();
		joinLobby([]);

		expect(container.querySelector(".game-lobby__player-empty")).not.toBeNull();
	});

	it("laisse l'admin expulser un autre joueur", () => {
		renderGamePage();
		joinLobby([{ username: "luffy", faction: "pirate" }, { username: "zoro", faction: "pirate" }]);

		fireEvent.click(screen.getByTitle("Expulser zoro"));
		expect(roomEvents.emitKickPlayer).toHaveBeenCalledWith("zoro");
	});

	it("n'affiche aucun bouton d'expulsion pour un joueur non admin", () => {
		const { container } = renderGamePage();
		joinLobby([{ username: "zoro", faction: "pirate" }, { username: "luffy", faction: "pirate" }]);

		expect(container.querySelectorAll(".game-lobby__kick-btn")).toHaveLength(0);
		expect(screen.getByText("En attente de l'admin…")).toBeInTheDocument();
		expect(screen.queryByRole("button", { name: "▶ Lancer" })).toBeNull();
	});

	it("permet a l'admin de changer la visibilite et de lancer la partie", () => {
		renderGamePage();
		joinLobby([{ username: "luffy", faction: "pirate" }]);

		fireEvent.click(screen.getByRole("button", { name: "🌐 Publique" }));
		expect(roomEvents.emitSetPrivate).toHaveBeenCalledWith(true);

		fireEvent.click(screen.getByRole("button", { name: "▶ Lancer" }));
		expect(roomEvents.emitStartGame).toHaveBeenCalledTimes(1);
	});

	it("propose tous les modes de jeu et laisse l'admin en choisir un", () => {
		const { container } = renderGamePage();
		joinLobby([{ username: "luffy", faction: "pirate" }]);

		expect(container.querySelectorAll(".game-lobby__mode-btn")).toHaveLength(GAME_MODES.length);
		for (const label of ["Classique", "Sprint", "Ultra", "Sudden Death", "Invisible", "Cascade", "Gruyère"])
			expect(screen.getByRole("button", { name: label })).toBeInTheDocument();

		fireEvent.click(screen.getByRole("button", { name: "Invisible" }));
		expect(roomEvents.emitSetGameMode).toHaveBeenCalledWith("invisible");
	});

	it("reflete le mode recu du serveur", () => {
		const { container } = renderGamePage();
		joinLobby([{ username: "luffy", faction: "pirate" }]);
		receive("room:settings", { mode: "sprint", private: false });

		expect(container.querySelector(".game-lobby__mode-btn--active")?.textContent).toBe("Sprint");
	});

	it("affiche les regles du mode selectionne dans une card dediee", () => {
		renderGamePage();
		joinLobby([{ username: "luffy", faction: "pirate" }]);

		// Classique par defaut.
		const classiqueCard = screen.getByLabelText("Règles du mode Classique");
		expect(within(classiqueCard).getByText(/dernier joueur encore en vie/i)).toBeInTheDocument();

		// La card suit le mode choisi.
		receive("room:settings", { mode: "ultra", private: false });
		const ultraCard = screen.getByLabelText("Règles du mode Ultra");
		expect(within(ultraCard).getByText(/2 minutes/i)).toBeInTheDocument();
	});

	it("empeche de lancer Sprint a moins de 2 joueurs", () => {
		renderGamePage();
		joinLobby([{ username: "luffy", faction: "pirate" }]);
		receive("room:settings", { mode: "sprint", private: false });

		const launch = screen.getByRole("button", { name: "▶ Lancer" });
		expect(launch).toBeDisabled();
		expect(screen.getByText(/Sprint nécessite au moins 2 joueurs/i)).toBeInTheDocument();

		fireEvent.click(launch);
		expect(roomEvents.emitStartGame).not.toHaveBeenCalled();
	});

	it("autorise le lancement de Sprint des 2 joueurs", () => {
		renderGamePage();
		joinLobby([
			{ username: "luffy", faction: "pirate" },
			{ username: "zoro", faction: "pirate" },
		]);
		receive("room:settings", { mode: "sprint", private: false });

		expect(screen.getByRole("button", { name: "▶ Lancer" })).not.toBeDisabled();
	});

	it("masque le mode Sprint en solo (injouable seul)", () => {
		ctx.params = { roomName: "sologame_abc", playerName: "luffy" };
		renderGamePage();
		joinLobby([{ username: "luffy", faction: "pirate" }]);

		expect(screen.queryByRole("button", { name: "Sprint" })).toBeNull();
		// Les modes solo restent proposés.
		expect(screen.getByRole("button", { name: "Classique" })).toBeInTheDocument();
		expect(screen.getByRole("button", { name: "Ultra" })).toBeInTheDocument();
	});

	it("ignore un mode inconnu envoye par le serveur", () => {
		const { container } = renderGamePage();
		joinLobby([{ username: "luffy", faction: "pirate" }]);
		receive("room:settings", { mode: "hardcore", private: false });

		expect(container.querySelector(".game-lobby__mode-btn--active")?.textContent).toBe("Classique");
	});

	it("n'emet pas de changement de mode pour un joueur non admin", () => {
		renderGamePage();
		joinLobby([{ username: "zoro", faction: "pirate" }, { username: "luffy", faction: "pirate" }]);

		fireEvent.click(screen.getByRole("button", { name: "Sprint" }));
		expect(roomEvents.emitSetGameMode).not.toHaveBeenCalled();
	});

	it("reflete la visibilite recue du serveur", () => {
		renderGamePage();
		joinLobby([{ username: "luffy", faction: "pirate" }]);
		receive("room:settings", { private: true });

		expect(screen.getByRole("button", { name: "🔒 Privée" })).toBeInTheDocument();
	});

	it("ignore un payload de reglages vide", () => {
		renderGamePage();
		joinLobby([{ username: "luffy", faction: "pirate" }]);
		receive("room:settings", null);

		expect(screen.getByRole("button", { name: "🌐 Publique" })).toBeInTheDocument();
	});

	it("ne declenche pas les reglages quand le joueur n'est pas admin", () => {
		renderGamePage();
		joinLobby([{ username: "zoro", faction: "pirate" }, { username: "luffy", faction: "pirate" }]);

		fireEvent.click(screen.getByRole("button", { name: "🌐 Publique" }));
		expect(roomEvents.emitSetPrivate).not.toHaveBeenCalled();
	});

	it("verrouille l'acces sur prive et non modifiable en partie solo", () => {
		ctx.params = { roomName: "sologame_abcd", playerName: "luffy" };
		renderGamePage();
		joinLobby([{ username: "luffy", faction: "pirate" }]);

		const privacyBtn = screen.getByRole("button", { name: "🔒 Privée" });
		expect(privacyBtn).toBeDisabled();
		fireEvent.click(privacyBtn);
		expect(roomEvents.emitSetPrivate).not.toHaveBeenCalled();
		expect(screen.getByText("Partie solo — toujours privée")).toBeInTheDocument();
	});
});

describe("GamePage — partie en cours", () => {
	it("affiche le plateau a la reception de game:update", () => {
		const { container } = renderGamePage();
		joinLobby([{ username: "luffy", faction: "pirate" }]);
		receive("game:update", {
			board: emptyBoard(),
			score: 1200,
			level: 4,
			spectator: false,
			currentPiece: { type: "T" },
			nextPiece: { type: "I" },
			opponents: [],
			ghost: [],
		});

		expect(container.querySelector(".tetris-board")).not.toBeNull();
		expect(container.querySelector(".game-lobby")).toBeNull();
	});

	it("bascule aussi sur game:start", () => {
		const { container } = renderGamePage();
		receive("game:start", { board: emptyBoard(), score: 0, level: 1, spectator: false });

		expect(container.querySelector(".tetris-board")).not.toBeNull();
	});

	it("ignore un etat de jeu invalide", () => {
		renderGamePage();
		joinLobby([{ username: "luffy", faction: "pirate" }]);
		receive("game:update", { board: "pas-un-plateau" });

		expect(screen.getByRole("heading", { name: "room-42" })).toBeInTheDocument();
	});

	it("affiche un ecran d'attente en mode jeu tant qu'aucun etat n'est arrive", () => {
		renderGamePage();
		receive("room:joined", { players: [{ username: "zoro" }], joined: false });

		expect(screen.getByText("Chargement de la partie…")).toBeInTheDocument();
	});
});

describe("GamePage — decompte de lancement", () => {
	it("affiche l'overlay 3-2-1 et le met a jour a chaque valeur", () => {
		const { container } = renderGamePage();
		joinLobby([{ username: "luffy", faction: "pirate" }]);

		receive("game:countdown", { value: 3 });
		expect(container.querySelector(".game-countdown__value")?.textContent).toBe("3");

		receive("game:countdown", { value: 2 });
		expect(container.querySelector(".game-countdown__value")?.textContent).toBe("2");

		receive("game:countdown", { value: 1 });
		expect(container.querySelector(".game-countdown__value")?.textContent).toBe("1");
	});

	it("retire l'overlay quand la partie demarre vraiment", () => {
		const { container } = renderGamePage();
		joinLobby([{ username: "luffy", faction: "pirate" }]);

		receive("game:countdown", { value: 1 });
		expect(container.querySelector(".game-countdown")).not.toBeNull();

		receive("game:start", { board: emptyBoard(), score: 0, level: 1, spectator: false });
		expect(container.querySelector(".game-countdown")).toBeNull();
		expect(container.querySelector(".tetris-board")).not.toBeNull();
	});

	it("ignore un decompte sans valeur numerique", () => {
		const { container } = renderGamePage();
		joinLobby([{ username: "luffy", faction: "pirate" }]);

		receive("game:countdown", { value: "trois" });
		expect(container.querySelector(".game-countdown")).toBeNull();
	});
});

describe("GamePage — spectateur", () => {
	it("s'abonne automatiquement quand la partie a deja demarre (joined: false)", () => {
		renderGamePage();
		receive("room:joined", { players: [{ username: "zoro", faction: "pirate" }], joined: false });

		expect(gameEvents.emitSubscribeSpectator).toHaveBeenCalledWith("room-42", null);
	});

	it("affiche le plateau observe sur game:SpectatorGame", () => {
		renderGamePage();
		receive("room:joined", { players: [{ username: "zoro" }], joined: false });
		receive("game:SpectatorGame", {
			board: emptyBoard(),
			score: 42,
			level: 1,
			spectator: "zoro",
			opponents: [],
		});

		expect(screen.getByText("Spectator")).toBeInTheDocument();
		expect(screen.getByText("zoro")).toBeInTheDocument();
	});

	it("quitte en se desabonnant sans emettre de leave quand on n'a jamais joue", () => {
		renderGamePage();
		receive("room:joined", { players: [{ username: "zoro" }], joined: false });
		receive("game:SpectatorGame", { board: emptyBoard(), spectator: "zoro", score: 0, level: 1 });

		fireEvent.click(screen.getByRole("button", { name: "Quitter la partie" }));

		expect(gameEvents.emitUnsubscribeSpectator).toHaveBeenCalledTimes(1);
		expect(roomEvents.emitLeaveRoom).not.toHaveBeenCalled();
		expect(ctx.navigate).toHaveBeenCalledWith("/dashboard");
	});
});

describe("GamePage — elimination", () => {
	function playThenEliminate(spectate: unknown) {
		const view = renderGamePage();
		joinLobby([{ username: "luffy", faction: "pirate" }]);
		receive("game:update", {
			board: emptyBoard(),
			score: 500,
			level: 3,
			spectator: false,
			opponents: [],
		});
		receive("game:eliminated", { spectate });
		return view;
	}

	it("affiche l'overlay GAME OVER sans quitter l'ecran de jeu", () => {
		const { container } = playThenEliminate("zoro");

		expect(container.querySelector(".tetris-gameover-overlay__text")?.textContent).toBe("GAME OVER");
		expect(container.querySelector(".tetris-board")).not.toBeNull();
		expect(gameEvents.emitSubscribeSpectator).not.toHaveBeenCalled();
	});

	it("s'abonne au joueur indique a la fin de l'animation puis retire l'overlay", () => {
		const { container } = playThenEliminate("zoro");
		const overlay = container.querySelector(".tetris-gameover-overlay__text") as HTMLElement;

		act(() => { fireEvent.animationEnd(overlay); });

		expect(gameEvents.emitSubscribeSpectator).toHaveBeenCalledWith("room-42", "zoro");
		expect(container.querySelector(".tetris-gameover-overlay")).toBeNull();
	});

	it("s'abonne sans cible quand le backend n'indique aucun joueur a observer", () => {
		const { container } = playThenEliminate(undefined);
		const overlay = container.querySelector(".tetris-gameover-overlay__text") as HTMLElement;

		act(() => { fireEvent.animationEnd(overlay); });

		expect(gameEvents.emitSubscribeSpectator).toHaveBeenCalledWith("room-42", null);
	});

	it("emet aussi un leave quand un joueur elimine quitte la room", () => {
		playThenEliminate("zoro");

		fireEvent.click(screen.getByRole("button", { name: "Quitter la partie" }));

		expect(gameEvents.emitUnsubscribeSpectator).toHaveBeenCalledTimes(1);
		expect(roomEvents.emitLeaveRoom).toHaveBeenCalledTimes(1);
	});
});

describe("GamePage — fin de partie", () => {
	/** Termine l'animation du zoom "GAME OVER" affiché sur l'écran de jeu. */
	function endGameOverZoom(container: HTMLElement) {
		const overlay = container.querySelector(".tetris-gameover-overlay__text") as HTMLElement;
		act(() => { fireEvent.animationEnd(overlay); });
	}

	it("joue le zoom GAME OVER au gagnant puis affiche le classement", () => {
		const { container } = renderGamePage();
		joinLobby([{ username: "luffy", faction: "pirate" }, { username: "zoro", faction: "pirate" }]);
		receive("game:update", { board: emptyBoard(), score: 10, level: 1, spectator: false });
		receive("game:over", {
			winner: "luffy",
			scores: [{ username: "luffy", score: 900 }, { username: "zoro", score: 400 }],
		});

		// Le gagnant n'a jamais vu le zoom: il joue d'abord, le récap n'est pas encore là.
		expect(container.querySelector(".tetris-gameover-overlay__text")?.textContent).toBe("GAME OVER");
		expect(screen.queryByRole("heading", { name: "Victoire" })).toBeNull();

		endGameOverZoom(container);

		expect(screen.getByRole("heading", { name: "Victoire" })).toBeInTheDocument();
		expect(screen.getByRole("heading", { name: "room-42" })).toBeInTheDocument();
	});

	it("changer de mode remplace le récap de fin de partie par les règles du mode", () => {
		const { container } = renderGamePage();
		joinLobby([{ username: "luffy", faction: "pirate" }, { username: "zoro", faction: "pirate" }]);
		receive("game:update", { board: emptyBoard(), score: 10, level: 1, spectator: false });
		receive("game:over", {
			winner: "luffy",
			scores: [{ username: "luffy", score: 900 }, { username: "zoro", score: 400 }],
		});
		endGameOverZoom(container);
		expect(screen.getByRole("heading", { name: "Victoire" })).toBeInTheDocument();

		// Un changement de mode efface le récap et réaffiche les règles du mode choisi.
		receive("room:settings", { mode: "ultra", private: false });

		expect(screen.queryByRole("heading", { name: "Victoire" })).toBeNull();
		expect(screen.getByLabelText("Règles du mode Ultra")).toBeInTheDocument();
	});

	it("joue le zoom GAME OVER a un spectateur pur puis affiche le classement", () => {
		ctx.params = { roomName: "room-42", playerName: "nami" };
		const { container } = renderGamePage();
		// Spectateur pur: room:joined { joined:false } -> abonnement spectateur.
		receive("room:joined", { players: [{ username: "luffy", faction: "pirate" }], joined: false });
		receive("game:SpectatorGame", { board: emptyBoard(), score: 10, level: 4, spectator: "luffy" });
		receive("game:over", { winner: "luffy", scores: [{ username: "luffy", score: 900 }] });

		expect(container.querySelector(".tetris-gameover-overlay__text")?.textContent).toBe("GAME OVER");
		endGameOverZoom(container);

		expect(screen.getByRole("heading", { name: "room-42" })).toBeInTheDocument();
	});

	it("complete le level manquant d'un resume solo avec le dernier level joue", () => {
		const { container } = renderGamePage();
		joinLobby([{ username: "luffy", faction: "pirate" }]);
		receive("game:update", { board: emptyBoard(), score: 10, level: 7, spectator: false });
		receive("game:over", { winner: "luffy", scores: [{ username: "luffy", score: 900 }] });
		endGameOverZoom(container);

		const soloStats = screen.getByText("Level final").parentElement as HTMLElement;
		expect(soloStats.querySelector("strong")?.textContent).toBe("7");
	});

	it("ne remonte pas le level d'un etat observe en spectateur", () => {
		const { container } = renderGamePage();
		joinLobby([{ username: "luffy", faction: "pirate" }]);
		receive("game:update", { board: emptyBoard(), score: 10, level: 7, spectator: false });
		receive("game:SpectatorGame", { board: emptyBoard(), score: 10, level: 12, spectator: "zoro" });
		receive("game:over", { winner: "luffy", scores: [{ username: "luffy", score: 900 }] });
		endGameOverZoom(container);

		const soloStats = screen.getByText("Level final").parentElement as HTMLElement;
		expect(soloStats.querySelector("strong")?.textContent).toBe("7");
	});

	it("purge l'overlay de fin quand une NOUVELLE partie demarre pendant le zoom", () => {
		const { container } = renderGamePage();
		joinLobby([{ username: "luffy", faction: "pirate" }, { username: "zoro", faction: "pirate" }]);
		receive("game:update", { board: emptyBoard(), score: 10, level: 1, spectator: false });
		receive("game:over", { winner: "luffy", scores: [{ username: "luffy", score: 900 }] });
		expect(container.querySelector(".tetris-gameover-overlay")).not.toBeNull();

		// L'hote relance avant la fin des 5 s de zoom.
		receive("game:start", { board: emptyBoard(), score: 0, level: 1, spectator: false });

		// L'overlay de l'ANCIENNE partie ne doit plus etre colle par-dessus la nouvelle.
		expect(container.querySelector(".tetris-gameover-overlay")).toBeNull();
		expect(container.querySelector(".tetris-board")).not.toBeNull();
	});

	it("n'ejecte pas vers le lobby si l'animation de l'ancien zoom finit en pleine partie", () => {
		const { container } = renderGamePage();
		joinLobby([{ username: "luffy", faction: "pirate" }, { username: "zoro", faction: "pirate" }]);
		receive("game:update", { board: emptyBoard(), score: 10, level: 1, spectator: false });
		receive("game:over", { winner: "luffy", scores: [{ username: "luffy", score: 900 }] });
		receive("game:countdown", { value: 3 });
		receive("game:start", { board: emptyBoard(), score: 0, level: 1, spectator: false });

		// Plus aucun overlay: rien ne peut declencher handleEliminationDone.
		expect(container.querySelector(".tetris-gameover-overlay__text")).toBeNull();
		// Le joueur reste bien dans la partie en cours, pas au lobby.
		expect(container.querySelector(".game-lobby")).toBeNull();
		expect(container.querySelector(".tetris-board")).not.toBeNull();
	});

	it("ne se reabonne pas et n'affiche pas le recap si l'animation finit APRES le depart", () => {
		const { container } = renderGamePage();
		joinLobby([{ username: "luffy", faction: "pirate" }, { username: "zoro", faction: "pirate" }]);
		receive("game:update", { board: emptyBoard(), score: 10, level: 2, spectator: false });
		receive("game:eliminated", { spectate: "zoro" });
		gameEvents.emitSubscribeSpectator.mockClear();

		// Le joueur quitte pendant le zoom; la navigation est differee (transition nuages)
		// donc l'animation peut encore se terminer avant le demontage.
		fireEvent.click(screen.getByRole("button", { name: "Quitter la partie" }));
		endGameOverZoom(container);

		expect(gameEvents.emitSubscribeSpectator).not.toHaveBeenCalled();
		expect(container.querySelector(".game-lobby")).toBeNull();
	});

	it("affiche le recap directement a un joueur deja elimine, sans rejouer le zoom", () => {
		const { container } = renderGamePage();
		joinLobby([{ username: "luffy", faction: "pirate" }, { username: "zoro", faction: "pirate" }]);
		receive("game:update", { board: emptyBoard(), score: 10, level: 2, spectator: false });
		// Le joueur meurt en cours de partie: il voit SON zoom, puis devient spectateur.
		receive("game:eliminated", { spectate: "zoro" });
		endGameOverZoom(container);
		gameEvents.emitSubscribeSpectator.mockClear();

		// Fin de partie: aucun second zoom, récap direct, aucun nouvel abonnement.
		receive("game:over", { winner: "zoro", scores: [{ username: "luffy", score: 10 }, { username: "zoro", score: 50 }] });

		expect(container.querySelector(".tetris-gameover-overlay")).toBeNull();
		expect(screen.getByRole("heading", { name: "room-42" })).toBeInTheDocument();
		expect(gameEvents.emitSubscribeSpectator).not.toHaveBeenCalled();
	});
});

describe("GamePage — sortie de room", () => {
	it("quitte la room et retourne au dashboard depuis le lobby", () => {
		renderGamePage();
		joinLobby([{ username: "luffy", faction: "pirate" }]);

		fireEvent.click(screen.getByRole("button", { name: "Quitter" }));

		expect(roomEvents.emitLeaveRoom).toHaveBeenCalledTimes(1);
		expect(ctx.navigate).toHaveBeenCalledWith("/dashboard");
	});

	it("ne flashe pas le lobby en quittant une partie en cours", () => {
		const { container } = renderGamePage();
		joinLobby([{ username: "luffy", faction: "pirate" }]);
		receive("game:update", {
			board: emptyBoard(),
			score: 0,
			level: 1,
			spectator: false,
			currentPiece: { type: "T" },
			nextPiece: { type: "I" },
			opponents: [],
			ghost: [],
		});
		expect(container.querySelector(".tetris-board")).not.toBeNull();

		fireEvent.click(screen.getByRole("button", { name: "Quitter la partie" }));
		// Le serveur renvoie game:over au partant: le garde doit l'ignorer pour ne pas
		// rebasculer sur le lobby avant la navigation vers le dashboard.
		receive("game:over", { scores: [{ username: "luffy", score: 0 }] });

		expect(ctx.navigate).toHaveBeenCalledWith("/dashboard");
		expect(container.querySelector(".game-lobby")).toBeNull();
	});

	it("ne quitte qu'une seule fois meme apres demontage", () => {
		const { unmount } = renderGamePage();
		joinLobby([{ username: "luffy", faction: "pirate" }]);

		fireEvent.click(screen.getByRole("button", { name: "Quitter" }));
		unmount();

		expect(roomEvents.emitLeaveRoom).toHaveBeenCalledTimes(1);
	});

	it("quitte la room quand la page est masquee (pagehide)", () => {
		renderGamePage();
		joinLobby([{ username: "luffy", faction: "pirate" }]);

		fireEvent(window, new Event("pagehide"));

		expect(roomEvents.emitLeaveRoom).toHaveBeenCalledTimes(1);
	});

	it("desabonne tous les listeners socket au demontage", () => {
		const { unmount } = renderGamePage();
		unmount();

		for (const event of ["room:joined", "room:players", "room:settings", "room:kicked", "room:denied", "game:start", "game:update", "game:SpectatorGame", "game:over", "game:eliminated", "user:ResultUsernameAvailable"]) {
			expect(ctx.socket.listenerCount(event)).toBe(0);
		}
	});

	it("affiche une alerte et redirige quand le joueur est expulse", async () => {
		renderGamePage();
		joinLobby([{ username: "zoro", faction: "pirate" }, { username: "luffy", faction: "pirate" }]);

		receive("room:kicked", {});

		expect(ctx.navigate).toHaveBeenCalledWith("/dashboard");
		expect(await screen.findByText("Expulsé de la salle")).toBeInTheDocument();
	});

	it("n'emet plus de leave apres une expulsion", () => {
		renderGamePage();
		joinLobby([{ username: "luffy", faction: "pirate" }]);
		receive("room:kicked", {});

		expect(roomEvents.emitLeaveRoom).not.toHaveBeenCalled();
	});

	it("redirige avec une alerte quand la room est privee (room:denied)", async () => {
		renderGamePage();
		receive("room:denied", { reason: "private" });

		expect(ctx.navigate).toHaveBeenCalledWith("/dashboard");
		expect(await screen.findByText("Partie privée")).toBeInTheDocument();
	});

	// B5: le serveur refuse desormais aussi une salle COMPLETE. Un message unique
	// « Partie privée » serait faux dans ce cas.
	it("distingue une salle complete d'une partie privee", async () => {
		renderGamePage();
		receive("room:denied", { reason: "full" });

		expect(ctx.navigate).toHaveBeenCalledWith("/dashboard");
		expect(await screen.findByText("Salle complète")).toBeInTheDocument();
		expect(screen.queryByText("Partie privée")).not.toBeInTheDocument();
	});

	// Un refus sans raison exploitable ne doit pas afficher un message trompeur:
	// on retombe sur le cas historique.
	it("retombe sur le message par defaut si la raison est absente", async () => {
		renderGamePage();
		receive("room:denied", undefined);

		expect(await screen.findByText("Partie privée")).toBeInTheDocument();
	});
});

describe("GamePage — join refuse", () => {
	it("redirige au lieu de charger indefiniment quand le serveur refuse le join", async () => {
		renderGamePage();
		expect(screen.getByText("Connexion à la room…")).toBeInTheDocument();

		receive("system:Error", { event: "room:join", message: "Invalid roomId" });

		expect(ctx.navigate).toHaveBeenCalledWith("/dashboard");
		expect(await screen.findByText("Salle inaccessible")).toBeInTheDocument();
	});

	it("ignore les erreurs qui ne concernent pas le join", () => {
		renderGamePage();

		receive("system:Error", { event: "room:setMode", message: "Invalid Mode or Not Host" });

		expect(ctx.navigate).not.toHaveBeenCalled();
		expect(screen.getByText("Connexion à la room…")).toBeInTheDocument();
	});
});
