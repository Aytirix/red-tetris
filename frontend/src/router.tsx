import { lazy } from "react";
import { createBrowserRouter } from "react-router-dom";
import RootLayout from "./layouts/RootLayout";
import HomePage from "./pages/HomePage";
import NotFoundPage from "./pages/NotFoundPage";
import ThemePage from "./pages/ThemePage";
import RouteErrorPage from "./pages/RouteErrorPage";
import DashboardPage from "./pages/DashboardPage";
import GamePage from "./pages/GamePage";
const DocsWsPage = import.meta.env.DEV ? /*#__PURE__*/ lazy(() => import("./pages/DocsWsPage")) : null;

const docsWsRoute = DocsWsPage ? [{ path: "docs-ws", element: <DocsWsPage /> }] : [];

export const router = createBrowserRouter([
	{
		path: "/",
		element: <RootLayout />,
		errorElement: <RouteErrorPage />,
		children: [
			{ index: true, element: <HomePage /> },
			{ path: "dashboard", element: <DashboardPage /> },
			{ path: "theme", element: <ThemePage /> },
			...docsWsRoute,
			{
				path: ":roomName/:playerName",
				loader: ({ params }) => {
					if (params.playerName) {
						localStorage.setItem("username", params.playerName);
					}
					return null;
				},
				element: <GamePage />,
			},
			{ path: "*", element: <NotFoundPage /> },
		],
	},
]);
