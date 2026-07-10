import { lazy } from "react";
import { createBrowserRouter } from "react-router-dom";
import RootLayout from "./layouts/RootLayout";
import HomePage from "./pages/HomePage";
import NotFoundPage from "./pages/NotFoundPage";
import ThemePage from "./pages/ThemePage";
import RouteErrorPage from "./pages/RouteErrorPage";
import DashboardPage from "./pages/DashboardPage";
import GamePage from "./pages/GamePage";

// Chargées à la demande (chunks async séparés) :
// - DocsWsPage : route DEV-only, ne doit pas peser sur le bundle de prod.
// - TestPage : tire @mediapipe/tasks-vision (~137 KB) qui ne sert qu'ici.
const DocsWsPage = lazy(() => import("./pages/DocsWsPage"));
const TestPage = lazy(() => import("./test/TestPage"));

const docsWsRoute = import.meta.env.DEV
	? [{ path: "docs-ws", element: <DocsWsPage /> }]
	: [];

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
			{ path: "test", element: <TestPage /> },
			{ path: "*", element: <NotFoundPage /> },
		],
	},
]);
