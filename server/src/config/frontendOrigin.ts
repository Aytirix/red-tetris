const frontendPort = process.env.PORT_DEV_FRONTEND || 5173;
const configuredOrigins = process.env.FRONTEND_ORIGIN?.split(",")
	.map((origin) => origin.trim())
	.filter(Boolean);

export const frontendOrigins = configuredOrigins?.length
	? configuredOrigins
	: [
		`http://localhost:${frontendPort}`,
		`http://127.0.0.1:${frontendPort}`,
	];

export function resolveFrontendOrigin(origin: string | undefined): string {
	if (origin && frontendOrigins.includes(origin))
		return origin;
	return frontendOrigins[0] ?? `http://localhost:${frontendPort}`;
}
