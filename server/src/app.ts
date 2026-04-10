	import express from "express";

	export function createApp() : express.Express {
		const app = express();
		app.get("/", (req, res) => {
		  res.send("Red Tetris Server");
		});
		return app;
	}