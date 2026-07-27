import type { Request, Response, NextFunction } from "express";
import { resolveFrontendOrigin } from "../config/frontendOrigin.js";

export function corsMiddleware(req: Request, res: Response, next: NextFunction) {

	// Autorise les requêtes provenant du frontend en développement, et de red-tetris.com en production
	const isDevelopment: boolean = process.env.NODE_ENV === "development";

	if (isDevelopment)
		res.header("Access-Control-Allow-Origin", resolveFrontendOrigin(req.headers.origin));
	else
		res.header("Access-Control-Allow-Origin", "https://red-tetris.com"); // Remplacez par votre domaine de production

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
