// Types du shop / portefeuille — partagés entre repo, service et emitters
// pour éviter tout cycle d'import service <-> emitter.

export type WalletRow = {
	berrys: number;
	ownedThemes: string[];
	equippedTheme: string;
};

export type ShopCatalogEntry = {
	id: string;
	price: number;
};

// État renvoyé au frontend (shop:State)
export type WalletState = {
	berrys: number;
	equipped: string;
	owned: string[];
	catalog: ShopCatalogEntry[];
};
