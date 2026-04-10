	import express from "express";
	import session from "express-session";

	const app = express();

	app.get("/", (req, res) => {
	  res.send("Red Tetris Server");
	});

	export default app;