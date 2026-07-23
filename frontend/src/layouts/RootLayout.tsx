import { Suspense, useEffect } from "react";
import { Outlet, useLocation } from "react-router-dom";
import DevToolsMenu from "../components/DevToolsMenu";
import { useAuthGuard } from "../hooks/useAuthGuard";
import { TransitionProvider } from "../transition/TransitionContext";

declare global {
	interface Window {
		// Ouvre les nuages de démarrage (définie dans index.html). Appelée par React
		// une fois la première page peinte, pour ne pas révéler un #root encore blanc.
		__openBootClouds?: () => void;
	}
}

export default function RootLayout() {
	const { pathname } = useLocation();
	useAuthGuard();

	// Ouvre l'overlay de démarrage après le tout premier paint de React (double rAF
	// = commit + peinture effective), quand la première page est réellement à l'écran.
	useEffect(() => {
		let raf2 = 0;
		const raf1 = requestAnimationFrame(() => {
			raf2 = requestAnimationFrame(() => {
				window.__openBootClouds?.();
			});
		});
		return () => {
			cancelAnimationFrame(raf1);
			if (raf2) cancelAnimationFrame(raf2);
		};
	}, []);

	const isDocsWsPage = pathname.startsWith("/docs-ws");
	const isHomePage = pathname === "/";
	const isDashboard = pathname.startsWith("/dashboard");
	const isGamePage = pathname.split("/").filter(Boolean).length === 2;

	if (isHomePage || isDashboard || isGamePage) {
		return (
			<TransitionProvider>
				<Suspense fallback={null}>
					<Outlet />
				</Suspense>
				<DevToolsMenu />
			</TransitionProvider>
		);
	}

	return (
		<TransitionProvider>
			<main className={`page${isDocsWsPage ? " page-wide" : ""}`}>
				<Suspense fallback={null}>
					<Outlet />
				</Suspense>
			</main>
			<DevToolsMenu />
		</TransitionProvider>
	);
}
