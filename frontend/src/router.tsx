import { lazy } from "react";
import { createBrowserRouter } from "react-router-dom";
import RootLayout from "./layouts/RootLayout";
import HomePage from "./pages/HomePage";
import NotFoundPage from "./pages/NotFoundPage";
import ThemePage from "./pages/ThemePage";
import RouteErrorPage from "./pages/RouteErrorPage";
import DashboardPage from "./pages/DashboardPage";
import GamePage from "./pages/GamePage";

// Routes DEV-only, chargées à la demande :
// - DocsWsPage : documentation des events websocket, inutile en production.
// - TestPage : bac à sable de détection de mains (piste « jouer au clavier virtuel »),
//   qui tire @mediapipe/tasks-vision — lequel crée un <canvas> WebGL, interdit par le
//   sujet. Le code reste dans le dépôt et utilisable en dev, mais ne doit RIEN laisser
//   dans le bundle de production.
// Le lazy() est placé DANS la branche DEV : en production `import.meta.env.DEV` vaut
// false et la branche est éliminée. Vérifié sur un build réel : ni TestPage ni
// @mediapipe ne subsistent dans dist/. Rollup peut malgré tout matérialiser un chunk
// asynchrone vide pour un import() resté dans le graphe — sans conséquence tant qu'il
// ne contient aucune API interdite.
const DocsWsPage = import.meta.env.DEV ? /*#__PURE__*/ lazy(() => import("./pages/DocsWsPage")) : null;
const TestPage = import.meta.env.DEV ? /*#__PURE__*/ lazy(() => import("./test/TestPage")) : null;

const docsWsRoute = DocsWsPage ? [{ path: "docs-ws", element: <DocsWsPage /> }] : [];
const testRoute = TestPage ? [{ path: "test", element: <TestPage /> }] : [];

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
			...testRoute,
			{ path: "*", element: <NotFoundPage /> },
		],
	},
]);
