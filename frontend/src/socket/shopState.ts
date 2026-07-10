import { DEFAULT_THEME_ID } from "../config/pieceThemes";

export type ShopCatalogEntry = { id: string; price: number };

export type ShopState = {
	berrys: number;
	owned: string[];
	equipped: string;
	catalog: ShopCatalogEntry[];
};

function normalizeCatalog(raw: unknown): ShopCatalogEntry[] {
	if (!Array.isArray(raw)) return [];
	const out: ShopCatalogEntry[] = [];
	for (const item of raw) {
		if (!item || typeof item !== "object") continue;
		const id = (item as { id?: unknown }).id;
		const price = (item as { price?: unknown }).price;
		if (typeof id !== "string" || typeof price !== "number") continue;
		out.push({ id, price: Math.max(0, Math.floor(price)) });
	}
	return out;
}

// shop:State (back -> front)
export function normalizeShopState(raw: unknown): ShopState | null {
	if (!raw || typeof raw !== "object") return null;
	const r = raw as Record<string, unknown>;

	const berrys = typeof r.berrys === "number" && r.berrys >= 0 ? Math.floor(r.berrys) : 0;
	const owned = Array.isArray(r.owned)
		? r.owned.filter((x): x is string => typeof x === "string")
		: [DEFAULT_THEME_ID];
	if (!owned.includes(DEFAULT_THEME_ID)) owned.push(DEFAULT_THEME_ID);
	const equipped =
		typeof r.equipped === "string" && owned.includes(r.equipped) ? r.equipped : DEFAULT_THEME_ID;
	const catalog = normalizeCatalog(r.catalog);

	return { berrys, owned, equipped, catalog };
}

export function normalizeShopError(raw: unknown): string | null {
	if (!raw || typeof raw !== "object") return null;
	const message = (raw as { message?: unknown }).message;
	return typeof message === "string" ? message : "Opération impossible";
}
