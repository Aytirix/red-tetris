/**
 * Dimensionnement du plateau en fonction de la taille de la fenêtre.
 *
 * Le plateau était figé à 38 px/cellule, soit ~888 px de hauteur nécessaire une
 * fois le HUD et les marges comptés. La majorité des écrans de PC portable
 * n'offrent que 640–790 px de viewport : le plateau débordait donc en bas.
 * On calcule ici la plus grande cellule qui tient réellement à l'écran.
 *
 * Module volontairement pur (aucun accès au DOM) pour rester testable.
 */

/** Taille historique : plafond, pour ne rien changer sur les grands écrans. */
export const MAIN_CELL_MAX = 38;
/** Plancher : en dessous le plateau devient illisible. */
export const MAIN_CELL_MIN = 14;

/** `gap` de `.tetris-board` (entre cellules). */
const CELL_GAP = 2;
/** Padding du plateau (2×2) + padding du cadre (2×8) + bordure (2×1). */
const BOARD_FRAME = 22;
/** Hauteur consommée autour du plateau : padding de la scène + HUD + sécurité. */
const VERTICAL_CHROME = 132;
/** Gouttières de la grille + padding horizontal de la scène. */
const HORIZONTAL_CHROME = 72;

/** Largeur d'une colonne latérale, alignée sur le `clamp()` CSS de `.tetris-stage__side`. */
function sideColumnWidth(viewportWidth: number): number {
	return Math.min(320, Math.max(170, viewportWidth * 0.22));
}

type CellSizeInput = {
	viewportWidth: number;
	viewportHeight: number;
	rows: number;
	cols: number;
};

/**
 * Plus grande taille de cellule tenant dans le viewport, bornée à
 * [MAIN_CELL_MIN, MAIN_CELL_MAX]. La hauteur est presque toujours la
 * contrainte active ; la largeur ne mord que sur les écrans très étroits.
 */
export function computeMainCellSize({ viewportWidth, viewportHeight, rows, cols }: CellSizeInput): number {
	// Un plateau vide (avant réception du premier état) ne doit pas diviser par zéro.
	if (rows <= 0 || cols <= 0) return MAIN_CELL_MAX;

	const availableHeight = viewportHeight - VERTICAL_CHROME;
	const byHeight = (availableHeight - BOARD_FRAME - (rows - 1) * CELL_GAP) / rows;

	const availableWidth = viewportWidth - sideColumnWidth(viewportWidth) * 2 - HORIZONTAL_CHROME;
	const byWidth = (availableWidth - BOARD_FRAME - (cols - 1) * CELL_GAP) / cols;

	const fitted = Math.floor(Math.min(byHeight, byWidth));
	return Math.max(MAIN_CELL_MIN, Math.min(MAIN_CELL_MAX, fitted));
}

/**
 * Taille des mini-plateaux adverses, proportionnelle au plateau principal
 * (0.26 → 10 px quand le plateau est à 38 px, la valeur historique).
 */
export function computeMiniCellSize(mainCellSize: number): number {
	return Math.max(5, Math.round(mainCellSize * 0.26));
}
