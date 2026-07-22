import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { createFakeSocket, type FakeSocket } from "../../test/fakeSocket";
import { AlertProvider } from "../components/Alert";

// DocsWsPage importe directement le singleton socket: on le remplace par un faux
// pour ne pas ouvrir de connexion reseau depuis les tests.
const ws = vi.hoisted(() => ({ socket: null as unknown as FakeSocket }));

vi.mock("../socket/socket", () => ({
	get socket() { return ws.socket; },
	registerAllListeners: vi.fn(),
}));

import DocsWsPage from "./DocsWsPage";

type DocEvent = {
	id: string;
	name: string;
	direction: "front-to-back" | "back-to-front";
	group: string;
	description: string;
	payload: string;
	payloadDescription: string;
	response: string;
	responseName: string;
	responseDescription: string;
};

function makeEvent(overrides: Partial<DocEvent> = {}): DocEvent {
	return {
		id: "evt-1",
		name: "user:CheckUsernameAvailable",
		direction: "front-to-back",
		group: "user",
		description: "Verifie la disponibilite d'un pseudo",
		payload: '{"username":"luffy"}',
		payloadDescription: "Le pseudo a verifier",
		response: '{"available":true}',
		responseName: "user:ResultUsernameAvailable",
		responseDescription: "Disponibilite du pseudo",
		...overrides,
	};
}

let fetchMock: ReturnType<typeof vi.fn>;
let docs: DocEvent[];

function jsonResponse(body: unknown) {
	return { json: () => Promise.resolve(body) };
}

function renderDocs() {
	return render(
		<AlertProvider>
			<DocsWsPage />
		</AlertProvider>,
	);
}

/** Rend la page et attend la fin du chargement des events. */
async function renderLoadedDocs() {
	const view = renderDocs();
	await screen.findByText(docs[0].name);
	return view;
}

/** Contenu brut des blocs <pre> (getByText normalise les espaces, pas ceci). */
function preTexts(): (string | null)[] {
	return Array.from(document.querySelectorAll("pre")).map((p) => p.textContent);
}

/** Panneau de la boite de dialogue AlertProvider portant le titre donne. */
async function findConfirmDialog(title: string): Promise<HTMLElement> {
	const heading = await screen.findByText(title);
	return heading.closest("div")!.parentElement as HTMLElement;
}

/** Derniere requete PUT envoyee par la page, deserialisee. */
function lastSavedPayload(): DocEvent[] {
	const puts = fetchMock.mock.calls.filter((call) => (call[1] as RequestInit | undefined)?.method === "PUT");
	const last = puts[puts.length - 1];
	return JSON.parse((last[1] as RequestInit).body as string) as DocEvent[];
}

beforeEach(() => {
	ws.socket = createFakeSocket();
	localStorage.clear();
	docs = [
		makeEvent(),
		makeEvent({
			id: "evt-2",
			name: "game:update",
			direction: "back-to-front",
			group: "game",
			payload: "{ score: number, level: number }",
			response: "",
			responseName: "",
			responseDescription: "",
		}),
	];
	fetchMock = vi.fn((_url: string, init?: RequestInit) =>
		Promise.resolve(init?.method === "PUT" ? jsonResponse({}) : jsonResponse(docs)),
	);
	vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
	cleanup();
	vi.unstubAllGlobals();
	vi.useRealTimers();
});

