// Validate the new crown sector outline: replicate crownSectorOutline (JS copy,
// same numbers as gearGeometry.ts), render one sector + the full rest crown +
// coin cap + corner stickers as a composite face view to eyeball against the
// reference SVG. Also print the invariant numbers the tests lock.
import { readFileSync, writeFileSync } from 'node:fs';
import zlib from 'node:zlib';

const TOOTH_TIP = 62, TOOTH_ROOT = 32, RIM_R = 44, TOOTH_HALF_W = 8.5;
const TOOTH_TIP_CR = 3.5, TOOTH_FILLET_R = 5;
const H = 128, COIN_R = 30.4;

export function crownSectorOutline(inset = 0) {
  const RIM = RIM_R - inset;
  const W = TOOTH_HALF_W - inset;
  const TIP = TOOTH_TIP - inset;
  const FR = TOOTH_FILLET_R, CR = TOOTH_TIP_CR;
  const STEP = 0.05;
  const pts = [];
  const arc = (cx, cy, r, a0, a1) => {
    const n = Math.max(2, Math.ceil(Math.abs(a1 - a0) / STEP));
    for (let i = 0; i <= n; i++) {
      const a = a0 + ((a1 - a0) * i) / n;
      pts.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]);
    }
  };
  const fcx = W + FR;
  const fcy = Math.sqrt((RIM + FR) * (RIM + FR) - fcx * fcx);
  const rimEnd = Math.atan2(fcy, fcx);
  const D60 = Math.PI / 3, D120 = (2 * Math.PI) / 3;
  const tipY = CR + Math.sqrt((TIP - CR) * (TIP - CR) - (W - CR) * (W - CR));
  arc(0, 0, RIM, D60, rimEnd);
  arc(fcx, fcy, FR, rimEnd + Math.PI, Math.PI);
  pts.push([W, tipY - CR]);
  arc(W - CR, tipY - CR, CR, 0, Math.PI / 2);
  pts.push([-(W - CR), tipY]);
  arc(-(W - CR), tipY - CR, CR, Math.PI / 2, Math.PI);
  pts.push([-W, fcy]);
  arc(-fcx, fcy, FR, 2 * Math.PI, 2 * Math.PI - rimEnd);
  arc(0, 0, RIM, Math.PI - rimEnd, D120);
  pts.push([0, 0]);
  const out = [];
  for (const p of pts) {
    const q = out[out.length - 1];
    if (!q || Math.hypot(p[0] - q[0], p[1] - q[1]) > 1e-6) out.push(p);
  }
  let area = 0;
  for (let i = 0; i < out.length; i++) {
    const [x0, y0] = out[i], [x1, y1] = out[(i + 1) % out.length];
    area += x0 * y1 - x1 * y0;
  }
  return area > 0 ? out : out.slice().reverse();
}

// everything below is the standalone validation/render — skipped when this
// module is imported for crownSectorOutline (e.g. by mesh_check.mjs)
const isMain = process.argv[1] !== undefined &&
  import.meta.url.endsWith('/' + process.argv[1].replace(/\\/g, '/').split('/').pop());
