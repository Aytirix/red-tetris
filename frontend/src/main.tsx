import React from "react";
import ReactDOM from "react-dom/client";
import "./styles.css";
import { router } from "./router";
import { RouterProvider } from "react-router-dom";
import { SocketProvider } from "./contexts/SocketContext";
import { AlertProvider } from "./components/Alert";
import { WsStateProvider } from "./contexts/WsStateContext";
import { ShopProvider } from "./contexts/ShopContext";
import { recordKeyLabel } from "./config/keyBindings";

document.addEventListener("dragstart", (event) => {
	event.preventDefault();
});

// Apprend passivement la disposition clavier réelle (AZERTY/QWERTY…) à partir des
// frappes : `event.key` donne le caractère imprimé, associé à la touche physique
// `event.code`. Indispensable là où l'API Keyboard Map est absente (Chrome/Linux).
window.addEventListener("keydown", (event) => {
	recordKeyLabel(event.code, event.key);
});

ReactDOM.createRoot(document.getElementById("root")!).render(
	<AlertProvider>
		<SocketProvider>
			<WsStateProvider>
				<ShopProvider>
					<RouterProvider router={router} />
				</ShopProvider>
			</WsStateProvider>
		</SocketProvider>
	</AlertProvider>
);
