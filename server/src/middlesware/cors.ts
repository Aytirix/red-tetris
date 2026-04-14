import type { Request, Response, NextFunction } from "express";

export function corsMiddleware(req: Request, res: Response, next: NextFunction) {

	// Autorise les requêtes provenant de localhost:5173 en développement, et de red-tetris.com en production
	const isDevelopment: boolean = process.env.NODE_ENV === "development";

	if (isDevelopment)
		res.header("Access-Control-Allow-Origin", "http://localhost:5173");
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