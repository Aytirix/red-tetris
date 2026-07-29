import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { createFakeSocket, type FakeSocket } from "../../test/fakeSocket";
import { AlertProvider } from "../components/Alert";

const ctx = vi.hoisted(() => ({
	socket: null as unknown as FakeSocket,
	location: { state: null as unknown, pathname: "/" },
	navigate: null as unknown as ReturnType<typeof vi.fn>,
	rememberFaction: null as unknown as ReturnType<typeof vi.fn>,
}));

const userEvents = vi.hoisted(() => ({ emitCheckUsernameAvailable: vi.fn() }));

vi.mock("../socket/events/user", () => userEvents);
vi.mock("../contexts/SocketContext", () => ({
	useSocket: () => ({ socket: ctx.socket, isConnected: true }),
}));
vi.mock("../contexts/WsStateContext", () => ({
	useRememberCurrentUserFaction: () => ctx.rememberFaction,
}));
vi.mock("react-router-dom", () => ({
	useNavigate: () => ctx.navigate,
	useLocation: () => ctx.location,
}));

import HomePage from "./HomePage";
function InstantImage(): HTMLImageElement {
	const image = {
		decoding: "",
		complete: false,
		onload: null as (() => void) | null,
		onerror: null as (() => void) | null,
	};
	let source = "";
	Object.defineProperty(image, "src", {
		enumerable: true,
		get: () => source,
		set: (value: string) => {
			source = value;
			queueMicrotask(() => image.onload?.());
		},
	});
	return image as unknown as HTMLImageElement;
}

function renderHome() {
	return render(
		<AlertProvider>
			<HomePage />
		</AlertProvider>,
	);
}

function receive(event: string, payload: unknown) {
	act(() => { ctx.socket.receive(event, payload); });
}

/** Laisse passer les timers (debounce, transitions) et les micro-taches. */
async function advance(ms: number) {
	await act(async () => { await vi.advanceTimersByTimeAsync(ms); });
}

function availablePayload(overrides: Record<string, unknown> = {}) {
	return { available: true, user_faction: "pirate", username: "monkeyd", ...overrides };
}

beforeEach(() => {
	vi.useFakeTimers({ shouldAdvanceTime: true });
	ctx.socket = createFakeSocket();
	ctx.location = { state: null, pathname: "/" };
	ctx.navigate = vi.fn();
	ctx.rememberFaction = vi.fn();
	userEvents.emitCheckUsernameAvailable.mockClear();
	localStorage.clear();
	vi.stubGlobal("Image", InstantImage);
});

afterEach(() => {
	cleanup();
	vi.useRealTimers();
	vi.unstubAllGlobals();
});

describe("HomePage — saisie du pseudo", () => {
	it("part du pseudo memorise dans le localStorage", () => {
		localStorage.setItem("username", "monkeyd");
		renderHome();

		expect((screen.getByPlaceholderText("Votre pseudo…") as HTMLInputElement).value).toBe("monkeyd");
	});

	it("filtre les caracteres interdits et limite la longueur a 15", () => {
		renderHome();
		const input = screen.getByPlaceholderText("Votre pseudo…") as HTMLInputElement;

		fireEvent.change(input, { target: { value: "lu ffy!@#-_é012345678" } });

		expect(input.value).toBe("luffy_012345678");
	});

	it("verifie la disponibilite apres le debounce, pas avant", async () => {
		renderHome();
		fireEvent.change(screen.getByPlaceholderText("Votre pseudo…"), { target: { value: "monkeyd" } });

		await advance(700);
		expect(userEvents.emitCheckUsernameAvailable).not.toHaveBeenCalled();

		await advance(200);
		expect(userEvents.emitCheckUsernameAvailable).toHaveBeenCalledWith("monkeyd");
	});

	it("ne verifie rien tant que le champ est vide", async () => {
		renderHome();
		await advance(1000);

		expect(userEvents.emitCheckUsernameAvailable).not.toHaveBeenCalled();
	});

	it("active le bouton Jouer quand le pseudo est libre et deja enregistre", () => {
		localStorage.setItem("username", "monkeyd");
		renderHome();
		receive("user:ResultUsernameAvailable", availablePayload());

		const button = screen.getByRole("button", { name: "Jouer →" });
		expect(button).toBeEnabled();
	});

	it("signale un pseudo indisponible et bloque la validation", () => {
		localStorage.setItem("username", "monkeyd");
		renderHome();
		receive("user:ResultUsernameAvailable", availablePayload({ available: false, user_faction: null }));

		expect(screen.getByText("Indisponible")).toBeInTheDocument();
		expect(screen.getByRole("button", { name: "Choisir ce pseudo" })).toBeDisabled();
	});

	it("vide le champ et le localStorage quand le backend juge le pseudo invalide", () => {
		localStorage.setItem("username", "monkeyd");
		renderHome();
		receive("user:ResultUsernameAvailable", { available: "invalid" });

		expect((screen.getByPlaceholderText("Votre pseudo…") as HTMLInputElement).value).toBe("");
		expect(localStorage.getItem("username")).toBeNull();
	});

	it("ignore une reponse de disponibilite mal formee", () => {
		localStorage.setItem("username", "monkeyd");
		renderHome();
		receive("user:ResultUsernameAvailable", { available: true });

		expect(screen.getByRole("button", { name: "Choisir ce pseudo" })).toBeDisabled();
	});

	it("memorise le pseudo et la faction puis part au dashboard", () => {
		localStorage.setItem("username", "monkeyd");
		renderHome();
		receive("user:ResultUsernameAvailable", availablePayload({ user_faction: "marine" }));

		fireEvent.click(screen.getByRole("button", { name: "Jouer →" }));

		expect(localStorage.getItem("username")).toBe("monkeyd");
		expect(ctx.rememberFaction).toHaveBeenCalledWith("marine");
		expect(ctx.navigate).toHaveBeenCalledWith("/dashboard");
	});

	it("affiche un indicateur de verification en cours", async () => {
		const { container } = renderHome();
		fireEvent.change(screen.getByPlaceholderText("Votre pseudo…"), { target: { value: "monkeyd" } });

		// Etat "idle": aucun indicateur a droite du champ.
		expect(container.querySelector("input + span")).toBeNull();

		await advance(900);

		// Etat "checking": indicateur present mais sans verdict textuel.
		const indicator = container.querySelector("input + span");
		expect(indicator).not.toBeNull();
		expect(indicator?.textContent).toBe("");
	});
});

