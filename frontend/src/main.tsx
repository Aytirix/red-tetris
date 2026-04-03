import React from "react";
import ReactDOM from "react-dom/client";
import "./styles.css";
import { router } from "./router";
import { RouterProvider } from "react-router-dom";

document.addEventListener("dragstart", (event) => {
	event.preventDefault();
});

ReactDOM.createRoot(document.getElementById("root")!).render(
	<RouterProvider router={router} />
);
