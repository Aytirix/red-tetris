import { Suspense, useEffect } from "react";
import { Outlet, useLocation } from "react-router-dom";
import DevToolsMenu from "../components/DevToolsMenu";
import { useAuthGuard } from "../hooks/useAuthGuard";
import { TransitionProvider } from "../transition/TransitionContext";
import { preloadBootImages } from "../preload/bootPreload";

declare global {
	interface Window {
		// Ouvre les nuages de démarrage (définie dans index.html). Appelée par React
		// une fois la première page peinte ET les images préchargées.
		__openBootClouds?: () => void;
		// Met à jour la barre de progression des nuages de démarrage ([0, 1]).
		__setBootProgress?: (ratio: number) => void;
	}
}

export default function RootLayout() {
	const { pathname } = useLocation();
	useAuthGuard();
	useEffect(() => {
		let cancelled = false;
		let raf2 = 0;
		const raf1 = requestAnimationFrame(() => {
			raf2 = requestAnimationFrame(() => {
				void preloadBootImages((ratio) => {
					if (!cancelled) window.__setBootProgress?.(ratio);
				}).finally(() => {
					if (!cancelled) window.__openBootClouds?.();
				});
			});
		});
		return () => {
			cancelled = true;
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
