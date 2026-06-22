/*
 * 3×3×3 cube state model for the STM (Slice Turn Metric) OPTIMAL solver.
 *
 * THE STM MOVE SET (27 generators): the 6 outer faces {U,D,L,R,F,B} AND the 3 slice layers
 * {M,E,S}, each in {90°,180°,270°}, with EACH counting as ONE move. A slice move is the two
 * adjacent face turns done in HTM, but here it is atomic. Crucially, slice moves permute the 6
 * CENTER pieces — so the center permutation is part of the state AND of the goal. An HTM solver
 * that ignores centers is WRONG for STM.
 *
 * GEOMETRY-DERIVED, INDEPENDENTLY VALIDATED. Every move's cubie permutation + orientation is
 * derived from real 3D rotation of a 54-sticker cube (no hand-typed tables in the hot path beyond
 * the per-face signed-rotation SPEC). The derivation was cross-checked three ways (see
 * tests/stm_solver.test.ts): (1) all 6 face-move cp/ep match the canonical Singmaster tables in
 * app/.../math/group/cube_state.ts; (2) all 27 generators' center permutations match cubing.js
 * exactly; (3) full (corner+edge+center) state matches cubing.js for random scrambles.
 *
 * Cubie indexing (standard Singmaster, identical to cube_state.ts and Kociemba/min2phase):
 *   corners 0:URF 1:UFL 2:ULB 3:UBR 4:DFR 5:DLF 6:DBL 7:DRB
 *   edges   0:UR 1:UF 2:UL 3:UB 4:DR 5:DF 6:DL 7:DB 8:FR 9:FL 10:BL 11:BR
 *   centers (this file's own order) 0:U 1:D 2:R 3:L 4:F 5:B
 * CO ∈ {0,1,2} = twist of the U/D facelet (0 = U/D facelet faces U/D). EO ∈ {0,1} = Kociemba
 * good-edge flip. Slice moves DO move corners? No — slices are interior layers, so corners are
 * permuted ONLY by face turns; edges and centers are permuted by both.
 *
 * This module exposes ONLY the validated state machine (move tables, apply, parse, solved test,
 * superflip alg). The PDBs + IDA* live in stm-solver.ts.
 */

// ── 54-sticker geometry ────────────────────────────────────────────────────────────
const N = 3;
type FaceId = 'U' | 'D' | 'R' | 'L' | 'F' | 'B';
interface Sticker { x: number; y: number; z: number; nx: number; ny: number; nz: number; face: FaceId; }
const FACE_NORMALS: ReadonlyArray<{ id: FaceId; n: [number, number, number] }> = [
  { id: 'U', n: [0, 1, 0] }, { id: 'D', n: [0, -1, 0] },
  { id: 'R', n: [1, 0, 0] }, { id: 'L', n: [-1, 0, 0] },
  { id: 'B', n: [0, 0, 1] }, { id: 'F', n: [0, 0, -1] },
];
const inSolid = (x: number, y: number, z: number) => x >= 0 && x < N && y >= 0 && y < N && z >= 0 && z < N;
const STICKERS: Sticker[] = (() => {
  const out: Sticker[] = [];
  for (let x = 0; x < N; x++) for (let y = 0; y < N; y++) for (let z = 0; z < N; z++) {
    for (const f of FACE_NORMALS) {
      const [dx, dy, dz] = f.n;
      if (!inSolid(x + dx, y + dy, z + dz)) out.push({ x, y, z, nx: dx, ny: dy, nz: dz, face: f.id });
    }
  }
  return out;
})();
const NS = STICKERS.length; // 54
const sKey = (x: number, y: number, z: number, nx: number, ny: number, nz: number) => `${x},${y},${z}|${nx},${ny},${nz}`;
const STICKER_INDEX = new Map<string, number>(STICKERS.map((s, i) => [sKey(s.x, s.y, s.z, s.nx, s.ny, s.nz), i]));
const cc = (v: number) => v - 1, ic = (v: number) => v + 1;

