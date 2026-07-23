import { describe, it, expect } from "vitest";
import { isValidUsername } from "./unsernameValidator.js";

describe("isValidUsername", () => {
	it("accepts letters, digits and underscores", () => {
		expect(isValidUsername("luffy")).toBe(true);
		expect(isValidUsername("Zoro42")).toBe(true);
		expect(isValidUsername("nico_robin")).toBe(true);
		expect(isValidUsername("A")).toBe(true);
		expect(isValidUsername("_")).toBe(true);
		expect(isValidUsername("123456789")).toBe(true);
	});

	it("accepts exactly 15 characters", () => {
		expect(isValidUsername("a".repeat(15))).toBe(true);
	});

	it("refuses more than 15 characters", () => {
		expect(isValidUsername("a".repeat(16))).toBe(false);
	});

	it("refuses an empty username", () => {
		expect(isValidUsername("")).toBe(false);
	});

	it("refuses special characters", () => {
		expect(isValidUsername("lu ffy")).toBe(false);
		expect(isValidUsername("luffy!")).toBe(false);
		expect(isValidUsername("luffy-san")).toBe(false);
		expect(isValidUsername("lu.ffy")).toBe(false);
		expect(isValidUsername("<script>")).toBe(false);
		expect(isValidUsername("émile")).toBe(false);
	});

	it("refuses a username containing a newline", () => {
		expect(isValidUsername("luffy\nzoro")).toBe(false);
		expect(isValidUsername("luffy\n")).toBe(false);
	});
});
