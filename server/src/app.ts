import express from "express";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { wsDocsRouter } from "./routes/wsDocs.js";
import { corsMiddleware } from "./middlewares/cors.js";

const currentDir = path.dirname(fileURLToPath(import.meta.url));

// Le sujet impose que le serveur serve lui-meme index.html, le bundle JS et les assets
// statiques via HTTP. STATIC_DIR permet de pointer le build en Docker; sinon on retombe
// sur frontend/dist du depot (meme chemin relatif que l'on tourne via tsx ou via dist/).
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

	// app.get("/", (_req, res) => {
	// 	res.send(`
	// 		<!DOCTYPE html>
	// 		<html>
	// 			<head>
	// 				<title>Socket test</title>
	// 			</head>
	// 			<body>
	// 				<h1>Socket test</h1>
	// 				<script src="/socket.io/socket.io.js"></script>
	// 				<script>
	// 					const socket = io();
	// 					socket.on("connect", () => {
	// 						console.log("connected:", socket.id);
	// 					});
	// 				</script>
	// 			</body>
	// 		</html>
	// 	`);
	// });


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
			// Un asset introuvable doit finir en 404, pas en index.html: sinon le
			// navigateur recoit du text/html la ou il attend un module JS et l'app
			// tombe en page blanche ("expected a JavaScript module script").
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