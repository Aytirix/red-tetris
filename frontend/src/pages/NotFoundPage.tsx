import { Link } from "react-router-dom";

export default function NotFoundPage() {
	return (
		<section className="card not-found-page">
			<div className="not-found-copy">
				<p className="section-kicker">Route introuvable</p>
				<div className="not-found-code">404</div>
				<h1>Signal perdu dans la grille</h1>
				<p className="hero-text">
					La page demandée n'existe pas ou a été déplacée. Vérifiez l'URL ou retournez à l'accueil pour continuer votre aventure dans le monde de Red Tetris.
				</p>

				<div className="not-found-actions">
					<Link className="button button-primary" to="/">
						Retour a l&apos;accueil
					</Link>
				</div>
			</div>

			<div className="card not-found-panel">
				<div className="preview-chip">
					<span aria-hidden="true" className="status-dot" />
					Etat : route-hors-grille
				</div>

				<div className="not-found-grid">
					<div className="mini-card" data-tone="red">
						<span>Erreur</span>
						<strong>404</strong>
					</div>
					<div className="mini-card" data-tone="cyan">
						<span>Action</span>
						<strong>RELOAD</strong>
					</div>
					<div className="mini-card" data-tone="violet">
						<span>Fallback</span>
						<strong>HOME</strong>
					</div>
					<div className="mini-card" data-tone="cyan">
						<span>Router</span>
						<strong>ACTIVE</strong>
					</div>
				</div>
			</div>
		</section>
	);
}
