import { Link } from "react-router-dom";

export default function App() {
	return (
		<main className="page">
			<section className="card hero-card">
				<div className="hero-copy">
					<p className="eyebrow">Theme system / arcade neon red</p>
					<div className="hero-chip">Base visuelle pour lobby, room, HUD et profils</div>
					<h1>Red Tetris</h1>
					<div className="hero-actions">
						<Link to="theme" className="btn btn-primary">
							Theme
						</Link>
					</div>
				</div>
			</section>
		</main>
	);
}