if (isMain) main();
function main() {
const sec = crownSectorOutline(0);
const rs = sec.map(([x, y]) => Math.hypot(x, y));
console.log(`sector: ${sec.length} pts  r ∈ [${Math.min(...rs).toFixed(2)}, ${Math.max(...rs).toFixed(2)}]`);
const fcy = Math.sqrt((RIM_R + TOOTH_FILLET_R) ** 2 - (TOOTH_HALF_W + TOOTH_FILLET_R) ** 2);
console.log(`fillet tangency: flank y=${fcy.toFixed(2)}  rim φ=${((Math.atan2(fcy, TOOTH_HALF_W + TOOTH_FILLET_R) * 180) / Math.PI).toFixed(1)}°`);
// symmetry about 90° and radial-edge match under 60° rotation
let symErr = 0;
for (const [x, y] of sec) {
  let best = 1e9;
  for (const [u, v] of sec) best = Math.min(best, Math.hypot(u + x, v - y));
  symErr = Math.max(symErr, best);
}
console.log(`mirror symmetry residual: ${symErr.toFixed(4)}`);

// composite face render: cap + 6 sectors (rest: sector tooth axes at 90+k60,
// face view keeps q>=0 half) for the TOP edge gear + baked CORNER_POLY
const CORNER_POLY = JSON.parse(readFileSync('D:/cube/cuberoot.me/.tmp/gear/corner_poly_clipped.json', 'utf8'));

const crc32 = (buf) => {
  let c, crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    c = (crc ^ buf[i]) & 0xff;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    crc = (crc >>> 8) ^ c;
  }
  return (crc ^ 0xffffffff) >>> 0;
};
const chunk = (type, data) => {
  const out = Buffer.alloc(12 + data.length);
  out.writeUInt32BE(data.length, 0); out.write(type, 4); data.copy(out, 8);
  out.writeUInt32BE(crc32(Buffer.concat([Buffer.from(type), data])), 8 + data.length);
  return out;
};
const inPoly = (poly, x, y) => {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i], [xj, yj] = poly[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
};

const sectors = [];
for (let k = 0; k < 6; k++) {
  const rot = (k * Math.PI) / 3;
  const cr = Math.cos(rot), sr = Math.sin(rot);
  sectors.push(sec.map(([x, y]) => [x * cr - y * sr, x * sr + y * cr]));
}

const W2 = 760, SC = W2 / 300; // face spans [-150,150] for margin
const rgb = Buffer.alloc(W2 * W2 * 3, 20);
for (let py = 0; py < W2; py++) {
  for (let px = 0; px < W2; px++) {
    const a = (px - W2 / 2) / SC, b = (W2 / 2 - py) / SC; // face coords
    let col = null;
    // corner stickers (4 quadrant mirrors)
    if (!col && inPoly(CORNER_POLY, Math.abs(a), Math.abs(b))) col = [40, 40, 230];
    // top edge gear at (0, H): gear coords p=a, q=H-b — keep q >= 0 face half
    const p = a, q = H - b;
    if (!col && q >= 0) {
      if (Math.hypot(p, q) <= COIN_R) col = [45, 45, 235];       // cap disc
      else for (const s of sectors) if (inPoly(s, p, q)) { col = [40, 40, 230]; break; }
    }
    // bottom/left/right gears for context
    const gears = [[0, -H, 1], [-H, 0, 2], [H, 0, 3]];
    if (!col) {
      for (const [gx, gy] of gears) {
        const dp = gx === 0 ? a - gx : b - gy, dq = gx === 0 ? (gy > 0 ? gy - b : b - gy) : (gx > 0 ? gx - a : a - gx);
        if (dq < 0) continue;
        if (Math.hypot(dp, dq) <= COIN_R) { col = [45, 45, 235]; break; }
        for (const s of sectors) if (inPoly(s, dp, dq)) { col = [40, 40, 230]; break; }
        if (col) break;
      }
    }
    if (col) {
      const o = (py * W2 + px) * 3;
      rgb[o] = col[0]; rgb[o + 1] = col[1]; rgb[o + 2] = col[2];
    }
  }
}
const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(W2, 0); ihdr.writeUInt32BE(W2, 4); ihdr[8] = 8; ihdr[9] = 2;
const raw = Buffer.alloc(W2 * (1 + W2 * 3));
for (let y = 0; y < W2; y++) rgb.copy(raw, y * (1 + W2 * 3) + 1, y * W2 * 3, (y + 1) * W2 * 3);
writeFileSync('D:/cube/cuberoot.me/.tmp/png/gear_face_new.png', Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0)),
]));
console.log('wrote gear_face_new.png');
}
