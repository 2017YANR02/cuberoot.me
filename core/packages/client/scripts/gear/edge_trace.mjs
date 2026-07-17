// Trace the 4 edge-gear silhouettes from the reference SVG, align them into one
// gear frame (p = along the arris, q = into the face), 8-fold symmetrize
// (4 gears × mirror), and report the shape language needed to restyle the sim's
// edge gear: tentacle profile (width vs radius, tip shape), scallop rim arcs
// between tentacles, and the inner boundary near the arris.
//
// The SVG's tentacle ANGLES (45/90/135 ⇒ 8-tooth crown) are mechanism-locked
// out — the sim keeps 6 teeth at 30/90/150 (mod-3 rest invariance, issue #32).
// What transfers is the SHAPE: waisted tentacle outline + scalloped web rim.
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import zlib from 'node:zlib';
const HERE = dirname(fileURLToPath(import.meta.url));

const H = 128;
const svg = readFileSync(join(HERE, 'gear-cube-reference.svg'), 'utf8');
const ds = [...svg.matchAll(/<path d="([^"]+)"/g)].map((m) => m[1].replace(/\s+/g, ' '));

function parsePath(str) {
  const tok = str.match(/[a-zA-Z]|-?\d+(?:\.\d+)?/g);
  let i = 0, cx = 0, cy = 0, cmd = '', sx = 0, sy = 0;
  const pts = [];
  const num = () => parseFloat(tok[i++]);
  const cubic = (x1, y1, x2, y2, x, y) => {
    for (let k = 1; k <= 24; k++) {
      const t = k / 24, u = 1 - t;
      pts.push([u * u * u * cx + 3 * u * u * t * x1 + 3 * u * t * t * x2 + t * t * t * x,
                u * u * u * cy + 3 * u * u * t * y1 + 3 * u * t * t * y2 + t * t * t * y]);
    }
    cx = x; cy = y;
  };
  while (i < tok.length) {
    if (/[a-zA-Z]/.test(tok[i])) cmd = tok[i++];
    switch (cmd) {
      case 'M': cx = num(); cy = num(); sx = cx; sy = cy; pts.push([cx, cy]); cmd = 'L'; break;
      case 'l': cx += num(); cy += num(); pts.push([cx, cy]); break;
      case 'c': { const a1 = cx + num(), b1 = cy + num(), a2 = cx + num(), b2 = cy + num(), a3 = cx + num(), b3 = cy + num(); cubic(a1, b1, a2, b2, a3, b3); break; }
      case 'z': case 'Z': cx = sx; cy = sy; break;
      default: throw new Error(`cmd ${cmd}`);
    }
  }
  return pts.map(([X, Y]) => [0.1 * X, 1024 - 0.1 * Y]).map(([x, y]) => [(x - 512) * 0.25, (512 - y) * 0.25]);
}

// gear frames: [start token, center, p-axis (along arris), q-axis (into face)]
const GEARS = [
  { tag: 'top', m: 'M3755 9892', C: [0, H], P: [1, 0], Q: [0, -1] },
  { tag: 'bottom', m: 'M5020 2871', C: [0, -H], P: [1, 0], Q: [0, 1] },
  { tag: 'left', m: 'M1260 7133', C: [-H, 0], P: [0, 1], Q: [1, 0] },
  { tag: 'right', m: 'M8910 7119', C: [H, 0], P: [0, 1], Q: [-1, 0] },
];
const outlines = GEARS.map((g) => {
  const raw = parsePath(ds.find((s) => s.startsWith(g.m)));
  return raw.map(([x, y]) => {
    const dx = x - g.C[0], dy = y - g.C[1];
    return [dx * g.P[0] + dy * g.P[1], dx * g.Q[0] + dy * g.Q[1]];
  });
});

// 8-fold sample cloud: 4 gears + p-mirror of each
const cloud = outlines.flatMap((o) => o.concat(o.map(([p, q]) => [-p, q])));

// radial profile r(φ) 1° bins: min/max radius of OUTLINE points per angle
const binsMax = new Map(), binsMin = new Map();
for (const [p, q] of cloud) {
  const r = Math.hypot(p, q), phi = Math.round((Math.atan2(q, p) * 180) / Math.PI);
  if (q < -1) continue;
  binsMax.set(phi, Math.max(binsMax.get(phi) ?? -1, r));
  binsMin.set(phi, Math.min(binsMin.get(phi) ?? 1e9, r));
}
console.log('φ°: outer r (outline max) | inner r (outline min)   [90° = tentacle axis]');
for (let a = 0; a <= 180; a += 3) {
  const mx = binsMax.get(a), mn = binsMin.get(a);
  if (mx !== undefined) console.log(`  ${String(a).padStart(3)}: ${mx.toFixed(1).padStart(5)} | ${mn === undefined ? '  -  ' : mn.toFixed(1).padStart(5)}`);
}

