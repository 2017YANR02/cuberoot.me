// build_2x2_essential.mjs
// Self-contained home-grown enumerator for the 2x2 (corner-only) "essential" case set.
// Replaces the retired scripts/build_2x2_essential.py (which read a research xlsx).
// Reads NO xlsx and NO external artifacts — it enumerates the 2x2 corner space
// from scratch using the validated <U,R,F>, DBL-fixed model and writes both JSON files:
//   2x2_essential.json        (meta + htm/qtm marginals + joint grid + stat groups + case_agg)
//   2x2_essential_cases.json  (per-case difficulty rows: idx,hAlg,F,H,QH,Q,qAlg,f6,dqhq)
//
// Model (validated): 8 corners URF=0,UFL=1,ULB=2,UBR=3,DFR=4,DLF=5,DBL=6,DRB=7.
//   Corner DBL(6) is held fixed; only the 3 adjacent faces U,R,F turn.
//   State = (cp,co) of the 7 free pieces (6 free orientations, 7th fixed by parity).
//   Perfect-hash index = permRank(7 free pieces)*729 + oriRank(6 free oris), N=3,674,160.
// Essential dedup group (order 48): 24 color-neutral rotations (conjugate + regauge to fix DBL)
//   times the mirror automorphism (U<->U', R<->F', F<->R'). No inverse. => 77,801 essential cases.
//
// Deterministic. CI-runnable: node --max-old-space-size=4096 scripts/build_2x2_essential.mjs
// Optional: --out=<dir> to redirect output; --verify=<oracle.json> to self-check against a reference.
//
// Home-grown enumeration + dedup by CubeRoot (this script is the sole source of the data).
// Reference model: https://www.jaapsch.net/puzzles/cube2.htm

