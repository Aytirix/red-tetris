import { useEffect, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useSocket } from "../contexts/SocketContext";
import { useAlert } from "../components/Alert";
import { emitCheckUsernameAvailable } from "../socket/events/user";

/**
 * Global auth guard — runs in RootLayout on every page.
 *
 * On mount (and on manual localStorage "username" edits):
 *  - If no username in localStorage → nothing.
 *  - Emits user:CheckUsernameAvailable.
 *  - On response, if NOT on "/": handles redirect.
 *    (When on "/", HomePage handles the response itself.)
 *
 * Redirects:
 *  - available=false → "/" + alert
 *  - available=true, user_faction=false → "/" with state { step:"register", returnTo: current path }
 *  - available=true, user_faction=true → stay
 */
export function useAuthGuard() {
	const { socket } = useSocket();
	const navigate = useNavigate();
	const location = useLocation();
	const { alert } = useAlert();

	// Keep a ref so the socket listener always reads the current pathname
	const pathnameRef = useRef(location.pathname);
	useEffect(() => {
		pathnameRef.current = location.pathname;
	}, [location.pathname]);

	// Socket listener — ignored when already on "/" (HomePage handles it there)
	useEffect(() => {
		function handleResult(data: { available: boolean; user_faction: boolean }) {
			if (pathnameRef.current === "/") return;

			if (!data.available) {
				const returnTo = pathnameRef.current;
				navigate("/", { state: { returnTo } });
				alert({
					title: "Pseudo indisponible",
					message: "Ce pseudo n'est plus disponible. Choisissez-en un autre.",
					danger: true,
				});
				return;
			}
			if (!data.user_faction) {
				navigate("/", {
					state: { step: "register", returnTo: pathnameRef.current },
				});
				return;
			}
			// available + registered → nothing, stay on page
		}

		socket.on("user:ResultUsernameAvailable", handleResult);
		return () => { socket.off("user:ResultUsernameAvailable", handleResult); };
	}, [socket, navigate, alert]);

	// Initial check on mount (skip "/" — HomePage debounces its own check)
	const initialPathname = useRef(location.pathname);
	useEffect(() => {
		if (initialPathname.current === "/") return;
		const username = localStorage.getItem("username")?.trim();
		if (!username) return;
		emitCheckUsernameAvailable(username);
	}, []); // eslint-disable-line react-hooks/exhaustive-deps

	// Watch for manual localStorage edits in OTHER tabs
	useEffect(() => {
		function handleStorage(e: StorageEvent) {
			if (e.key !== "username") return;
			const newUsername = e.newValue?.trim();
			if (!newUsername) {
				navigate("/");
				return;
			}
			emitCheckUsernameAvailable(newUsername);
		}
		window.addEventListener("storage", handleStorage);
		return () => window.removeEventListener("storage", handleStorage);
	}, [navigate]);

	// Poll for same-tab localStorage deletion (DevTools, etc.)
	// The native "storage" event does NOT fire for changes in the same tab.
	useEffect(() => {
		const interval = setInterval(() => {
			if (pathnameRef.current === "/") return;
			const username = localStorage.getItem("username")?.trim();
			if (!username) {
				navigate("/");
			}
		}, 1000);
		return () => clearInterval(interval);
	}, [navigate]);
}
