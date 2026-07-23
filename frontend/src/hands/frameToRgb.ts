// Conversion d'un VideoFrame (WebCodecs) en image RGB carrée, SANS canvas: on lit
// directement les plans YUV via VideoFrame.copyTo, on sous-échantillonne et on convertit
// en RGB. Le sujet interdit Canvas côté client — WebCodecs permet d'y échapper.

export const HAND_FRAME_SIZE = 256;

function clamp(x: number): number {
	return x < 0 ? 0 : x > 255 ? 255 : x | 0;
}

// Renvoie un buffer RGB HAND_FRAME_SIZE²·3, ou null si le format n'est pas géré.
// Gère I420 / I420A (plans U,V séparés) et NV12 (U/V entrelacés).
export async function frameToRgb(frame: VideoFrame): Promise<Uint8Array | null> {
	const fmt = frame.format ?? "";
	const planar = fmt.startsWith("I420");
	const nv12 = fmt === "NV12";
	if (!planar && !nv12) return null;

	const buf = new Uint8Array(frame.allocationSize());
	const layout = await frame.copyTo(buf);
	const w = frame.codedWidth;
	const h = frame.codedHeight;
	const yL = layout[0]!;
	const c1 = layout[1]!;
	const c2 = layout[2];
	const size = HAND_FRAME_SIZE;
	const out = new Uint8Array(size * size * 3);

	for (let ty = 0; ty < size; ty++) {
		const sy = ((ty * h) / size) | 0;
		const cy = sy >> 1;
		const yRow = yL.offset + sy * yL.stride;
		for (let tx = 0; tx < size; tx++) {
			const sx = ((tx * w) / size) | 0;
			const cx = sx >> 1;
			const Y = buf[yRow + sx]!;
			let U: number;
			let V: number;
			if (planar) {
				U = buf[c1.offset + cy * c1.stride + cx]!;
				V = buf[c2!.offset + cy * c2!.stride + cx]!;
			} else {
				const b = c1.offset + cy * c1.stride + cx * 2;
				U = buf[b]!;
				V = buf[b + 1]!;
			}
			const u = U - 128;
			const v = V - 128;
			const o = (ty * size + tx) * 3;
			out[o] = clamp(Y + 1.402 * v);
			out[o + 1] = clamp(Y - 0.344 * u - 0.714 * v);
			out[o + 2] = clamp(Y + 1.772 * u);
		}
	}
	return out;
}
