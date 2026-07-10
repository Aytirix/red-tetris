import type { Socket } from "socket.io";
import {prisma} from "../config/prisma.js";
import type { User } from "../generated/prisma/client.js";
import type { Faction } from "../generated/prisma/enums.js";
import { userSocketStore } from "../gateways/socket/userSocketStore.js";
import { error } from "node:console";
import type { WalletRow } from "../types/shopTypes.js";

export async function findUserByUsername(username: string) : Promise<User | null> {
	return await prisma.user.findUnique({
		where: {username: username},
	});
}

export async function postUsername(socket: Socket, faction: Faction, avatar: string) : Promise<User> {
	const session = userSocketStore.get(socket.id);
	if (!session || !session.username) {
		throw new Error("Username not found for this socket");
	}
	return await prisma.user.create({
	data: {
		username: session.username,
		faction,
		avatar,
	},
	});
}

// ─── Portefeuille / thèmes (shop) ──────────────────────────────────────────────

const WALLET_SELECT = { berrys: true, ownedThemes: true, equippedTheme: true } as const;

// Crédite le solde du joueur (cumul des scores de fin de partie) — atomique.
export async function creditBerrys(username: string, amount: number): Promise<void> {
	await prisma.user.update({
		where: { username },
		data: { berrys: { increment: amount } },
	});
}

// Lecture ciblée du portefeuille + thèmes.
export async function getWalletRow(username: string): Promise<WalletRow | null> {
	return await prisma.user.findUnique({
		where: { username },
		select: WALLET_SELECT,
	});
}

export async function setEquippedTheme(username: string, themeId: string): Promise<void> {
	await prisma.user.update({
		where: { username },
		data: { equippedTheme: themeId },
	});
}

// Achat atomique: vérifie fonds + non-possession DANS la transaction pour rester
// autoritatif serveur et éviter double-achat / solde négatif en cas de course.
export async function purchaseThemeTx(username: string, themeId: string, price: number): Promise<WalletRow> {
	return await prisma.$transaction(async (tx) => {
		const user = await tx.user.findUnique({ where: { username }, select: WALLET_SELECT });
		if (!user) throw new Error("USER_NOT_FOUND");
		if (user.ownedThemes.includes(themeId)) throw new Error("ALREADY_OWNED");
		if (user.berrys < price) throw new Error("INSUFFICIENT_FUNDS");
		return await tx.user.update({
			where: { username },
			data: {
				berrys: { decrement: price },
				ownedThemes: { push: themeId },
				equippedTheme: themeId,
			},
			select: WALLET_SELECT,
		});
	});
}