import { writeFileSync, readFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const N = 3674160;
const GENERATED_AT = '2026-07-11';

// ---- CLI ----
const args = process.argv.slice(2);
const outArg = args.find(a => a.startsWith('--out='));
const verifyArg = args.find(a => a.startsWith('--verify='));
const OUT_DIR = outArg ? outArg.slice(6)
  : (process.env.OUT_DIR || fileURLToPath(new URL('../stats/scramble', import.meta.url)));
const VERIFY = verifyArg ? verifyArg.slice(9) : null;

const log = (...a) => process.stderr.write(a.join(' ') + '\n');

// =====================================================================================
// 1. Group algebra on (cp,co) elements  ( "a then b" state semantics )
// =====================================================================================
const ID = { p: [0, 1, 2, 3, 4, 5, 6, 7], o: [0, 0, 0, 0, 0, 0, 0, 0] };
function P(a, b) {
  const p = new Array(8), o = new Array(8);
  for (let i = 0; i < 8; i++) { p[i] = a.p[b.p[i]]; o[i] = (a.o[b.p[i]] + b.o[i]) % 3; }
  return { p, o };
}
function inv(g) {
  const p = new Array(8), o = new Array(8);
  for (let i = 0; i < 8; i++) { p[g.p[i]] = i; o[g.p[i]] = (3 - g.o[i]) % 3; }
  return { p, o };
}
function conj(u, g) { return P(P(u, g), inv(u)); }
function pw(m, n) { let r = ID; for (let i = 0; i < n; i++) r = P(r, m); return r; }

// The three face quarter-turn generators (whole-cube DBL-fixed convention).
const MOVES = {
  U: { p: [3, 0, 1, 2, 4, 5, 6, 7], o: [0, 0, 0, 0, 0, 0, 0, 0] },
  R: { p: [4, 1, 2, 0, 7, 5, 6, 3], o: [2, 0, 0, 1, 1, 0, 0, 2] },
  F: { p: [1, 5, 2, 3, 0, 4, 6, 7], o: [1, 2, 0, 0, 2, 1, 0, 0] },
};
const MOVE_ELEMS = [pw(MOVES.U, 1), pw(MOVES.U, 2), pw(MOVES.U, 3),
                    pw(MOVES.R, 1), pw(MOVES.R, 2), pw(MOVES.R, 3),
                    pw(MOVES.F, 1), pw(MOVES.F, 2), pw(MOVES.F, 3)];
const MOVE_NAMES = ['U', 'U2', "U'", 'R', 'R2', "R'", 'F', 'F2', "F'"];
const QCOLS = [0, 2, 3, 5, 6, 8];              // quarter-turn columns
const QCOST = [1, 2, 1, 1, 2, 1, 1, 2, 1];     // QTM cost of each of the 9 HTM moves
const PHIMOVE = [2, 1, 0, 8, 7, 6, 5, 4, 3];   // mirror move relabel: U<->U', R<->F', F<->R'

// =====================================================================================
// 2. Perfect-hash index  (7 free pieces, 6 free orientations)
// =====================================================================================
const FREE = [0, 1, 2, 3, 4, 5, 7];
const PMAP = new Int8Array(8); { let k = 0; for (const p of FREE) PMAP[p] = k++; }
const INVP = [0, 1, 2, 3, 4, 5, 7];
const FACT = [1, 1, 2, 6, 24, 120, 720];
function permRank(cp) {
  const a = new Int8Array(7);
  for (let i = 0; i < 7; i++) a[i] = PMAP[cp[FREE[i]]];
  let r = 0;
  for (let i = 0; i < 7; i++) { let s = a[i]; for (let j = 0; j < i; j++) if (a[j] < a[i]) s--; r += s * FACT[6 - i]; }
  return r;
}
function oriRank(co) { let r = 0; for (let i = 0; i < 6; i++) r = r * 3 + co[FREE[i]]; return r; }
function indexPO(p, o) { return permRank(p) * 729 + oriRank(o); }
function index(g) { return permRank(g.p) * 729 + oriRank(g.o); }
function decode(idx) {
  const pr = Math.floor(idx / 729); let orr = idx % 729;
  const co = new Array(8).fill(0);
  for (let i = 5; i >= 0; i--) { co[FREE[i]] = orr % 3; orr = Math.floor(orr / 3); }
  let s = 0; for (let i = 0; i < 6; i++) s += co[FREE[i]]; co[FREE[6]] = ((3 - (s % 3)) % 3); co[6] = 0;
  let r = pr; const digits = new Array(7);
  for (let i = 0; i < 7; i++) { const f = FACT[6 - i]; digits[i] = Math.floor(r / f); r %= f; }
  const avail = [0, 1, 2, 3, 4, 5, 6]; const a = new Array(7);
  for (let i = 0; i < 7; i++) { a[i] = avail[digits[i]]; avail.splice(digits[i], 1); }
  const cp = new Array(8); cp[6] = 6;
  for (let i = 0; i < 7; i++) cp[FREE[i]] = INVP[a[i]];
  return { p: cp, o: co };
}

// =====================================================================================
// 3. Cube symmetry elements (24 proper rotations) via a facelet model.
//    Used to build the color-neutral orbit (conjugate + regauge to re-fix DBL).
// =====================================================================================
const NF = 24;
const COORD = [[1, 1, 1], [-1, 1, 1], [-1, 1, -1], [1, 1, -1],
               [1, -1, 1], [-1, -1, 1], [-1, -1, -1], [1, -1, -1]];
function slotIndex(v) { for (let i = 0; i < 8; i++) { const c = COORD[i]; if (c[0] === v[0] && c[1] === v[1] && c[2] === v[2]) return i; } return -1; }
function mmul(M, v) {
  return [M[0][0] * v[0] + M[0][1] * v[1] + M[0][2] * v[2],
          M[1][0] * v[0] + M[1][1] * v[1] + M[1][2] * v[2],
          M[2][0] * v[0] + M[2][1] * v[1] + M[2][2] * v[2]];
}
function det(M) {
  return M[0][0] * (M[1][1] * M[2][2] - M[1][2] * M[2][1])
       - M[0][1] * (M[1][0] * M[2][2] - M[1][2] * M[2][0])
       + M[0][2] * (M[1][0] * M[2][1] - M[1][1] * M[2][0]);
}
function faceId(a, sign) { return a * 2 + (sign > 0 ? 0 : 1); }
const SOLVED_COLOR = (() => { const c = new Int8Array(NF); for (let i = 0; i < 8; i++) for (let a = 0; a < 3; a++) c[i * 3 + a] = faceId(a, COORD[i][a]); return c; })();
const DIR = -1; // calibrated cyclic-orientation convention (matches the MOVES table)
function cycAxesF(i) { const v = COORD[i]; if (v[0] * v[1] * v[2] * DIR < 0) return [1, 0, 2]; return [1, 2, 0]; }
function faceletPerm(M) {
  const perm = new Int8Array(NF); for (let f = 0; f < NF; f++) perm[f] = f;
  for (let i = 0; i < 8; i++) {
    const vi = COORD[i]; const j = slotIndex(mmul(M, vi));
    for (let a = 0; a < 3; a++) { const n = [0, 0, 0]; n[a] = vi[a]; const np = mmul(M, n); const ap = np[0] !== 0 ? 0 : (np[1] !== 0 ? 1 : 2); perm[j * 3 + ap] = i * 3 + a; }
  }
  return perm;
}
function applyPerm(color, perm) { const c = new Int8Array(NF); for (let f = 0; f < NF; f++) c[f] = color[perm[f]]; return c; }
function toCpco(color) {
  const cp = new Array(8), co = new Array(8);
  for (let i = 0; i < 8; i++) {
    const colors = [color[i * 3], color[i * 3 + 1], color[i * 3 + 2]];
    let piece = -1;
    for (let k = 0; k < 8; k++) { const kc = [SOLVED_COLOR[k * 3], SOLVED_COLOR[k * 3 + 1], SOLVED_COLOR[k * 3 + 2]]; if (kc.slice().sort().join() === colors.slice().sort().join()) { piece = k; break; } }
    cp[i] = piece;
    let udAxis = -1; for (let a = 0; a < 3; a++) { const col = color[i * 3 + a]; if (col === 2 || col === 3) { udAxis = a; break; } }
    co[i] = cycAxesF(i).indexOf(udAxis);
  }
  return { p: cp, o: co };
}
function symElem(M) { return toCpco(applyPerm(SOLVED_COLOR, faceletPerm(M))); }
function allMatrices() {
  const perms = [[0, 1, 2], [0, 2, 1], [1, 0, 2], [1, 2, 0], [2, 0, 1], [2, 1, 0]]; const out = [];
  for (const pm of perms) for (let s = 0; s < 8; s++) { const sg = [(s & 1) ? -1 : 1, (s & 2) ? -1 : 1, (s & 4) ? -1 : 1]; const M = [[0, 0, 0], [0, 0, 0], [0, 0, 0]]; for (let r = 0; r < 3; r++) M[r][pm[r]] = sg[r]; out.push(M); }
  return out;
}
const ROTS = allMatrices().filter(M => det(M) === 1).map(symElem);  // 24 proper rotations
const XR = symElem([[1, 0, 0], [0, 0, -1], [0, 1, 0]]);             // rotation gen (x-axis)
const YR = symElem([[0, 0, 1], [0, 1, 0], [-1, 0, 0]]);             // rotation gen (y-axis)
if (ROTS.length !== 24) throw new Error('ROTS != 24');
// regauge: premultiply by the unique rotation that re-fixes DBL(6) to (slot 6, ori 0)
function regA(x) {
  for (const r of ROTS) {
    const p = new Array(8), o = new Array(8);
    for (let i = 0; i < 8; i++) { p[i] = r.p[x.p[i]]; o[i] = (r.o[x.p[i]] + x.o[i]) % 3; }
    if (p[6] === 6 && o[6] === 0) return { p, o };
  }
  throw new Error('regA failed');
}
const cA_x = (idx) => index(regA(conj(XR, decode(idx))));
const cA_y = (idx) => index(regA(conj(YR, decode(idx))));

// =====================================================================================
// 4. Color model for face-solid / first-layer / bar / per-face solves (facelet coloring).
//    Face index order 0..5 = U,D,F,B,R,L. Colors: U0 D1 F2 B3 R4 L5.
// =====================================================================================
const CC = [
  [0, 4, 2], [0, 2, 5], [0, 5, 3], [0, 3, 4],   // URF UFL ULB UBR
  [1, 2, 4], [1, 5, 2], [1, 3, 5], [1, 4, 3],   // DFR DLF DBL DRB
];
const FACE_SLOTS = [[0, 1, 2, 3], [4, 5, 6, 7], [0, 1, 4, 5], [2, 3, 6, 7], [0, 3, 4, 7], [1, 2, 5, 6]];
const ADJ = {
  0: [[0, 1, 2], [1, 2, 5], [2, 3, 3], [3, 0, 4]],
  1: [[4, 5, 2], [5, 6, 5], [6, 7, 3], [7, 4, 4]],
  2: [[0, 1, 0], [1, 5, 5], [5, 4, 1], [4, 0, 4]],
  3: [[2, 3, 0], [3, 7, 4], [7, 6, 1], [6, 2, 5]],
  4: [[0, 3, 0], [3, 7, 3], [7, 4, 1], [4, 0, 2]],
  5: [[1, 2, 0], [2, 6, 3], [6, 5, 1], [5, 1, 2]],
};
const SIGN = -1;
function showColor(cp, co, slot, face) { const j = CC[slot].indexOf(face); return CC[cp[slot]][((j + SIGN * co[slot]) % 3 + 3) % 3]; }
function faceSolid(cp, co, f) { const s = FACE_SLOTS[f]; const c = showColor(cp, co, s[0], f); return showColor(cp, co, s[1], f) === c && showColor(cp, co, s[2], f) === c && showColor(cp, co, s[3], f) === c; }
function layerSolved(cp, co, f) { if (!faceSolid(cp, co, f)) return false; for (const [a, b, sf] of ADJ[f]) if (showColor(cp, co, a, sf) !== showColor(cp, co, b, sf)) return false; return true; }
function hasBar(cp, co) { for (let f = 0; f < 6; f++) for (const [a, b, sf] of ADJ[f]) if (showColor(cp, co, a, sf) === showColor(cp, co, b, sf)) return true; return false; }

// =====================================================================================
// 5. Build the full move-transition table + per-state flags + per-face solid seeds.
// =====================================================================================
log('building move tables + flags...'); console.time('tables');
const tbl = []; for (let m = 0; m < 9; m++) tbl.push(new Int32Array(N));
const solidFlag = new Uint8Array(N), layerFlag = new Uint8Array(N), noBarFlag = new Uint8Array(N);
const faceSeed = [[], [], [], [], [], []];
{
  const cp = new Int8Array(8), co = new Int8Array(8);
  for (let idx = 0; idx < N; idx++) {
    const g = decode(idx);
    for (let i = 0; i < 8; i++) { cp[i] = g.p[i]; co[i] = g.o[i]; }
    let anySolid = false, anyLayer = false;
    for (let f = 0; f < 6; f++) if (faceSolid(cp, co, f)) { faceSeed[f].push(idx); anySolid = true; }
    for (let f = 0; f < 6; f++) if (layerSolved(cp, co, f)) { anyLayer = true; break; }
    solidFlag[idx] = anySolid ? 1 : 0;
    layerFlag[idx] = anyLayer ? 1 : 0;
    noBarFlag[idx] = hasBar(cp, co) ? 0 : 1;
    for (let m = 0; m < 9; m++) {
      const mm = MOVE_ELEMS[m]; const p = new Array(8), o = new Array(8);
      for (let i = 0; i < 8; i++) { p[i] = g.p[mm.p[i]]; o[i] = (g.o[mm.p[i]] + mm.o[i]) % 3; }
      tbl[m][idx] = indexPO(p, o);
    }
  }
}
console.timeEnd('tables');

// ---- BFS helpers ----
function bfsCols(cols) {
  const dist = new Uint8Array(N).fill(255); dist[0] = 0; let fr = [0], d = 0;
  while (fr.length) { const nx = []; for (const s of fr) for (const m of cols) { const t = tbl[m][s]; if (dist[t] === 255) { dist[t] = d + 1; nx.push(t); } } fr = nx; d++; }
  return dist;
}
function bfsSeeds(seeds) {
  const dist = new Uint8Array(N).fill(255); let fr = [];
  for (const s of seeds) if (dist[s] === 255) { dist[s] = 0; fr.push(s); }
  let d = 0;
  while (fr.length) { const nx = []; for (const s of fr) for (let m = 0; m < 9; m++) { const t = tbl[m][s]; if (dist[t] === 255) { dist[t] = d + 1; nx.push(t); } } fr = nx; d++; }
  return dist;
}
function bfsFlag(flag) { const seeds = []; for (let i = 0; i < N; i++) if (flag[i]) seeds.push(i); return bfsSeeds(seeds); }

log('BFS distances (H, Q, per-face, CN-FF, CN-FL)...'); console.time('bfs');
const dH = bfsCols([0, 1, 2, 3, 4, 5, 6, 7, 8]);
const dQ = bfsCols(QCOLS);
const f6dist = []; for (let f = 0; f < 6; f++) f6dist.push(bfsSeeds(faceSeed[f]));
const dFF = bfsFlag(solidFlag);   // color-neutral first-face solve = min over 6 faces
const dFL = bfsFlag(layerFlag);   // color-neutral first-layer solve
console.timeEnd('bfs');
// dFF must equal min over the six per-face distances
for (let i = 0; i < N; i++) { let mn = 255; for (let f = 0; f < 6; f++) if (f6dist[f][i] < mn) mn = f6dist[f][i]; if (mn !== dFF[i]) throw new Error('f6 min != dFF at ' + i); }

// ---- qh: minimum QTM cost among the HTM-optimal solutions of each state ----
log('qh (min-QTM among HTM-optimal)...'); console.time('qh');
const qh = new Uint16Array(N).fill(65535); qh[0] = 0;
{
  const buckets = Array.from({ length: 12 }, () => []);
  for (let i = 0; i < N; i++) buckets[dH[i]].push(i);
  for (let d = 1; d <= 11; d++) for (const s of buckets[d]) {
    let best = 65535;
    for (let m = 0; m < 9; m++) { const t = tbl[m][s]; if (dH[t] === d - 1) { const v = QCOST[m] + qh[t]; if (v < best) best = v; } }
    qh[s] = best;
  }
}
console.timeEnd('qh');

// ---- mirror automorphism phi (state relabeling) ----
log('mirror automorphism phi...'); console.time('phi');
const phi = new Int32Array(N).fill(-1); phi[0] = 0;
{ let fr = [0]; while (fr.length) { const nx = []; for (const s of fr) for (let m = 0; m < 9; m++) { const c = tbl[m][s]; if (phi[c] === -1) { phi[c] = tbl[PHIMOVE[m]][phi[s]]; nx.push(c); } } fr = nx; } }
console.timeEnd('phi');

// ---- union-find over the dedup group (color-neutral rotations x mirror) ----
log('orbits (union-find)...'); console.time('orbits');
const uf = new Uint32Array(N); for (let i = 0; i < N; i++) uf[i] = i;
function find(x) { let r = x; while (uf[r] !== r) r = uf[r]; while (uf[x] !== r) { const n = uf[x]; uf[x] = r; x = n; } return r; }
function uni(a, b) { a = find(a); b = find(b); if (a !== b) { if (a < b) uf[b] = a; else uf[a] = b; } }
for (let i = 0; i < N; i++) { let j = cA_x(i); if (j !== i) uni(i, j); j = cA_y(i); if (j !== i) uni(i, j); j = phi[i]; if (j !== i) uni(i, j); }
console.timeEnd('orbits');

// ---- per-orbit minima + representatives ----
const minH = new Uint8Array(N).fill(255), minQ = new Uint8Array(N).fill(255), minQH = new Uint16Array(N).fill(65535);
const repH = new Int32Array(N).fill(-1), repQ = new Int32Array(N).fill(-1);
for (let i = 0; i < N; i++) {
  const r = find(i);
  if (dH[i] < minH[r]) { minH[r] = dH[i]; repH[r] = i; }
  if (dQ[i] < minQ[r]) { minQ[r] = dQ[i]; repQ[r] = i; }
  if (qh[i] < minQH[r]) minQH[r] = qh[i];
}

// ---- optimal-solution reconstruction (greedy descent along the distance gradient) ----
function solveHTM(s) { const mv = []; let g = 0; while (s !== 0 && g++ < 40) { const d = dH[s]; let ok = false; for (let m = 0; m < 9; m++) { const t = tbl[m][s]; if (dH[t] === d - 1) { mv.push(MOVE_NAMES[m]); s = t; ok = true; break; } } if (!ok) throw new Error('stuckH'); } return mv; }
function solveQTM(s) { const mv = []; let g = 0; while (s !== 0 && g++ < 40) { const d = dQ[s]; let ok = false; for (const m of QCOLS) { const t = tbl[m][s]; if (dQ[t] === d - 1) { mv.push(MOVE_NAMES[m]); s = t; ok = true; break; } } if (!ok) throw new Error('stuckQ'); } return mv; }

// =====================================================================================
// 6. Essential cases -> difficulty-ranked rows.
// =====================================================================================
log('building essential case rows...'); console.time('cases');
const caseAgg = { F: {}, H: {}, Q: {}, QH: {}, dqhq: {} };
const bump = (o, k) => { o[k] = (o[k] || 0) + 1; };
const cases = [];  // {ci, F,H,QH,Q, dqhq, hAlg, qAlg, f6, repH, repQ}
for (let i = 0; i < N; i++) {
  if (find(i) !== i || i === 0) continue;
  const F = dFF[i], H = minH[i], Q = minQ[i], QH = minQH[i], dqhq = QH - Q;
  const rH = repH[i], rQ = repQ[i];
  const hAlg = solveHTM(rH);
  const qAlg = (QH === Q) ? null : solveQTM(rQ);
  const f6 = [f6dist[0][i], f6dist[1][i], f6dist[2][i], f6dist[3][i], f6dist[4][i], f6dist[5][i]];
  const f6null = f6.every(v => v === F);
  cases.push({ ci: i, F, H, QH, Q, dqhq, hAlg: hAlg.join(' '), qAlg: qAlg ? qAlg.join(' ') : null, f6: f6null ? null : f6, repH: rH, repQ: rQ, hLen: hAlg.length, qLen: qAlg ? qAlg.length : 0 });
  bump(caseAgg.F, F); bump(caseAgg.H, H); bump(caseAgg.Q, Q); bump(caseAgg.QH, QH); bump(caseAgg.dqhq, dqhq);
}
// difficulty rank: H desc, QH desc, Q desc, F desc, canonicalIndex asc  (idx=1 hardest)
cases.sort((a, b) => (b.H - a.H) || (b.QH - a.QH) || (b.Q - a.Q) || (b.F - a.F) || (a.ci - b.ci));
console.timeEnd('cases');
if (cases.length !== 77801) throw new Error('essential count ' + cases.length + ' != 77801');

// =====================================================================================
// 7. Full-space marginals + joint grid + scalar meta.
// =====================================================================================
const htmCounts = {}, qtmCounts = {};
const grid = Array.from({ length: 15 }, () => new Array(12).fill(0));
let sumHtm = 0, sumQtm = 0, htmLE3 = 0;
for (let i = 0; i < N; i++) {
  const hi = dH[i], qi = dQ[i];
  htmCounts[hi] = (htmCounts[hi] || 0) + 1;
  qtmCounts[qi] = (qtmCounts[qi] || 0) + 1;
  grid[qi][hi]++;
  sumHtm += hi; sumQtm += qi;
  if (hi <= 3) htmLE3++;
}
const sig5 = (x) => Number(x.toPrecision(5));

// =====================================================================================
// 8. Fixed-piece stat sub-puzzles (small projected BFS).
// =====================================================================================
const HTM_INV = MOVE_ELEMS.map(m => { const iv = new Int8Array(8); for (let i = 0; i < 8; i++) iv[m.p[i]] = i; return iv; });
function fixedBFS(tracked, ordered) {
  const keyOf = (st) => { const arr = st.map(x => x[0] * 3 + x[1]); if (ordered) return arr.join(','); return arr.sort((a, b) => a - b).join(','); };
  const startSt = tracked.map(p => [p, 0]);
  const dist = new Map(); dist.set(keyOf(startSt), 0);
  let fr = [startSt], d = 0; const h = { 0: 1 };
  while (fr.length) {
    const nx = [];
    for (const st of fr) for (let m = 0; m < 9; m++) {
      const iv = HTM_INV[m], mo = MOVE_ELEMS[m].o;
      const nst = st.map(([s, o]) => { const t = iv[s]; return [t, (o + mo[t]) % 3]; });
      const k = keyOf(nst);
      if (!dist.has(k)) { dist.set(k, d + 1); h[d + 1] = (h[d + 1] || 0) + 1; nx.push(nst); }
    }
    fr = nx; d++;
  }
  return { h, total: dist.size };
}
const fixV = fixedBFS([1, 2], true);        // Fixed V : 2 tracked pieces, ordered
const fixFF = fixedBFS([4, 5, 7], false);   // Fixed FF: 3 bottom pieces, unordered (face)
const fixFL = fixedBFS([4, 5, 7], true);    // Fixed FL: 3 bottom pieces, ordered (layer)

// histogram of a distance array over an optional filter
function histOf(dist, filter) { const h = {}; for (let i = 0; i < N; i++) { if (filter && !filter[i]) continue; const v = dist[i]; h[v] = (h[v] || 0) + 1; } return h; }

// =====================================================================================
// 9. Stat-group assembly (rows with inv/dist/cumm + total + mean).
//    inv  = round(total/cases, 4)   [Python banker's rounding, half-to-even]
//    dist = cases/total
//    cumm = running sum of dist, restarting at m==6  (reproduces the reference layout)
//    mean = round( sum(m*cases)/total, 4 )
// =====================================================================================
function ratRound(num, den, nd) { // exact rational round-half-to-even to nd decimals
  const scale = Math.pow(10, nd); const NN = num * scale;
  let q = Math.floor(NN / den); const rem = NN - q * den; const twice = 2 * rem;
  if (twice > den) q += 1; else if (twice === den) { if (q % 2 !== 0) q += 1; }
  return q / scale;
}
function makeGroup(key, label, hist, total) {
  const ms = Object.keys(hist).map(Number).sort((a, b) => a - b).filter(m => hist[m] > 0);
  const rows = []; let cum = 0, msum = 0;
  for (const m of ms) {
    const cases = hist[m];
    const inv = ratRound(total, cases, 4);
    const dist = cases / total;
    if (m === 6) cum = 0;
    cum += dist;
    rows.push({ m, cases, inv, dist, cumm: cum });
    msum += m * cases;
  }
  return { key, label, rows, total, mean: ratRound(msum, total, 4) };
}
const statGroups = [
  makeGroup('Fixed V', { zh: '固定 V', en: 'Fixed V' }, fixV.h, fixV.total),
  makeGroup('Fixed FF', { zh: '固定底面', en: 'Fixed FF' }, fixFF.h, fixFF.total),
  makeGroup('CN FF', { zh: '色中性底面', en: 'CN FF' }, histOf(dFF), N),
  makeGroup('(No Bar) CN FF', { zh: '无 bar · 色中性底面', en: '(No Bar) CN FF' }, histOf(dFF, noBarFlag), (() => { let c = 0; for (let i = 0; i < N; i++) if (noBarFlag[i]) c++; return c; })()),
  makeGroup('Fixed FL', { zh: '固定首层', en: 'Fixed FL' }, fixFL.h, fixFL.total),
  makeGroup('CN FL', { zh: '色中性首层', en: 'CN FL' }, histOf(dFL), N),
];

// =====================================================================================
// 10. Emit JSON.
// =====================================================================================
function ascHist(o) { const out = {}; for (const k of Object.keys(o).map(Number).sort((a, b) => a - b)) out[k] = o[k]; return out; }

const meta = {
  god_htm: 11, god_qtm: 14,
  avg_htm: sig5(sumHtm / N), avg_qtm: sig5(sumQtm / N),
  wca_legal_min4h: N - htmLE3, total_positions: N,
  generated_at: GENERATED_AT,
  credits: {
    author: { zh: 'CubeRoot', en: 'CubeRoot' },
    algorithm: { zh: '自有枚举(3,674,160 态精确)', en: 'home-grown enumeration (exact over 3,674,160 states)' },
    classify: { zh: 'CubeRoot', en: 'CubeRoot' },
    source_url: 'https://www.jaapsch.net/puzzles/cube2.htm',
  },
  notation: [
    { sym: 'F', zh: "面转步数(Face HTM*):把 U/U'/U2 都记作 1 步的面转度量", en: 'Face turns (Face HTM*): any face turn — U, U\', U2 — counts as one move' },
    { sym: 'H', zh: '半转步数(HTM*):U2 计 1 步的标准半转度量', en: 'Half-turn metric (HTM*): U2 counts as one move' },
    { sym: 'Q', zh: '四分之一转步数(QTM*):U2 计 2 步', en: 'Quarter-turn metric (QTM*): U2 counts as two moves' },
    { sym: '*', zh: '固定一个角块、只用相邻 3 个面(2×2 的标准解法约定)', en: 'one corner fixed, only the 3 adjacent faces turn (the standard 2×2 solving convention)' },
  ],
};

const essential = {
  meta,
  htm: { min: 0, max: 11, counts: ascHist(htmCounts) },
  qtm: { min: 0, max: 14, counts: ascHist(qtmCounts) },
  joint: { htm: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11], qtm: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14], grid },
  stat: { groups: statGroups, note: "No Bar f* = R U2 F'" },
  case_agg: {
    F: ascHist(caseAgg.F), H: ascHist(caseAgg.H), Q: ascHist(caseAgg.Q),
    QH: ascHist(caseAgg.QH), dqhq: ascHist(caseAgg.dqhq), total: cases.length,
  },
};