describe("DocsWsPage — chargement et affichage", () => {
	it("charge la documentation depuis le backend", async () => {
		renderDocs();

		expect(screen.getByText("Chargement...")).toBeInTheDocument();
		expect(await screen.findByText("user:CheckUsernameAvailable")).toBeInTheDocument();
		expect(fetchMock.mock.calls[0][0]).toMatch(/\/ws-docs$/);
	});

	it("repartit les events par direction et compte les groupes", async () => {
		await renderLoadedDocs();

		const badges = document.querySelectorAll(".badge");
		expect(Array.from(badges).map((b) => b.textContent)).toEqual([
			"1 Front → Back",
			"1 Back → Front",
			"2 groupes",
		]);
	});

	it("reformate un payload JSON et laisse un schema libre intact", async () => {
		await renderLoadedDocs();

		expect(preTexts()).toContain('{\n  "username": "luffy"\n}');
		expect(preTexts()).toContain("{ score: number, level: number }");
	});

	it("filtre les events par groupe", async () => {
		await renderLoadedDocs();

		fireEvent.click(screen.getByRole("button", { name: "game (1)" }));
		expect(screen.queryByText("user:CheckUsernameAvailable")).toBeNull();
		expect(screen.getByText("game:update")).toBeInTheDocument();

		// Un second clic sur le groupe actif remet le filtre a zero.
		fireEvent.click(screen.getByRole("button", { name: "game (1)" }));
		expect(screen.getByText("user:CheckUsernameAvailable")).toBeInTheDocument();
	});

	it("revient a la liste complete via le bouton Tous", async () => {
		await renderLoadedDocs();

		fireEvent.click(screen.getByRole("button", { name: "user (1)" }));
		expect(screen.queryByText("game:update")).toBeNull();

		fireEvent.click(screen.getByRole("button", { name: "Tous (2)" }));
		expect(screen.getByText("game:update")).toBeInTheDocument();
	});

	it("regroupe sous « Général » les events sans groupe", async () => {
		docs = [makeEvent({ group: "" })];
		await renderLoadedDocs();

		expect(screen.getByText("Général")).toBeInTheDocument();
	});

	it("affiche un message quand une direction ne contient aucun event", async () => {
		docs = [makeEvent()];
		await renderLoadedDocs();

		expect(screen.getByText("Aucun event documenté")).toBeInTheDocument();
	});

	it("sort du chargement meme si le backend est injoignable", async () => {
		fetchMock.mockImplementation(() => Promise.reject(new Error("offline")));
		renderDocs();

		await waitFor(() => expect(screen.queryByText("Chargement...")).toBeNull());
		// Les deux colonnes (front→back et back→front) sont vides.
		expect(screen.getAllByText("Aucun event documenté")).toHaveLength(2);
	});
});

