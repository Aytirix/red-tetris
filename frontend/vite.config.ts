import { resolve } from "node:path";
import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

function parsePort(value: string | undefined, fallback: number): number {
	if (!value)
		return fallback;

	const port = Number(value);
	return Number.isInteger(port) && port > 0 && port <= 65535 ? port : fallback;
}

export default defineConfig(({ mode }) => {
	const env = {
		...loadEnv(mode, resolve(process.cwd(), ".."), ""),
		...loadEnv(mode, process.cwd(), ""),
		...process.env,
	};
	// Le .env de la racine (partage avec Docker Compose) contient NODE_ENV=development,
	// necessaire au service backend-dev. loadEnv le recopie dans VITE_USER_NODE_ENV, et
	// Vite bascule alors TOUT le build en mode developpement: React en jsxDEV,
	// `import.meta.env.DEV === true`, donc les routes DEV-only — dont /test et son
	// <canvas> @mediapipe interdit par le sujet — atterrissaient dans dist/.
	// Le front ne consomme jamais NODE_ENV: on coupe donc cet effet de bord.
	delete process.env.VITE_USER_NODE_ENV;
	const frontendPort = parsePort(env.PORT_DEV_FRONTEND, 5173);
	const previewPort = parsePort(env.PORT_PREVIEW_FRONTEND, 4173);

	return {
		plugins: [react(), tailwindcss()],
		server: {
			host: "0.0.0.0",
			port: frontendPort,
		},
		preview: {
			host: "0.0.0.0",
			port: previewPort,
		},
	};
});