// Signed 90° rotation about an axis (right-hand rule). dir ∈ {+1,-1}.
function rot(axis: 'x' | 'y' | 'z', dir: number) {
  return (s: Sticker): [number, number, number, number, number, number] => {
    let X = cc(s.x), Y = cc(s.y), Z = cc(s.z), A = s.nx, B = s.ny, C = s.nz;
    if (axis === 'y') { [X, Z] = dir > 0 ? [Z, -X] : [-Z, X]; [A, C] = dir > 0 ? [C, -A] : [-C, A]; }
    else if (axis === 'x') { [Y, Z] = dir > 0 ? [Z, -Y] : [-Z, Y]; [B, C] = dir > 0 ? [C, -B] : [-C, B]; }
    else { [X, Y] = dir > 0 ? [Y, -X] : [-Y, X]; [A, B] = dir > 0 ? [B, -A] : [-B, A]; }
    return [ic(X), ic(Y), ic(Z), A, B, C];
  };
}
function buildStickerPerm(pred: (s: Sticker) => boolean, tf: (s: Sticker) => [number, number, number, number, number, number]): Int32Array {
  const fwd = new Int32Array(NS);
  for (let i = 0; i < NS; i++) {
    const s = STICKERS[i];
    if (!pred(s)) { fwd[i] = i; continue; }
    const [x, y, z, nx, ny, nz] = tf(s);
    const di = STICKER_INDEX.get(sKey(x, y, z, nx, ny, nz));
    if (di === undefined) throw new Error('stm: rotation left the surface');
    fwd[i] = di;
  }
  const P = new Int32Array(NS);
  for (let src = 0; src < NS; src++) P[fwd[src]] = src; // source-form: state'[dst]=state[P[dst]]
  return P;
}

// Per-base-generator (axis, layer-coordinate, signed direction). The signs were solved so that each
// face turn is CW viewed from OUTSIDE that face, and slices follow convention M←L, E←D, S←F. All nine
// are validated in tests/stm_solver.test.ts.
const BASE_SPEC: Record<string, ['x' | 'y' | 'z', number, number]> = {
  U: ['y', 2, 1], D: ['y', 0, -1], R: ['x', 2, -1], L: ['x', 0, 1], F: ['z', 0, 1], B: ['z', 2, -1],
  M: ['x', 1, 1], E: ['y', 1, -1], S: ['z', 1, 1],
};
const BASE_PERM: Record<string, Int32Array> = {};
for (const [name, [axis, layer, dir]] of Object.entries(BASE_SPEC)) {
  const sel = (s: Sticker) => (axis === 'y' ? s.y : axis === 'x' ? s.x : s.z) === layer;
  BASE_PERM[name] = buildStickerPerm(sel, rot(axis, dir));
}
function powerStickerPerm(P: Int32Array, pow: number): Int32Array {
  let cur = Int32Array.from({ length: NS }, (_, i) => i);
  for (let k = 0; k < pow; k++) { const o = new Int32Array(NS); for (let i = 0; i < NS; i++) o[i] = cur[P[i]]; cur = o; }
  return cur;
}

// ── cubie model ────────────────────────────────────────────────────────────────────
interface Cubie { x: number; y: number; z: number; stickers: number[]; }
const CUBIES: Cubie[] = (() => {
  const byPos = new Map<string, number[]>();
  for (let i = 0; i < NS; i++) {
    const s = STICKERS[i]; const k = `${s.x},${s.y},${s.z}`;
    if (!byPos.has(k)) byPos.set(k, []);
    byPos.get(k)!.push(i);
  }
  return [...byPos.entries()].map(([k, sts]) => { const [x, y, z] = k.split(',').map(Number); return { x, y, z, stickers: sts }; });
})();
const cs = (v: number) => v - 1;
const CORNER_NAMES = ['URF', 'UFL', 'ULB', 'UBR', 'DFR', 'DLF', 'DBL', 'DRB'];
const EDGE_NAMES = ['UR', 'UF', 'UL', 'UB', 'DR', 'DF', 'DL', 'DB', 'FR', 'FL', 'BL', 'BR'];
function cornerName(cb: Cubie): string {
  const set = new Set([cs(cb.y) > 0 ? 'U' : 'D', cs(cb.z) < 0 ? 'F' : 'B', cs(cb.x) > 0 ? 'R' : 'L']);
  return CORNER_NAMES.find((nm) => [...nm].every((ch) => set.has(ch)))!;
}
function edgeName(cb: Cubie): string {
  const p: string[] = [];
  if (cs(cb.y) > 0) p.push('U'); else if (cs(cb.y) < 0) p.push('D');
  if (cs(cb.z) < 0) p.push('F'); else if (cs(cb.z) > 0) p.push('B');
  if (cs(cb.x) > 0) p.push('R'); else if (cs(cb.x) < 0) p.push('L');
  const set = new Set(p);
  return EDGE_NAMES.find((nm) => nm.length === 2 && [...nm].every((ch) => set.has(ch)) && set.size === 2)!;
}
const cornerIdxByName: Record<string, number> = Object.fromEntries(CORNER_NAMES.map((n, i) => [n, i]));
const edgeIdxByName: Record<string, number> = Object.fromEntries(EDGE_NAMES.map((n, i) => [n, i]));
interface NamedCubie extends Cubie { idx: number; }
const CORNERS: NamedCubie[] = CUBIES.filter((c) => c.stickers.length === 3).map((c) => ({ ...c, idx: cornerIdxByName[cornerName(c)] })).sort((a, b) => a.idx - b.idx);
const EDGES: NamedCubie[] = CUBIES.filter((c) => c.stickers.length === 2).map((c) => ({ ...c, idx: edgeIdxByName[edgeName(c)] })).sort((a, b) => a.idx - b.idx);

