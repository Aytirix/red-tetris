import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, render, screen } from "@testing-library/react";
import { createFakeSocket, type FakeSocket } from "../../test/fakeSocket";
import { AlertProvider } from "../components/Alert";

const ctx = vi.hoisted(() => ({
	socket: null as unknown as FakeSocket,
	navigate: null as unknown as ReturnType<typeof vi.fn>,
	clearFaction: null as unknown as ReturnType<typeof vi.fn>,
	location: { pathname: "/dashboard" },
}));

const userEvents = vi.hoisted(() => ({ emitCheckUsernameAvailable: vi.fn() }));

vi.mock("../socket/events/user", () => userEvents);
vi.mock("../contexts/SocketContext", () => ({
	useSocket: () => ({ socket: ctx.socket, isConnected: true }),
}));
vi.mock("../contexts/WsStateContext", () => ({
	useClearCurrentUserFaction: () => ctx.clearFaction,
}));
vi.mock("react-router-dom", () => ({
	useNavigate: () => ctx.navigate,
	useLocation: () => ctx.location,
}));

import { useAuthGuard } from "./useAuthGuard";

function Guarded() {
	useAuthGuard();
	return <span>page</span>;
}

function renderGuard() {
	return render(
		<AlertProvider>
			<Guarded />
		</AlertProvider>,
	);
}

function receive(payload: unknown) {
	act(() => { ctx.socket.receive("user:ResultUsernameAvailable", payload); });
}

beforeEach(() => {
	vi.useFakeTimers({ shouldAdvanceTime: true });
	ctx.socket = createFakeSocket();
	ctx.navigate = vi.fn();
	ctx.clearFaction = vi.fn();
	ctx.location = { pathname: "/dashboard" };
	userEvents.emitCheckUsernameAvailable.mockClear();
	localStorage.clear();
});

afterEach(() => {
	cleanup();
	vi.useRealTimers();
});

describe("useAuthGuard — verification initiale", () => {
	it("verifie le pseudo memorise en arrivant sur une page protegee", () => {
		localStorage.setItem("username", " luffy ");
		renderGuard();

		expect(userEvents.emitCheckUsernameAvailable).toHaveBeenCalledWith("luffy");
	});

	it("ne verifie rien sans pseudo en memoire", () => {
		renderGuard();

		expect(userEvents.emitCheckUsernameAvailable).not.toHaveBeenCalled();
	});

	it("laisse la page d'accueil gerer sa propre verification", () => {
		ctx.location = { pathname: "/" };
		localStorage.setItem("username", "luffy");
		renderGuard();

		expect(userEvents.emitCheckUsernameAvailable).not.toHaveBeenCalled();
	});
});

describe("useAuthGuard — reponses du backend", () => {
	it("renvoie a l'inscription et purge le pseudo quand il est invalide", async () => {
		localStorage.setItem("username", "luffy");
		renderGuard();

		receive({ available: "invalid" });

		expect(localStorage.getItem("username")).toBeNull();
		expect(ctx.navigate).toHaveBeenCalledWith("/", {
			state: { step: "register", returnTo: "/dashboard" },
		});
		expect(await screen.findByText("Pseudo invalide")).toBeInTheDocument();
	});

	it("renvoie a l'accueil quand le pseudo n'est plus disponible", async () => {
		localStorage.setItem("username", "luffy");
		renderGuard();

		receive({ available: false, user_faction: null, username: "luffy" });

		expect(ctx.navigate).toHaveBeenCalledWith("/", { state: { returnTo: "/dashboard" } });
		expect(await screen.findByText("Pseudo indisponible")).toBeInTheDocument();
	});

	it("renvoie a l'inscription quand le pseudo est libre mais sans faction", () => {
		localStorage.setItem("username", "luffy");
		renderGuard();

		receive({ available: true, user_faction: null, username: "luffy" });

		expect(ctx.navigate).toHaveBeenCalledWith("/", {
			state: { step: "register", returnTo: "/dashboard" },
		});
	});

	it("laisse l'utilisateur sur sa page quand tout est en ordre", () => {
		localStorage.setItem("username", "luffy");
		renderGuard();

		receive({ available: true, user_faction: "pirate", username: "luffy" });

		expect(ctx.navigate).not.toHaveBeenCalled();
	});

	it("ignore un payload non exploitable", () => {
		localStorage.setItem("username", "luffy");
		renderGuard();

		receive({ available: true });

		expect(ctx.navigate).not.toHaveBeenCalled();
	});

	it("n'intervient pas quand l'utilisateur est deja sur l'accueil", () => {
		ctx.location = { pathname: "/" };
		renderGuard();

		receive({ available: false, user_faction: null, username: "luffy" });

		expect(ctx.navigate).not.toHaveBeenCalled();
	});
});

describe("useAuthGuard — surveillance du localStorage", () => {
	it("reverifie le pseudo modifie depuis un autre onglet", () => {
		renderGuard();

		act(() => {
			window.dispatchEvent(new StorageEvent("storage", { key: "username", newValue: " zoro " }));
		});

		expect(userEvents.emitCheckUsernameAvailable).toHaveBeenCalledWith("zoro");
	});

	it("renvoie a l'accueil quand un autre onglet efface le pseudo", () => {
		renderGuard();

		act(() => {
			window.dispatchEvent(new StorageEvent("storage", { key: "username", newValue: null }));
		});

		expect(ctx.clearFaction).toHaveBeenCalledTimes(1);
		expect(ctx.navigate).toHaveBeenCalledWith("/");
	});

	it("ignore les modifications d'autres cles", () => {
		renderGuard();

		act(() => {
			window.dispatchEvent(new StorageEvent("storage", { key: "theme", newValue: "dark" }));
		});

		expect(ctx.navigate).not.toHaveBeenCalled();
		expect(userEvents.emitCheckUsernameAvailable).not.toHaveBeenCalled();
	});

	it("detecte une suppression du pseudo dans le meme onglet", () => {
		localStorage.setItem("username", "luffy");
		renderGuard();

		localStorage.removeItem("username");
		act(() => { vi.advanceTimersByTime(1000); });

		expect(ctx.clearFaction).toHaveBeenCalledTimes(1);
		expect(ctx.navigate).toHaveBeenCalledWith("/");
	});

	it("ne surveille pas la suppression sur la page d'accueil", () => {
		ctx.location = { pathname: "/" };
		renderGuard();

		act(() => { vi.advanceTimersByTime(3000); });

		expect(ctx.navigate).not.toHaveBeenCalled();
	});

	it("garde le silence tant que le pseudo est toujours la", () => {
		localStorage.setItem("username", "luffy");
		renderGuard();

		act(() => { vi.advanceTimersByTime(3000); });

		expect(ctx.navigate).not.toHaveBeenCalled();
	});

	it("arrete la surveillance au demontage", () => {
		localStorage.setItem("username", "luffy");
		const { unmount } = renderGuard();
		unmount();

		localStorage.removeItem("username");
		act(() => { vi.advanceTimersByTime(3000); });

		expect(ctx.navigate).not.toHaveBeenCalled();
		expect(ctx.socket.listenerCount("user:ResultUsernameAvailable")).toBe(0);
	});
});
