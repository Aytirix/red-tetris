import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

// Seuils imposes par le sujet: 70% statements/functions/lines, 50% branches.
// Le perimetre de couverture est tout `src/**`: aucun dossier applicatif n'est
// trie a la main, seules les exclusions justifiees ci-dessous en sont retirees.
export default defineConfig({
	plugins: [react()],
	test: {
		// jsdom est volontairement bloque en 26.x: la 27 tire une dependance qui exige
		// require(esm), indisponible avant Node 22.12 -> `npm test` casserait sur une
		// machine avec un Node plus ancien.
		environment: "jsdom",
		include: ["src/**/*.test.{ts,tsx}"],
		setupFiles: ["src/test-setup.ts"],
		coverage: {
			provider: "v8",
			reporter: ["text", "html", "json-summary"],
			include: ["src/**"],
			exclude: [
				// Les fichiers de test eux-memes et leur bootstrap: ce n'est pas du code produit.
				"src/**/*.test.{ts,tsx}",
				"src/test-setup.ts",
				// Point d'entree: monte React sur #root au chargement, rien d'observable a tester.
				"src/main.tsx",
				// Donnees statiques importees telles quelles: aucun code executable.
				"src/**/*.json",
				// Notes de conception (ex: src/test/prompt.md): du texte, pas du code.
				"src/**/*.md",
				// Declarations de types Vite: effacees a la compilation.
				"src/vite-env.d.ts",
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
