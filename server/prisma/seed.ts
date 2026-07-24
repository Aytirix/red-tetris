import "dotenv/config";
import { prisma } from "../src/config/prisma.js";
import type { Faction } from "../src/generated/prisma/enums.js";

// ─────────────────────────────────────────────────────────────────────────────
// Seed de correction : crée un joueur par personnage One Piece (pirates + marines),
// chacun avec son avatar, 100 000 berrys, et un historique de parties généré qui
// alimente de FAUSSES statistiques variées entre les joueurs.
//
// Approche : on génère d'abord un historique de parties (GameRecord) par joueur, puis
// on en DÉRIVE les agrégats (User.totalGames/wins/…, FactionStats) — ainsi les quatre
// niveaux de stats (individuel, classements, factions, par mode) sont cohérents.
//
// Déterministe (PRNG graine) → rejouable à l'identique. Idempotent : ré-exécuter le
// script remet les mêmes données (upsert users, remplacement des GameRecord seedés,
// FactionStats recalculées).
//
// Lancer :  DATABASE_URL=... npx tsx prisma/seed.ts   (ou `npm run seed`)
// ─────────────────────────────────────────────────────────────────────────────

// Nom d'utilisateur = personnage, avatar = fichier /img/avatar/<faction>/<avatar>.png
const PIRATES = ["luffy", "zoro", "sanji", "nami", "usopp", "chopper", "robin", "franky", "brook", "jinbei"];
const MARINES = ["garp", "akainu", "aokiji", "kizaru", "sengoku", "smoker", "tashigi", "koby", "fujitora", "ryokugyu"];

// Deux « stars » un peu plus fortes, pour un classement lisible en correction.
const STARS = new Set(["luffy", "garp"]);

// Modes de jeu à faire apparaître dans les stats « par mode » (D). Le jeu ne propose
// pour l'instant que « classique » ; on saupoudre les autres modes (déjà définis côté
// serveur) pour DÉMONTRER que le niveau D fonctionne dès qu'ils seront rouverts.
const SECONDARY_MODES = ["sprint", "ultra", "suddendeath", "invisible"];

const BERRYS = 100_000;

type Character = { username: string; avatar: string; faction: Faction; skill: number };

