/**
 * Siamese 1×2×3 (sia123) state preview — a 2D net of BOTH glued 3×3×3 cubes, colored ENTIRELY from the
 * scramble applied to an INDEPENDENT re-derivation of the geometry (NOT imported from the solver's internal
 * tables). The fused puzzle is two 3×3×3 cubes joined along a shared 1×2×3 block; cstimer turns each with
 * {U, R, r} and a literal `z2` (whole-puzzle 180° about the shared block's long axis) separates cube-A moves
 * from cube-B moves. We split the scramble on the first `z2`: tokens before → cube A, after → cube B (by z2
 * symmetry each cube's own tokens act on it like a plain {U,R,r} cube). Each cube is drawn as a standard
 * 6-face cross-net; every facelet is painted with the home-face color of the sticker currently there. At
 * solved each face is a single color (self-proving); any scramble repaints faithfully; the shared 1×2×3
 * block never moves.
 *
 * Geometry is re-derived here from 3D rotation matrices, independent of lib/sia123-solver — same convention
 * (U=layer y=2 about +y, R=x=2 about +x, r=x=1 about +x; cube centre (1,1,1)).
 */

// ── independent minimal geometry ────────────────────────────────────────────────────────────────
type Mat = readonly number[][];
const matMul = (a: Mat, b: Mat): Mat => { const r = [[0, 0, 0], [0, 0, 0], [0, 0, 0]]; for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) { let s = 0; for (let k = 0; k < 3; k++) s += a[i][k] * b[k][j]; r[i][j] = s; } return r; };
const matVec = (m: Mat, v: readonly number[]): number[] => [m[0][0] * v[0] + m[0][1] * v[1] + m[0][2] * v[2], m[1][0] * v[0] + m[1][1] * v[1] + m[1][2] * v[2], m[2][0] * v[0] + m[2][1] * v[1] + m[2][2] * v[2]];
const transpose = (m: Mat): Mat => [[m[0][0], m[1][0], m[2][0]], [m[0][1], m[1][1], m[2][1]], [m[0][2], m[1][2], m[2][2]]];
const I: Mat = [[1, 0, 0], [0, 1, 0], [0, 0, 1]];
const RX: Mat = [[1, 0, 0], [0, 0, -1], [0, 1, 0]];
const RY: Mat = [[0, 0, 1], [0, 1, 0], [-1, 0, 0]];
const RZ: Mat = [[0, -1, 0], [1, 0, 0], [0, 0, 1]];
const mkey = (m: Mat) => m.flat().join(',');
const ROTS: Mat[] = (() => { const seen = new Map<string, number>(); const out: Mat[] = []; const stack: Mat[] = [I]; seen.set(mkey(I), 0); out.push(I); while (stack.length) { const m = stack.pop()!; for (const g of [RX, RY, RZ]) { const n = matMul(g, m); const k = mkey(n); if (!seen.has(k)) { seen.set(k, out.length); out.push(n); stack.push(n); } } } return out; })();
const ROT_IDX = new Map(ROTS.map((m, i) => [mkey(m), i] as const));
const rotCompose = (aIdx: number, g: Mat): number => ROT_IDX.get(mkey(matMul(g, ROTS[aIdx])))!;

interface Cubie { x: number; y: number; z: number; }
const CUBIES: Cubie[] = [];
for (let x = 0; x < 3; x++) for (let y = 0; y < 3; y++) for (let z = 0; z < 3; z++) { const ex = [x, y, z].filter((c) => c === 0 || c === 2).length; if (ex === 0) continue; CUBIES.push({ x, y, z }); }
const NC = CUBIES.length;
const slotOf = new Map(CUBIES.map((c, i) => [`${c.x},${c.y},${c.z}`, i] as const));
const cubieAt = (x: number, y: number, z: number): number => slotOf.get(`${x},${y},${z}`) ?? -1;

interface BaseMove { map: number[]; rot: (Mat | null)[]; }
function layerMove(axis: number, layerVal: number, rotMat: Mat): BaseMove {
  const map: number[] = []; const rot: (Mat | null)[] = [];
  for (let i = 0; i < NC; i++) { const c = CUBIES[i]; const co = [c.x, c.y, c.z]; if (co[axis] !== layerVal) { map[i] = i; rot[i] = null; continue; } const rel = [c.x - 1, c.y - 1, c.z - 1]; const nr = matVec(rotMat, rel); map[i] = cubieAt(nr[0] + 1, nr[1] + 1, nr[2] + 1); rot[i] = rotMat; }
  return { map, rot };
}
const BASE: Record<string, BaseMove> = { U: layerMove(1, 2, RY), R: layerMove(0, 2, RX), r: layerMove(0, 1, RX) };
interface St { perm: number[]; ori: number[]; }
const solved = (): St => ({ perm: Array.from({ length: NC }, (_, i) => i), ori: Array.from({ length: NC }, () => 0) });
function applyBase(st: St, name: string): St { const { map, rot } = BASE[name]; const perm = new Array<number>(NC), ori = new Array<number>(NC); for (let s = 0; s < NC; s++) { const d = map[s]; perm[d] = st.perm[s]; ori[d] = rot[s] === null ? st.ori[s] : rotCompose(st.ori[s], rot[s]!); } return { perm, ori }; }
function applyTok(st: St, name: string): St { const base = name[0]; const suf = name.slice(1); const amt = suf === '' ? 1 : suf === '2' ? 2 : 3; let s = st; for (let k = 0; k < amt; k++) s = applyBase(s, base); return s; }

