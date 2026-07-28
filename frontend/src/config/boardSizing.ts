/**
 * Dimensionnement du plateau en fonction de la place réellement disponible.
 *
 * Le plateau était figé à 38 px/cellule, soit ~888 px de hauteur nécessaire une
 * fois le HUD et les marges comptés. La majorité des écrans de PC portable
 * n'offrent que 640–790 px de viewport : le plateau débordait donc en bas.
 *
 * Deux niveaux :
 *  - `fitCellSize` : la vraie source de vérité, alimentée par la MESURE de la
 *    zone du plateau (ResizeObserver côté GameView). Aucune constante à deviner,
 *    donc aucune dérive possible entre le CSS et le calcul.
 *  - `computeMainCellSize` : estimation de repli à partir du viewport, utilisée
 *    au tout premier rendu (avant la première mesure) et hors navigateur (tests,
 *    SSR). Elle retranche une approximation du « chrome » (HUD, marges).
 *
 * Module volontairement pur (aucun accès au DOM) pour rester testable.
 */

/** Taille historique : plafond, pour ne rien changer sur les grands écrans. */
export const MAIN_CELL_MAX = 38;
/**
 * Plancher : en dessous le plateau devient illisible. Volontairement bas — sur une
 * fenêtre minuscule, un plateau petit reste préférable à un plateau tronqué, la
 * scène ne défilant plus (`overflow: hidden`).
 */
export const MAIN_CELL_MIN = 10;

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
	return Math.min(320, Math.max(120, viewportWidth * 0.2));
}

type FitInput = {
	/** Largeur intérieure de la zone réservée au plateau, en px. */
	availableWidth: number;
	/** Hauteur intérieure de la zone réservée au plateau, en px. */
	availableHeight: number;
	rows: number;
	cols: number;
};

/**
 * Plus grande cellule tenant dans la boîte donnée, cadre et gouttières compris,
 * bornée à [MAIN_CELL_MIN, MAIN_CELL_MAX].
 */
export function fitCellSize({ availableWidth, availableHeight, rows, cols }: FitInput): number {
	// Un plateau vide (avant réception du premier état) ne doit pas diviser par zéro.
	if (rows <= 0 || cols <= 0) return MAIN_CELL_MAX;

	const byHeight = (availableHeight - BOARD_FRAME - (rows - 1) * CELL_GAP) / rows;
	const byWidth = (availableWidth - BOARD_FRAME - (cols - 1) * CELL_GAP) / cols;

	const fitted = Math.floor(Math.min(byHeight, byWidth));
	return Math.max(MAIN_CELL_MIN, Math.min(MAIN_CELL_MAX, fitted));
}

type CellSizeInput = {
	viewportWidth: number;
	viewportHeight: number;
	rows: number;
	cols: number;
};

/**
 * Estimation de repli à partir du viewport, utilisée tant que la zone du plateau
 * n'a pas été mesurée. La hauteur est presque toujours la contrainte active ; la
 * largeur ne mord que sur les écrans très étroits.
 */
export function computeMainCellSize({ viewportWidth, viewportHeight, rows, cols }: CellSizeInput): number {
	return fitCellSize({
		availableWidth: viewportWidth - sideColumnWidth(viewportWidth) * 2 - HORIZONTAL_CHROME,
		availableHeight: viewportHeight - VERTICAL_CHROME,
		rows,
		cols,
	});
}

/**
 * Taille des mini-plateaux adverses, proportionnelle au plateau principal
 * (0.26 → 10 px quand le plateau est à 38 px, la valeur historique).
 */
export function computeMiniCellSize(mainCellSize: number): number {
	return Math.max(5, Math.round(mainCellSize * 0.26));
}
