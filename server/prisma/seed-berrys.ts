import "dotenv/config";
import { prisma } from "../src/config/prisma.js";
import type { Faction } from "../src/generated/prisma/enums.js";
import { BERRYS, makeSeedCharacters } from "./characters.js";

// ─────────────────────────────────────────────────────────────────────────────
// Seed « portefeuille seul » : crée le même casting One Piece que `seed.ts`
// (pirates + marines, avec leur avatar) et leur donne 500 000 berrys, mais SANS
// aucune statistique : pas d'historique de parties, agrégats à zéro.
//
// Utile pour une démo « page blanche » : les comptes existent et peuvent acheter
// des thèmes, mais les classements et les stats partent de zéro et ne se
// remplissent qu'avec de vraies parties.
//
// Idempotent : ré-exécuter le script redonne exactement le même état (500 000 ฿,
// stats à zéro, historique supprimé pour ces joueurs).
//
// Lancer :  DATABASE_URL=... npx tsx prisma/seed-berrys.ts   (ou `npm run seed:berrys`)
// ─────────────────────────────────────────────────────────────────────────────

// Stats remises à zéro : ces colonnes ne sont qu'un cache d'affichage, elles
// doivent rester cohérentes avec l'historique GameRecord qu'on efface juste après.
const ZERO_STATS = {
	totalGames: 0,
	wins: 0,
	losses: 0,
	totalLines: 0,
	totalTetris: 0,
	bestScore: 0,
	playtimeMs: 0,
};

async function main() {
	if (!process.env.DATABASE_URL) {
		console.error("❌ DATABASE_URL manquant. Lance le script avec la variable d'environnement de la base.");
		process.exit(1);
	}

	const characters = makeSeedCharacters();
	const usernames = characters.map((c) => c.username);

	// Aucune statistique : on efface l'historique des personnages seedés (sinon les
	// stats « par mode » et les classements continueraient d'afficher d'anciennes parties).
	const removed = await prisma.gameRecord.deleteMany({ where: { username: { in: usernames } } });

	for (const character of characters) {
		await prisma.user.upsert({
			where: { username: character.username },
			create: {
				username: character.username,
				faction: character.faction,
				avatar: character.avatar,
				berrys: BERRYS,
				...ZERO_STATS,
			},
			update: {
				faction: character.faction,
				avatar: character.avatar,
				berrys: BERRYS,
				...ZERO_STATS,
			},
		});

		console.log(
			`  ${character.faction === "pirate" ? "🏴" : "⚓"} ${character.username.padEnd(9)} ` +
			`${BERRYS.toLocaleString("fr-FR")} ฿ · aucune statistique`,
		);
	}

	// FactionStats remis à zéro pour rester cohérent : sans historique, un camp ne peut
	// pas afficher de victoires. (SET, pas increment → idempotent.)
	for (const faction of ["marine", "pirate"] as Faction[]) {
		await prisma.factionStats.upsert({
			where: { faction },
			create: { faction, wins: 0, losses: 0, tetris: 0, lines: 0, bestScore: 0 },
			update: { wins: 0, losses: 0, tetris: 0, lines: 0, bestScore: 0 },
		});
	}

	console.log(`\n✅ ${characters.length} joueurs seedés (${BERRYS.toLocaleString("fr-FR")} ฿ chacun, stats vierges).`);
	console.log(`   ${removed.count} parties d'historique supprimées · FactionStats remis à zéro.`);
}

main()
	.catch((err) => {
		console.error("❌ Seed échoué :", err);
		process.exit(1);
	})
	.finally(() => prisma.$disconnect());
