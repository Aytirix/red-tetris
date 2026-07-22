import { describe, expect, it } from "vitest";
import { APP_NAME } from "./config";

describe("config", () => {
	it("expose le nom de l'application affiche dans l'interface", () => {
		expect(APP_NAME).toBe("Red Piece");
	});
});