describe("HomePage — choix de la faction et inscription", () => {
	async function goToRegisterStep() {
		localStorage.setItem("username", "monkeyd");
		renderHome();
		receive("user:ResultUsernameAvailable", availablePayload({ user_faction: null }));

		fireEvent.click(screen.getByRole("button", { name: "Choisir ce pseudo" }));
		await advance(1200);
		return screen.getByRole("button", { name: "Choisir Pirate" });
	}

	it("bascule sur l'ecran de choix de camp apres validation d'un pseudo non enregistre", async () => {
		await goToRegisterStep();

		expect(screen.getByText("Choisissez votre camp")).toBeInTheDocument();
		expect(screen.getByRole("button", { name: "Choisir Marine" })).toBeInTheDocument();
	});

	it("n'active le bouton de validation qu'apres selection d'un personnage", async () => {
		const pirate = await goToRegisterStep();

		fireEvent.click(pirate);
		await advance(100);
		expect(screen.getByRole("button", { name: "Rejoindre la bataille" })).toBeDisabled();

		fireEvent.click(screen.getByText("Luffy").closest("button") as HTMLButtonElement);
		expect(screen.getByRole("button", { name: "Rejoindre la bataille" })).toBeEnabled();
	});

	it("envoie l'inscription avec la faction et l'avatar choisis", async () => {
		const pirate = await goToRegisterStep();
		fireEvent.click(pirate);
		await advance(100);
		fireEvent.click(screen.getByText("Nami").closest("button") as HTMLButtonElement);

		fireEvent.click(screen.getByRole("button", { name: "Rejoindre la bataille" }));

		expect(ctx.socket.emitted()).toContainEqual([
			"user:Register",
			{ faction: "pirate", avatar: "nami" },
		]);
	});

	it("revient au choix des camps via la poignee de bord", async () => {
		const pirate = await goToRegisterStep();
		fireEvent.click(pirate);
		await advance(100);
		expect(screen.getByRole("button", { name: "Rejoindre la bataille" })).toBeInTheDocument();

		// La poignee de retour est le premier bouton sans libelle du calque actif.
		const backButtons = screen.getAllByRole("button", { name: "" });
		fireEvent.click(backButtons[0]);
		await advance(600);

		expect(screen.queryByRole("button", { name: "Rejoindre la bataille" })).toBeNull();
	});

	it("redirige vers le dashboard quand le backend confirme l'inscription", async () => {
		const pirate = await goToRegisterStep();
		fireEvent.click(pirate);
		await advance(100);
		fireEvent.click(screen.getByText("Zoro").closest("button") as HTMLButtonElement);
		fireEvent.click(screen.getByRole("button", { name: "Rejoindre la bataille" }));

		receive("user:ResultRegister", { isRegister: true });

		expect(ctx.rememberFaction).toHaveBeenCalledWith("pirate");
		expect(ctx.navigate).toHaveBeenCalledWith("/dashboard");
	});

	it("affiche le message d'erreur du backend quand l'inscription echoue", async () => {
		const pirate = await goToRegisterStep();
		fireEvent.click(pirate);
		await advance(100);
		fireEvent.click(screen.getByText("Sanji").closest("button") as HTMLButtonElement);
		fireEvent.click(screen.getByRole("button", { name: "Rejoindre la bataille" }));

		receive("user:ResultRegister", { isRegister: false, message: "Pseudo deja pris" });

		expect(await screen.findByText("Inscription impossible")).toBeInTheDocument();
		expect(screen.getByText("Pseudo deja pris")).toBeInTheDocument();
		expect(ctx.navigate).not.toHaveBeenCalled();
	});

	it("ignore une reponse d'inscription mal formee", async () => {
		await goToRegisterStep();
		receive("user:ResultRegister", { isRegister: "oui" });

		expect(ctx.navigate).not.toHaveBeenCalled();
	});

	it("ne navigue pas si aucune inscription n'etait en attente", async () => {
		await goToRegisterStep();
		receive("user:ResultRegister", { isRegister: true });

		expect(ctx.navigate).not.toHaveBeenCalled();
	});

	it("retombe sur l'initiale du personnage quand l'avatar est introuvable", async () => {
		const pirate = await goToRegisterStep();
		fireEvent.click(pirate);
		await advance(100);

		const avatar = screen.getAllByAltText("Luffy")[0];
		fireEvent.error(avatar);

		expect(screen.queryAllByAltText("Luffy")).toHaveLength(0);
		expect(screen.getByText("L")).toBeInTheDocument();
	});
});

