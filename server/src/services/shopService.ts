import type { Socket } from "socket.io";
import {
	creditBerrys,
	getWalletRow,
	purchaseThemeTx,
	setEquippedTheme,
} from "../repositories/userRepositories.js";
import { DEFAULT_THEME_ID, SHOP_THEMES, getShopTheme, isShopThemeId } from "../config/shopThemes.js";
import { emitShopState } from "../gateways/socket/emitters/shopEmitters.js";
import { recordGameResults } from "./statsService.js";
import type { WalletRow, WalletState } from "../types/shopTypes.js";
import type { GameResultInput } from "../types/statsTypes.js";

// neon-gem est TOUJOURS possédé (défaut gratuit) même s'il n'est pas dans ownedThemes.
function ownedThemesOf(row: { ownedThemes?: string[] | null } | null): Set<string> {
	const owned = new Set<string>([DEFAULT_THEME_ID]);
	if (row?.ownedThemes) {
		for (const t of row.ownedThemes) owned.add(t);
	}
	return owned;
}

/** Theme equipe, ou le theme par defaut si celui enregistre n'est pas possede. */
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

// Entrée de règlement de fin de partie : les données de stats (GameResultInput) plus
// le socket, nécessaire pour repousser le portefeuille à jour au joueur concerné.
export type GameSettlementEntry = GameResultInput & { socket: Socket };
export async function settleGameRewards(entries: GameSettlementEntry[]): Promise<void> {
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
	try {
		await recordGameResults(entries);
	} catch (err) {
		console.error("recordGameResults failed:", err);
	}
}
