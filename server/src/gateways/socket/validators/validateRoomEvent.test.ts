import { describe, it, expect } from "vitest";
import {
	isValidRoomJoinPayload,
	isValidRoomKickPayload,
	isValidRoomModePayload,
	isValidRoomName,
	isValidRoomSetPrivatePayload,
	isValidSubscribeSpectatorPayload,
} from "./validateRoomEvent.js";

describe("validateRoomEvent", () => {
	describe("isValidRoomName", () => {
		it("accepts alphanumeric names and underscores up to 15 chars", () => {
			expect(isValidRoomName("salle1")).toBe(true);
			expect(isValidRoomName("Grand_Line_42")).toBe(true);
			expect(isValidRoomName("a".repeat(15))).toBe(true);
		});

		it("refuses an empty name or a name that is too long", () => {
			expect(isValidRoomName("")).toBe(false);
			expect(isValidRoomName("a".repeat(16))).toBe(false);
		});

		it("refuses special characters", () => {
			expect(isValidRoomName("salle 1")).toBe(false);
			expect(isValidRoomName("salle/1")).toBe(false);
			expect(isValidRoomName("../etc")).toBe(false);
		});
	});

	describe("isValidRoomJoinPayload", () => {
		it("accepts { roomId: string }", () => {
			expect(isValidRoomJoinPayload({ roomId: "salle1" })).toBe(true);
		});

		it("refuses a wrong shape", () => {
			expect(isValidRoomJoinPayload(null)).toBe(false);
			expect(isValidRoomJoinPayload(undefined)).toBe(false);
			expect(isValidRoomJoinPayload("salle1")).toBe(false);
			expect(isValidRoomJoinPayload({})).toBe(false);
			expect(isValidRoomJoinPayload({ roomId: 42 })).toBe(false);
			expect(isValidRoomJoinPayload({ room: "salle1" })).toBe(false);
		});

		it("refuses extra keys", () => {
			expect(isValidRoomJoinPayload({ roomId: "salle1", admin: true })).toBe(false);
		});
	});

	describe("isValidRoomKickPayload", () => {
		it("accepts { username: string }", () => {
			expect(isValidRoomKickPayload({ username: "zoro" })).toBe(true);
		});

		it("refuses anything else", () => {
			expect(isValidRoomKickPayload(null)).toBe(false);
			expect(isValidRoomKickPayload({})).toBe(false);
			expect(isValidRoomKickPayload({ username: 1 })).toBe(false);
			expect(isValidRoomKickPayload({ username: "zoro", roomId: "x" })).toBe(false);
		});
	});

	describe("isValidRoomModePayload", () => {
		it("accepts { mode: string }", () => {
			expect(isValidRoomModePayload({ mode: "ultra" })).toBe(true);
			// La validation de la VALEUR du mode est faite par Room.setMode.
			expect(isValidRoomModePayload({ mode: "n'importe quoi" })).toBe(true);
		});

		it("refuses anything else", () => {
			expect(isValidRoomModePayload(null)).toBe(false);
			expect(isValidRoomModePayload({})).toBe(false);
			expect(isValidRoomModePayload({ mode: 3 })).toBe(false);
			expect(isValidRoomModePayload({ mode: "ultra", extra: 1 })).toBe(false);
		});
	});

	describe("isValidRoomSetPrivatePayload", () => {
		it("accepts { private: boolean }", () => {
			expect(isValidRoomSetPrivatePayload({ private: true })).toBe(true);
			expect(isValidRoomSetPrivatePayload({ private: false })).toBe(true);
		});

		it("refuses anything else", () => {
			expect(isValidRoomSetPrivatePayload(null)).toBe(false);
			expect(isValidRoomSetPrivatePayload({})).toBe(false);
			expect(isValidRoomSetPrivatePayload({ private: "true" })).toBe(false);
			expect(isValidRoomSetPrivatePayload({ private: true, roomId: "x" })).toBe(false);
		});
	});

	describe("isValidSubscribeSpectatorPayload", () => {
		it("accepts { roomId, user } with a username or null", () => {
			expect(isValidSubscribeSpectatorPayload({ roomId: "salle1", user: "zoro" })).toBe(true);
			expect(isValidSubscribeSpectatorPayload({ roomId: "salle1", user: null })).toBe(true);
		});

		it("refuses anything else", () => {
			expect(isValidSubscribeSpectatorPayload(null)).toBe(false);
			expect(isValidSubscribeSpectatorPayload({ roomId: "salle1" })).toBe(false);
			expect(isValidSubscribeSpectatorPayload({ roomId: 1, user: null })).toBe(false);
			expect(isValidSubscribeSpectatorPayload({ roomId: "salle1", user: 42 })).toBe(false);
			expect(isValidSubscribeSpectatorPayload({ roomId: "s", user: null, extra: 1 })).toBe(false);
		});
	});
});
