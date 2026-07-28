import type { Faction } from "../src/generated/prisma/enums.js";

// Source de vérité partagée par les deux seeds (`seed.ts` et `seed-berrys.ts`) :
// un joueur par personnage One Piece. Le username est en MINUSCULE — c'est ce que le
// joueur saisit pour se connecter, et c'est aussi le nom du fichier avatar
// (/img/avatar/<faction>/<username>.png). Postgres étant sensible à la casse,
// "Luffy" ≠ "luffy" ferait échouer la jointure des stats et du portefeuille.
export const PIRATES = ["luffy", "zoro", "sanji", "nami", "usopp", "chopper", "robin", "franky", "brook", "jinbei"];
export const MARINES = ["garp", "akainu", "aokiji", "kizaru", "sengoku", "smoker", "tashigi", "koby", "fujitora", "ryokugyu"];

// Doit couvrir le catalogue entier de la boutique (202 000 ฿ après le rééquilibrage
// des prix) : la correction doit pouvoir acheter et essayer tous les thèmes.
export const BERRYS = 500_000;

export type SeedCharacter = { username: string; avatar: string; faction: Faction };

export function makeSeedCharacters(): SeedCharacter[] {
	const build = (names: string[], faction: Faction): SeedCharacter[] =>
		names.map((name) => ({ username: name, avatar: name, faction }));
	return [...build(PIRATES, "pirate"), ...build(MARINES, "marine")];
}
