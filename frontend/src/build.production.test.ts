// @vitest-environment node
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, readdirSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterAll, describe, expect, it } from "vitest";

// Le sujet interdit Canvas et SVG cote client. Or ces interdits ne vivent pas dans le
// code source: ils dependent de ce que le BUILD embarque reellement. Deux pieges reels
// rencontres sur ce projet:
//   - l'ancienne route DEV-only /test tirait @mediapipe/tasks-vision, qui cree un
//     <canvas> WebGL. Code et dependance ont depuis ete SUPPRIMES du depot; les
//     assertions restent comme garde-fou anti-reintroduction;
//   - le .env de la racine porte NODE_ENV=development, que Vite recupere via loadEnv,
//     ce qui basculait TOUT le build en mode dev: `import.meta.env.DEV` valait true,
//     la branche DEV survivait et le chunk canvas atterrissait dans dist/.
// Aucun test de source ne peut attraper ca. On construit donc pour de vrai et on
// inspecte le resultat, comme le ferait un correcteur avec `grep -r canvas dist/`.

const outDir = mkdtempSync(join(tmpdir(), "red-tetris-build-"));

function collectFiles(dir: string): string[] {
	return readdirSync(dir).flatMap((entry) => {
		const full = join(dir, entry);
		return statSync(full).isDirectory() ? collectFiles(full) : [full];
	});
}

describe("bundle de production", () => {
	afterAll(() => { rmSync(outDir, { recursive: true, force: true }); });

	it("ne contient aucun interdit du sujet", () => {
		// NODE_ENV est retire de l'environnement du fils: vitest le positionne a "test",
		// ce qui ferait croire a Vite qu'on ne construit pas pour la production. On
		// reproduit donc exactement un `npm run build` lance depuis un shell propre.
		const env = { ...process.env };
		delete env.NODE_ENV;

		execFileSync("npx", ["vite", "build", "--outDir", outDir, "--emptyOutDir", "--logLevel", "error"], {
			cwd: resolve(process.cwd()),
			stdio: "pipe",
			env,
		});

		const files = collectFiles(outDir);
		expect(files.some((file) => file.endsWith("index.html"))).toBe(true);

		const scripts = files.filter((file) => file.endsWith(".js"));
		expect(scripts.length).toBeGreaterThan(0);
		const bundle = scripts.map((file) => readFileSync(file, "utf-8")).join("\n");

		// Canvas: interdit par le sujet, arrivait autrefois par @mediapipe (page /test).
		expect(bundle).not.toContain("createElement(\"canvas\")");
		expect(bundle).not.toContain("OffscreenCanvas");
		expect(bundle).not.toContain("webgl2");
		// La detection de mains a ete supprimee: rien ne doit la reintroduire.
		expect(bundle).not.toContain("HandLandmarker");
		expect(bundle.toLowerCase()).not.toContain("mediapipe");
		// Le build doit etre un vrai build de production, pas un build de dev deguise.
		expect(bundle).not.toContain("jsxDEV");
	});

	it("n'embarque aucun fichier ni data-URI SVG", () => {
		const files = collectFiles(outDir);
		expect(files.some((file) => file.endsWith(".svg"))).toBe(false);
		const assets = files
			.filter((file) => file.endsWith(".js") || file.endsWith(".css") || file.endsWith(".html"))
			.map((file) => readFileSync(file, "utf-8"))
			.join("\n");
		expect(assets).not.toContain("data:image/svg+xml");
		expect(assets).not.toContain("feDisplacementMap");
	});
}, 180000);
