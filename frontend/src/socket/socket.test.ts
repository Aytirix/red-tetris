import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { ioMock, fakeSocket } = vi.hoisted(() => {
	const fakeSocket = {
		on: vi.fn(),
		off: vi.fn(),
		emit: vi.fn(),
		connected: false,
	};
	return { ioMock: vi.fn(() => fakeSocket), fakeSocket };
});

vi.mock("socket.io-client", () => ({
	io: ioMock,
	Socket: class {},
}));

import { DEV_BACKEND_PORT } from "../config/backendUrl";
import { socket } from "./socket";

describe("socket (singleton)", () => {
	beforeEach(() => {
		fakeSocket.on.mockClear();
		vi.spyOn(console, "log").mockImplementation(() => {});
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	it("cree une seule connexion au chargement du module", () => {
		expect(ioMock).toHaveBeenCalledTimes(1);
		expect(socket).toBe(fakeSocket);
	});

	it("cible le backend sur l'hote courant avec autoConnect", () => {
		const [url, options] = ioMock.mock.calls[0] as unknown as [string, Record<string, unknown>];

		expect(url.startsWith(`${window.location.protocol}//${window.location.hostname}:`)).toBe(true);
		expect(url).toBe(
			`${window.location.protocol}//${window.location.hostname}:${DEV_BACKEND_PORT}`,
		);
		expect(options).toEqual({ autoConnect: true });
	});

	// B9: `VITE_PORT` n'est injectee qu'au build Docker. Sans repli, un `npm run dev`
	// lance a la main produisait `http://<host>:undefined` et le socket ne se
	// connectait jamais — panne silencieuse, aucun test ne la voyait.
	it("ne construit jamais une URL avec un port indefini", () => {
		const [url] = ioMock.mock.calls[0] as unknown as [string];

		expect(url).not.toContain("undefined");
		expect(DEV_BACKEND_PORT).toBeTruthy();
	});

	// Le module ne doit brancher AUCUN listener global: chaque page abonne et
	// desabonne les siens. Des listeners globaux qui ne font que journaliser sont
	// revenus deux fois dans l'historique du projet — ce test ferme la porte.
	it("ne branche aucun listener global au chargement", () => {
		expect(fakeSocket.on).not.toHaveBeenCalled();
	});
});
