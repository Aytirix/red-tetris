import React, { useEffect, useState } from "react";
import DocsWsPage from "../pages/DocsWsPage";

export default function DevToolsMenu() {
	const [isDocsWsOpen, setIsDocsWsOpen] = useState(false);

	useEffect(() => {
		if (!isDocsWsOpen) return;

		const previousOverflow = document.body.style.overflow;
		document.body.style.overflow = "hidden";

		return () => {
			document.body.style.overflow = previousOverflow;
		};
	}, [isDocsWsOpen]);

	useEffect(() => {
		if (!isDocsWsOpen) return;

		function handleKeyDown(event: KeyboardEvent) {
			if (event.key === "Escape") {
				setIsDocsWsOpen(false);
			}
		}

		window.addEventListener("keydown", handleKeyDown);
		return () => window.removeEventListener("keydown", handleKeyDown);
	}, [isDocsWsOpen]);

	if (!import.meta.env.DEV) return null;

	return (
		<>
			<div className="dev-tools-anchor">
				<button
					type="button"
					className="button button-ghost"
					aria-label="Ouvrir les outils de développement"
					onClick={() => setIsDocsWsOpen(true)}
				>
					&#9881;
				</button>
			</div>

			<div
				className={`dev-tools-modal${isDocsWsOpen ? " is-open" : ""}`}
				aria-hidden={!isDocsWsOpen}
				onClick={() => setIsDocsWsOpen(false)}
			>
				<div className="card dev-tools-modal-panel" onClick={(event) => event.stopPropagation()}>
					<div className="dev-tools-modal-header">
						<div>
							<p className="eyebrow" style={{ marginBottom: "0.35rem" }}>Dev Tools</p>
							<h3>Docs WS</h3>
						</div>
						<button
							type="button"
							className="button button-outline"
							style={{ minHeight: "40px" }}
							onClick={() => setIsDocsWsOpen(false)}
						>
							Fermer
						</button>
					</div>

					<div className="dev-tools-modal-body">
						<div className="page page-wide">
							<DocsWsPage />
						</div>
					</div>
				</div>
			</div>
		</>
	);
}
