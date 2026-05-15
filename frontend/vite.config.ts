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