const casesJson = {
  meta: {
    generated_at: GENERATED_AT, total: cases.length,
    cols: ['idx', 'hAlg', 'F', 'H', 'QH', 'Q', 'qAlg', 'f6', 'dqhq'],
    note: 'qAlg=null ⇒ 同 hAlg(HTM 最优解也是 QTM 最优解);f6=null ⇒ 六朝向面转步数都等于 F',
  },
  rows: cases.map((c, k) => [k + 1, c.hAlg, c.F, c.H, c.QH, c.Q, c.qAlg, c.f6, c.dqhq]),
};

mkdirSync(OUT_DIR, { recursive: true });
const p1 = OUT_DIR + '/2x2_essential.json';
const p2 = OUT_DIR + '/2x2_essential_cases.json';
writeFileSync(p1, JSON.stringify(essential) + '\n');
writeFileSync(p2, JSON.stringify(casesJson) + '\n');
log('wrote ' + p1);
log('wrote ' + p2);

// =====================================================================================
// 11. Optional self-verification against a reference oracle.
// =====================================================================================
if (VERIFY) {
  const O = JSON.parse(readFileSync(VERIFY, 'utf8'));
  const lines = []; let allOk = true;
  const eqNum = (name, a, b) => { const ok = a === b; if (!ok) allOk = false; lines.push(`${ok ? 'OK  ' : 'DIFF'} ${name}: got ${a} want ${b}`); return ok; };
  const eqHist = (name, a, b) => { const ks = new Set([...Object.keys(a), ...Object.keys(b)]); let ok = true; for (const k of ks) if ((a[k] || 0) !== (b[k] || 0)) ok = false; if (!ok) allOk = false; lines.push(`${ok ? 'OK  ' : 'DIFF'} ${name}`); return ok; };

  // meta scalars
  eqNum('meta.god_htm', meta.god_htm, O.meta.god_htm);
  eqNum('meta.god_qtm', meta.god_qtm, O.meta.god_qtm);
  eqNum('meta.avg_htm', meta.avg_htm, O.meta.avg_htm);
  eqNum('meta.avg_qtm', meta.avg_qtm, O.meta.avg_qtm);
  eqNum('meta.wca_legal_min4h', meta.wca_legal_min4h, O.meta.wca_legal_min4h);
  eqNum('meta.total_positions', meta.total_positions, O.meta.total_positions);
  lines.push(`NOTE meta.generated_at got ${meta.generated_at} vs oracle ${O.meta.generated_at} (intentional per spec)`);

  // marginals
  eqHist('htm.counts', essential.htm.counts, O.htm.counts);
  eqHist('qtm.counts', essential.qtm.counts, O.qtm.counts);

  // joint grid every cell
  { let ok = true; for (let q = 0; q <= 14; q++) for (let h = 0; h <= 11; h++) if (grid[q][h] !== O.joint.grid[q][h]) ok = false; if (!ok) allOk = false; lines.push(`${ok ? 'OK  ' : 'DIFF'} joint.grid (all 15x12 cells)`); }

  // stat groups (rows m+cases+inv+dist+cumm, total, mean)
  for (let gi = 0; gi < statGroups.length; gi++) {
    const G = statGroups[gi], OG = O.stat.groups[gi]; let ok = G.key === OG.key && G.total === OG.total && G.mean === OG.mean && G.rows.length === OG.rows.length;
    if (ok) for (let ri = 0; ri < G.rows.length; ri++) { const a = G.rows[ri], b = OG.rows[ri]; if (a.m !== b.m || a.cases !== b.cases || a.inv !== b.inv || a.dist !== b.dist || a.cumm !== b.cumm) ok = false; }
    if (!ok) allOk = false; lines.push(`${ok ? 'OK  ' : 'DIFF'} stat.group[${gi}] ${G.key} (rows+total+mean)`);
  }
  { const ok = essential.stat.note === O.stat.note; if (!ok) allOk = false; lines.push(`${ok ? 'OK  ' : 'DIFF'} stat.note`); }

  // case_agg
  eqHist('case_agg.F', essential.case_agg.F, O.case_agg.F);
  eqHist('case_agg.H', essential.case_agg.H, O.case_agg.H);
  eqHist('case_agg.Q', essential.case_agg.Q, O.case_agg.Q);
  eqHist('case_agg.QH', essential.case_agg.QH, O.case_agg.QH);
  eqHist('case_agg.dqhq', essential.case_agg.dqhq, O.case_agg.dqhq);
  eqNum('case_agg.total', essential.case_agg.total, O.case_agg.total);

  // independent re-histogram of the cases file
  const reF = {}, reH = {}, reQ = {}, reQH = {}, reDQ = {};
  for (const r of casesJson.rows) { bump(reF, r[2]); bump(reH, r[3]); bump(reQH, r[4]); bump(reQ, r[5]); bump(reDQ, r[8]); }
  eqHist('cases-rehist F', reF, O.case_agg.F);
  eqHist('cases-rehist H', reH, O.case_agg.H);
  eqHist('cases-rehist Q', reQ, O.case_agg.Q);
  eqHist('cases-rehist QH', reQH, O.case_agg.QH);
  eqHist('cases-rehist dqhq', reDQ, O.case_agg.dqhq);

  // spot-check 500 hAlg/qAlg actually solve + lengths
  { let bad = 0, checked = 0; const step = Math.floor(cases.length / 500);
    for (let k = 0; k < cases.length; k += step) {
      const c = cases[k]; checked++;
      let s = c.repH; for (const nm of c.hAlg.split(' ')) s = tbl[MOVE_NAMES.indexOf(nm)][s];
      if (s !== 0 || c.hLen !== c.H) bad++;
      if (c.qAlg !== null) { let sq = c.repQ; for (const nm of c.qAlg.split(' ')) sq = tbl[MOVE_NAMES.indexOf(nm)][sq]; if (sq !== 0 || c.qLen !== c.Q) bad++; }
    }
    const ok = bad === 0; if (!ok) allOk = false; lines.push(`${ok ? 'OK  ' : 'DIFF'} spot-check solve (${checked} cases, ${bad} failures)`);
  }

  process.stderr.write('\n===== VERIFICATION =====\n' + lines.join('\n') + '\n');
  process.stderr.write('\nMATCHED_ALL: ' + allOk + '\n');
  if (!allOk) process.exitCode = 1;
}
