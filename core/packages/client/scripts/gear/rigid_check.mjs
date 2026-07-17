// rigid_check.mjs — 3D clearance oracle for the v12 RIGID creased crown.
//
// v12 (user-locked with real-machine evidence): the edge gear is ONE rigid
// piece — the creased disc spins ±480°/flip about its outward radial n̂ and
// RESTS TILTED at phases ±120° (the scrambled real cube bristles). The old 2D
// footprint reasoning (mesh_check.mjs) assumed the crown never leaves the two
// face-plane slabs; a rigid crown does — so every crown↔corner-plate
// interaction must be re-verified in 3D:
//   REST    θ ∈ {0°,120°,240°}          crown vs the 4 surrounding corner plates
//   TRANSIT θ = φ0 ± (480/90)·ω, ω∈[0,360°)  synced flip from EVERY start phase
// plus the constructive bounds (ball vs corner slab, hub throat cone).
// Prints min clearances; negative = interpenetration (geometry regression).
//
//   node core/packages/client/scripts/gear/rigid_check.mjs
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { crownSectorOutline } from './sector_check.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));

// ── engine constants (must match gearGeometry.ts) ───────────────────────────
const H = 128;
const TEETH = 6, PLATE_T = 7, FOLD_R = 1.2;
const LIFT = 0.5, DEPTH = 2.6;
const STICKER_TOP = LIFT + DEPTH;            // 3.1
const LINE_TOP = STICKER_TOP + 0.12;         // fold-line mark top
const RATIO = 480 / 90;

// CORNER_POLY: parse the shipped values straight out of the engine source, so
// the oracle always judges what actually renders.
const engineSrc = readFileSync(join(HERE, '../../app/[lang]/sim/engine/gear/gearGeometry.ts'), 'utf8');
const polyMatch = engineSrc.match(/export const CORNER_POLY: V2\[\] = \[([\s\S]*?)\n\];/);
if (!polyMatch) throw new Error('CORNER_POLY not found in gearGeometry.ts');
const polyNums = polyMatch[1].match(/-?\d+(?:\.\d+)?/g).map(Number);
const CORNER_POLY = [];
for (let i = 0; i < polyNums.length; i += 2) CORNER_POLY.push([polyNums[i], polyNums[i + 1]]);
console.log(`CORNER_POLY: ${CORNER_POLY.length} pts (from engine source)`);

// ── fold map for the UF slot (E=(0,H,H), ê=x̂, facePlus=U(+y), faceMinus=F(+z)) ──
function foldPoint(p, q, d) {
  if (q >= FOLD_R) return [p, H + d, H - q];
  if (q <= -FOLD_R) return [p, H + q, H + d];
  const a = (q / FOLD_R) * (Math.PI / 4);
  const cN = (FOLD_R + d) * Math.cos(a) - FOLD_R * Math.SQRT2;
  const cH = (FOLD_R + d) * Math.sin(a);
  return [p, H + Math.SQRT1_2 * (cN + cH), H + Math.SQRT1_2 * (cN - cH)];
}

// ── crown cloud in spin-cylindrical form (axis n̂=(0,1,1)/√2 through origin) ──
// P = α·n̂ + u·ê + w·t̂  with ê = x̂, t̂ = (0,1,−1)/√2; spin θ advances the (u,w)
// azimuth. Store (α, r, φ) per point — a frame is two trig calls per point.
function toCyl([x, y, z]) {
  const alpha = (y + z) * Math.SQRT1_2;
  const w = (y - z) * Math.SQRT1_2;
  return [alpha, Math.hypot(x, w), Math.atan2(w, x)];
}

function buildCloud(bStep, gStep) {
  const outline = crownSectorOutline(0);
  const base = [];
  for (let i = 0; i < outline.length; i++) {
    const A = outline[i], B = outline[(i + 1) % outline.length];
    const L = Math.hypot(B[0] - A[0], B[1] - A[1]);
    const n = Math.max(1, Math.ceil(L / bStep));
    for (let k = 0; k < n; k++) base.push([A[0] + ((B[0] - A[0]) * k) / n, A[1] + ((B[1] - A[1]) * k) / n]);
  }
  const inPoly = (x, y) => {
    let inside = false;
    for (let i = 0, j = outline.length - 1; i < outline.length; j = i++) {
      const [xi, yi] = outline[i], [xj, yj] = outline[j];
      if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
    }
    return inside;
  };
  for (let x = -24; x <= 24; x += gStep) {
    for (let y = 0.5; y <= 62; y += gStep) if (inPoly(x, y)) base.push([x, y]);
  }
  const DEPTHS = [-PLATE_T, -PLATE_T / 2, 0, LIFT + DEPTH / 2, LINE_TOP + 0.12];
  const cyl = [];
  const pitch = (2 * Math.PI) / TEETH;
  for (let k = 0; k < TEETH; k++) {
    const c = Math.cos(k * pitch), s = Math.sin(k * pitch);
    for (const [x, y] of base) {
      const p = x * c - y * s, q = x * s + y * c;
      for (const d of DEPTHS) cyl.push(toCyl(foldPoint(p, q, d)));
    }
  }
  return cyl;
}

