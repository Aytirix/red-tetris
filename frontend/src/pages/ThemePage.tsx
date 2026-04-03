import { Link } from "react-router-dom";

const pillars = [
	{
		icon: "01",
		tone: "red",
		title: "Palette centralisee",
		description:
			"Le fond, les surfaces, les bordures et les lueurs reposent sur des tokens simples a faire evoluer.",
		tags: ["root vars", "global"],
	},
	{
		icon: "02",
		tone: "cyan",
		title: "UI arcade reutilisable",
		description:
			"Cartes arrondies, boutons lumineux, statuts compacts et structure assez propre pour le lobby, la room et les profils.",
		tags: ["cards", "buttons"],
	},
	{
		icon: "03",
		tone: "violet",
		title: "Effets neon discrets",
		description:
			"Le site garde une identite jeu video sans tomber dans un rendu agressif ou fatigueant a lire.",
		tags: ["glow", "hover"],
	},
];

const systems = [
	{ label: "Lobby", value: "READY", tone: "cyan" },
	{ label: "Match", value: "SYNC", tone: "red" },
	{ label: "Ghost", value: "LIVE", tone: "violet" },
	{ label: "HUD", value: "BOOST", tone: "cyan" },
];

const themeTokens = [
	{ label: "Fond principal", variable: "--color-bg-0", value: "#050816", tone: "base" },
	{ label: "Rouge principal", variable: "--color-primary", value: "#ff365f", tone: "red" },
	{ label: "Cyan secondaire", variable: "--color-secondary", value: "#3de7ff", tone: "cyan" },
	{ label: "Violet accent", variable: "--color-accent", value: "#9069ff", tone: "violet" },
	{ label: "Texte principal", variable: "--color-text", value: "#f4f7ff", tone: "text" },
];

export default function App() {
	return (
		<main className="page">
			<section className="card hero-card">
				<div className="hero-copy">
					<p className="eyebrow">Theme system / arcade neon red</p>
					<div className="hero-chip">Base visuelle pour lobby, room, HUD et profils</div>
					<h1>Red Tetris</h1>
					<p className="hero-text">
						On part sur un theme facile a modifier: fond bleu nuit,
						rouge pour les actions fortes, cyan pour les interactions
						secondaires, violet en accent et une ambiance arcade nette
						mais propre.
					</p>

					<div className="hero-actions">
						<Link className="button button-primary" to="/">
							Retour au Lobby
						</Link>
						<button className="button button-secondary" type="button">
							Ouvrir une room
						</button>
						<button className="button button-ghost">
							Theme tokens
						</button>
					</div>
				</div>

				<aside className="card hero-preview">
					<div className="preview-chip">
						<span aria-hidden="true" className="status-dot" />
						Theme actif : arcade-neon-red
					</div>

					<div className="preview-grid">
						{systems.map((system) => (
							<div className="mini-card" data-tone={system.tone} key={system.label}>
								<span>{system.label}</span>
								<strong>{system.value}</strong>
							</div>
						))}
					</div>

					<div className="signal-panel">
						<div className="signal-head">
							<span>Stabilite visuelle</span>
							<strong>99%</strong>
						</div>
						<div className="signal-bar">
							<span />
						</div>
						<p>
							Les memes tokens pilotent les cartes, les boutons, les
							bordures, les titres et les effets lumineux.
						</p>
					</div>
				</aside>
			</section>

			<section className="section">
				<header className="section-header">
					<div>
						<p className="section-kicker">Direction visuelle</p>
						<h2>Un systeme unique pour tout le site</h2>
					</div>
					<p className="section-copy">
						L&apos;idee est de changer l&apos;ambiance du projet depuis un
						petit nombre de variables, sans reouvrir tous les composants.
					</p>
				</header>

				<div className="feature-grid">
					{pillars.map((pillar) => (
						<article className="card feature-card" data-tone={pillar.tone} key={pillar.title}>
							<div className="feature-icon">{pillar.icon}</div>
							<h3>{pillar.title}</h3>
							<p>{pillar.description}</p>
							<div className="feature-tags">
								{pillar.tags.map((tag) => (
									<span className="badge" key={tag}>
										{tag}
									</span>
								))}
							</div>
						</article>
					))}
				</div>
			</section>

			<section className="split-grid">
				<article className="card token-panel">
					<p className="section-kicker">Theme tokens</p>
					<h2>Changez ces variables en premier</h2>
					<p className="section-copy">
						La palette repose sur des noms semantiques, pas sur des
						couleurs dispersees dans le CSS.
					</p>

					<ul className="token-list">
						{themeTokens.map((token) => (
							<li className="token-item" key={token.variable}>
								<div className="token-meta">
									<span className="token-swatch" data-tone={token.tone} />
									<div>
										<strong>{token.label}</strong>
										<code>{token.variable}</code>
									</div>
								</div>
								<span className="token-value">{token.value}</span>
							</li>
						))}
					</ul>
				</article>

				<article className="card control-panel">
					<p className="section-kicker">Composants de base</p>
					<h2>Pieces UI coherentes</h2>
					<p className="section-copy">
						La meme direction sert aux CTA, aux statuts, aux panneaux et a
						la navigation de jeu.
					</p>

					<div className="button-grid">
						<button className="button button-primary" type="button">
							Primary action
						</button>
						<button className="button button-secondary" type="button">
							Secondary action
						</button>
						<button className="button button-ghost" type="button">
							Accent action
						</button>
						<button className="button button-outline" type="button">
							Neutral action
						</button>
					</div>

					<div className="micro-grid">
						<div className="micro-card" data-tone="red">
							<span>Rouge</span>
							<strong>Call to action</strong>
							<p>Priorites, alertes, score, actions fortes.</p>
						</div>
						<div className="micro-card" data-tone="cyan">
							<span>Cyan</span>
							<strong>Lecture rapide</strong>
							<p>Infos utiles, feedbacks, etats vivants.</p>
						</div>
						<div className="micro-card" data-tone="violet">
							<span>Violet</span>
							<strong>Accent</strong>
							<p>Touches de contraste, focus et details speciaux.</p>
						</div>
					</div>
				</article>
			</section>
		</main>
	);
}
