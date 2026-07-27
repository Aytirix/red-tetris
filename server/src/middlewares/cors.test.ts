import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { NextFunction, Request, Response } from "express";
import { corsMiddleware } from "./cors.js";

function makeRes() {
	const headers = new Map<string, string>();
	const res = {
		header: vi.fn((name: string, value: string) => {
			headers.set(name, value);
			return res;
		}),
		// `vary()` AJOUTE au champ existant (contrairement a header/set, qui
		// remplacent) : on reproduit ce comportement pour que le test detecte un
		// retour a `res.header("Vary", …)`.
		vary: vi.fn((field: string) => {
			const current = headers.get("Vary");
			const values = current ? current.split(", ") : [];
			if (!values.includes(field))
				values.push(field);
			headers.set("Vary", values.join(", "));
			return res;
		}),
		sendStatus: vi.fn(),
	};
	return { res: res as unknown as Response, headers, raw: res };
}

function makeReq(method = "GET", origin?: string): Request {
	return { method, headers: origin ? { origin } : {} } as unknown as Request;
}

describe("corsMiddleware", () => {
	beforeEach(() => {
		vi.unstubAllEnvs();
	});

	afterEach(() => {
		vi.unstubAllEnvs();
	});

	it("allows the frontend origin in development", () => {
		vi.stubEnv("NODE_ENV", "development");
		const { res, headers } = makeRes();
		const next = vi.fn() as unknown as NextFunction;

		corsMiddleware(makeReq("GET", "http://localhost:5173"), res, next);

		expect(headers.get("Access-Control-Allow-Origin")).toBe("http://localhost:5173");
		expect(next).toHaveBeenCalledTimes(1);
	});

	it("falls back to the first allowed origin for an unknown origin in development", () => {
		vi.stubEnv("NODE_ENV", "development");
		const { res, headers } = makeRes();

		corsMiddleware(makeReq("GET", "http://evil.com"), res, vi.fn() as unknown as NextFunction);

		expect(headers.get("Access-Control-Allow-Origin")).toBe("http://localhost:5173");
	});

	// B7: la prod codait en dur `https://red-tetris.com` et ignorait FRONTEND_ORIGIN,
	// alors que socket.io s'appuyait dessus -> deux politiques CORS incoherentes.
	it("applies the configured origins outside of development too", () => {
		vi.stubEnv("NODE_ENV", "production");
		const { res, headers } = makeRes();

		corsMiddleware(makeReq("GET", "http://localhost:5173"), res, vi.fn() as unknown as NextFunction);

		expect(headers.get("Access-Control-Allow-Origin")).toBe("http://localhost:5173");
	});

	it("never pins the hardcoded production domain", () => {
		vi.stubEnv("NODE_ENV", "production");
		const { res, headers } = makeRes();

		corsMiddleware(makeReq("GET", "https://red-tetris.com"), res, vi.fn() as unknown as NextFunction);

		// L'origine n'est pas dans `frontendOrigins` -> repli, jamais un echo aveugle.
		expect(headers.get("Access-Control-Allow-Origin")).toBe("http://localhost:5173");
	});

	it("marks the response as varying on Origin", () => {
		const { res, headers } = makeRes();

		corsMiddleware(makeReq("GET", "http://localhost:5173"), res, vi.fn() as unknown as NextFunction);

		expect(headers.get("Vary")).toBe("Origin");
	});

	// `res.header("Vary", …)` REMPLACE : il effacerait un Vary pose en amont (par un
	// `compression()`, par exemple). Seul `res.vary()` ajoute.
	it("preserves a Vary header already set upstream", () => {
		const { res, headers } = makeRes();
		headers.set("Vary", "Accept-Encoding");

		corsMiddleware(makeReq("GET", "http://localhost:5173"), res, vi.fn() as unknown as NextFunction);

		expect(headers.get("Vary")).toBe("Accept-Encoding, Origin");
	});

	it("always sets the allowed methods and headers", () => {
		const { res, headers } = makeRes();

		corsMiddleware(makeReq(), res, vi.fn() as unknown as NextFunction);

		expect(headers.get("Access-Control-Allow-Methods")).toBe("GET, POST, PUT, OPTIONS");
		expect(headers.get("Access-Control-Allow-Headers")).toBe("Content-Type");
	});

	it("answers 204 to a preflight request without calling next", () => {
		const { res, raw } = makeRes();
		const next = vi.fn() as unknown as NextFunction;

		corsMiddleware(makeReq("OPTIONS"), res, next);

		expect(raw.sendStatus).toHaveBeenCalledWith(204);
		expect(next).not.toHaveBeenCalled();
	});

	it("calls next for a normal request", () => {
		const { res, raw } = makeRes();
		const next = vi.fn() as unknown as NextFunction;

		corsMiddleware(makeReq("POST"), res, next);

		expect(raw.sendStatus).not.toHaveBeenCalled();
		expect(next).toHaveBeenCalledTimes(1);
	});
});
