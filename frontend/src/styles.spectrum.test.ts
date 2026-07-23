import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

// `styles.css` n'est importe que par main.tsx, donc aucun test de composant ne le
// charge: sans ce garde-fou textuel, supprimer une regle ne fait rougir personne.
// C'est exactement ce qui etait arrive au spectre, rendu en cyan de piece I parce
// qu'aucune regle `data-piece="spectrum"` n'existait et que le defaut
// `.tetris-cell--filled { --c: var(--piece-i) }` s'appliquait.
const css = readFileSync(resolve(process.cwd(), "src/styles.css"), "utf-8");

/** Selecteurs de "recipe" (theme de pieces equipe) qui repeignent les cellules. */
function recipeCellSelectors(): string[] {
	const matches = css.match(/\[data-recipe="[^"]+"\][^{]*\.tetris-cell--filled[^{]*(?=\{)/g);
	return (matches ?? []).map((selector) => selector.trim());
}

describe("styles.css — spectre adverse monochrome", () => {
	it("declare une regle dediee pour data-piece=\"spectrum\"", () => {
		expect(css).toMatch(/\.tetris-cell--filled\[data-piece="spectrum"\]\s*\{/);
	});

	it("declare la variable de couleur du spectre", () => {
		expect(css).toMatch(/--piece-spectrum:\s*#[0-9a-fA-F]{3,8};/);
	});

	it("ne reprend jamais une couleur de piece pour le spectre", () => {
		const rule = css.split('.tetris-cell--filled[data-piece="spectrum"]')[1]?.split("}")[0] ?? "";
		expect(rule).toBeTruthy();
		// Borne de fin obligatoire: `--piece-spectrum` commence par `--piece-s`.
		for (const piece of ["i", "j", "l", "o", "s", "t", "z"])
			expect(rule).not.toMatch(new RegExp(`--piece-${piece}(?![a-z])`));
	});

	it("exclut le spectre de toutes les recipes de theme", () => {
		const selectors = recipeCellSelectors();
		// Garde-fou du garde-fou: si plus aucune recipe n'est trouvee, le test ne
		// verifie plus rien et doit echouer.
		expect(selectors.length).toBeGreaterThanOrEqual(4);
		for (const selector of selectors)
			expect(selector).toContain(':not([data-piece="spectrum"])');
	});

	it("laisse la penalite intacte et toujours exclue des recipes", () => {
		expect(css).toMatch(/\.tetris-cell--filled\[data-piece="penalty"\]\s*\{/);
		for (const selector of recipeCellSelectors())
			expect(selector).toContain(':not([data-piece="penalty"])');
	});
});
