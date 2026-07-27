import { io, Socket } from "socket.io-client";
import { getBackendUrl } from "../config/backendUrl";

// Singleton de connexion. Aucun listener global n'est branché ici: chaque page
// (GamePage, DashboardPage…) abonne et désabonne les événements dont elle a besoin,
// ce qui évite les handlers orphelins entre deux navigations.
export const socket: Socket = io(getBackendUrl(), {
	autoConnect: true,
});
