import express from "express";
import { wsDocsRouter } from "./routes/wsDocs.js";

export function createApp(): express.Express {
	const app = express();

	app.use((req, res, next) => {
		res.header("Access-Control-Allow-Origin", "*");
		res.header("Access-Control-Allow-Methods", "GET, POST, PUT, OPTIONS");
		res.header("Access-Control-Allow-Headers", "Content-Type");
		if (req.method === "OPTIONS") { res.sendStatus(204); return; }
		next();
	});

	app.use(express.json());

	app.get("/", (req, res) => {
		res.send("Red Tetris Server");
	});

	app.use(wsDocsRouter);

	return app;
}