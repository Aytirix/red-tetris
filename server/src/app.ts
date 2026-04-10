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

	app.get("/", (_req, res) => {
		res.send(`
			<!DOCTYPE html>
			<html>
				<head>
					<title>Socket test</title>
				</head>
				<body>
					<h1>Socket test</h1>
					<script src="/socket.io/socket.io.js"></script>
					<script>
						const socket = io();
						socket.on("connect", () => {
							console.log("connected:", socket.id);
						});
					</script>
				</body>
			</html>
		`);
	});

	app.use(wsDocsRouter);

	return app;
}