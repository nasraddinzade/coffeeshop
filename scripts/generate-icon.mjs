// Copyright (c) 2026 Ramin Nasraddinzade
// SPDX-License-Identifier: MIT

/**
 * Draws the application icon (a coffee cup on a rounded square) and writes it
 * to app-icon.png. Run it, then regenerate the platform icon set:
 *
 *   node scripts/generate-icon.mjs
 *   npx tauri icon app-icon.png
 *
 * Everything is plain pixel maths so the repository needs no image toolchain.
 */

import { deflateSync } from 'node:zlib';
import { writeFileSync } from 'node:fs';
import { Buffer } from 'node:buffer';

const SIZE = 1024;

const BACKGROUND = [61, 40, 30];
const CUP = [250, 249, 246];
const COFFEE = [122, 79, 47];
const ACCENT = [76, 175, 80];

/** Coverage of a shape at a pixel, anti-aliased over a 1px band. */
function edge(distance) {
  return Math.min(1, Math.max(0, 0.5 - distance));
}

function roundedRect(x, y, left, top, right, bottom, radius) {
  const dx = Math.max(left - x, 0, x - right);
  const dy = Math.max(top - y, 0, y - bottom);
  return Math.hypot(dx, dy) - radius;
}

function ellipse(x, y, cx, cy, rx, ry) {
  const nx = (x - cx) / rx;
  const ny = (y - cy) / ry;
  // Approximate signed distance, good enough for anti-aliasing.
  return (Math.hypot(nx, ny) - 1) * Math.min(rx, ry);
}

function mix(base, colour, alpha) {
  return [
    base[0] + (colour[0] - base[0]) * alpha,
    base[1] + (colour[1] - base[1]) * alpha,
    base[2] + (colour[2] - base[2]) * alpha,
  ];
}

function shade(x, y) {
  let colour = [0, 0, 0];
  let alpha = 0;

  const background = edge(roundedRect(x, y, 96, 96, SIZE - 96, SIZE - 96, 176));
  if (background <= 0) return [0, 0, 0, 0];
  colour = BACKGROUND;
  alpha = background;

  // Handle: a ring on the right side of the cup.
  const handleOuter = edge(ellipse(x, y, 690, 500, 150, 150));
  const handleInner = edge(ellipse(x, y, 690, 500, 88, 88));
  const handle = Math.max(0, handleOuter - handleInner);
  colour = mix(colour, CUP, handle);

  // Cup body.
  const body = edge(roundedRect(x, y, 300, 372, 660, 660, 44));
  colour = mix(colour, CUP, body);

  // Coffee surface.
  const surface = edge(ellipse(x, y, 480, 396, 168, 42));
  colour = mix(colour, COFFEE, surface);

  // Saucer.
  const saucer = edge(ellipse(x, y, 480, 716, 300, 52));
  colour = mix(colour, CUP, saucer);

  // Steam.
  for (const offset of [-108, 0, 108]) {
    const wave = Math.sin((y - 120) / 46) * 18;
    const steam = edge(
      Math.hypot(x - (480 + offset + wave), 0) - 13 + Math.max(0, (y - 300) / 2) + Math.max(0, (150 - y) / 2),
    );
    colour = mix(colour, ACCENT, steam * 0.85);
  }

  return [...colour, alpha * 255];
}

const raw = Buffer.alloc((SIZE * 4 + 1) * SIZE);
let cursor = 0;

for (let y = 0; y < SIZE; y += 1) {
  raw[cursor] = 0; // filter type: none
  cursor += 1;
  for (let x = 0; x < SIZE; x += 1) {
    const [r, g, b, a] = shade(x + 0.5, y + 0.5);
    raw[cursor] = Math.round(Math.min(255, Math.max(0, r)));
    raw[cursor + 1] = Math.round(Math.min(255, Math.max(0, g)));
    raw[cursor + 2] = Math.round(Math.min(255, Math.max(0, b)));
    raw[cursor + 3] = Math.round(Math.min(255, Math.max(0, a)));
    cursor += 4;
  }
}

function chunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body) >>> 0);
  return Buffer.concat([length, body, crc]);
}

const CRC_TABLE = (() => {
  const table = new Int32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c;
  }
  return table;
})();

function crc32(buffer) {
  let crc = -1;
  for (const byte of buffer) crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return crc ^ -1;
}

const header = Buffer.alloc(13);
header.writeUInt32BE(SIZE, 0);
header.writeUInt32BE(SIZE, 4);
header[8] = 8; // bit depth
header[9] = 6; // colour type: RGBA
header[10] = 0;
header[11] = 0;
header[12] = 0;

const png = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  chunk('IHDR', header),
  chunk('IDAT', deflateSync(raw, { level: 9 })),
  chunk('IEND', Buffer.alloc(0)),
]);

writeFileSync('app-icon.png', png);
console.log(`app-icon.png written (${SIZE}×${SIZE}, ${(png.length / 1024).toFixed(1)} KB)`);
