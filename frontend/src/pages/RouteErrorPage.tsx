import { isRouteErrorResponse, Link, useRouteError } from "react-router-dom";

export default function RouteErrorPage() {
	const error = useRouteError();
	const isDev = import.meta.env.DEV;

	let title = "Erreur de routage";
	let summary =
		"Le frontend a rencontre un incident inattendu pendant le chargement de cette route.";
	let detail = "";
	let status = "500";

	if (isRouteErrorResponse(error)) {
		status = String(error.status);
		title = error.status === 404 ? "Route introuvable" : "Erreur de navigation";
		summary = error.statusText || summary;
		detail = typeof error.data === "string" ? error.data : "";
	} else if (error instanceof Error) {
		title = "Erreur applicative";
		summary = error.message;
		detail = error.stack ?? "";
	}

	return (
		<section className="card error-page">
			<div className="error-copy">
				<p className="section-kicker">System fault</p>
				<div className="error-code">{status}</div>
				<h1>{title}</h1>
				<p className="hero-text">{summary}</p>

				<div className="error-actions">
					<Link className="button button-primary" to="/">
						Retour a l&apos;accueil
					</Link>
					<Link className="button button-secondary" to="/theme">
						Ouvrir le theme
					</Link>
				</div>
			</div>

			<div className="card error-panel">
				<div className="preview-chip">
					<span aria-hidden="true" className="status-dot" />
					Etat : route-error
				</div>

				<div className="error-stats">
					<div className="mini-card" data-tone="red">
						<span>Status</span>
						<strong>{status}</strong>
					</div>
					<div className="mini-card" data-tone="cyan">
						<span>Recover</span>
						<strong>HOME</strong>
					</div>
				</div>

				<div className="signal-panel">
					<div className="signal-head">
						<span>Resume</span>
						<strong>{title}</strong>
					</div>
					<p>{detail && isDev ? detail : "Consultez la console en mode developpement pour plus de details."}</p>
				</div>
			</div>
		</section>
	);
}
