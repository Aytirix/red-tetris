import express from "express";
import { wsDocsRouter } from "./routes/wsDocs.js";
import { corsMiddleware } from "./middlesware/cors.js";

export function createApp(): express.Express {
	const app = express();
	app.use((corsMiddleware));

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

	return app;
}