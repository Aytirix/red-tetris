/**
 * Genere frontend/src/config/avatarCrops.json a partir des PNG d'avatars.
 *
 * Le sujet interdit Canvas cote client: le recadrage automatique des avatars
 * (detection de la bounding box alpha) est donc calcule ici, hors ligne, et le
 * client se contente de lire le JSON. Les maths sont identiques a celles qui
 * tournaient dans le navigateur, le rendu est donc inchange.
 *
 * Usage: npm run generate:avatar-crops
 */
import { inflateSync } from "node:zlib";
import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const frontendDir = resolve(scriptDir, "..");
const avatarRoot = join(frontendDir, "public", "img", "avatar");
const outputFile = join(frontendDir, "src", "config", "avatarCrops.json");

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const OVERSCAN = 1.04;
const ALPHA_THRESHOLD = 8;

function paeth(a, b, c) {
	const p = a + b - c;
	const pa = Math.abs(p - a);
	const pb = Math.abs(p - b);
	const pc = Math.abs(p - c);
	if (pa <= pb && pa <= pc) return a;
	if (pb <= pc) return b;
	return c;
}

/** Decodeur PNG minimal: 8 bits/canal, RGBA (color type 6), non entrelace. */
function decodePng(buffer) {
	for (let i = 0; i < PNG_SIGNATURE.length; i += 1) {
		if (buffer[i] !== PNG_SIGNATURE[i])
			throw new Error("not a PNG file");
	}

	let offset = 8;
	let width = 0;
	let height = 0;
	const idatChunks = [];

	while (offset < buffer.length) {
		const length = buffer.readUInt32BE(offset);
		const type = buffer.toString("ascii", offset + 4, offset + 8);
		const dataStart = offset + 8;

		if (type === "IHDR") {
			width = buffer.readUInt32BE(dataStart);
			height = buffer.readUInt32BE(dataStart + 4);
			const bitDepth = buffer[dataStart + 8];
			const colorType = buffer[dataStart + 9];
			const interlace = buffer[dataStart + 12];
			if (bitDepth !== 8 || colorType !== 6 || interlace !== 0)
				throw new Error(`unsupported PNG (bitDepth=${bitDepth}, colorType=${colorType}, interlace=${interlace})`);
		} else if (type === "IDAT") {
			idatChunks.push(buffer.subarray(dataStart, dataStart + length));
		} else if (type === "IEND") {
			break;
		}

		offset = dataStart + length + 4;
	}

	const raw = inflateSync(Buffer.concat(idatChunks));
	const bytesPerPixel = 4;
	const stride = width * bytesPerPixel;
	const pixels = Buffer.alloc(stride * height);

	for (let y = 0; y < height; y += 1) {
		const filterType = raw[y * (stride + 1)];
		const lineStart = y * (stride + 1) + 1;

		for (let x = 0; x < stride; x += 1) {
			const rawByte = raw[lineStart + x];
			const left = x >= bytesPerPixel ? pixels[y * stride + x - bytesPerPixel] : 0;
			const up = y > 0 ? pixels[(y - 1) * stride + x] : 0;
			const upLeft = y > 0 && x >= bytesPerPixel ? pixels[(y - 1) * stride + x - bytesPerPixel] : 0;

			let value;
			switch (filterType) {
				case 0: value = rawByte; break;
				case 1: value = rawByte + left; break;
				case 2: value = rawByte + up; break;
				case 3: value = rawByte + Math.floor((left + up) / 2); break;
				case 4: value = rawByte + paeth(left, up, upLeft); break;
				default: throw new Error(`unknown PNG filter ${filterType}`);
			}
			pixels[y * stride + x] = value & 0xff;
		}
	}

	return { width, height, data: pixels };
}

/** Reproduit a l'identique l'ancien computeAvatarCrop() qui tournait sur canvas. */
function computeCrop({ width, height, data }) {
	let minX = width;
	let minY = height;
	let maxX = -1;
	let maxY = -1;

	for (let y = 0; y < height; y += 1) {
		for (let x = 0; x < width; x += 1) {
			const alpha = data[(y * width + x) * 4 + 3];
			if (alpha < ALPHA_THRESHOLD) continue;
			if (x < minX) minX = x;
			if (y < minY) minY = y;
			if (x > maxX) maxX = x;
			if (y > maxY) maxY = y;
		}
	}

	const hasVisiblePixels = maxX >= minX && maxY >= minY;
	const contentWidth = hasVisiblePixels ? maxX - minX + 1 : width;
	const contentHeight = hasVisiblePixels ? maxY - minY + 1 : height;
	const contentCenterX = hasVisiblePixels ? minX + contentWidth / 2 : width / 2;
	const contentCenterY = hasVisiblePixels ? minY + contentHeight / 2 : height / 2;
	const scale = OVERSCAN / Math.max(1, Math.min(contentWidth, contentHeight));

	return {
		positionX: (contentCenterX / width) * 100,
		positionY: (contentCenterY / height) * 100,
		zoom: Math.min(3, Math.max(1.04, scale * Math.min(width, height))),
	};
}

const crops = {};

for (const faction of readdirSync(avatarRoot)) {
	const factionDir = join(avatarRoot, faction);
	for (const file of readdirSync(factionDir)) {
		if (!file.endsWith(".png")) continue;
		const publicPath = `/img/avatar/${faction}/${file}`;
		try {
			crops[publicPath] = computeCrop(decodePng(readFileSync(join(factionDir, file))));
		} catch (error) {
			console.error(`skipped ${publicPath}: ${error.message}`);
		}
	}
}

const sorted = Object.fromEntries(Object.entries(crops).sort(([a], [b]) => a.localeCompare(b)));
writeFileSync(outputFile, `${JSON.stringify(sorted, null, "\t")}\n`);
console.log(`Wrote ${Object.keys(sorted).length} avatar crops to ${outputFile}`);
