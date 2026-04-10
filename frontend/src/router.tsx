import { createBrowserRouter } from "react-router-dom";
import RootLayout from "./layouts/RootLayout";
import HomePage from "./pages/HomePage";
import NotFoundPage from "./pages/NotFoundPage";
import ThemePage from "./pages/ThemePage";
import RouteErrorPage from "./pages/RouteErrorPage";
import DocsWsPage from "./pages/DocsWsPage";

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
			{ path: "theme", element: <ThemePage /> },
			...docsWsRoute,
			{ path: "*", element: <NotFoundPage /> },
		],
	},
]);