describe("DocsWsPage — edition de la documentation", () => {
	it("ajoute un event et le persiste via PUT", async () => {
		await renderLoadedDocs();

		fireEvent.click(screen.getByRole("button", { name: "+ Ajouter un event" }));
		fireEvent.change(screen.getByPlaceholderText("user:check-username"), {
			target: { value: "room:join" },
		});
		fireEvent.submit(document.querySelector("form") as HTMLFormElement);

		await waitFor(() => expect(lastSavedPayload()).toHaveLength(3));
		expect(lastSavedPayload()[2].name).toBe("room:join");
	});

	it("pre-remplit le formulaire en modification et remplace l'event existant", async () => {
		await renderLoadedDocs();

		fireEvent.click(screen.getAllByRole("button", { name: "Modifier" })[0]);
		const nameInput = screen.getByPlaceholderText("user:check-username") as HTMLInputElement;
		expect(nameInput.value).toBe("user:CheckUsernameAvailable");

		fireEvent.change(nameInput, { target: { value: "user:Renamed" } });
		fireEvent.submit(document.querySelector("form") as HTMLFormElement);

		await waitFor(() => expect(lastSavedPayload()).toHaveLength(2));
		expect(lastSavedPayload()[0].name).toBe("user:Renamed");
		expect(lastSavedPayload()[0].id).toBe("evt-1");
	});

	it("ferme le formulaire sans rien sauvegarder au clic sur Annuler", async () => {
		await renderLoadedDocs();

		fireEvent.click(screen.getByRole("button", { name: "+ Ajouter un event" }));
		fireEvent.click(screen.getByRole("button", { name: "Annuler" }));

		expect(screen.queryByPlaceholderText("user:check-username")).toBeNull();
		expect(fetchMock.mock.calls.filter((c) => (c[1] as RequestInit)?.method === "PUT")).toHaveLength(0);
	});

	it("propose les groupes existants en autocompletion", async () => {
		await renderLoadedDocs();

		fireEvent.click(screen.getByRole("button", { name: "+ Ajouter un event" }));
		const groupInput = screen.getByPlaceholderText("user, game…") as HTMLInputElement;
		fireEvent.focus(groupInput);
		fireEvent.change(groupInput, { target: { value: "ga" } });

		const suggestion = screen.getByRole("button", { name: "game" });
		fireEvent.mouseDown(suggestion);
		expect(groupInput.value).toBe("game");
	});

	it("supprime un event apres confirmation", async () => {
		await renderLoadedDocs();

		fireEvent.click(screen.getAllByRole("button", { name: "Supprimer" })[0]);
		const dialog = await findConfirmDialog("Supprimer cet event ?");
		fireEvent.click(within(dialog).getByRole("button", { name: "Supprimer" }));

		await waitFor(() => expect(lastSavedPayload()).toHaveLength(1));
		expect(lastSavedPayload()[0].id).toBe("evt-2");
	});

	it("ne supprime rien si la confirmation est annulee", async () => {
		await renderLoadedDocs();

		fireEvent.click(screen.getAllByRole("button", { name: "Supprimer" })[0]);
		const dialog = await findConfirmDialog("Supprimer cet event ?");
		fireEvent.click(within(dialog).getByRole("button", { name: "Annuler" }));

		await waitFor(() => expect(screen.queryByText("Cette action est irréversible.")).toBeNull());
		expect(fetchMock.mock.calls.filter((c) => (c[1] as RequestInit)?.method === "PUT")).toHaveLength(0);
	});

	it("insere une indentation au lieu de changer de champ sur Tab dans le payload", async () => {
		await renderLoadedDocs();

		fireEvent.click(screen.getByRole("button", { name: "+ Ajouter un event" }));
		const payload = document.querySelectorAll("textarea")[2] as HTMLTextAreaElement;
		payload.selectionStart = 0;
		payload.selectionEnd = 0;
		fireEvent.keyDown(payload, { key: "Tab" });

		expect(payload.value.startsWith("  ")).toBe(true);
	});

	it("insere un saut de ligne sur Tab dans la description", async () => {
		await renderLoadedDocs();

		fireEvent.click(screen.getByRole("button", { name: "+ Ajouter un event" }));
		const description = document.querySelectorAll("textarea")[0] as HTMLTextAreaElement;
		fireEvent.change(description, { target: { value: "ligne" } });
		description.selectionStart = 5;
		description.selectionEnd = 5;
		fireEvent.keyDown(description, { key: "Tab" });

		expect(description.value).toBe("ligne\n");
	});

	it("laisse passer les autres touches dans les textareas", async () => {
		await renderLoadedDocs();

		fireEvent.click(screen.getByRole("button", { name: "+ Ajouter un event" }));
		const description = document.querySelectorAll("textarea")[0] as HTMLTextAreaElement;
		fireEvent.change(description, { target: { value: "abc" } });
		fireEvent.keyDown(description, { key: "a" });

		expect(description.value).toBe("abc");
	});
});

