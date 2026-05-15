import { frontendOrigins } from "./frontendOrigin.js";

export const socketConfig = {
	cors: {
		origin: frontendOrigins,
		methods: ["GET", "POST"],
	},
};
