import { Outlet, useLocation } from "react-router-dom";

export default function RootLayout() {
	const { pathname } = useLocation();
	const isDocsWsPage = pathname.startsWith("/docs-ws");

	return (
		<main className={`page${isDocsWsPage ? " page-wide" : ""}`}>
			<Outlet />
		</main>
	);
}
