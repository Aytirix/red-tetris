import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Request, Response } from "express";

vi.mock("fs/promises", () => ({
	default: {
		readFile: vi.fn(),
		writeFile: vi.fn(),
	},
}));

import fs from "fs/promises";
import { wsDocsRouter } from "./wsDocs.js";

type RouteHandler = (req: Request, res: Response) => Promise<void>;
type Layer = { route?: { path: string; methods: Record<string, boolean>; stack: { handle: RouteHandler }[] } };

function getHandler(method: "get" | "put"): RouteHandler {
	const stack = (wsDocsRouter as unknown as { stack: Layer[] }).stack;
	const layer = stack.find((current) => current.route?.path === "/ws-docs" && current.route.methods[method]);
	if (!layer?.route) throw new Error(`route ${method} /ws-docs not found`);
	return layer.route.stack[0]!.handle;
}

function makeRes() {
	const res = {
		json: vi.fn(() => res),
		status: vi.fn(() => res),
	};
	return res as unknown as Response & { json: ReturnType<typeof vi.fn>; status: ReturnType<typeof vi.fn> };
}

describe("wsDocsRouter", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("declares GET and PUT on /ws-docs", () => {
		expect(() => getHandler("get")).not.toThrow();
		expect(() => getHandler("put")).not.toThrow();
	});

	describe("GET /ws-docs", () => {
		it("returns the parsed documentation file", async () => {
			vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify([{ name: "user:Register" }]) as never);
			const res = makeRes();

			await getHandler("get")({} as Request, res);

			expect(res.json).toHaveBeenCalledWith([{ name: "user:Register" }]);
		});

		it("returns an empty list when the file cannot be read", async () => {
			vi.mocked(fs.readFile).mockRejectedValue(new Error("ENOENT"));
			const res = makeRes();

			await getHandler("get")({} as Request, res);

			expect(res.json).toHaveBeenCalledWith([]);
		});

		it("returns an empty list when the file is not valid JSON", async () => {
			vi.mocked(fs.readFile).mockResolvedValue("{ pas du json" as never);
			const res = makeRes();

			await getHandler("get")({} as Request, res);

			expect(res.json).toHaveBeenCalledWith([]);
		});
	});

	describe("PUT /ws-docs", () => {
		it("writes the body and confirms", async () => {
			vi.mocked(fs.writeFile).mockResolvedValue(undefined as never);
			const res = makeRes();
			const body = [{ name: "room:join" }];

			await getHandler("put")({ body } as Request, res);

			expect(vi.mocked(fs.writeFile).mock.calls[0]![1]).toBe(JSON.stringify(body, null, 2));
			expect(res.json).toHaveBeenCalledWith({ ok: true });
		});

		it("answers 500 when the write fails", async () => {
			vi.mocked(fs.writeFile).mockRejectedValue(new Error("EACCES"));
			const res = makeRes();

			await getHandler("put")({ body: [] } as Request, res);

			expect(res.status).toHaveBeenCalledWith(500);
			expect(res.json).toHaveBeenCalledWith({ error: "Failed to save" });
		});
	});
});
