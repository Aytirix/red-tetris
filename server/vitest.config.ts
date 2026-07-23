import { defineConfig } from "vitest/config";

// Seuils imposes par le sujet: 70% statements/functions/lines, 50% branches.
// Le client Prisma genere et le bootstrap HTTP sont hors perimetre (code non ecrit ici).
export default defineConfig({
	test: {
		environment: "node",
		include: ["src/**/*.test.ts"],
		coverage: {
			provider: "v8",
			reporter: ["text", "html", "json-summary"],
			include: ["src/**"],
			exclude: [
				"src/generated/**",
				"src/server.ts",
				"src/**/*.test.ts",
				"src/types/**",
				// Charge tfjs + le modèle MediaPipe au runtime (import dynamique): non
				// testable sans exécuter réellement le modèle. La logique de gestes qui
				// l'exploite (motion/gestures/actions/handsController) EST testée.
				"src/hands/handDetectionService.ts",
			],
			thresholds: {
				statements: 70,
				functions: 70,
				lines: 70,
				branches: 50,
			},
		},
	},
});
