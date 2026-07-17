// Synced-mesh sweep: does the SVG corner spur profile thread the gear teeth?
// Replicates the engine's fold-glide crown (gearGeometry.ts) for the gear at
// E=(0,H,H) (edge ∥ x), sweeps the two relative branches (spin/orbit ratio
// ±480°/90°, full 360° orbit ≡ all 4 start slots since 120° is tooth-identical),
// and reports the min signed distance from any tooth/decal sample point to the
// corner plate prisms (traced polygon × depth band). Negative = interpenetration.
//
// THIS IS THE GEAR CORNER BAKE PIPELINE — durable, not throwaway. It is the
// offline oracle that produces gearGeometry.ts's CORNER_POLY from the
// reference SVG. Re-run whenever the corner shape needs adjusting:
//     node core/packages/client/scripts/gear/mesh_check.mjs
// It prints the CORNER_POLY table to paste into gearGeometry.ts and the three
// clearance gates (transit / rest / arms); rigid_check.mjs then re-judges the
// composite. The plate band is [H − CORNER_PLATE_T, top] — DEEP_LO below.
// (A GEAR_BAND=7 run once confirmed the shallow-band bake is byte-identical:
// the deep dive doesn't clip the fins, so no stratified second plate.)
// Design notes: GEAR_FRONT_SPEC.md §9
// (same folder). Input is self-contained (script-relative SVG); regenerable
// outputs (corner_poly*.json + the overlay SVG) go under .tmp/ and the dirs are
// re-created on the fly, so clearing .tmp never breaks a re-run.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { crownSectorOutline } from './sector_check.mjs';
const HERE = dirname(fileURLToPath(import.meta.url));
const TMP = 'D:/cube/cuberoot.me/.tmp/gear'; // regenerable bake outputs (gitignored)
const PNG = 'D:/cube/cuberoot.me/.tmp/png'; // user-facing overlay (gitignored)
mkdirSync(TMP, { recursive: true });
mkdirSync(PNG, { recursive: true });
// (readFileSync reused for the overlay diff at the end)

const H = 128;
const TEETH = 6, TOOTH_TIP = 62;
const PLATE_T = 7, FOLD_R = 1.2;
const STICKER_LIFT = 0.5, STICKER_DEPTH = 2.6;

// ── 1. trace + symmetrize + simplify the corner polygon ──────────────────────
const svg = readFileSync(join(HERE, 'gear-cube-reference.svg'), 'utf8');
const d = [...svg.matchAll(/<path d="([^"]+)"/g)].map((m) => m[1].replace(/\s+/g, ' ')).find((s) => s.startsWith('M7386 9900'));
function parsePath(str) {
  const tok = str.match(/[a-zA-Z]|-?\d+(?:\.\d+)?/g);
  let i = 0, cx = 0, cy = 0, cmd = '';
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
      case 'M': cx = num(); cy = num(); pts.push([cx, cy]); cmd = 'L'; break;
      case 'c': { const a1 = cx + num(), b1 = cy + num(), a2 = cx + num(), b2 = cy + num(), a3 = cx + num(), b3 = cy + num(); cubic(a1, b1, a2, b2, a3, b3); break; }
      case 'z': case 'Z': break;
      default: throw new Error(`cmd ${cmd}`);
    }
  }
  return pts;
}
let poly = parsePath(d)
  .map(([X, Y]) => [0.1 * X, 1024 - 0.1 * Y])            // path → user space
  .map(([x, y]) => [(x - 512) * 0.25, (512 - y) * 0.25]); // user → face coords (+,+ corner)
poly = poly.filter((p, i) => i === 0 || Math.hypot(p[0] - poly[i - 1][0], p[1] - poly[i - 1][1]) > 1e-6);

function distToPolyline(p, line) {
  let best = Infinity;
  for (let i = 0; i < line.length; i++) {
    const q = line[i], r = line[(i + 1) % line.length];
    const dx = r[0] - q[0], dy = r[1] - q[1];
    const L2 = dx * dx + dy * dy;
    const t = L2 ? Math.max(0, Math.min(1, ((p[0] - q[0]) * dx + (p[1] - q[1]) * dy) / L2)) : 0;
    best = Math.min(best, Math.hypot(p[0] - q[0] - t * dx, p[1] - q[1] - t * dy));
  }
  return best;
}
function nearestOnPolyline(p, line) {
  let best = Infinity, bx = 0, by = 0;
  for (let i = 0; i < line.length; i++) {
    const q = line[i], r = line[(i + 1) % line.length];
    const dx = r[0] - q[0], dy = r[1] - q[1];
    const L2 = dx * dx + dy * dy;
    const t = L2 ? Math.max(0, Math.min(1, ((p[0] - q[0]) * dx + (p[1] - q[1]) * dy) / L2)) : 0;
    const nx = q[0] + t * dx, ny = q[1] + t * dy;
    const dd = Math.hypot(p[0] - nx, p[1] - ny);
    if (dd < best) { best = dd; bx = nx; by = ny; }
  }
  return [bx, by];
}
// symmetrize about the diagonal a=b (potrace noise ~2.2): average each vertex
// with its nearest point on the mirrored outline, 3 rounds
for (let round = 0; round < 3; round++) {
  const mir = poly.map(([a, b]) => [b, a]);
  poly = poly.map((p) => {
    const [nx, ny] = nearestOnPolyline(p, mir);
    return [(p[0] + nx) / 2, (p[1] + ny) / 2];
  });
}
{
  const mir = poly.map(([a, b]) => [b, a]);
  let dev = 0;
  for (const p of poly) dev = Math.max(dev, distToPolyline(p, mir));
  console.log(`symmetrized: residual diagonal deviation ${dev.toFixed(3)}`);
}
// closed-polygon RDP: anchor at the two mutually farthest vertices, simplify both arcs
function rdpOpen(points, eps) {
  if (points.length < 3) return points.slice();
  let dmax = 0, idx = -1;
  const [x0, y0] = points[0], [x1, y1] = points[points.length - 1];
  const dx = x1 - x0, dy = y1 - y0, L = Math.hypot(dx, dy) || 1;
  for (let j = 1; j < points.length - 1; j++) {
    const dist = Math.abs(dx * (points[j][1] - y0) - dy * (points[j][0] - x0)) / L;
    if (dist > dmax) { dmax = dist; idx = j; }
  }
  if (dmax <= eps) return [points[0], points[points.length - 1]];
  const a = rdpOpen(points.slice(0, idx + 1), eps);
  const b = rdpOpen(points.slice(idx), eps);
  return a.slice(0, -1).concat(b);
}
{
  let i0 = 0, best = -1;
  const c = poly.reduce(([sa, sb], [a, b]) => [sa + a / poly.length, sb + b / poly.length], [0, 0]);
  for (let i = 0; i < poly.length; i++) {
    const dd = Math.hypot(poly[i][0] - c[0], poly[i][1] - c[1]);
    if (dd > best) { best = dd; i0 = i; }
  }
  let i1 = 0; best = -1;
  for (let i = 0; i < poly.length; i++) {
    const dd = Math.hypot(poly[i][0] - poly[i0][0], poly[i][1] - poly[i0][1]);
    if (dd > best) { best = dd; i1 = i; }
  }
  if (i1 < i0) [i0, i1] = [i1, i0];
  const arcA = poly.slice(i0, i1 + 1);
  const arcB = poly.slice(i1).concat(poly.slice(0, i0 + 1));
  const sA = rdpOpen(arcA, 0.25), sB = rdpOpen(arcB, 0.25);
  poly = sA.slice(0, -1).concat(sB.slice(0, -1));
}
// quantize to 0.1 (this exact table goes into gearGeometry.ts)
poly = poly.map(([a, b]) => [Math.round(a * 10) / 10, Math.round(b * 10) / 10]);
poly = poly.filter((p, i) => {
  const q = poly[(i + poly.length - 1) % poly.length];
  return Math.hypot(p[0] - q[0], p[1] - q[1]) > 1e-9;
});
console.log(`simplified polygon: ${poly.length} pts`);
const xs = poly.map((p) => p[0]), ys = poly.map((p) => p[1]);
console.log(`bbox a:[${Math.min(...xs)}, ${Math.max(...xs)}] b:[${Math.min(...ys)}, ${Math.max(...ys)}]`);
writeFileSync(join(TMP, 'corner_poly.json'), JSON.stringify(poly));

