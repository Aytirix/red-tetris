import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import type { AddressInfo } from "node:net";
import { createApp } from "./app.js";
let server: http.Server;
let baseUrl: string;
let staticDir: string;

async function get(pathname: string): Promise<{ status: number; contentType: string; body: string }> {
	const response = await fetch(`${baseUrl}${pathname}`);
	return {
		status: response.status,
		contentType: response.headers.get("content-type") ?? "",
		body: await response.text(),
	};
}

describe("createApp — service HTTP reel des fichiers statiques", () => {
	beforeAll(async () => {
		staticDir = fs.mkdtempSync(path.join(os.tmpdir(), "red-tetris-http-"));
		fs.mkdirSync(path.join(staticDir, "assets"));
		fs.writeFileSync(path.join(staticDir, "index.html"), "<!doctype html><title>red tetris</title>");
		fs.writeFileSync(path.join(staticDir, "assets", "bundle.js"), "export const app = 1;\n");
		fs.writeFileSync(path.join(staticDir, "assets", "style.css"), ".cell{color:red}\n");

		vi.stubEnv("STATIC_DIR", staticDir);
		vi.spyOn(console, "log").mockImplementation(() => undefined);
		const app = createApp();
		server = http.createServer(app);
		await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
		baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
	});

	afterAll(async () => {
		await new Promise<void>((resolve) => server.close(() => resolve()));
		fs.rmSync(staticDir, { recursive: true, force: true });
		vi.unstubAllEnvs();
		vi.restoreAllMocks();
	});

	it("sert index.html a la racine", async () => {
		const response = await get("/");
		expect(response.status).toBe(200);
		expect(response.contentType).toContain("text/html");
		expect(response.body).toContain("red tetris");
	});

	it("sert le bundle JS avec le bon content-type", async () => {
		const response = await get("/assets/bundle.js");
		expect(response.status).toBe(200);
		expect(response.contentType).toContain("javascript");
		expect(response.body).toContain("export const app");
	});

	it("sert les autres assets statiques", async () => {
		const response = await get("/assets/style.css");
		expect(response.status).toBe(200);
		expect(response.contentType).toContain("text/css");
	});

	it("renvoie index.html sur l'URL de partie /<room>/<player>", async () => {
		const response = await get("/salle1/luffy");
		expect(response.status).toBe(200);
		expect(response.contentType).toContain("text/html");
		expect(response.body).toContain("red tetris");
	});

	it("renvoie 404 pour un asset introuvable, jamais index.html", async () => {
		const response = await get("/assets/inexistant.js");
		expect(response.status).toBe(404);
		expect(response.body).not.toContain("red tetris");
	});

	it("n'avale pas les routes socket.io", async () => {
		const response = await get("/socket.io/?EIO=4&transport=polling");
		// Aucun serveur socket.io n'est attache ici: ce qui compte est que le
		// fallback SPA ne reponde pas index.html a sa place.
		expect(response.body).not.toContain("red tetris");
	});

	it("ne sert rien hors du repertoire statique (pas de path traversal)", async () => {
		const secret = path.join(staticDir, "..", "hors-perimetre.txt");
		fs.writeFileSync(secret, "secret");
		try {
			for (const attack of ["/../hors-perimetre.txt", "/%2e%2e/hors-perimetre.txt"]) {
				const response = await get(attack);
				expect(response.body).not.toContain("secret");
			}
		} finally {
			fs.rmSync(secret, { force: true });
		}
	});

	it("ne repond au fallback SPA que pour GET et HEAD", async () => {
		const response = await fetch(`${baseUrl}/salle1/luffy`, { method: "POST" });
		expect(response.status).toBe(404);
	});
});