describe("DocsWsPage — banc de test des events", () => {
	async function openTestModal() {
		await renderLoadedDocs();
		fireEvent.click(screen.getByRole("button", { name: "Tester" }));
		return screen.getByText("Tester l'event").closest("div")!.parentElement as HTMLElement;
	}

	it("n'offre le bouton Tester que pour les events front → back", async () => {
		await renderLoadedDocs();
		expect(screen.getAllByRole("button", { name: "Tester" })).toHaveLength(1);
	});

	it("pre-remplit le payload et emet l'event au clic sur Envoyer", async () => {
		await openTestModal();

		fireEvent.click(screen.getByRole("button", { name: "Envoyer le payload" }));

		expect(ws.socket.emitted()).toContainEqual([
			"user:CheckUsernameAvailable",
			{ username: "luffy" },
		]);
		expect(screen.getByText("Event envoyé. En attente de user:ResultUsernameAvailable...")).toBeInTheDocument();
	});

	it("affiche la reponse recue du backend", async () => {
		await openTestModal();
		fireEvent.click(screen.getByRole("button", { name: "Envoyer le payload" }));

		act(() => { ws.socket.receive("user:ResultUsernameAvailable", { available: false }); });

		expect(screen.getByText("Réponse user:ResultUsernameAvailable reçue.")).toBeInTheDocument();
		expect(preTexts()).toContain('{\n  "available": false\n}');
	});

	it("passe en timeout apres 10 secondes sans reponse", async () => {
		vi.useFakeTimers({ shouldAdvanceTime: true });
		await openTestModal();
		fireEvent.click(screen.getByRole("button", { name: "Envoyer le payload" }));

		act(() => { vi.advanceTimersByTime(10_000); });

		expect(
			screen.getByText("Aucune réponse user:ResultUsernameAvailable reçue après 10 secondes."),
		).toBeInTheDocument();
	});

	it("refuse un payload JSON invalide", async () => {
		await openTestModal();
		const payload = screen.getAllByPlaceholderText('{"key": "value"}')[0];
		fireEvent.change(payload, { target: { value: "{invalide" } });

		fireEvent.click(screen.getByRole("button", { name: "Envoyer le payload" }));

		expect(screen.getByText("Le payload de test doit être un JSON valide.")).toBeInTheDocument();
		expect(ws.socket.emitted()).toHaveLength(0);
	});

	it("refuse d'envoyer quand le socket n'est pas connecte", async () => {
		await openTestModal();
		ws.socket.connected = false;

		fireEvent.click(screen.getByRole("button", { name: "Envoyer le payload" }));

		expect(screen.getByText("Socket non connecté au backend.")).toBeInTheDocument();
		expect(ws.socket.emitted()).toHaveLength(0);
	});

	it("emet l'event sans argument quand le payload est vide", async () => {
		docs = [makeEvent({ payload: "", responseName: "", response: "" })];
		await renderLoadedDocs();
		fireEvent.click(screen.getByRole("button", { name: "Tester" }));

		fireEvent.click(screen.getByRole("button", { name: "Envoyer le payload" }));

		expect(ws.socket.emitted()).toContainEqual(["user:CheckUsernameAvailable"]);
		expect(screen.getByText("Event envoyé. Aucune réponse attendue.")).toBeInTheDocument();
	});

	it("envoie une reponse mock au backend", async () => {
		await openTestModal();
		const mockField = screen.getAllByPlaceholderText('{"key": "value"}')[1];
		fireEvent.change(mockField, { target: { value: '{"available":false}' } });

		fireEvent.click(screen.getByRole("button", { name: "Envoyer la réponse mock" }));

		expect(ws.socket.emitted()).toContainEqual([
			"__docsWs:emitMockResponse",
			{
				eventName: "user:CheckUsernameAvailable",
				responseName: "user:ResultUsernameAvailable",
				response: { available: false },
				requestPayload: { username: "luffy" },
			},
		]);
	});

	it("refuse une reponse mock JSON invalide", async () => {
		await openTestModal();
		const mockField = screen.getAllByPlaceholderText('{"key": "value"}')[1];
		fireEvent.change(mockField, { target: { value: "{{" } });

		fireEvent.click(screen.getByRole("button", { name: "Envoyer la réponse mock" }));

		expect(screen.getByText("La réponse mock doit être un JSON valide.")).toBeInTheDocument();
	});

	it("memorise la reponse mock modifiee dans le localStorage", async () => {
		await openTestModal();
		const mockField = screen.getAllByPlaceholderText('{"key": "value"}')[1];

		fireEvent.change(mockField, { target: { value: '{"available":false}' } });
		expect(localStorage.getItem("docsWs:mock:evt-1")).toBe('{"available":false}');

		// Revenir a la valeur d'origine efface l'entree.
		fireEvent.change(mockField, { target: { value: '{\n  "available": true\n}' } });
		expect(localStorage.getItem("docsWs:mock:evt-1")).toBeNull();
	});

	it("repond automatiquement quand le mode auto est actif et le mock modifie", async () => {
		await openTestModal();
		fireEvent.change(screen.getAllByPlaceholderText('{"key": "value"}')[1], {
			target: { value: '{"available":false}' },
		});
		fireEvent.click(screen.getByRole("button", { name: "Réponse automatique" }));
		fireEvent.click(screen.getByRole("button", { name: "Fermer" }));

		act(() => { ws.socket.emit("user:CheckUsernameAvailable", { username: "zoro" }); });

		expect(ws.socket.emitted()).toContainEqual([
			"__docsWs:emitMockResponse",
			{
				eventName: "user:CheckUsernameAvailable",
				responseName: "user:ResultUsernameAvailable",
				response: { available: false },
				requestPayload: { username: "zoro" },
			},
		]);
		expect(JSON.parse(localStorage.getItem("docsWs:autoMockEvents") as string)).toEqual(["evt-1"]);
	});

	it("ne repond pas automatiquement tant que le mock n'a pas ete modifie", async () => {
		await openTestModal();
		fireEvent.click(screen.getByRole("button", { name: "Réponse automatique" }));
		fireEvent.click(screen.getByRole("button", { name: "Fermer" }));
		ws.socket.reset();

		act(() => { ws.socket.emit("user:CheckUsernameAvailable", { username: "zoro" }); });

		expect(ws.socket.emitted().map((call) => call[0])).not.toContain("__docsWs:emitMockResponse");
	});

	it("desactive le mode auto au second clic", async () => {
		await openTestModal();
		fireEvent.click(screen.getByRole("button", { name: "Réponse automatique" }));
		fireEvent.click(screen.getByRole("button", { name: "Réponse automatique" }));

		expect(JSON.parse(localStorage.getItem("docsWs:autoMockEvents") as string)).toEqual([]);
	});

	it("ferme le banc de test avec la croix", async () => {
		await openTestModal();

		fireEvent.click(screen.getByRole("button", { name: "×" }));

		expect(screen.queryByText("Tester l'event")).toBeNull();
	});
});

