import { beforeEach, describe, expect, it, vi } from "vitest";

const { ioMock, fakeSocket } = vi.hoisted(() => {
	const fakeSocket = {
		on: vi.fn(),
		off: vi.fn(),
		emit: vi.fn(),
		connected: false,
	};
	return { ioMock: vi.fn(() => fakeSocket), fakeSocket };
});

vi.mock("socket.io-client", () => ({
	io: ioMock,
	Socket: class {},
}));

import { emitShopBuy, emitShopEquip, emitShopGet } from "./shop";

describe("emitters shop", () => {
	beforeEach(() => {
		fakeSocket.emit.mockClear();
	});

	it("emet shop:Get sans payload (identite deduite cote serveur)", () => {
		emitShopGet();
		expect(fakeSocket.emit).toHaveBeenCalledTimes(1);
		expect(fakeSocket.emit).toHaveBeenCalledWith("shop:Get");
	});

	it("emet shop:Buy avec l'identifiant du theme", () => {
		emitShopBuy("synthwave");
		expect(fakeSocket.emit).toHaveBeenCalledWith("shop:Buy", { themeId: "synthwave" });
	});

	it("emet shop:Equip avec l'identifiant du theme", () => {
		emitShopEquip("jewel");
		expect(fakeSocket.emit).toHaveBeenCalledWith("shop:Equip", { themeId: "jewel" });
	});

	it("n'envoie jamais le pseudo dans le payload", () => {
		emitShopBuy("jewel");
		emitShopEquip("jewel");

		for (const call of fakeSocket.emit.mock.calls) {
			expect(JSON.stringify(call[1] ?? {})).not.toContain("username");
		}
	});
});