// Orientation references (conventions validated 6/6 against the canonical face-move tables — see
// tests/stm_solver.test.ts and the cube_state.ts cp/co/ep/eo reference):
//   CORNER CO: each corner's three stickers are placed in CCW order viewed from OUTSIDE along the
//     corner's outward body diagonal, STARTING from the U/D facelet. co = the position (0/1/2) within
//     that CCW frame where the (source) corner's U/D facelet currently sits. co=0 ⟺ U/D facelet on a
//     U/D face. This CCW ordering is what distinguishes a +1 (CW) from a +2 (CCW) twist.
//   EDGE EO (Kociemba good-edge): reference facelet = the U/D facelet if the edge has one, else the
//     F/B facelet. eo = 0 iff that reference facelet's destination lies on the SAME axis class
//     (y=U/D, z=F/B, x=R/L) as the slot's home reference; eo=1 otherwise.
const stickerAxisClass = (si: number): 0 | 1 | 2 => { const s = STICKERS[si]; return s.ny !== 0 ? 0 : s.nz !== 0 ? 1 : 2; };
const CORNER_REF: number[] = []; // U/D facelet sticker of each corner cubie (by idx)
CORNERS.forEach((cb) => { CORNER_REF[cb.idx] = cb.stickers.find((si) => STICKERS[si].ny !== 0)!; });
const EDGE_REF: number[] = []; // U/D facelet, else F/B facelet
EDGES.forEach((cb) => {
  const ud = cb.stickers.find((si) => STICKERS[si].ny !== 0);
  const fb = cb.stickers.find((si) => STICKERS[si].nz !== 0);
  EDGE_REF[cb.idx] = ud ?? fb!;
});

// CCW-ordered sticker frame per corner, starting from the U/D facelet. Order the two non-U/D stickers
// so that (UD-normal × firstOther-normal) · outwardDiagonal > 0 (right-hand CCW about the diagonal).
function ccwCornerFrame(cb: NamedCubie): number[] {
  const d: [number, number, number] = [cs(cb.x), cs(cb.y), cs(cb.z)];
  const start = cb.stickers.find((si) => STICKERS[si].ny !== 0)!;
  const others = cb.stickers.filter((si) => si !== start);
  const nv = (si: number): [number, number, number] => [STICKERS[si].nx, STICKERS[si].ny, STICKERS[si].nz];
  const cross = (a: number[], b: number[]) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  const dot = (a: number[], b: number[]) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const cr = cross(nv(start), nv(others[0]));
  return dot(cr, d) > 0 ? [start, others[0], others[1]] : [start, others[1], others[0]];
}
const CORNER_CCW_FRAME: number[][] = [];
CORNERS.forEach((cb) => { CORNER_CCW_FRAME[cb.idx] = ccwCornerFrame(cb); });

interface CubieState { cp: Int8Array; co: Int8Array; ep: Int8Array; eo: Int8Array; center: Int8Array; }