// ── 2. corner plate prism test (all faces / quadrants at once) ───────────────
// Corner plate model (matches the planned engine build):
//   ledge (full polygon):     z ∈ [LEDGE_LO, TOP]   — thin tongue, arms sweep under it
//   deep  (a ≥ DEEP_SPLIT or b ≥ DEEP_SPLIT): z ∈ [DEEP_LO, TOP] — full tooth-plate depth
//   sticker sits flush (same polygon) up to TOP.
// Plate-band bottom = engine CORNER_PLATE_T (the corner die-cut plate roots
// into the strict-intersection body's roof, deeper than the crown PLATE_T).
// GEAR_BAND overrides it for the one-off shallow-band confirmation run.
const BAND_T = process.env.GEAR_BAND ? Number(process.env.GEAR_BAND) : 9.8;
const DEEP_LO = H - BAND_T;
const LEDGE_LO = 123.6;              // tail tongue underside (clears arm sweep r≤130.3)
const TOP = H + STICKER_LIFT + STICKER_DEPTH + 0.1; // 131.2
const DEEP_SPLIT = 52;
const PB = { x0: Math.min(...xs), y0: Math.min(...ys), x1: Math.max(...xs), y1: Math.max(...ys) };
function inPoly(a, b) {
  if (a < PB.x0 || a > PB.x1 || b < PB.y0 || b > PB.y1) return false;
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i], [xj, yj] = poly[j];
    if ((yi > b) !== (yj > b) && a < ((xj - xi) * (b - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}
function signedDist(a, b) { // + outside, − inside
  const dd = distToPolyline([a, b], poly);
  return inPoly(a, b) ? -dd : dd;
}
// point (X,Y,Z) → min signed distance to any corner plate prism (in-plane only
// while inside the band; band edges add vertical distance outside)
let probeInfo = null; // set by cornerClearance for the argmin face
function cornerClearance(X, Y, Z) {
  let best = Infinity;
  probeInfo = null;
  const co = [X, Y, Z];
  for (let j = 0; j < 3; j++) {
    const h = Math.abs(co[j]);
    const a = Math.abs(co[(j + 1) % 3]), b = Math.abs(co[(j + 2) % 3]);
    const lo = a >= DEEP_SPLIT || b >= DEEP_SPLIT ? DEEP_LO : LEDGE_LO;
    const dz = h < lo ? lo - h : h > TOP ? h - TOP : 0;
    if (dz > 4) continue; // too far from any plate band to matter
    const dInPlane = signedDist(a, b);
    const dd = dz === 0 ? dInPlane : dInPlane <= 0 ? dz : Math.hypot(dz, dInPlane);
    if (dd < best) { best = dd; probeInfo = { a, b, h }; }
  }
  return best;
}
// free-height probe: min height h of gear material whose in-plane position is
// INSIDE the polygon (per zone) — tells whether a sunken wing shelf can hide
// under the transit envelope
const minH = { wing: Infinity, tail: Infinity, head: Infinity };
function trackMinH(X, Y, Z) {
  const co = [X, Y, Z];
  for (let j = 0; j < 3; j++) {
    const h = Math.abs(co[j]);
    if (h > TOP + 2 || h < 100) continue;
    const a = Math.abs(co[(j + 1) % 3]), b = Math.abs(co[(j + 2) % 3]);
    if (!inPoly(a, b)) continue;
    const zone = Math.max(a, b) >= 100 ? 'wing' : Math.min(a, b) <= DEEP_SPLIT ? 'tail' : 'head';
    if (h < minH[zone]) minH[zone] = h;
  }
}
// transit FOOTPRINT at plate heights: 2D occupancy raster over (along, q') —
// q' = in-face distance from the block outer border. This is the conjugate
// region the corner profile must stay clear of (per gear, mirrored by symmetry).
const FP_SCALE = 2; // half-unit bins — coarse bins force fat pooling margins
const FP_NA = 80 * FP_SCALE, FP_NQ = 95 * FP_SCALE;
const FP = new Uint8Array(FP_NA * FP_NQ);
function trackFootprint(X, Y, Z) {
  // ONLY the simulated gear's own frame (E=(0,±H,±H) after orbit about x̂):
  // along = |X| (the edge direction), q' = distance from the gear's border
  // into whichever face band the material is crossing. The mirrored (right-)
  // gear footprint is the transposed QUERY, not a second record.
  const bin = Math.round(Math.abs(X) * FP_SCALE);
  if (bin < 0 || bin >= FP_NA) return;
  const hy = Math.abs(Y), hz = Math.abs(Z);
  if (hy >= DEEP_LO - 0.4 && hy <= TOP + 0.4) { // on a y-face band → border is the z edge
    const qb = Math.round((H - hz) * FP_SCALE);
    if (qb >= 0 && qb < FP_NQ) FP[qb * FP_NA + bin] = 1;
  }
  if (hz >= DEEP_LO - 0.4 && hz <= TOP + 0.4) { // on a z-face band → border is the y edge
    const qb = Math.round((H - hy) * FP_SCALE);
    if (qb >= 0 && qb < FP_NQ) FP[qb * FP_NA + bin] = 1;
  }
}
// static: corner plate material vs the swept center-arm annuli. Arms (C-plates,
// z∈[H−ARM_D, H], r∈[ARM_R0, ARM_R1], |s|≤ARM_S) orbit about each cube axis;
// arm point (along=xa, ya, za) sweeps radius hypot(ya,za) — envelope per axis:
//   along ∈ [ARM_R0−m, ARM_R1+m]: radius ∈ [hypot(0,H−ARM_D), hypot(ARM_S,H)]  (own-direction arm)
//   along ∈ [0, ARM_S+m]:          radius ∈ [hypot(ARM_R0,H−ARM_D), hypot(ARM_R1,H)] (side arms)
//   cap (|xa|,|ya| ≤ CAP_HALF, z∈[H−CAP_T,H]): along ≤ CAP_HALF, radius ≤ hypot(CAP_HALF,H)
function armSweepHit(X, Y, Z, m) {
  const ARM_R0 = 0.30 * H, ARM_R1 = 0.375 * H, ARM_S = 24, ARM_D = 5, CAP_HALF = 0.19 * H, CAP_T = 12;
  const co = [X, Y, Z];
  for (let ax = 0; ax < 3; ax++) {
    const along = Math.abs(co[ax]);
    const rad = Math.hypot(co[(ax + 1) % 3], co[(ax + 2) % 3]);
    if (along <= ARM_R1 + m && along >= ARM_R0 - m &&
        rad >= H - ARM_D - m && rad <= Math.hypot(ARM_S, H) + m) return `arm-radial@ax${ax}`;
    if (along <= ARM_S + m &&
        rad >= Math.hypot(ARM_R0, H - ARM_D) - m && rad <= Math.hypot(ARM_R1, H) + m) return `arm-side@ax${ax}`;
    if (along <= CAP_HALF + m && rad >= H - CAP_T - m && rad <= Math.hypot(CAP_HALF, H) + m) return `cap@ax${ax}`;
  }
  return null;
}

// ── 3. crease-baked crown cloud for gear E=(0,H,H), ê=x̂ (v12: fold ONCE, rigid) ──
// frame (derived like slotFoldFrame): facePlus=U(0,1,0), faceMinus=F(0,0,1)
// foldPoint in these coords: p along x; q>0 → U; q<0 → F.
// E=(0,H,H); vPlus=(0,0,-1); fPlus=(0,1,0); vMinus=(0,-1,0); fMinus=(0,0,1);
// n=(0,1,1)/√2; h=(0,1,-1)/√2
function fold(p, q, dd, out) {
  if (q >= FOLD_R) { out[0] = p; out[1] = H + dd; out[2] = H - q; return out; }
  if (q <= -FOLD_R) { out[0] = p; out[1] = H + q; out[2] = H + dd; return out; }
  const a = (q / FOLD_R) * (Math.PI / 4);
  const rn = (FOLD_R + dd) * Math.cos(a) - FOLD_R * Math.SQRT2;
  const rh = (FOLD_R + dd) * Math.sin(a);
  const s2 = Math.SQRT1_2;
  out[0] = p;
  out[1] = H + rn * s2 + rh * s2;
  out[2] = H + rn * s2 - rh * s2;
  return out;
}
// sanity: q=-50,d=0 → on F face (z=H) at y=H-50
{
  const o = [0, 0, 0];
  fold(0, -50, 0, o);
  if (Math.abs(o[2] - H) > 1e-9 || Math.abs(o[1] - (H - 50)) > 1e-9) throw new Error(`fold sanity: ${o}`);
  fold(0, 50, 2, o);
  if (Math.abs(o[1] - (H + 2)) > 1e-9 || Math.abs(o[2] - (H - 50)) > 1e-9) throw new Error(`fold sanity+: ${o}`);
}

// un-spun crown SECTOR sample points (local coords, tooth axis along +y = rest
// 90°; the sector spans local polar 60°..120° with half a scalloped gullet on
// each side — six of these tile the whole crown, so the per-tooth rotation
// loop below covers web AND tentacles). Shape = crownSectorOutline (SVG-traced
// tentacle + RIM_R scallop), shared with sector_check.mjs.
const trap = crownSectorOutline(0);
const TIP_CORNERS = (() => {
  const rMax = Math.max(...trap.map(([x, y]) => Math.hypot(x, y)));
  const near = trap.filter(([x, y]) => Math.hypot(x, y) > rMax - 0.05);
  const xs2 = near.map((p) => p[0]);
  return [near[xs2.indexOf(Math.min(...xs2))], near[xs2.indexOf(Math.max(...xs2))]];
})();
function polyArea2(pts) {
  let s = 0;
  for (let i = 0; i < pts.length; i++) {
    const [x0, y0] = pts[i], [x1, y1] = pts[(i + 1) % pts.length];
    s += x0 * y1 - x1 * y0;
  }
  return s;
}
function inClosed(pts, x, y) {
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [xi, yi] = pts[i], [xj, yj] = pts[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}
let toothOutline = trap;
let toothSamples = []; // [x, y] local
function rebuildToothSamples() {
  toothSamples = [];
  const ys = toothOutline.map((p) => p[1]);
  const y0 = Math.min(...ys), y1 = Math.max(...ys);
  const xsAll = toothOutline.map((p) => p[0]);
  const bx0 = Math.min(...xsAll) - 0.5, bx1 = Math.max(...xsAll) + 0.5;
  for (let x = bx0; x <= bx1; x += 1.4) {
    for (let y = y0; y <= y1; y += 1.4) if (inClosed(toothOutline, x, y)) toothSamples.push([x, y]);
  }
  for (let i = 0; i < toothOutline.length; i++) {
    const A = toothOutline[i], B = toothOutline[(i + 1) % toothOutline.length];
    const L = Math.hypot(B[0] - A[0], B[1] - A[1]);
    const n = Math.max(1, Math.ceil(L / 1.0));
    for (let k = 0; k < n; k++) toothSamples.push([A[0] + ((B[0] - A[0]) * k) / n, A[1] + ((B[1] - A[1]) * k) / n]);
  }
}
rebuildToothSamples();
console.log(`tooth samples: ${toothSamples.length} × ~6 depths × ${TEETH} teeth`);

// tooth underside chamfer: bottom rises from −PLATE_T at dev radius CHAM.r0
// linearly to −PLATE_T+CHAM.lift at the tip (0 = no chamfer)
let CHAM = { r0: TOOTH_TIP, lift: 0 };
function dBot(r) {
  if (r <= CHAM.r0) return -PLATE_T;
  return -PLATE_T + (CHAM.lift * (r - CHAM.r0)) / (TOOTH_TIP - CHAM.r0);
}

// ── 4. the sweep ─────────────────────────────────────────────────────────────
// v12 RIGID crown: the crease is baked, the whole piece spins as a rigid body
// about its axis n̂ = (0,1,1)/√2 (through the origin — E ∥ n̂), so a frame is
// fold(rest) → rigid spin θ → orbit ω about x̂. θ = φ0 + ratio·ω with
// ratio = ±480/90 (the two relative branches) and φ0 ∈ {0,120,240} — a tilted
// START phase changes the transit geometry now, unlike the old fold-glide
// whose dev shape was 120°-periodic.
function sweep(ratio, stepDeg, collect, phi0 = 0) {
  let worst = Infinity, worstAt = null;
  const viol = [];
  const out = [0, 0, 0];
  for (let wDeg = 0; wDeg < 360; wDeg += stepDeg) {
    const w = (wDeg * Math.PI) / 180;
    const cw = Math.cos(w), sw = Math.sin(w);
    const th = ((phi0 + ratio * wDeg) * Math.PI) / 180;
    const ct = Math.cos(th), st = Math.sin(th);
    for (let k = 0; k < TEETH; k++) {
      const rot = (k * 2 * Math.PI) / TEETH; // REST orientation (90°+k·60°)
      const cr = Math.cos(rot), sr = Math.sin(rot);
      for (const [lx, ly] of toothSamples) {
        const p = lx * cr - ly * sr, q = lx * sr + ly * cr;
        const r = Math.hypot(lx, ly);
        const db = dBot(r);
        // top sample 3.34 = the fold-line bar top (LIFT+DEPTH+0.12) + 0.12 —
        // the bar rides proud of the decals and its tilted top governs the
        // plate-band ceiling encounter (rigid_check's global offender)
        for (const dd of [db, db / 2, 0, STICKER_LIFT, 1.8, STICKER_LIFT + STICKER_DEPTH, STICKER_LIFT + STICKER_DEPTH + 0.24]) {
          fold(p, q, dd, out);
          // rigid spin about n̂: cylindrical (u along x̂, w along t̂=(0,1,−1)/√2)
          const alpha = (out[1] + out[2]) * Math.SQRT1_2;
          const wq = (out[1] - out[2]) * Math.SQRT1_2;
          const u2 = out[0] * ct - wq * st, w2 = out[0] * st + wq * ct;
          const X = u2, ys = (alpha + w2) * Math.SQRT1_2, zs = (alpha - w2) * Math.SQRT1_2;
          // orbit about x̂: (y,z) → (y·cw − z·sw, y·sw + z·cw)
          const Y = ys * cw - zs * sw, Z = ys * sw + zs * cw;
          const c = cornerClearance(X, Y, Z);
          if (c < worst) { worst = c; worstAt = { wDeg, phi0, k, p: +p.toFixed(1), q: +q.toFixed(1), d: +dd.toFixed(1), X: +X.toFixed(1), Y: +Y.toFixed(1), Z: +Z.toFixed(1) }; }
          if (collect) {
            trackMinH(X, Y, Z);
            trackFootprint(X, Y, Z);
            if (c < 0) viol.push({ wDeg, r, d: dd, p, q, c, lx, ly, pa: probeInfo?.a, pb: probeInfo?.b, ph: probeInfo?.h });
          }
        }
      }
    }
  }
  return { worst, worstAt, viol };
}
// worst over both branches and all three start phases
function sweepAll(stepDeg, collect) {
  let worst = Infinity, worstAt = null;
  const viol = [];
  for (const ratio of [-480 / 90, 480 / 90]) {
    for (const phi0 of [0, 120, 240]) {
      const r = sweep(ratio, stepDeg, collect, phi0);
      if (r.worst < worst) { worst = r.worst; worstAt = r.worstAt; }
      viol.push(...r.viol);
    }
  }
  return { worst, worstAt, viol };
}

// ── 5. static arm-sweep check over the corner plate material ─────────────────
{
  let hits = 0, sample = null, total = 0;
  for (let a = PB.x0; a <= PB.x1; a += 0.8) {
    for (let b = PB.y0; b <= PB.y1; b += 0.8) {
      if (!inPoly(a, b)) continue;
      const lo = a >= DEEP_SPLIT || b >= DEEP_SPLIT ? DEEP_LO : LEDGE_LO;
      for (let z = lo; z <= TOP; z += 0.6) {
        total++;
        const v = armSweepHit(a, b, z, 0.5);
        if (v) { hits++; if (!sample) sample = { a: +a.toFixed(1), b: +b.toFixed(1), z: +z.toFixed(1), v }; }
      }
    }
  }
  console.log(`ARM sweep vs plates: ${hits}/${total} hits ${sample ? JSON.stringify(sample) : '(clear)'}`);
}

// ── 6. tooth violation envelope + tip-corner distance, then tip-rounding scan ─
const t0 = Date.now();
{
  const { worst, viol } = sweepAll(0.5, true);
  console.log(`rigid crown vs SVG plates: min ${worst.toFixed(2)}  (${viol.length} violating samples)`);
  if (viol.length) {
    const rs = viol.map((v) => v.r), ds = viol.map((v) => v.d), cs = viol.map((v) => v.c);
    const ws = viol.map((v) => ((v.wDeg + 45) % 90) - 45);
    // distance of each violating sample from the NEAREST tip corner, in the
    // tooth's local frame (violation stores p,q = spun coords; r is invariant,
    // recover local x from r and the spun angle is lost — so store local in viol)
    console.log(`  envelope: r ∈ [${Math.min(...rs).toFixed(1)}, ${Math.max(...rs).toFixed(1)}]  d ∈ [${Math.min(...ds).toFixed(1)}, ${Math.max(...ds).toFixed(1)}]  ω-from-dock ±${Math.max(...ws.map(Math.abs)).toFixed(1)}°  depth ${Math.min(...cs).toFixed(2)}`);
    const dc = viol.map((v) => Math.min(
      Math.hypot(v.lx - TIP_CORNERS[0][0], v.ly - TIP_CORNERS[0][1]),
      Math.hypot(v.lx - TIP_CORNERS[1][0], v.ly - TIP_CORNERS[1][1])));
    dc.sort((a, b) => a - b);
    console.log(`  dist-from-tip-corner: min ${dc[0].toFixed(1)}  median ${dc[Math.floor(dc.length / 2)].toFixed(1)}  max ${dc[dc.length - 1].toFixed(1)}`);
    // where do collisions land in the POLYGON frame?
    const pas = viol.map((v) => v.pa), pbs = viol.map((v) => v.pb), phs = viol.map((v) => v.ph);
    console.log(`  hit zone: a ∈ [${Math.min(...pas).toFixed(1)}, ${Math.max(...pas).toFixed(1)}]  b ∈ [${Math.min(...pbs).toFixed(1)}, ${Math.max(...pbs).toFixed(1)}]  h ∈ [${Math.min(...phs).toFixed(1)}, ${Math.max(...phs).toFixed(1)}]  (max(a,b) ≥ ${Math.min(...viol.map((v) => Math.max(v.pa, v.pb))).toFixed(1)})`);
  }
  console.log(`  transit min-h inside polygon: wing ${minH.wing.toFixed(1)}  tail ${minH.tail.toFixed(1)}  head ${minH.head.toFixed(1)}`);
}
// footprint profile summary (max q' per along bin)
console.log('transit footprint: q\' reach by |along| (max per unit bin):');
{
  let line = '';
  for (let i = 0; i < FP_NA; i += FP_SCALE) {
    let mx = -1;
    for (let s = 0; s < FP_SCALE; s++) for (let qb = 0; qb < FP_NQ; qb++) if (FP[qb * FP_NA + i + s]) mx = Math.max(mx, qb);
    if (mx >= 0) line += `${i / FP_SCALE}:${(mx / FP_SCALE).toFixed(1)} `;
  }
  console.log(`  ${line}`);
}

// ── 7. conjugate clip: polygon ∩ safe region, re-verify ──────────────────────
const MARGIN = 0.5; // safety margin (units) beyond the pooled footprint —
                    // user-locked 2026-07-17: the corner fins reach as close
                    // to the gear as the transit sweep allows, a hair of gap
                    // only (was 1.2; the half-unit bin pooling + SAFE_LVL
                    // still add ~0.5 of implicit conservatism on top)
{
  // FIELD-BASED clip (no raster staircase): region = { sdOrig ≥ 0 ∧ sdSafe ≥ 0 },
  // extracted by marching squares WITH sub-cell interpolation, then every vertex
  // that lies on the original outline is snapped back to it exactly — untrimmed
  // stretches reproduce the user's SVG verbatim, trimmed stretches follow the
  // smooth conjugate cap curve b = H − F(a) − MARGIN.
  const FMAX = new Float64Array(FP_NA).fill(-1);
  for (let i = 0; i < FP_NA; i++) {
    for (let qb = 0; qb < FP_NQ; qb++) if (FP[qb * FP_NA + i]) FMAX[i] = qb;
  }
  const G3 = (k) => Math.max(FMAX[Math.max(0, k - 1)] ?? -1, FMAX[k] ?? -1, FMAX[Math.min(FP_NA - 1, k + 1)] ?? -1);
  const Finterp = (a) => { // units in, units out (bins are half-units)
    let x = a * FP_SCALE;
    if (x < 0) x = 0;
    const k = Math.floor(x);
    if (k >= FP_NA - 1) return G3(FP_NA - 1) / FP_SCALE;
    const g0 = G3(k), g1 = G3(k + 1);
    if (g0 < 0 && g1 < 0) return -1;
    const bins = g0 < 0 ? g1 : g1 < 0 ? g0 : g0 + (g1 - g0) * (x - k);
    return bins / FP_SCALE;
  };
  const sdSafe = (a, b) => {
    let sd = Infinity;
    const fa = Finterp(a);
    if (fa >= 0) sd = Math.min(sd, H - fa - MARGIN - b);
    const fb = Finterp(b);
    if (fb >= 0) sd = Math.min(sd, H - fb - MARGIN - a);
    return sd;
  };
  // MINIMAL SMOOTH DEFORMATION (no boolean-clip artifacts): walk the ORIGINAL
  // dense outline; safe points stay VERBATIM (the SVG's own curves); shallow
  // offenders shift inward along their normal by a smoothed upper envelope
  // (G1, always ≥ the required shift → clearance only grows); deep pockets
  // (wing knobs — the transit reaches ~29 in) are dropped and bridged by
  // tracing the sdSafe level set (this keeps the wing stubs beyond tooth reach).
  const ccwPoly = polyArea2(poly) > 0 ? poly : poly.slice().reverse();
  const dense = [];
  for (let i = 0; i < ccwPoly.length; i++) {
    const A = ccwPoly[i], B = ccwPoly[(i + 1) % ccwPoly.length];
    const L = Math.hypot(B[0] - A[0], B[1] - A[1]);
    const n = Math.max(1, Math.ceil(L / 0.2));
    for (let k = 0; k < n; k++) dense.push([A[0] + ((B[0] - A[0]) * k) / n, A[1] + ((B[1] - A[1]) * k) / n]);
  }
  const N = dense.length;
  const SAFE_LVL = 0.3, DEEP = 3.5;
  const rawNormals = dense.map((_, i) => {
    const P = dense[(i + N - 1) % N], Q = dense[(i + 1) % N];
    const tx = Q[0] - P[0], ty = Q[1] - P[1];
    const L = Math.hypot(tx, ty) || 1;
    return [-ty / L, tx / L]; // rot90ccw(tangent) = interior side for CCW
  });
  // window-smoothed normal field: raw normals flip abruptly at the polygon's
  // corner vertices — shifting neighbours along diverging normals makes the
  // warped outline zigzag/self-cross. ±4 points ≈ ±0.8 units of smoothing.
  const normals = dense.map((_, i) => {
    let sx = 0, sy = 0;
    for (let w = -4; w <= 4; w++) {
      const [nx2, ny2] = rawNormals[(i + w + N) % N];
      sx += nx2; sy += ny2;
    }
    const L = Math.hypot(sx, sy) || 1;
    return [sx / L, sy / L];
  });
  const vRaw = dense.map((p, i) => {
    if (sdSafe(p[0], p[1]) > SAFE_LVL) return 0;
    const [nx2, ny2] = normals[i];
    for (let s = 0.05; s <= DEEP; s += 0.05) {
      if (sdSafe(p[0] + nx2 * s, p[1] + ny2 * s) > SAFE_LVL) return s;
    }
    return Infinity; // deep pocket
  });
  // smoothed upper envelope of the shifts (deep counted as DEEP for the bleed
  // so bridge junctions ease in; the deep points themselves are dropped)
  let vs = vRaw.map((v) => (v === Infinity ? DEEP : v));
  const vBase = vs.slice();
  for (let it = 0; it < 120; it++) {
    const nxt = vs.slice();
    for (let i = 0; i < N; i++) {
      nxt[i] = Math.max(vBase[i], Math.max(0, (vs[(i + N - 1) % N] + vs[(i + 1) % N]) / 2 - 0.004));
    }
    vs = nxt;
  }
  const grad = (a, b) => {
    const h2 = 0.05;
    return [(sdSafe(a + h2, b) - sdSafe(a - h2, b)) / (2 * h2), (sdSafe(a, b + h2) - sdSafe(a, b - h2)) / (2 * h2)];
  };
  const traceLevel = (P1, P2) => {
    const path = [];
    let p = [P1[0], P1[1]];
    for (let it = 0; it < 400; it++) {
      for (let k = 0; k < 3; k++) { // Newton back onto the level set
        const g = grad(p[0], p[1]);
        const gg = g[0] * g[0] + g[1] * g[1] || 1;
        const err = sdSafe(p[0], p[1]) - SAFE_LVL;
        p = [p[0] - (g[0] * err) / gg, p[1] - (g[1] * err) / gg];
      }
      const g = grad(p[0], p[1]);
      const gl = Math.hypot(g[0], g[1]) || 1;
      let t = [-g[1] / gl, g[0] / gl];
      if (t[0] * (P2[0] - p[0]) + t[1] * (P2[1] - p[1]) < 0) t = [-t[0], -t[1]];
      p = [p[0] + t[0] * 0.3, p[1] + t[1] * 0.3];
      if (Math.hypot(p[0] - P2[0], p[1] - P2[1]) < 0.45) return path;
      path.push([p[0], p[1]]);
    }
    console.log('  (level-set trace hit the iteration cap — straight bridge)');
    return [];
  };
  let contour = [];
  for (let i = 0; i < N; i++) {
    if (vRaw[i] === Infinity) continue;
    const [nx2, ny2] = normals[i];
    const w = [dense[i][0] + nx2 * vs[i], dense[i][1] + ny2 * vs[i]];
    const prevDeep = vRaw[(i + N - 1) % N] === Infinity;
    if (prevDeep && contour.length) contour.push(...traceLevel(contour[contour.length - 1], w));
    contour.push(w);
  }
  // cleanup: dedupe + drop zigzag reversals the warp can still leave at high
  // curvature (consecutive segment directions folding back on themselves)
  for (let pass = 0; pass < 200; pass++) {
    const n = contour.length;
    let changed = false;
    const keep = [];
    for (let i = 0; i < n; i++) {
      const P = contour[(i + n - 1) % n], C = contour[i], Q = contour[(i + 1) % n];
      if (Math.hypot(C[0] - P[0], C[1] - P[1]) < 0.12) { changed = true; continue; }
      const d1 = [C[0] - P[0], C[1] - P[1]], d2 = [Q[0] - C[0], Q[1] - C[1]];
      const dot = d1[0] * d2[0] + d1[1] * d2[1];
      const ll = Math.hypot(...d1) * Math.hypot(...d2) || 1;
      if (dot / ll < -0.2) { changed = true; continue; } // fold-back — drop
      keep.push(C);
    }
    contour = keep;
    if (!changed) break;
  }
  console.log(`\nwarp+bridge contour: ${contour.length} pts  (deep-dropped ${vRaw.filter((v) => v === Infinity).length}/${N}, max shallow shift ${Math.max(...vRaw.filter((v) => v !== Infinity)).toFixed(2)})`);
  // TARGETED FILLET: where the transit wall meets an SVG flank, the clip leaves
  // a pointy leftover corner (the head's top-left beak + its diagonal twin, the
  // bottom-right tab tip — clip artifacts, not SVG features). The fairing pass
  // below is erosion-capped (0.9) so it can only blunt them to r≈1.7, which
  // still reads as a point at zoom. Cut every concentrated CONVEX non-verbatim
  // corner with a quadratic Bezier across ±FILLET_S of arc length (r_eff ≈ 5,
  // matching the SVG's own head-corner roundness). Material removal only —
  // footprint-safe by construction; the fairing right after blends junctions.
  {
    const FILLET_S = 4.2, TURN_MIN = 45, ORIG_MIN = 0.5;
    const distToOrig = (p) => {
      let best = Infinity;
      for (let i = 0; i < N; i++) {
        const A = dense[i], B = dense[(i + 1) % N];
        const ex = B[0] - A[0], ey = B[1] - A[1];
        const L2 = ex * ex + ey * ey || 1;
        const t = Math.max(0, Math.min(1, ((p[0] - A[0]) * ex + (p[1] - A[1]) * ey) / L2));
        best = Math.min(best, Math.hypot(p[0] - A[0] - ex * t, p[1] - A[1] - ey * t));
      }
      return best;
    };
    const findCorners = () => {
      const Mc = contour.length;
      const found = [];
      for (let i = 0; i < Mc; i++) {
        const Pm = contour[(i - 3 + Mc) % Mc], C = contour[i], Pp = contour[(i + 3) % Mc];
        const inD = [C[0] - Pm[0], C[1] - Pm[1]], outD = [Pp[0] - C[0], Pp[1] - C[1]];
        const li = Math.hypot(...inD) || 1, lo = Math.hypot(...outD) || 1;
        const cross = (inD[0] * outD[1] - inD[1] * outD[0]) / (li * lo);
        const dot = (inD[0] * outD[0] + inD[1] * outD[1]) / (li * lo);
        const turn = (Math.atan2(Math.abs(cross), dot) * 180) / Math.PI;
        if (turn >= TURN_MIN && cross > 0 && distToOrig(C) > ORIG_MIN) found.push({ i, turn });
      }
      found.sort((a, b) => b.turn - a.turn);
      const picked = [];
      for (const c of found) {
        if (picked.every((p2) => Math.hypot(contour[c.i][0] - contour[p2.i][0], contour[c.i][1] - contour[p2.i][1]) > 6)) picked.push(c);
      }
      return picked;
    };
    const walk = (i0, sgn, S) => {
      const Mc = contour.length;
      let rem = S, i = i0;
      for (let guard = 0; guard < Mc; guard++) {
        const j = (i + sgn + Mc) % Mc;
        const A = contour[i], B = contour[j];
        const L = Math.hypot(B[0] - A[0], B[1] - A[1]);
        if (L >= rem) {
          const t = rem / L;
          return { far: j, pt: [A[0] + (B[0] - A[0]) * t, A[1] + (B[1] - A[1]) * t] };
        }
        rem -= L; i = j;
      }
      return { far: i0, pt: contour[i0].slice() };
    };
    // one corner per pass: each rebuild invalidates indices, so re-find after
    for (let guard = 0; guard < 8; guard++) {
      const cs = findCorners();
      if (!cs.length) break;
      const c = cs[0];
      const Mc = contour.length;
      const apex = contour[c.i];
      const back = walk(c.i, -1, FILLET_S), fwd = walk(c.i, 1, FILLET_S);
      // CCW order runs back.far → P0 → apex → P2 → fwd.far; keep the long way
      // around (fwd.far … back.far) then append P0 → bezier → P2
      const bez = [back.pt];
      for (let k = 1; k < 16; k++) {
        const t = k / 16;
        bez.push([
          (1 - t) * (1 - t) * back.pt[0] + 2 * (1 - t) * t * apex[0] + t * t * fwd.pt[0],
          (1 - t) * (1 - t) * back.pt[1] + 2 * (1 - t) * t * apex[1] + t * t * fwd.pt[1],
        ]);
      }
      bez.push(fwd.pt);
      const kept = [];
      for (let i = fwd.far; ; i = (i + 1) % Mc) {
        kept.push(contour[i]);
        if (i === back.far) break;
      }
      contour = kept.concat(bez);
      console.log(`  fillet: corner (${apex[0].toFixed(1)}, ${apex[1].toFixed(1)}) turn ${c.turn.toFixed(0)}°  → r_eff ≈ ${(FILLET_S / Math.tan(((c.turn / 2) * Math.PI) / 180)).toFixed(1)}`);
    }
  }
  // CONSTRAINED FAIRING: the warp/bridge junctions are G1 at envelope level but
  // still read as creases up close — verbatim and deformed stretches meet with a
  // curvature jump (the user wants every junction to look like ONE fillet).
  // Diffuse curvature along the outline: each point relaxes toward its
  // neighbours' midpoint ALONG ITS LOCAL NORMAL only (no tangential slide, so
  // the deviation cap measures real erosion), accepted only while it stays
  // above FAIR_LVL of the safety field (may eat 0.25 of SAFE_LVL, never dips
  // under the rasterized footprint+MARGIN edge — exact gates re-verify below)
  // and within FAIR_CAP of its pre-fairing position (tips round, never melt).
  {
    const step = 0.25, FAIR_CAP = 0.9, FAIR_LVL = 0.05, LAM = 0.5;
    let fine = [];
    for (let i = 0; i < contour.length; i++) {
      const A = contour[i], B = contour[(i + 1) % contour.length];
      const L = Math.hypot(B[0] - A[0], B[1] - A[1]);
      const n = Math.max(1, Math.round(L / step));
      for (let k = 0; k < n; k++) fine.push([A[0] + ((B[0] - A[0]) * k) / n, A[1] + ((B[1] - A[1]) * k) / n]);
    }
    const M = fine.length;
    const base = fine.map((p) => p.slice());
    let moved = 0;
    for (let it = 0; it < 160; it++) {
      const nxt = fine.map((p) => p.slice());
      moved = 0;
      for (let i = 0; i < M; i++) {
        const P = fine[(i + M - 1) % M], C = fine[i], Q = fine[(i + 1) % M];
        const tx = Q[0] - P[0], ty = Q[1] - P[1];
        const tl = Math.hypot(tx, ty) || 1;
        const nx2 = -ty / tl, ny2 = tx / tl;
        const d = ((P[0] + Q[0]) / 2 - C[0]) * nx2 + ((P[1] + Q[1]) / 2 - C[1]) * ny2;
        const q = [C[0] + nx2 * d * LAM, C[1] + ny2 * d * LAM];
        if (Math.hypot(q[0] - base[i][0], q[1] - base[i][1]) > FAIR_CAP) continue;
        if (sdSafe(q[0], q[1]) < FAIR_LVL) continue;
        nxt[i] = q;
        moved = Math.max(moved, Math.abs(d) * LAM);
      }
      fine = nxt;
    }
    contour = fine;
    console.log(`faired contour: ${M} pts  (last-iter max step ${moved.toFixed(4)})`);
  }
  // reuse the closed-RDP (two farthest anchors)
  let cp = contour;
  {
    let i0 = 0, best = -1;
    const c = cp.reduce(([sa, sb], [a, b]) => [sa + a / cp.length, sb + b / cp.length], [0, 0]);
    for (let i = 0; i < cp.length; i++) {
      const dd = Math.hypot(cp[i][0] - c[0], cp[i][1] - c[1]);
      if (dd > best) { best = dd; i0 = i; }
    }
    let i1 = 0; best = -1;
    for (let i = 0; i < cp.length; i++) {
      const dd = Math.hypot(cp[i][0] - cp[i0][0], cp[i][1] - cp[i0][1]);
      if (dd > best) { best = dd; i1 = i; }
    }
    if (i1 < i0) [i0, i1] = [i1, i0];
    const sA = rdpOpen(cp.slice(i0, i1 + 1), 0.1), sB = rdpOpen(cp.slice(i1).concat(cp.slice(0, i0 + 1)), 0.1);
    cp = sA.slice(0, -1).concat(sB.slice(0, -1));
  }
  cp = cp.map(([a, b]) => [Math.round(a * 10) / 10, Math.round(b * 10) / 10]);
  cp = cp.filter((p, i) => Math.hypot(p[0] - cp[(i + cp.length - 1) % cp.length][0], p[1] - cp[(i + cp.length - 1) % cp.length][1]) > 1e-9);
  console.log(`clipped polygon: ${cp.length} pts  bbox a:[${Math.min(...cp.map((p) => p[0]))}, ${Math.max(...cp.map((p) => p[0]))}] b:[${Math.min(...cp.map((p) => p[1]))}, ${Math.max(...cp.map((p) => p[1]))}]`);
  writeFileSync(join(TMP, 'corner_poly_clipped.json'), JSON.stringify(cp));

  // swap in the clipped polygon and re-verify everything
  poly = cp;
  const nxs = poly.map((p) => p[0]), nys = poly.map((p) => p[1]);
  PB.x0 = Math.min(...nxs); PB.y0 = Math.min(...nys); PB.x1 = Math.max(...nxs); PB.y1 = Math.max(...nys);
  {
    let hits = 0;
    let total = 0;
    for (let a = PB.x0; a <= PB.x1; a += 0.8) {
      for (let b = PB.y0; b <= PB.y1; b += 0.8) {
        if (!inPoly(a, b)) continue;
        const lo = a >= DEEP_SPLIT || b >= DEEP_SPLIT ? DEEP_LO : LEDGE_LO;
        for (let z = lo; z <= TOP; z += 0.6) { total++; if (armSweepHit(a, b, z, 0.5)) hits++; }
      }
    }
    console.log(`re-verify ARM sweep: ${hits}/${total} hits`);
  }
  toothOutline = trap;
  rebuildToothSamples();
  const R = sweepAll(0.5, false);
  console.log(`re-verify transit: min clearance ${R.worst.toFixed(2)}  at ${JSON.stringify(R.worstAt)}`);

  // REST-phase clearance with the final polygon — the three RIGID rest tilts
  {
    let worst = Infinity;
    const out = [0, 0, 0];
    for (const phi0 of [0, 120, 240]) {
      const th = (phi0 * Math.PI) / 180, ct = Math.cos(th), st = Math.sin(th);
      for (let k = 0; k < TEETH; k++) {
        const rot = (k * 2 * Math.PI) / TEETH;
        const cr = Math.cos(rot), sr = Math.sin(rot);
        for (const [lx, ly] of toothSamples) {
          for (const dd of [-PLATE_T, 0, 3.1]) {
            fold(lx * cr - ly * sr, lx * sr + ly * cr, dd, out);
            const alpha = (out[1] + out[2]) * Math.SQRT1_2;
            const wq = (out[1] - out[2]) * Math.SQRT1_2;
            const u2 = out[0] * ct - wq * st, w2 = out[0] * st + wq * ct;
            worst = Math.min(worst, cornerClearance(u2, (alpha + w2) * Math.SQRT1_2, (alpha - w2) * Math.SQRT1_2));
          }
        }
      }
    }
    console.log(`re-verify REST (θ=0/120/240 rigid tilts): min clearance ${worst.toFixed(2)}`);
  }

  // ── bake engine tables ──────────────────────────────────────────────────────
  const clipHalf = (pts, keepFn, edgeVal, axis) => {
    // Sutherland–Hodgman against a single axis-aligned half-plane
    const outPts = [];
    for (let i = 0; i < pts.length; i++) {
      const P = pts[i], Q = pts[(i + 1) % pts.length];
      const pin = keepFn(P), qin = keepFn(Q);
      if (pin) outPts.push(P);
      if (pin !== qin) {
        const t = (edgeVal - P[axis]) / (Q[axis] - P[axis]);
        const M = [P[0] + (Q[0] - P[0]) * t, P[1] + (Q[1] - P[1]) * t];
        outPts.push(M);
      }
    }
    return outPts.map(([a, b]) => [Math.round(a * 10) / 10, Math.round(b * 10) / 10]);
  };
  const deepA = clipHalf(poly, (P) => P[0] >= DEEP_SPLIT, DEEP_SPLIT, 0);
  const deepB = clipHalf(clipHalf(poly, (P) => P[0] <= DEEP_SPLIT, DEEP_SPLIT, 0), (P) => P[1] >= DEEP_SPLIT, DEEP_SPLIT, 1);
  const fmt = (pts) => pts.map(([a, b]) => `[${a}, ${b}]`).join(', ');
  console.log(`\n// baked tables (paste into gearGeometry.ts):`);
  console.log(`CORNER_POLY (${poly.length}): [${fmt(poly)}]`);
  console.log(`CORNER_DEEP_A (${deepA.length}): [${fmt(deepA)}]`);
  console.log(`CORNER_DEEP_B (${deepB.length}): [${fmt(deepB)}]`);

  // overlay for the user: original trace (gray) vs clipped (red) + footprint edge
  const orig = JSON.parse(readFileSync(join(TMP, 'corner_poly.json'), 'utf8'));
  const toU = ([a, b]) => [512 + a * 4, 512 - b * 4];
  const pl = (pts) => pts.map((p) => toU(p).map((v) => v.toFixed(1)).join(',')).join(' ');
  // footprint boundary curve for the top gear (allowed side): b = H − maxq'(a) − MARGIN
  const fpCurve = [];
  for (let i = 0; i < FP_NA; i++) {
    let mx = -1;
    for (let qb = 0; qb < FP_NQ; qb++) if (FP[qb * FP_NA + i]) mx = qb;
    if (mx >= 0) fpCurve.push([i, H - mx - MARGIN]);
  }
  const svgOut = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="640 -20 440 440" width="1100" height="1100">
<rect x="640" y="-20" width="440" height="440" fill="white"/>
<polygon points="${pl(orig)}" fill="#000" fill-opacity="0.15" stroke="#999" stroke-width="1"/>
<polygon points="${pl(poly)}" fill="#2a2" fill-opacity="0.25" stroke="#c00" stroke-width="1.5"/>
<polyline points="${pl(fpCurve)}" fill="none" stroke="#f80" stroke-width="1.5" stroke-dasharray="7 4"/>
<polyline points="${pl(fpCurve.map(([a, b]) => [b, a]))}" fill="none" stroke="#f80" stroke-width="1.5" stroke-dasharray="7 4"/>
<text x="650" y="405" font-size="15" fill="#333">gray=SVG original  green/red=final feasible sticker  orange-dash=tooth transit envelope (v12 rigid crown, all start phases)</text>
</svg>`;
  writeFileSync(join(PNG, 'gear_corner_final.svg'), svgOut);
  console.log(`overlay: ${join(PNG, 'gear_corner_final.svg')}`);
}
console.log(`total time ${((Date.now() - t0) / 1000).toFixed(1)}s`);