// ── corner plate field: signed clearance (negative = inside a plate prism) ──
// Prism per axis j: |coord_j| ∈ [H − CORNER_PLATE_T, H + STICKER_TOP + 0.52],
// in-plane |a|,|b| inside CORNER_POLY (quadrant fold = all 4 corners of both
// faces). CORNER_PLATE_T (v3 strict-intersection corners: the plates dig
// below the crown-standard PLATE_T to root into the intersection body's
// roof) is parsed from the engine source so the oracle always judges the
// shipped band.
const cptMatch = engineSrc.match(/export const CORNER_PLATE_T = ([\d.]+)/);
if (!cptMatch) throw new Error('CORNER_PLATE_T not found in gearGeometry.ts');
const CORNER_PLATE_T = Number(cptMatch[1]);
console.log(`CORNER_PLATE_T: ${CORNER_PLATE_T} (from engine source)`);
const BAND_LO = H - CORNER_PLATE_T, BAND_HI = H + STICKER_TOP + 0.52;
const PX = CORNER_POLY.map((p) => p[0]), PY = CORNER_POLY.map((p) => p[1]);
const PMINX = Math.min(...PX), PMAXX = Math.max(...PX);
const PMINY = Math.min(...PY), PMAXY = Math.max(...PY);

function polySigned(a, b) {
  // quick reject far outside the poly bbox
  const bb = Math.max(PMINX - a, a - PMAXX, PMINY - b, b - PMAXY);
  if (bb > 6) return bb; // lower bound on the true distance, enough to cull
  let inside = false;
  let dEdge = Infinity;
  for (let i = 0, k = CORNER_POLY.length - 1; i < CORNER_POLY.length; k = i++) {
    const xi = PX[i], yi = PY[i], xj = PX[k], yj = PY[k];
    if ((yi > b) !== (yj > b) && a < ((xj - xi) * (b - yi)) / (yj - yi) + xi) inside = !inside;
    const ex = xj - xi, ey = yj - yi;
    const L2 = ex * ex + ey * ey;
    const t = L2 ? Math.max(0, Math.min(1, ((a - xi) * ex + (b - yi) * ey) / L2)) : 0;
    const dx = a - xi - t * ex, dy = b - yi - t * ey;
    const d2 = dx * dx + dy * dy;
    if (d2 < dEdge) dEdge = d2;
  }
  dEdge = Math.sqrt(dEdge);
  return inside ? -dEdge : dEdge;
}

function plateClearance(x, y, z) {
  let best = Infinity;
  const co = [x, y, z];
  for (let j = 0; j < 3; j++) {
    const h = Math.abs(co[j]);
    const dz = h < BAND_LO ? BAND_LO - h : h > BAND_HI ? h - BAND_HI : 0;
    if (dz > 4) continue;
    const a = Math.abs(co[(j + 1) % 3]), b = Math.abs(co[(j + 2) % 3]);
    const dIn = polySigned(a, b);
    const dd = dz === 0 ? dIn : dIn <= 0 ? dz : Math.hypot(dz, dIn);
    if (dd < best) best = dd;
  }
  return best;
}

// ── sweeps ──────────────────────────────────────────────────────────────────
const cloud = buildCloud(1.0, 2.0);
console.log(`cloud: ${cloud.length} pts`);

// constructive bounds: ball + the throat undersweep line ρ = a − PLATE_T·√2
// (blocks are NOT covered by any ball argument — the slab starts at CUT+SEAM =
// 34.5, far inside the sweep; the rigid-sweep LATHE carve is what protects
// them, verified by the containment test in gear_geometry.test.ts)
let maxR = 0, maxBall = 0, minUnder = Infinity;
for (const [alpha, r] of cloud) {
  maxR = Math.max(maxR, r);
  const axial = alpha - H * Math.SQRT2; // along n̂ from E
  maxBall = Math.max(maxBall, Math.hypot(axial, r));
  minUnder = Math.min(minUnder, r - (-axial - PLATE_T * Math.SQRT2));
}
console.log(`max transverse radius: ${maxR.toFixed(2)}  max ball radius about E: ${maxBall.toFixed(2)}  (CROWN_BALL must cover)`);
console.log(`min ρ − (a − PLATE_T·√2): ${minUnder.toFixed(2)}  (≥0 ⇒ the throat undersweep envelope holds — hub/cone hide below it)`);

const D2R = Math.PI / 180;
// evaluate min plate clearance at spin θ (deg) + orbit ω (deg about x̂)
function frameMin(thetaDeg, omegaDeg, track) {
  const th = thetaDeg * D2R, om = omegaDeg * D2R;
  const co = Math.cos(om), so = Math.sin(om);
  let worst = Infinity;
  for (const [alpha, r, phi] of cloud) {
    const u = r * Math.cos(phi + th), w = r * Math.sin(phi + th);
    const x = u;
    const y0 = Math.SQRT1_2 * (alpha + w), z0 = Math.SQRT1_2 * (alpha - w);
    const y = co * y0 - so * z0, z = so * y0 + co * z0;
    // cull: only points near some face-plane band can touch a plate
    const m = Math.max(Math.abs(x), Math.abs(y), Math.abs(z));
    if (m < BAND_LO - 4 || m > BAND_HI + 4) continue;
    const c = plateClearance(x, y, z);
    if (c < worst) {
      worst = c;
      if (track && c < track.c) Object.assign(track, { c, x, y, z, thetaDeg, omegaDeg });
    }
  }
  return worst;
}

