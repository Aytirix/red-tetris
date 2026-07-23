import { describe, it, expect } from "vitest";
import { frameToRgb, HAND_FRAME_SIZE } from "./frameToRgb";

type PlaneLayout = { offset: number; stride: number };

// Faux VideoFrame minimal: expose format/coded*/allocationSize/copyTo, comme WebCodecs.
function fakeFrame(format: string, width: number, height: number, bytes: number[], layout: PlaneLayout[]): VideoFrame {
	return {
		format,
		codedWidth: width,
		codedHeight: height,
		allocationSize: () => bytes.length,
		copyTo: async (dest: Uint8Array) => {
			dest.set(bytes);
			return layout;
		},
		close: () => undefined,
	} as unknown as VideoFrame;
}

describe("frameToRgb", () => {
	it("renvoie null pour un format non géré", async () => {
		const frame = fakeFrame("RGBA", 2, 2, [], []);
		expect(await frameToRgb(frame)).toBeNull();
	});

	it("convertit un I420 gris uniforme en RGB gris", async () => {
		// Y=128 (2x2), U=128, V=128 -> RGB (128,128,128).
		const frame = fakeFrame(
			"I420", 2, 2,
			[128, 128, 128, 128, 128, 128],
			[{ offset: 0, stride: 2 }, { offset: 4, stride: 1 }, { offset: 5, stride: 1 }],
		);
		const rgb = await frameToRgb(frame);
		expect(rgb).not.toBeNull();
		expect(rgb!.length).toBe(HAND_FRAME_SIZE * HAND_FRAME_SIZE * 3);
		expect([rgb![0], rgb![1], rgb![2]]).toEqual([128, 128, 128]);
	});

	it("applique la conversion YUV->RGB (rouge saturé)", async () => {
		// Y=76, U=84, V=255 -> proche du rouge pur.
		const frame = fakeFrame(
			"I420", 2, 2,
			[76, 76, 76, 76, 84, 255],
			[{ offset: 0, stride: 2 }, { offset: 4, stride: 1 }, { offset: 5, stride: 1 }],
		);
		const rgb = (await frameToRgb(frame))!;
		expect(rgb[0]).toBeGreaterThan(230); // R élevé
		expect(rgb[1]).toBeLessThan(40);     // G faible
		expect(rgb[2]).toBeLessThan(40);     // B faible
	});

	it("gère le format NV12 (U/V entrelacés)", async () => {
		// Plan Y (4 octets) puis plan chroma entrelacé UV (2 octets).
		const frame = fakeFrame(
			"NV12", 2, 2,
			[128, 128, 128, 128, 128, 128],
			[{ offset: 0, stride: 2 }, { offset: 4, stride: 2 }],
		);
		const rgb = (await frameToRgb(frame))!;
		expect([rgb[0], rgb[1], rgb[2]]).toEqual([128, 128, 128]);
	});
});
