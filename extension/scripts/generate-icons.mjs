#!/usr/bin/env node
/**
 * Generates minimal solid-color PNG placeholders for the extension at
 * 16/32/48/128 sizes. Run once at scaffolding time. Replace with real artwork
 * (drag into extension/public/icons/) whenever you have a logo.
 */
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { deflateSync } from "node:zlib";

const here = dirname(fileURLToPath(import.meta.url));
const iconsDir = resolve(here, "..", "public", "icons");

const COLOR = { r: 0xff, g: 0x66, b: 0x00 };
const SIZES = [16, 32, 48, 128];

const crcTable = (() => {
	const table = new Uint32Array(256);
	for (let n = 0; n < 256; n++) {
		let c = n;
		for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
		table[n] = c;
	}
	return table;
})();

function crc32(buf) {
	let c = 0xffffffff;
	for (let i = 0; i < buf.length; i++) c = crcTable[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
	return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
	const len = Buffer.alloc(4);
	len.writeUInt32BE(data.length, 0);
	const typeBuf = Buffer.from(type, "ascii");
	const crcInput = Buffer.concat([typeBuf, data]);
	const crcBuf = Buffer.alloc(4);
	crcBuf.writeUInt32BE(crc32(crcInput), 0);
	return Buffer.concat([len, typeBuf, data, crcBuf]);
}

function buildSolidPng(size, { r, g, b }) {
	const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

	const ihdr = Buffer.alloc(13);
	ihdr.writeUInt32BE(size, 0);
	ihdr.writeUInt32BE(size, 4);
	ihdr[8] = 8; // bit depth
	ihdr[9] = 2; // color type: RGB
	ihdr[10] = 0; // compression
	ihdr[11] = 0; // filter
	ihdr[12] = 0; // interlace

	const stride = size * 3;
	const raw = Buffer.alloc((stride + 1) * size);
	for (let y = 0; y < size; y++) {
		const rowStart = y * (stride + 1);
		raw[rowStart] = 0; // filter: None
		for (let x = 0; x < size; x++) {
			const px = rowStart + 1 + x * 3;
			raw[px] = r;
			raw[px + 1] = g;
			raw[px + 2] = b;
		}
	}
	const idat = deflateSync(raw);

	return Buffer.concat([sig, chunk("IHDR", ihdr), chunk("IDAT", idat), chunk("IEND", Buffer.alloc(0))]);
}

await mkdir(iconsDir, { recursive: true });
for (const size of SIZES) {
	const png = buildSolidPng(size, COLOR);
	await writeFile(resolve(iconsDir, `icon-${size}.png`), png);
	console.log(`[generate-icons] wrote icon-${size}.png (${png.length} bytes)`);
}
