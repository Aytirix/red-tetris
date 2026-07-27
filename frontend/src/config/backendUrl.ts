/**
 * Port du backend en développement. `VITE_PORT` n'est injectée qu'au build Docker :
 * sans valeur de repli, un `npm run dev` lancé à la main produit l'URL
 * `http://<host>:undefined` et **le socket ne se connecte jamais**. 3000 est la
 * valeur par défaut de `PORT` côté serveur (`server/src/server.ts`).
 */
export const DEV_BACKEND_PORT = import.meta.env.VITE_PORT || "3000";

/**
 * URL du backend, source unique pour le socket et la page de doc WS — les deux
 * calculaient auparavant cette URL chacune de leur côté, avec des replis différents.
 *
 * En DEV le front (Vite) et le back sont sur deux origines : il faut viser le port
 * du backend explicitement. En PROD le serveur Node sert la SPA **et** le socket sur
 * la même origine, derrière le reverse proxy : on reste en same-origin, sans port
 * figé — sinon on taperait un port interne non exposé publiquement.
 */
export function getBackendUrl(): string {
	if (!import.meta.env.DEV)
		return window.location.origin;
	return `${window.location.protocol}//${window.location.hostname}:${DEV_BACKEND_PORT}`;
}
