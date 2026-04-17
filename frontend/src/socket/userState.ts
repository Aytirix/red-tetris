export const USER_RESULT_USERNAME_AVAILABLE_EVENT = "user:ResultUsernameAvailable";

export type AppFaction = "pirate" | "marine";

export type UsernameAvailabilityPayload = {
	available: boolean;
	user_faction: unknown;
	username: string;
};

export type NormalizedUsernameAvailability = {
	available: boolean;
	isRegistered: boolean;
	user_faction: AppFaction | null;
	username: string;
	raw: UsernameAvailabilityPayload;
};

const FACTION_ALIASES: Record<string, AppFaction> = {
	pirate: "pirate",
	marine: "marine",
};

export function normalizeUserFaction(value: unknown): AppFaction | null {
	if (typeof value !== "string") return null;

	return FACTION_ALIASES[value.toLowerCase()] ?? null;
}

export function hasUserFaction(value: unknown): boolean {
	return value === true || normalizeUserFaction(value) !== null;
}

export function normalizeUsernameAvailability(value: unknown): NormalizedUsernameAvailability | null {
	if (!value || typeof value !== "object") return null;

	const payload = value as Record<string, unknown>;
	const { available, user_faction, username } = payload;

	if (typeof available !== "boolean" || typeof username !== "string") {
		return null;
	}

	return {
		available,
		isRegistered: hasUserFaction(user_faction),
		user_faction: normalizeUserFaction(user_faction),
		username,
		raw: {
			available,
			user_faction,
			username,
		},
	};
}