// PRNG déterministe (mulberry32) : même graine → même suite.
function mulberry32(seed: number): () => number {
	let a = seed >>> 0;
	return () => {
		a |= 0;
		a = (a + 0x6d2b79f5) | 0;
		let t = Math.imul(a ^ (a >>> 15), 1 | a);
		t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

// Graine stable dérivée d'une chaîne (pour que chaque joueur ait sa propre suite).
function hashSeed(text: string): number {
	let h = 2166136261;
	for (let i = 0; i < text.length; i++) {
		h ^= text.charCodeAt(i);
		h = Math.imul(h, 16777619);
	}
	return h >>> 0;
}

function makeCharacters(): Character[] {
	const build = (names: string[], faction: Faction): Character[] =>
		names.map((name) => {
			// Niveau ~[0.25, 0.9], relevé pour les stars : fait varier V/D, scores, etc.
			const base = 0.25 + (hashSeed(name) % 1000) / 1000 * 0.6;
			const skill = Math.min(0.95, STARS.has(name) ? base + 0.25 : base);
			// username = nom EN MINUSCULE : identique à ce que le joueur saisit pour se
			// connecter et au fichier avatar (/img/avatar/<faction>/<name>.png). Postgres
			// étant sensible à la casse, "Luffy" ≠ "luffy" ferait échouer la jointure des
			// stats et du portefeuille.
			return { username: name, avatar: name, faction, skill };
		});
	return [...build(PIRATES, "pirate"), ...build(MARINES, "marine")];
}

type Game = {
	mode: string;
	score: number;
	lines: number;
	tetris: number;
	level: number;
	won: boolean;
	durationMs: number;
};

// Historique de parties d'un personnage, façonné par son niveau (skill).
function generateGames(character: Character): Game[] {
	const rng = mulberry32(hashSeed(`${character.username}:games`));
	const count = 6 + Math.floor(rng() * 25); // 6 à 30 parties
	const winRate = 0.3 + character.skill * 0.5; // 0.3 à ~0.78
	const games: Game[] = [];
	for (let i = 0; i < count; i++) {
		// 80 % classique, sinon un mode secondaire (pour peupler le niveau D).
		const mode = rng() < 0.8 ? "classique" : SECONDARY_MODES[Math.floor(rng() * SECONDARY_MODES.length)]!;
		const lines = 4 + Math.floor(rng() * (25 + character.skill * 40));
		const tetris = Math.floor((lines / 4) * (0.2 + rng() * 0.5)); // une part des lignes en Tetris
		const level = 1 + Math.floor(lines / 10);
		const score = Math.round(400 + character.skill * 3500 + lines * 45 + tetris * 300 + rng() * 1500);
		const won = rng() < winRate;
		const durationMs = 45_000 + Math.floor(rng() * 555_000); // 45 s à 10 min
		games.push({ mode, score, lines, tetris, level, won, durationMs });
	}
	return games;
}

type Aggregate = {
	totalGames: number;
	wins: number;
	losses: number;
	totalLines: number;
	totalTetris: number;
	bestScore: number;
	playtimeMs: number;
};

function aggregate(games: Game[]): Aggregate {
	const wins = games.filter((g) => g.won).length;
	return {
		totalGames: games.length,
		wins,
		losses: games.length - wins, // toutes les parties seedées sont décisives
		totalLines: games.reduce((s, g) => s + g.lines, 0),
		totalTetris: games.reduce((s, g) => s + g.tetris, 0),
		bestScore: games.reduce((m, g) => Math.max(m, g.score), 0),
		playtimeMs: games.reduce((s, g) => s + g.durationMs, 0),
	};
}

async function main() {
	if (!process.env.DATABASE_URL) {
		console.error("❌ DATABASE_URL manquant. Lance le script avec la variable d'environnement de la base.");
		process.exit(1);
	}

	const characters = makeCharacters();
	const usernames = characters.map((c) => c.username);

	// Idempotence : on efface l'historique des personnages seedés avant de le recréer.
	await prisma.gameRecord.deleteMany({ where: { username: { in: usernames } } });

	const factionTotals: Record<Faction, Aggregate & { bestScore: number }> = {
		marine: { totalGames: 0, wins: 0, losses: 0, totalLines: 0, totalTetris: 0, bestScore: 0, playtimeMs: 0 },
		pirate: { totalGames: 0, wins: 0, losses: 0, totalLines: 0, totalTetris: 0, bestScore: 0, playtimeMs: 0 },
	};

	for (const character of characters) {
		const games = generateGames(character);
		const agg = aggregate(games);

		// Upsert du joueur : avatar, faction, 100 000 berrys et agrégats de stats.
		await prisma.user.upsert({
			where: { username: character.username },
			create: {
				username: character.username,
				faction: character.faction,
				avatar: character.avatar,
				berrys: BERRYS,
				totalGames: agg.totalGames,
				wins: agg.wins,
				losses: agg.losses,
				totalLines: agg.totalLines,
				totalTetris: agg.totalTetris,
				bestScore: agg.bestScore,
				playtimeMs: agg.playtimeMs,
			},
			update: {
				faction: character.faction,
				avatar: character.avatar,
				berrys: BERRYS,
				totalGames: agg.totalGames,
				wins: agg.wins,
				losses: agg.losses,
				totalLines: agg.totalLines,
				totalTetris: agg.totalTetris,
				bestScore: agg.bestScore,
				playtimeMs: agg.playtimeMs,
			},
		});

		// Historique détaillé (source de vérité, alimente les stats « par mode »).
		await prisma.gameRecord.createMany({
			data: games.map((g) => ({
				username: character.username,
				faction: character.faction,
				mode: g.mode,
				score: g.score,
				lines: g.lines,
				tetris: g.tetris,
				level: g.level,
				won: g.won,
				durationMs: g.durationMs,
			})),
		});

		// Cumul par faction.
		const ft = factionTotals[character.faction];
		ft.totalGames += agg.totalGames;
		ft.wins += agg.wins;
		ft.losses += agg.losses;
		ft.totalLines += agg.totalLines;
		ft.totalTetris += agg.totalTetris;
		ft.playtimeMs += agg.playtimeMs;
		ft.bestScore = Math.max(ft.bestScore, agg.bestScore);

		console.log(
			`  ${character.faction === "pirate" ? "🏴" : "⚓"} ${character.username.padEnd(9)} ` +
			`${agg.totalGames} parties · ${agg.wins}V/${agg.losses}D · best ${agg.bestScore} · ${agg.totalTetris} tetris`,
		);
	}

	// FactionStats : on écrit les totaux seedés (SET, pas increment) pour rester idempotent.
	for (const faction of ["marine", "pirate"] as Faction[]) {
		const ft = factionTotals[faction];
		await prisma.factionStats.upsert({
			where: { faction },
			create: {
				faction,
				wins: ft.wins,
				losses: ft.losses,
				tetris: ft.totalTetris,
				lines: ft.totalLines,
				bestScore: ft.bestScore,
			},
			update: {
				wins: ft.wins,
				losses: ft.losses,
				tetris: ft.totalTetris,
				lines: ft.totalLines,
				bestScore: ft.bestScore,
			},
		});
	}

	const marine = factionTotals.marine;
	const pirate = factionTotals.pirate;
	const leader = pirate.wins === marine.wins ? "égalité" : pirate.wins > marine.wins ? "🏴 Pirates" : "⚓ Marines";
	console.log(`\n✅ ${characters.length} joueurs seedés (100 000 ฿ chacun).`);
	console.log(`   Camps → Pirates ${pirate.wins}V · Marines ${marine.wins}V · Meilleur camp : ${leader}`);
	console.log("   ⚠️  FactionStats a été réécrit avec les totaux seedés (données de démo).");
}

main()
	.catch((err) => {
		console.error("❌ Seed échoué :", err);
		process.exit(1);
	})
	.finally(() => prisma.$disconnect());
