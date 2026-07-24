import type { Socket } from "socket.io";
import {
	creditBerrys,
	getWalletRow,
	purchaseThemeTx,
	setEquippedTheme,
} from "../repositories/userRepositories.js";
import { DEFAULT_THEME_ID, SHOP_THEMES, getShopTheme, isShopThemeId } from "../config/shopThemes.js";
import { emitShopState } from "../gateways/socket/emitters/shopEmitters.js";
import type { WalletRow, WalletState } from "../types/shopTypes.js";

// neon-gem est TOUJOURS possédé (défaut gratuit) même s'il n'est pas dans ownedThemes.
function ownedThemesOf(row: { ownedThemes?: string[] | null } | null): Set<string> {
	const owned = new Set<string>([DEFAULT_THEME_ID]);
	if (row?.ownedThemes) {
		for (const t of row.ownedThemes) owned.add(t);
	}
	return owned;
}

/**
 * Thème réellement équipé: un thème non possédé (retiré du catalogue, données
 * incohérentes) retombe sur le défaut. Partagé entre l'état boutique et le thème
 * embarqué sur le Player (cosmétique vu par les spectateurs).
 */
export function resolveEquippedTheme(
	row: { equippedTheme?: string | null; ownedThemes?: string[] | null } | null,
): string {
	const owned = ownedThemesOf(row);
	const equipped = row?.equippedTheme ?? DEFAULT_THEME_ID;
	return owned.has(equipped) ? equipped : DEFAULT_THEME_ID;
}

function toWalletState(row: WalletRow | null): WalletState {
	return {
		berrys: row?.berrys ?? 0,
		equipped: resolveEquippedTheme(row),
		owned: [...ownedThemesOf(row)],
		catalog: SHOP_THEMES.map((t) => ({ id: t.id, price: t.price })),
	};
}

export async function getWalletState(username: string): Promise<WalletState> {
	return toWalletState(await getWalletRow(username));
}

export async function buyThemeForUser(username: string, themeId: string): Promise<WalletState> {
	if (!isShopThemeId(themeId)) throw new Error("UNKNOWN_THEME");
	const theme = getShopTheme(themeId)!;
	if (themeId === DEFAULT_THEME_ID || theme.price <= 0) throw new Error("NOT_PURCHASABLE");
	const row = await purchaseThemeTx(username, themeId, theme.price);
	return toWalletState(row);
}

export async function equipThemeForUser(username: string, themeId: string): Promise<WalletState> {
	if (!isShopThemeId(themeId)) throw new Error("UNKNOWN_THEME");
	if (themeId !== DEFAULT_THEME_ID) {
		const row = await getWalletRow(username);
		if (!row || !row.ownedThemes.includes(themeId)) throw new Error("NOT_OWNED");
	}
	await setEquippedTheme(username, themeId);
	return getWalletState(username);
}

// Fin de partie: crédite chaque joueur de son score final, puis pousse le
// portefeuille à jour à son socket (mise à jour live du solde). Best-effort,
// ne bloque pas la partie. Appelé UNE seule fois par partie (checkGameOver).
export async function settleGameRewards(
	entries: { username: string; score: number; socket: Socket }[],
): Promise<void> {
	for (const entry of entries) {
		try {
			if (entry.score > 0) {
				await creditBerrys(entry.username, entry.score);
			}
			emitShopState(entry.socket, await getWalletState(entry.username));
		} catch (err) {
			console.error(`settleGameRewards failed for ${entry.username}:`, err);
		}
	}
}
