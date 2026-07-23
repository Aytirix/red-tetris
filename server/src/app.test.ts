import { describe, it, expect, vi, beforeAll, afterAll, beforeEach, afterEach } from "vitest";
import type { NextFunction, Request, Response } from "express";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createApp } from "./app.js";

type Layer = { name: string; handle: (req: Request, res: Response, next: NextFunction) => void };

function layers(app: ReturnType<typeof createApp>): Layer[] {
	return (app as unknown as { router: { stack: Layer[] } }).router.stack;
}

let staticDir: string;

describe("createApp", () => {
	beforeAll(() => {
		staticDir = fs.mkdtempSync(path.join(os.tmpdir(), "red-tetris-static-"));
		fs.writeFileSync(path.join(staticDir, "index.html"), "<!doctype html><title>red tetris</title>");
	});

	afterAll(() => {
		fs.rmSync(staticDir, { recursive: true, force: true });
	});

	beforeEach(() => {
		vi.unstubAllEnvs();
		vi.spyOn(console, "log").mockImplementation(() => undefined);
		vi.spyOn(console, "warn").mockImplementation(() => undefined);
	});

	afterEach(() => {
		vi.unstubAllEnvs();
		vi.restoreAllMocks();
	});

	it("returns an express application", () => {
		vi.stubEnv("STATIC_DIR", staticDir);
		const app = createApp();
		expect(typeof app).toBe("function");
		expect(layers(app).length).toBeGreaterThan(0);
	});

	it("serves the frontend build pointed by STATIC_DIR", () => {
		vi.stubEnv("STATIC_DIR", staticDir);

		createApp();

		expect(console.log).toHaveBeenCalledWith(`Serving static frontend from ${staticDir}`);
	});

	it("warns when no frontend build is found", () => {
		vi.stubEnv("STATIC_DIR", path.join(staticDir, "nexiste-pas"));
		vi.spyOn(fs, "existsSync").mockReturnValue(false);

		createApp();

		expect(console.warn).toHaveBeenCalledWith(
			"No frontend build found: run 'npm run build' in frontend/ or set STATIC_DIR",
		);
	});

	it("mounts the ws-docs router only in development", () => {
		vi.stubEnv("STATIC_DIR", staticDir);

		vi.stubEnv("NODE_ENV", "production");
		const production = layers(createApp()).length;

		vi.stubEnv("NODE_ENV", "development");
		const development = layers(createApp()).length;

		expect(development).toBe(production + 1);
	});

	describe("SPA fallback", () => {
		function fallbackOf(app: ReturnType<typeof createApp>): Layer["handle"] {
			const stack = layers(app);
			return stack[stack.length - 1]!.handle;
		}

		function run(method: string, urlPath: string) {
			vi.stubEnv("STATIC_DIR", staticDir);
			const fallback = fallbackOf(createApp());
			const res = { sendFile: vi.fn() } as unknown as Response & { sendFile: ReturnType<typeof vi.fn> };
			const next = vi.fn() as unknown as NextFunction;
			fallback({ method, path: urlPath } as Request, res, next);
			return { res, next };
		}

		it("serves index.html for an unknown GET route (/room/player)", () => {
			const { res, next } = run("GET", "/salle1/luffy");
			expect(res.sendFile).toHaveBeenCalledWith(path.join(staticDir, "index.html"));
			expect(next).not.toHaveBeenCalled();
		});

		it("serves index.html for a HEAD request", () => {
			const { res } = run("HEAD", "/salle1/luffy");
			expect(res.sendFile).toHaveBeenCalledWith(path.join(staticDir, "index.html"));
		});

		it("delegates a non GET/HEAD request", () => {
			const { res, next } = run("POST", "/api/quelquechose");
			expect(res.sendFile).not.toHaveBeenCalled();
			expect(next).toHaveBeenCalledTimes(1);
		});

		it("never swallows the socket.io routes", () => {
			const { res, next } = run("GET", "/socket.io/?EIO=4");
			expect(res.sendFile).not.toHaveBeenCalled();
			expect(next).toHaveBeenCalledTimes(1);
		});
	});
});
