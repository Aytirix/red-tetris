import avatarCrops from "../config/avatarCrops.json";
import { SCENE_THEMES } from "../components/DashboardParallaxScene/themes";

// Images du premier parcours (accueil → choix de faction → dashboard) préchargées
// derrière l'écran « nuages » au tout premier chargement, pour éviter le pop-in.
// Le dossier public/img/**/origin/ (sources lourdes non servies) est volontairement
// EXCLU : on ne référence que les fichiers réellement affichés.
const HOME_IMAGES = [
	"/img/Luffy-vs-Akainu.jpg",
	"/img/choix-faction/affrontement.jpg",
	"/img/choix-faction/pirate.jpg",
	"/img/choix-faction/marine.jpg",
	"/img/decor/bolt-hero.png",
	"/img/decor/bolt-card-wide.png",
	"/img/decor/bolt-card-thin.png",
];

// Toutes les couches parallax des deux dashboards (source de vérité : SCENE_THEMES).
const DASHBOARD_IMAGES = Object.values(SCENE_THEMES)
	.flat()
	.map((layer) => layer.src);

// Toutes les URLs d'avatars (les clés d'avatarCrops.json sont les chemins d'images).
const AVATAR_IMAGES = Object.keys(avatarCrops as Record<string, unknown>);

// Liste dédupliquée.
export const BOOT_PRELOAD_IMAGES: string[] = [
	...new Set([...HOME_IMAGES, ...DASHBOARD_IMAGES, ...AVATAR_IMAGES]),
];

// Charge une image ; résout au chargement OU en erreur (une image manquante ne doit
// jamais bloquer le démarrage). Attend le décodage quand l'API est dispo pour éviter
// un « jank » au moment de l'affichage.
function preloadOne(src: string): Promise<void> {
	return new Promise((resolve) => {
		const image = new Image();
		let settled = false;
		const finish = () => {
			if (settled) return;
			settled = true;
			resolve();
		};
		image.decoding = "async";
		image.onload = () => {
			if (typeof image.decode === "function") image.decode().catch(() => undefined).finally(finish);
			else finish();
		};
		image.onerror = finish;
		image.src = src;
		if (image.complete) finish();
	});
}

/**
 * Précharge toutes les images de démarrage en signalant la progression dans [0, 1].
 * Ne rejette jamais. `timeoutMs` garantit qu'on n'attend pas indéfiniment si une
 * requête reste bloquée : au-delà, on considère le préchargement terminé.
 */
export function preloadBootImages(
	onProgress?: (ratio: number) => void,
	timeoutMs = 30_000,
): Promise<void> {
	const total = BOOT_PRELOAD_IMAGES.length;
	if (total === 0) {
		onProgress?.(1);
		return Promise.resolve();
	}
	onProgress?.(0);
	let done = 0;
	const all = Promise.all(
		BOOT_PRELOAD_IMAGES.map((src) =>
			preloadOne(src).then(() => {
				done += 1;
				onProgress?.(done / total);
			}),
		),
	).then(() => undefined);

	// Filet de sécurité : on révèle le site même si le réseau traîne sur une image.
	const safety = new Promise<void>((resolve) => setTimeout(resolve, timeoutMs));
	return Promise.race([all, safety]);
}