// ── facelet model: 6 faces × 9 cells → (cubie, outward normal). Net unfolds U / L F R B / D. ────────
const FACES = [
  { name: 'U', n: [0, 1, 0] }, { name: 'D', n: [0, -1, 0] }, { name: 'R', n: [1, 0, 0] },
  { name: 'L', n: [-1, 0, 0] }, { name: 'F', n: [0, 0, 1] }, { name: 'B', n: [0, 0, -1] },
] as const;
const eqv = (a: readonly number[], b: readonly number[]) => a[0] === b[0] && a[1] === b[1] && a[2] === b[2];
interface Facelet { face: string; row: number; col: number; cubie: number; normal: number[]; }
const FACELETS: Facelet[] = (() => {
  const out: Facelet[] = [];
  for (const F of FACES) for (let row = 0; row < 3; row++) for (let col = 0; col < 3; col++) {
    let x = 0, y = 0, z = 0;
    if (F.name === 'U') { y = 2; x = col; z = 2 - row; }
    else if (F.name === 'D') { y = 0; x = col; z = row; }
    else if (F.name === 'F') { z = 2; x = col; y = 2 - row; }
    else if (F.name === 'B') { z = 0; x = 2 - col; y = 2 - row; }
    else if (F.name === 'R') { x = 2; z = 2 - col; y = 2 - row; }
    else { x = 0; z = col; y = 2 - row; }
    out.push({ face: F.name, row, col, cubie: cubieAt(x, y, z), normal: [...F.n] });
  }
  return out;
})();
function colorOf(st: St, fl: Facelet): string {
  const here = fl.cubie; const o = st.ori[here];
  const dir = matVec(transpose(ROTS[o]), fl.normal).map((v) => Math.round(v));
  const f = FACES.find((F) => eqv(F.n, dir));
  return f ? f.name : 'U';
}

// ── colors per face (puzzle sticker hex, well-separated) ────────────────────────────────────────
export const SIA123_FACE_COLORS: Record<string, string> = {
  U: '#FFD500', // yellow (up)
  D: '#FFFFFF', // white (down)
  R: '#EE0000', // red
  L: '#FF8800', // orange
  F: '#00B14F', // green
  B: '#1463E6', // blue
};
const STROKE = '#000';
const BG = '#FFFFFF';

// ── net layout: each cube is a 4-wide × 3-tall cross (L F R B row, U above F, D below F) ────────────
const CELL = 11;
const FACE_W = CELL * 3;
const GAP = 3;
const CUBE_GAP = 14;
// face origins within one cube's local box (col,row in face units):
//   row0:        [   U   ]
//   row1: [ L ][ F ][ R ][ B ]
//   row2:        [   D   ]
const faceLocal: Record<string, [number, number]> = { U: [1, 0], L: [0, 1], F: [1, 1], R: [2, 1], B: [3, 1], D: [1, 2] };
const CUBE_W = FACE_W * 4 + GAP * 3;
const CUBE_H = FACE_W * 3 + GAP * 2;
const PAD = 6;
const VIEW_W = PAD * 2 + CUBE_W * 2 + CUBE_GAP;
const VIEW_H = PAD * 2 + CUBE_H;

function cubeSvg(st: St, baseX: number): string {
  const out: string[] = [];
  // group facelets by face
  for (const F of FACES) {
    const [fc, fr] = faceLocal[F.name];
    const ox = baseX + fc * (FACE_W + GAP);
    const oy = PAD + fr * (FACE_W + GAP);
    for (const fl of FACELETS) {
      if (fl.face !== F.name) continue;
      const color = SIA123_FACE_COLORS[colorOf(st, fl)] ?? '#888888';
      const x = ox + fl.col * CELL;
      const y = oy + fl.row * CELL;
      out.push(`<rect x="${x}" y="${y}" width="${CELL}" height="${CELL}" fill="${color}" stroke="${STROKE}" stroke-width="0.7"/>`);
    }
  }
  return out.join('');
}

/** Split a fused scramble on the first z2 into cube-A and cube-B token lists. */
function split(scramble: string): { a: string[]; b: string[] } {
  const toks = scramble.trim().split(/\s+/).filter(Boolean);
  const zi = toks.indexOf('z2');
  if (zi < 0) return { a: toks.filter((t) => t !== 'z2'), b: [] };
  const a: string[] = [], b: string[] = [];
  toks.forEach((t, i) => { if (t === 'z2') return; (i < zi ? a : b).push(t); });
  return { a, b };
}

export function renderSia123ScrambleSvg(scramble: string): string {
  let stA = solved(), stB = solved();
  try {
    const { a, b } = split(scramble);
    for (const t of a) stA = applyTok(stA, t);
    for (const t of b) stB = applyTok(stB, t);
  } catch (e) {
    console.warn('[sia123_svg] apply failed', scramble, e);
  }
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${VIEW_W} ${VIEW_H}" preserveAspectRatio="xMidYMid meet" style="width:100%;height:100%">`,
    `<rect x="0" y="0" width="${VIEW_W}" height="${VIEW_H}" fill="${BG}"/>`,
    cubeSvg(stA, PAD),
    cubeSvg(stB, PAD + CUBE_W + CUBE_GAP),
    '</svg>',
  ].join('');
}