// REST: the three physical rest phases
console.log('\nREST (tilted phases are physical states now):');
for (const th of [0, 120, 240]) {
  const track = { c: Infinity };
  const worst = frameMin(th, 0, track);
  console.log(`  θ=${th}°: min plate clearance ${worst.toFixed(2)}` +
    (worst < 2 ? `  @ (${track.x.toFixed(1)}, ${track.y.toFixed(1)}, ${track.z.toFixed(1)})` : ''));
}

// TRANSIT: both relative branches, all three start phases, coarse → refine
console.log('\nTRANSIT (θ = φ0 ± RATIO·ω):');
let globalMin = Infinity, globalArg = null;
for (const sgn of [1, -1]) {
  for (const phi0 of [0, 120, 240]) {
    let min1 = Infinity, argW = 0;
    for (let w = 0; w < 360; w += 2) {
      const c = frameMin(phi0 + sgn * RATIO * w, w, null);
      if (c < min1) { min1 = c; argW = w; }
    }
    let min2 = min1, argW2 = argW;
    for (let w = argW - 2; w <= argW + 2; w += 0.25) {
      const c = frameMin(phi0 + sgn * RATIO * w, ((w % 360) + 360) % 360, null);
      if (c < min2) { min2 = c; argW2 = w; }
    }
    console.log(`  branch ${sgn > 0 ? '+' : '-'} φ0=${phi0}°: min ${min2.toFixed(2)} @ ω=${argW2.toFixed(2)}°`);
    if (min2 < globalMin) { globalMin = min2; globalArg = { sgn, phi0, w: argW2 }; }
  }
}
console.log(`\nGLOBAL transit min: ${globalMin.toFixed(2)} @ branch ${globalArg.sgn > 0 ? '+' : '-'} φ0=${globalArg.phi0}° ω=${globalArg.w}°`);
{
  // diagnose the offender: world position + which plate face + plan coords
  const track = { c: Infinity };
  frameMin(globalArg.phi0 + globalArg.sgn * RATIO * globalArg.w, ((globalArg.w % 360) + 360) % 360, track);
  const co = [track.x, track.y, track.z];
  let face = -1;
  for (let j = 0; j < 3; j++) if (Math.abs(co[j]) > BAND_LO - 4) face = j;
  const a = Math.abs(co[(face + 1) % 3]), b = Math.abs(co[(face + 2) % 3]);
  console.log(`offender: (${track.x.toFixed(2)}, ${track.y.toFixed(2)}, ${track.z.toFixed(2)})  plate axis ${'xyz'[face]}` +
    `  height ${Math.abs(co[face]) - H >= 0 ? '+' : ''}${(Math.abs(co[face]) - H).toFixed(2)}  plan (${a.toFixed(1)}, ${b.toFixed(1)})`);
}

// ── own hub + backing cone vs the tilted crown underside ────────────────────
// Both are slope-1 cones about n̂ starting at the THROAT_OFF intercept parsed
// from the engine; the crown's spin-sweep inner envelope is ρ(a) = a −
// PLATE_T·√2 (underside at p=0), so both must sit a margin below that line.
{
  const thrExpr = engineSrc.match(/const THROAT_OFF = ([^;]+);/)?.[1];
  if (!thrExpr) throw new Error('THROAT_OFF not found in engine source');
  const THROAT = eval(thrExpr); // uses PLATE_T from this scope
  console.log(`\nengine THROAT_OFF = ${thrExpr.trim()} = ${THROAT.toFixed(2)}`);
  const WEB_R = 13;
  let worstHub = Infinity, worstCone = Infinity;
  for (const [alpha, r] of cloud) {
    const a = H * Math.SQRT2 - alpha;
    // hub solid: rad ≤ WEB_R, axial ∈ [THROAT + rad, THROAT + PLATE_T·√2 + rad]
    if (r <= WEB_R + 2) worstHub = Math.min(worstHub, (THROAT + r) - a);
    // backing cone solid: ρ ≤ a − THROAT for axial ∈ [THROAT, THROAT + 34]
    if (a >= THROAT && a <= THROAT + 34 + 2) worstCone = Math.min(worstCone, r - (a - THROAT));
  }
  console.log(`hub top-cone clearance (min over crown, rad ≤ WEB_R+2): ${worstHub.toFixed(2)}  (>0 required)`);
  console.log(`backing-cone clearance (min over crown in its axial span): ${worstCone.toFixed(2)}  (>0 required)`);
}
console.log(globalMin > 0 ? 'OK: no interpenetration' : 'VIOLATION: corner plates need re-clipping for the rigid crown');