describe("HomePage — arrivee depuis une URL de room", () => {
	function renderRoomJoin() {
		ctx.location = { state: { returnTo: "/room-1/luffy" }, pathname: "/" };
		return renderHome();
	}

	it("n'affiche rien tant que la verification initiale n'a pas repondu", () => {
		const { container } = renderRoomJoin();

		expect(container).toBeEmptyDOMElement();
	});

	it("verifie le pseudo extrait de l'URL", async () => {
		renderRoomJoin();
		await advance(900);

		expect(userEvents.emitCheckUsernameAvailable).toHaveBeenCalledWith("luffy");
	});

	it("enchaine directement sur le choix du camp si le pseudo est libre et non enregistre", () => {
		renderRoomJoin();
		receive("user:ResultUsernameAvailable", { available: true, user_faction: null, username: "luffy" });

		expect(screen.getByText("Choisissez votre camp")).toBeInTheDocument();
	});

	it("propose de jouer directement si le pseudo est deja enregistre", () => {
		renderRoomJoin();
		receive("user:ResultUsernameAvailable", { available: true, user_faction: "marine", username: "luffy" });

		expect(screen.getByRole("button", { name: "Jouer →" })).toBeInTheDocument();
	});

	it("renvoie vers la room avec le pseudo confirme", () => {
		renderRoomJoin();
		receive("user:ResultUsernameAvailable", { available: true, user_faction: "marine", username: "luffy" });

		fireEvent.click(screen.getByRole("button", { name: "Jouer →" }));

		expect(ctx.navigate).toHaveBeenCalledWith("/room-1/luffy");
	});

	it("redemande un pseudo si celui de l'URL est deja pris", () => {
		renderRoomJoin();
		receive("user:ResultUsernameAvailable", { available: false, user_faction: null, username: "luffy" });

		expect(screen.getByPlaceholderText("Votre pseudo…")).toBeInTheDocument();
		expect(screen.getByText("Indisponible")).toBeInTheDocument();
	});

	it("redemande un pseudo si celui de l'URL est invalide", () => {
		renderRoomJoin();
		receive("user:ResultUsernameAvailable", { available: "invalid" });

		expect((screen.getByPlaceholderText("Votre pseudo…") as HTMLInputElement).value).toBe("");
	});

	it("conserve la destination room apres inscription", async () => {
		renderRoomJoin();
		receive("user:ResultUsernameAvailable", { available: true, user_faction: null, username: "luffy" });

		fireEvent.click(screen.getByRole("button", { name: "Choisir Marine" }));
		await advance(100);
		fireEvent.click(screen.getByText("Garp").closest("button") as HTMLButtonElement);
		fireEvent.click(screen.getByRole("button", { name: "Rejoindre la bataille" }));
		receive("user:ResultRegister", { isRegister: true });

		expect(ctx.navigate).toHaveBeenCalledWith("/room-1/luffy");
	});

	it("ignore un returnTo qui n'est pas une URL de room", () => {
		ctx.location = { state: { returnTo: "/dashboard" }, pathname: "/" };
		localStorage.setItem("username", "monkeyd");
		renderHome();
		receive("user:ResultUsernameAvailable", availablePayload());

		fireEvent.click(screen.getByRole("button", { name: "Jouer →" }));
		expect(ctx.navigate).toHaveBeenCalledWith("/dashboard");
	});
});

describe("HomePage — nettoyage", () => {
	it("retire ses listeners socket au demontage", () => {
		const { unmount } = renderHome();
		unmount();

		expect(ctx.socket.listenerCount("user:ResultUsernameAvailable")).toBe(0);
		expect(ctx.socket.listenerCount("user:ResultRegister")).toBe(0);
	});
});