function solvedState(): CubieState {
  return {
    cp: Int8Array.from({ length: 8 }, (_, i) => i),
    co: new Int8Array(8),
    ep: Int8Array.from({ length: 12 }, (_, i) => i),
    eo: new Int8Array(12),
    center: Int8Array.from({ length: 6 }, (_, i) => i),
  };
}

// center slot stickers (this file order U D R L F B)
const CENTER_FACES: FaceId[] = ['U', 'D', 'R', 'L', 'F', 'B'];
const CENTER_POS: Record<FaceId, [number, number, number]> = { U: [1, 2, 1], D: [1, 0, 1], R: [2, 1, 1], L: [0, 1, 1], F: [1, 1, 0], B: [1, 1, 2] };
const CENTER_STICKER: number[] = CENTER_FACES.map((f) => {
  const [x, y, z] = CENTER_POS[f]; const [nx, ny, nz] = FACE_NORMALS.find((fn) => fn.id === f)!.n;
  return STICKER_INDEX.get(sKey(x, y, z, nx, ny, nz))!;
});

// Precompute, for each base generator at each power, the cubie-level deltas as a "move op".
interface MoveOp { name: string; baseName: string; pow: number; cpFrom: Int8Array; coAdd: Int8Array; epFrom: Int8Array; eoAdd: Int8Array; centerFrom: Int8Array; }

function deriveMoveOp(baseName: string, pow: number, displayName: string): MoveOp {
  const Pn = powerStickerPerm(BASE_PERM[baseName], pow);
  // forward sticker map: where does sticker s go? fwd[s] = dst with Pn[dst]=s
  const fwd = new Int32Array(NS); for (let dst = 0; dst < NS; dst++) fwd[Pn[dst]] = dst;
  const stickerToCorner = new Int32Array(NS).fill(-1);
  CORNERS.forEach((cb) => cb.stickers.forEach((si) => { stickerToCorner[si] = cb.idx; }));
  const stickerToEdge = new Int32Array(NS).fill(-1);
  EDGES.forEach((cb) => cb.stickers.forEach((si) => { stickerToEdge[si] = cb.idx; }));

  const cpFrom = new Int8Array(8), coAdd = new Int8Array(8), epFrom = new Int8Array(12), eoAdd = new Int8Array(12), centerFrom = new Int8Array(6);

  // corners: co delta = position in the slot's CCW frame where the source corner's U/D facelet lands.
  for (let slot = 0; slot < 8; slot++) {
    const cb = CORNERS[slot];
    const srcCorner = stickerToCorner[Pn[cb.stickers[0]]];
    cpFrom[slot] = srcCorner;
    const refDst = fwd[CORNER_REF[srcCorner]]; // sticker position the source U/D facelet now occupies
    const frame = CORNER_CCW_FRAME[slot];
    const pos = frame.indexOf(refDst);
    if (pos < 0) throw new Error('stm: corner orientation frame miss');
    coAdd[slot] = pos; // 0/1/2 twist delta
  }
  // edges: eo delta = 0 iff the source ref facelet lands on the same axis-class as the slot's home ref.
  for (let slot = 0; slot < 12; slot++) {
    const cb = EDGES[slot];
    const srcEdge = stickerToEdge[Pn[cb.stickers[0]]];
    epFrom[slot] = srcEdge;
    const refDst = fwd[EDGE_REF[srcEdge]];
    eoAdd[slot] = stickerAxisClass(refDst) === stickerAxisClass(EDGE_REF[slot]) ? 0 : 1;
  }
  // centers
  for (let slot = 0; slot < 6; slot++) {
    const srcSticker = Pn[CENTER_STICKER[slot]];
    centerFrom[slot] = CENTER_STICKER.indexOf(srcSticker);
  }
  return { name: displayName, baseName, pow, cpFrom, coAdd, epFrom, eoAdd, centerFrom };
}