describe("DocsWsPage — journal WebSocket", () => {
	it("journalise les events entrants et sortants", async () => {
		await renderLoadedDocs();

		act(() => { ws.socket.receive("room:joined", { players: [] }); });
		act(() => { ws.socket.emit("room:join", { roomId: "r1" }); });

		const logs = screen.getByText("Logs WS").closest("section") as HTMLElement;
		expect(within(logs).getByText("room:joined")).toBeInTheDocument();
		expect(within(logs).getByText("room:join")).toBeInTheDocument();
		expect(within(logs).getByText("in")).toBeInTheDocument();
		expect(within(logs).getByText("out")).toBeInTheDocument();
	});

	it("journalise les deconnexions et les erreurs de connexion", async () => {
		await renderLoadedDocs();

		act(() => { ws.socket.receive("disconnect", "transport close"); });
		act(() => { ws.socket.receive("connect_error", new Error("boom")); });

		const logs = screen.getByText("Logs WS").closest("section") as HTMLElement;
		expect(within(logs).getByText("disconnect")).toBeInTheDocument();
		expect(within(logs).getByText("connect_error")).toBeInTheDocument();
	});

	it("n'affiche pas les events internes du banc de test", async () => {
		await renderLoadedDocs();

		act(() => { ws.socket.emit("__docsWs:emitMockResponse", { eventName: "x" }); });

		expect(screen.getByText("Aucun log WebSocket pour le moment.")).toBeInTheDocument();
	});

	it("ignore un event sans payload exploitable", async () => {
		await renderLoadedDocs();

		act(() => { ws.socket.receive("room:left"); });

		expect(screen.getByText("Aucun log WebSocket pour le moment.")).toBeInTheDocument();
	});

	it("vide le journal a la demande", async () => {
		await renderLoadedDocs();
		act(() => { ws.socket.receive("room:joined", { players: [] }); });

		fireEvent.click(screen.getByRole("button", { name: "Vider" }));

		expect(screen.getByText("Aucun log WebSocket pour le moment.")).toBeInTheDocument();
	});

	it("affiche l'etat de connexion du socket", async () => {
		ws.socket.connected = false;
		await renderLoadedDocs();

		expect(screen.getByText("Socket non connecté")).toBeInTheDocument();
	});
});
