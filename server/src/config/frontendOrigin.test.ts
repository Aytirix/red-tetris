import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

async function loadModule() {
	vi.resetModules();
	return await import("./frontendOrigin.js");
}

describe("frontendOrigin", () => {
	beforeEach(() => {
		vi.unstubAllEnvs();
	});

	afterEach(() => {
		vi.unstubAllEnvs();
		vi.resetModules();
	});

	describe("frontendOrigins (default)", () => {
		it("falls back to localhost:5173 and 127.0.0.1:5173", async () => {
			vi.stubEnv("FRONTEND_ORIGIN", "");
			vi.stubEnv("PORT_DEV_FRONTEND", "");
			const { frontendOrigins } = await loadModule();
			expect(frontendOrigins).toEqual(["http://localhost:5173", "http://127.0.0.1:5173"]);
		});

		it("uses PORT_DEV_FRONTEND when provided", async () => {
			vi.stubEnv("FRONTEND_ORIGIN", "");
			vi.stubEnv("PORT_DEV_FRONTEND", "4242");
			const { frontendOrigins } = await loadModule();
			expect(frontendOrigins).toEqual(["http://localhost:4242", "http://127.0.0.1:4242"]);
		});
	});

	describe("frontendOrigins (configured)", () => {
		it("splits FRONTEND_ORIGIN on commas and trims each entry", async () => {
			vi.stubEnv("FRONTEND_ORIGIN", "https://a.com , https://b.com");
			const { frontendOrigins } = await loadModule();
			expect(frontendOrigins).toEqual(["https://a.com", "https://b.com"]);
		});

		it("drops empty entries and falls back when nothing is left", async () => {
			vi.stubEnv("FRONTEND_ORIGIN", ",,");
			vi.stubEnv("PORT_DEV_FRONTEND", "5173");
			const { frontendOrigins } = await loadModule();
			expect(frontendOrigins).toEqual(["http://localhost:5173", "http://127.0.0.1:5173"]);
		});
	});

	describe("resolveFrontendOrigin", () => {
		it("returns the origin when it is allowed", async () => {
			vi.stubEnv("FRONTEND_ORIGIN", "https://red-tetris.com,https://staging.red-tetris.com");
			const { resolveFrontendOrigin } = await loadModule();
			expect(resolveFrontendOrigin("https://staging.red-tetris.com")).toBe("https://staging.red-tetris.com");
		});

		it("returns the first allowed origin when the origin is unknown", async () => {
			vi.stubEnv("FRONTEND_ORIGIN", "https://red-tetris.com,https://staging.red-tetris.com");
			const { resolveFrontendOrigin } = await loadModule();
			expect(resolveFrontendOrigin("https://evil.com")).toBe("https://red-tetris.com");
		});

		it("returns the first allowed origin when no origin is given", async () => {
			vi.stubEnv("FRONTEND_ORIGIN", "");
			vi.stubEnv("PORT_DEV_FRONTEND", "5173");
			const { resolveFrontendOrigin } = await loadModule();
			expect(resolveFrontendOrigin(undefined)).toBe("http://localhost:5173");
		});
	});

	describe("socketConfig", () => {
		it("exposes the CORS configuration of the socket server", async () => {
			vi.resetModules();
			const { socketConfig } = await import("./socketConfig.js");
			const { frontendOrigins } = await import("./frontendOrigin.js");
			expect(socketConfig.cors.origin).toEqual(frontendOrigins);
			expect(socketConfig.cors.methods).toEqual(["GET", "POST"]);
		});
	});
});
