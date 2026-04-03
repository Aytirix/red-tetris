const features = [
  {
    title: "Mode dev sous Docker",
    description:
      "Vite tourne dans le conteneur avec hot reload et montage du dossier frontend pour un cycle de dev immédiat.",
  },
  {
    title: "Mode production propre",
    description:
      "Build statique optimisé puis servi par Nginx, prêt pour une livraison simple et fiable.",
  },
  {
    title: "Base frontend saine",
    description:
      "React, TypeScript et Vite sont déjà branchés, avec une landing de démarrage facile à remplacer par vos écrans de jeu.",
  },
];

const commands = [
  "docker compose --profile dev up --build",
  "docker compose --profile prod up --build",
];

export default function App() {
  return (
    <main className="shell">
      <section className="hero">
        <p className="eyebrow">Red Tetris / Frontend Ready</p>
        <h1>Un frontend prêt à coder, lancer et livrer sous Docker.</h1>
        <p className="lede">
          La base est en place pour attaquer le lobby, la room et l'interface de
          jeu sans perdre de temps sur la plomberie.
        </p>

        <div className="command-grid">
          {commands.map((command) => (
            <div className="command-card" key={command}>
              <span className="command-label">Commande</span>
              <code>{command}</code>
            </div>
          ))}
        </div>
      </section>

      <section className="content-grid">
        <article className="panel panel-accent">
          <span className="panel-kicker">Point de départ</span>
          <h2>Stack légère, base solide</h2>
          <p>
            Cette page sert de tremplin visuel. Vous pouvez remplacer ce bloc
            par votre routing, votre état global et vos premiers composants de
            gameplay dès la prochaine étape.
          </p>
        </article>

        <div className="feature-list">
          {features.map((feature) => (
            <article className="panel" key={feature.title}>
              <h3>{feature.title}</h3>
              <p>{feature.description}</p>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
