import { Outlet, useLocation } from "react-router-dom";
import DevToolsMenu from "../components/DevToolsMenu";
import { useAuthGuard } from "../hooks/useAuthGuard";

export default function RootLayout() {
	const { pathname } = useLocation();
	useAuthGuard();
	const isDocsWsPage = pathname.startsWith("/docs-ws");
	const isHomePage = pathname === "/";

	if (isHomePage) {
		return (
			<>
				<Outlet />
				<DevToolsMenu />
			</>
		);
	}

	return (
		<>
			<main className={`page${isDocsWsPage ? " page-wide" : ""}`}>
				<Outlet />
			</main>
			<DevToolsMenu />
		</>
	);
}
