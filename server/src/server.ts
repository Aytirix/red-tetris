import { createApp } from "./app.js";
import { createServer } from "node:http";
import { initSocket } from "./gateways/socket/socketInit.js";

const app = createApp();
const server = createServer(app);
const PORT = process.env.PORT || 3000;
initSocket(server);
server.on("error", (error) => {
	console.error("HTTP server failed to start:", error);
	process.exit(1);
});

server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});