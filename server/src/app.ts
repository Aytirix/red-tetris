import express from "express";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { wsDocsRouter } from "./routes/wsDocs.js";
import { corsMiddleware } from "./middlewares/cors.js";

const currentDir = path.dirname(fileURLToPath(import.meta.url));
function resolveStaticDir(): string | null {
	const candidates = [
		process.env.STATIC_DIR,
		path.resolve(currentDir, "../../frontend/dist"),
	].filter((candidate): candidate is string => Boolean(candidate));

	for (const candidate of candidates) {
		if (fs.existsSync(path.join(candidate, "index.html")))
			return candidate;
	}
	return null;
}

export function createApp(): express.Express {
	const app = express();
	app.use((corsMiddleware));
	app.use(express.json());


	if (process.env.NODE_ENV === "development") {
		app.use(wsDocsRouter);
	}

	const staticDir = resolveStaticDir();
	if (staticDir) {
		app.use(express.static(staticDir));
		// Fallback SPA: les URLs du type /<room>/<player> sont resolues cote client,
		// le serveur doit donc renvoyer index.html pour toute route GET inconnue.
		app.use((req, res, next) => {
			if (req.method !== "GET" && req.method !== "HEAD")
				return next();
			if (req.path.startsWith("/socket.io"))
				return next();
			if (path.extname(req.path) !== "")
				return next();
			res.sendFile(path.join(staticDir, "index.html"));
		});
		console.log(`Serving static frontend from ${staticDir}`);
	} else {
		console.warn("No frontend build found: run 'npm run build' in frontend/ or set STATIC_DIR");
	}

	return app;
}