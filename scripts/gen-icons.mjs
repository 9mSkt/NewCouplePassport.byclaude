// Renders the PWA PNG icons (navy passport + gold heart) without any image library.
import { writeFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const out = join(dirname(fileURLToPath(import.meta.url)), '..', 'public');
const NAVY = [0x1f, 0x3a, 0x5f];
const GOLD = [0xd9, 0xb0, 0x5c];
const PINK = [0xf4, 0xa7, 0xb9];

const crcTable = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
const crc = (buf) => {
  let c = 0xffffffff;
  for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};
function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]);
  const c = Buffer.alloc(4);
  c.writeUInt32BE(crc(td));
  return Buffer.concat([len, td, c]);
}

// Heart implicit curve: (x²+y²−1)³ − x²y³ ≤ 0
const inHeart = (x, y) => Math.pow(x * x + y * y - 1, 3) - x * x * y * y * y <= 0;

function render(size, maskable) {
  const raw = Buffer.alloc(size * (size * 3 + 1));
  const pad = maskable ? 0.2 : 0.08; // maskable icons need a larger safe zone
  for (let py = 0; py < size; py++) {
    raw[py * (size * 3 + 1)] = 0;
    for (let px = 0; px < size; px++) {
      const u = px / size;
      const v = py / size;
      let col = NAVY;
      // gold frame
      const fIn = pad;
      const fw = 0.025;
      const onFrame =
        u > fIn && u < 1 - fIn && v > fIn && v < 1 - fIn &&
        (u < fIn + fw || u > 1 - fIn - fw || v < fIn + fw || v > 1 - fIn - fw);
      if (onFrame) col = GOLD;
      // heart, centred, scaled to the safe area
      const s = (1 - 2 * pad) * 0.32;
      const x = (u - 0.5) / s;
      const y = -(v - 0.53) / s;
      if (inHeart(x * 0.9, y * 0.9 + 0.1)) col = inHeart(x * 1.25, y * 1.25 + 0.15) ? PINK : GOLD;
      const o = py * (size * 3 + 1) + 1 + px * 3;
      raw[o] = col[0];
      raw[o + 1] = col[1];
      raw[o + 2] = col[2];
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // RGB
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

writeFileSync(join(out, 'icon-192.png'), render(192, false));
writeFileSync(join(out, 'icon-512.png'), render(512, false));
writeFileSync(join(out, 'icon-maskable-512.png'), render(512, true));
console.log('icons written to public/');