// The 27 STM generators, in a fixed canonical order: for each base U D R L F B M E S → pow 1,2,3.
const BASE_ORDER = ['U', 'D', 'R', 'L', 'F', 'B', 'M', 'E', 'S'];
const POW_SUFFIX = ['', '2', "'"]; // pow 1,2,3
export const STM_MOVE_NAMES: string[] = [];
const MOVE_OPS: MoveOp[] = [];
for (const b of BASE_ORDER) for (let p = 1; p <= 3; p++) {
  const name = b + POW_SUFFIX[p - 1];
  STM_MOVE_NAMES.push(name);
  MOVE_OPS.push(deriveMoveOp(b, p, name));
}
export const NUM_MOVES = MOVE_OPS.length; // 27
const MOVE_BY_NAME = new Map<string, number>(STM_MOVE_NAMES.map((n, i) => [n, i]));
/** Base axis group of each move: U/D/E share axis 0 (y), R/L/M axis 1 (x), F/B/S axis 2 (z). */
export const MOVE_AXIS: number[] = MOVE_OPS.map((m) => {
  const b = m.baseName;
  return 'UDE'.includes(b) ? 0 : 'RLM'.includes(b) ? 1 : 2;
});
/** Base-layer id (0..8) so two moves on the SAME layer are forbidden consecutively (e.g. R then R2). */
export const MOVE_BASE: number[] = MOVE_OPS.map((m) => BASE_ORDER.indexOf(m.baseName));
/** Inverse move index: pow 1↔3 (X ↔ X'), pow 2 self-inverse. */
export const INVERSE_MOVE: number[] = MOVE_OPS.map((m) => {
  const invPow = m.pow === 2 ? 2 : m.pow === 1 ? 3 : 1;
  return MOVE_BY_NAME.get(m.baseName + POW_SUFFIX[invPow - 1])!;
});

/** Apply move `mi` to a cubie state, returning a new state. */
export function applyMoveState(s: CubieState, mi: number): CubieState {
  const op = MOVE_OPS[mi];
  const cp = new Int8Array(8), co = new Int8Array(8), ep = new Int8Array(12), eo = new Int8Array(12), center = new Int8Array(6);
  for (let i = 0; i < 8; i++) {
    const src = op.cpFrom[i];
    cp[i] = s.cp[src];
    co[i] = (s.co[src] + op.coAdd[i]) % 3;
  }
  for (let i = 0; i < 12; i++) {
    const src = op.epFrom[i];
    ep[i] = s.ep[src];
    eo[i] = (s.eo[src] + op.eoAdd[i]) % 2;
  }
  for (let i = 0; i < 6; i++) center[i] = s.center[op.centerFrom[i]];
  return { cp, co, ep, eo, center };
}

export function isSolvedState(s: CubieState): boolean {
  for (let i = 0; i < 8; i++) if (s.cp[i] !== i || s.co[i] !== 0) return false;
  for (let i = 0; i < 12; i++) if (s.ep[i] !== i || s.eo[i] !== 0) return false;
  for (let i = 0; i < 6; i++) if (s.center[i] !== i) return false;
  return true;
}

export const STM_TOKEN_RE = /^([UDRLFBMES])('|2)?$/;

/** Parse an STM scramble/alg into move indices. Throws Error('bad: <tok>') on an invalid token. */
export function parseStmScramble(scramble: string): number[] {
  const out: number[] = [];
  for (const tok of scramble.trim().split(/\s+/)) {
    if (!tok) continue;
    const mi = MOVE_BY_NAME.get(tok);
    if (mi === undefined) throw new Error(`bad: ${tok}`);
    out.push(mi);
  }
  return out;
}

/** Apply a scramble string to the solved cube → cubie state. */
export function stmApply(scramble: string): CubieState {
  let s = solvedState();
  for (const mi of parseStmScramble(scramble)) s = applyMoveState(s, mi);
  return s;
}

export { solvedState };
export type { CubieState, MoveOp };
export { MOVE_OPS };

/** Reid's superflip (all 12 edges flipped, everything else home). STM-optimal length is a validation
 *  anchor (16 in STM; 20 in HTM/FTM). */
export const SUPERFLIP_ALG = "U R2 F B R B2 R U2 L B2 R U' D' R2 F R' L B2 U2 F2";

// Internal accessors for the solver/tests (coordinate encoders live in stm-solver.ts).
export const _internals = {
  STICKERS, NS, CORNERS, EDGES, CENTER_STICKER, CENTER_FACES, BASE_SPEC, BASE_PERM, powerStickerPerm,
  STICKER_INDEX, sKey, FACE_NORMALS,
};
