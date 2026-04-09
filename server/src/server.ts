import express from "express";

const app = express();
const PORT = Number(process.env.PORT) || 3000;

app.get("/", (_req, res) => {
	res.json("Red Tetris");
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});