// tentacle width vs radius: for the 90° tentacle, at each radius band find the
// angular extent of outline points (the two flanks)
console.log('\n90° tentacle: width vs radius (outline flank separation)');
for (let r0 = 44; r0 <= 66; r0 += 2) {
  const band = cloud.filter(([p, q]) => {
    const r = Math.hypot(p, q);
    return r >= r0 - 1 && r < r0 + 1 && q > 0 && Math.abs(p) < 20;
  });
  if (!band.length) continue;
  const psAt = band.map(([p]) => p);
  console.log(`  r≈${r0}: p ∈ [${Math.min(...psAt).toFixed(1)}, ${Math.max(...psAt).toFixed(1)}]  width ${(Math.max(...psAt) - Math.min(...psAt)).toFixed(1)}`);
}

// diagonal tentacle (45°): same, in its local frame
console.log('\n45° tentacle: width vs radius (rotated frame)');
const rot45 = cloud.map(([p, q]) => {
  const c = Math.cos(Math.PI / 4), s = Math.sin(Math.PI / 4);
  return [p * c + q * s, -p * s + q * c]; // rotate −45°: tentacle axis → +q̂... use (w,g)
});
for (let r0 = 42; r0 <= 64; r0 += 2) {
  const band = rot45.filter(([w, g]) => {
    const r = Math.hypot(w, g);
    return r >= r0 - 1 && r < r0 + 1 && g > 0 && Math.abs(w) < 18;
  });
  if (!band.length) continue;
  const ws = band.map(([w]) => w);
  console.log(`  r≈${r0}: w ∈ [${Math.min(...ws).toFixed(1)}, ${Math.max(...ws).toFixed(1)}]  width ${(Math.max(...ws).toFixed(1) - Math.min(...ws)).toFixed(1)}`);
}

// inner boundary near the arris: q(p) minimum for |q| small
console.log('\ninner boundary (near-arris edge): min q per |p| bin');
const qmin = new Map();
for (const [p, q] of cloud) {
  if (q < 0 || q > 30) continue;
  const k = Math.round(Math.abs(p) / 4) * 4;
  qmin.set(k, Math.min(qmin.get(k) ?? 1e9, q));
}
for (const k of [...qmin.keys()].sort((a, b) => a - b)) console.log(`  |p|≈${String(k).padStart(2)}: q ≥ ${qmin.get(k).toFixed(1)}`);

// overlay PNG: all 8 aligned outlines
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
const W = 720, SC = W / 150, OX = W / 2, OY = W - 40;
const rgb = Buffer.alloc(W * W * 3, 22);
const put = (x, y, col) => {
  const px = Math.round(OX + x * SC), py = Math.round(OY - y * SC);
  if (px < 0 || px >= W || py < 0 || py >= W) return;
  const o = (py * W + px) * 3;
  rgb[o] = col[0]; rgb[o + 1] = col[1]; rgb[o + 2] = col[2];
};
const COLS = [[240, 80, 80], [80, 220, 80], [90, 120, 250], [240, 220, 70]];
outlines.forEach((o, i) => {
  for (const [p, q] of o) put(p, q, COLS[i]);
  for (const [p, q] of o) put(-p, q, COLS[i].map((v) => Math.round(v * 0.55)));
});
// reference circles: r=30.4 (cap), 32 (root), 62 (tip)
for (let a = 0; a < 360; a++) {
  const c = Math.cos((a * Math.PI) / 180), s = Math.sin((a * Math.PI) / 180);
  put(30.4 * c, 30.4 * s, [120, 120, 120]);
  put(32 * c, 32 * s, [90, 90, 160]);
  put(62 * c, 62 * s, [90, 90, 160]);
}
const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(W, 0); ihdr.writeUInt32BE(W, 4); ihdr[8] = 8; ihdr[9] = 2;
const raw = Buffer.alloc(W * (1 + W * 3));
for (let y = 0; y < W; y++) rgb.copy(raw, y * (1 + W * 3) + 1, y * W * 3, (y + 1) * W * 3);
writeFileSync('D:/cube/cuberoot.me/.tmp/png/gear_edge_aligned.png', Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0)),
]));
console.log('\nwrote gear_edge_aligned.png');
