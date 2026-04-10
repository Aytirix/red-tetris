import React from "react";
import ReactDOM from "react-dom/client";
import "./styles.css";
import { router } from "./router";
import { RouterProvider } from "react-router-dom";
import { SocketProvider } from "./contexts/SocketContext";
import { AlertProvider } from "./components/Alert";

document.addEventListener("dragstart", (event) => {
	event.preventDefault();
});

ReactDOM.createRoot(document.getElementById("root")!).render(
	<AlertProvider>
		<SocketProvider>
			<RouterProvider router={router} />
		</SocketProvider>
	</AlertProvider>
);
