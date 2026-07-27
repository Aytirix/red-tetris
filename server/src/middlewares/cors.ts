import type { Request, Response, NextFunction } from "express";
import { resolveFrontendOrigin } from "../config/frontendOrigin.js";

export function corsMiddleware(req: Request, res: Response, next: NextFunction) {

	// Une SEULE politique d'origines, en dev comme en prod : celle de `frontendOrigins`
	// (variable FRONTEND_ORIGIN), déjà utilisée par socket.io via `socketConfig`.
	// Auparavant la prod codait en dur `https://red-tetris.com` : le domaine réel de
	// déploiement était donc refusé en HTTP alors qu'il était accepté en WebSocket,
	// et `FRONTEND_ORIGIN` — pourtant injectée dans le service de prod — ne servait à rien.
	res.header("Access-Control-Allow-Origin", resolveFrontendOrigin(req.headers.origin));
	// La réponse dépend de l'en-tête `Origin` : sans ça un cache intermédiaire servirait
	// à tout le monde la réponse calculée pour la première origine vue.
	// `res.vary()` et non `res.header("Vary", …)` : le second REMPLACE, et écraserait
	// un `Vary: Accept-Encoding` posé en amont (par un `compression()`, par exemple).
	res.vary("Origin");

	// Autorise ces méthodes HTTP
	res.header("Access-Control-Allow-Methods", "GET, POST, PUT, OPTIONS");

	// Autorise ce header dans les requêtes
	res.header("Access-Control-Allow-Headers", "Content-Type");

	// Réponse immédiate aux requêtes preflight CORS
	if (req.method === "OPTIONS") {
		res.sendStatus(204);
		return;
	}
	next();
}
