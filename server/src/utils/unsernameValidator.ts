const USERNAME_REGEX = /^[a-zA-Z0-9_]{1,15}$/;

export function isValidUsername(username: string): boolean {
	return USERNAME_REGEX.test(username);
}