import { Router } from "express";
import type { Request, Response } from "express";
import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DOCS_PATH = path.resolve(__dirname, "../../ws-docs.json");

export const wsDocsRouter = Router();

wsDocsRouter.get("/ws-docs", async (_req: Request, res: Response) => {
	try {
		const data = await fs.readFile(DOCS_PATH, "utf-8");
		res.json(JSON.parse(data));
	} catch {
		res.json([]);
	}
});

wsDocsRouter.put("/ws-docs", async (req: Request, res: Response) => {
	try {
		await fs.writeFile(DOCS_PATH, JSON.stringify(req.body, null, 2));
		res.json({ ok: true });
	} catch {
		res.status(500).json({ error: "Failed to save" });
	}
});
