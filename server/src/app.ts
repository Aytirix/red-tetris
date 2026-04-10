	import express from "express";

export function createApp() : express.Express {
		const app = express();
	app.use((req, res, next) => {
		 console.log("bonjour")
		 next();
	})
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
		return app;
	}