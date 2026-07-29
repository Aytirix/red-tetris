/** Port du backend en développement. */
export const DEV_BACKEND_PORT = import.meta.env.VITE_PORT || "3000";

/** URL du backend, source unique pour le socket et la page de doc WS. */
export function getBackendUrl(): string {
	if (!import.meta.env.DEV)
		return window.location.origin;
	return `${window.location.protocol}//${window.location.hostname}:${DEV_BACKEND_PORT}`;
}
