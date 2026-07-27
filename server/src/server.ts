import { createApp } from "./app.js";
import { createServer } from "node:http";
import { initSocket } from "./gateways/socket/socketInit.js";

const app = createApp();
const server = createServer(app);
const PORT = process.env.PORT || 3000;
initSocket(server);

// Un 'error' sans ecouteur sur un serveur HTTP est relance en exception fatale avec
// une trace illisible. On journalise le motif reel (EADDRINUSE, EACCES...) puis on
// SORT en echec: un process qui n'ecoute rien doit mourir pour que l'orchestrateur
// (restart: unless-stopped) le relance, pas rester en vie a ne servir personne.
server.on("error", (error) => {
	console.error("HTTP server failed to start:", error);
	process.exit(1);
});

server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

// PAS de process.on("uncaughtException") ici. Le reflexe est tentant — « une partie
// fautive ne doit pas emporter les autres » — mais maintenir le process en vie apres
// une exception non rattrapee le laisse dans un etat indefini (Node le documente) ET
// masque les pannes de demarrage: un EADDRINUSE donnerait un process zombie, sorti en
// code 0, que `restart: unless-stopped` ne relancerait jamais. Les sources connues
// sont isolees LA OU elles se produisent: try/catch autour du tick de gravite
// (Game.restartTickInterval) et .catch sur chaque promesse non attendue.