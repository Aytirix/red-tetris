import { afterEach, describe, expect, it, vi } from "vitest";
import type { LoaderFunction, RouteObject } from "react-router-dom";

// Le routeur importe toutes les pages, dont certaines tirent le singleton socket:
// on neutralise la couche reseau pour que l'import reste hors-ligne.
vi.mock("socket.io-client", () => ({
	io: () => ({ on: vi.fn(), off: vi.fn(), emit: vi.fn(), onAny: vi.fn(), offAny: vi.fn(), connected: false }),
	Socket: class {},
}));

import { router } from "./router";

const rootRoute = router.routes[0] as RouteObject;
const children = (rootRoute.children ?? []) as RouteObject[];
const paths = children.map((route) => route.path ?? (route.index ? "(index)" : ""));

afterEach(() => { localStorage.clear(); });

describe("router", () => {
	it("declare une seule racine avec sa page d'erreur", () => {
		expect(router.routes).toHaveLength(1);
		expect(rootRoute.path).toBe("/");
		expect(rootRoute.errorElement).toBeDefined();
	});

	it("expose les routes applicatives dans l'ordre attendu", () => {
		expect(paths).toEqual([
			"(index)",
			"dashboard",
			"theme",
			"docs-ws",
			":roomName/:playerName",
			"*",
		]);
	});

	it("place la route attrape-tout en dernier", () => {
		expect(paths[paths.length - 1]).toBe("*");
	});

	it("monte la route de developpement docs-ws sous vitest", () => {
		expect(paths).toContain("docs-ws");
	});

	it("n'expose plus la route /test (detection de mains supprimee)", () => {
		expect(paths).not.toContain("test");
	});

	it("memorise le pseudo de l'URL avant d'ouvrir la room", () => {
		const gameRoute = children.find((route) => route.path === ":roomName/:playerName") as RouteObject;
		const loader = gameRoute.loader as LoaderFunction;

		const result = loader({ params: { roomName: "room-42", playerName: "luffy" } } as never);

		expect(localStorage.getItem("username")).toBe("luffy");
		expect(result).toBeNull();
	});

	it("n'ecrase pas le pseudo memorise quand l'URL n'en fournit pas", () => {
		localStorage.setItem("username", "zoro");
		const gameRoute = children.find((route) => route.path === ":roomName/:playerName") as RouteObject;
		const loader = gameRoute.loader as LoaderFunction;

		loader({ params: { roomName: "room-42" } } as never);

		expect(localStorage.getItem("username")).toBe("zoro");
	});
});
