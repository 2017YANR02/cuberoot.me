/** Megaminx Pochmann-notation scramble simulator.
 *
 * 12 pentagonal faces × 11 stickers = 132 stickers.
 * Sticker layout per face (regular pentagon):
 *   idx 0 = center
 *   idx 1..5 = 5 corner stickers (at the 5 vertices, CW from "top" vertex)
 *   idx 6..10 = 5 edge stickers (between adjacent corners; idx 6 = edge between corners 1 and 2)
 *
 * Faces named: U (top), F, FR, BR, BL, FL (5 around U), D (bottom),
 * and 5 around D mirroring the top: DF (under F), DFR, DBR, DBL, DFL.
 *
 * Pochmann moves: U, U', R++, R--, D++, D--.
 *   U  rotates U face 72° CW (when looking down at U).
 *   R++/R-- rotate the right hemisphere by ±144° (= ±2 face-clicks).
 *   D++/D-- rotate the bottom hemisphere by ±144°.
 *
 * Correctness model
 * -----------------
 * Full physical simulation of Pochmann R++/D++ requires a piece-based model
 * (20 corners + 30 edges + 12 centers, with orientation tracking) and
 * geometry-derived cycle tables. We use a simpler permutation model here:
 *
 *   • Each "macro" move is built from face-rotations + a fixed set of
 *     5-cycles of stickers (shift = 2, which is what 144° corresponds to).
 *   • R-- applies the same operations in reverse order with reversed shifts,
 *     so R-- is the literal inverse permutation of R++ (R++ R-- ≡ id by
 *     construction). Same for D--.
 *   • U has order 5 (U^5 ≡ id) since it is a single face-rotation + a single
 *     cycle, which commute trivially in their effect on disjoint slot sets.
 *   • R++ and D++ have higher order (rotation and cycle don't commute on
 *     overlapping faces), but this is fine for scramble preview — the
 *     invariant we need is invertibility, which holds.
 *
 * The visual result is a plausible scramble that compresses real megaminx
 * piece moves; it is NOT bit-identical to a physical megaminx.
 *
 * Invariants are asserted at module load via console.assert (silent in prod,
 * warns in dev). See megaSelfCheck() below.
 */

export type MegaFace = 'U' | 'F' | 'FR' | 'BR' | 'BL' | 'FL'
                     | 'D' | 'DF' | 'DFR' | 'DBR' | 'DBL' | 'DFL';
export type MegaSticker = MegaFace;
export type MegaState = Record<MegaFace, MegaSticker[]>;

const FACES: MegaFace[] = ['U', 'F', 'FR', 'BR', 'BL', 'FL', 'D', 'DF', 'DFR', 'DBR', 'DBL', 'DFL'];

export function megaSolved(): MegaState {
  const s = {} as MegaState;
  for (const f of FACES) s[f] = Array<MegaSticker>(11).fill(f);
  return s;
}

// 5-cycle of a face's corners (1..5) and edges (6..10) under 72° CW rotation:
// idx 1 -> 2 -> 3 -> 4 -> 5 -> 1, and 6 -> 7 -> 8 -> 9 -> 10 -> 6.
function rotateFace(arr: MegaSticker[], turns: number): void {
  const n = ((turns % 5) + 5) % 5;
  if (n === 0) return;
  const next = arr.slice();
  for (let i = 0; i < 5; i++) {
    next[1 + ((i + n) % 5)] = arr[1 + i];
    next[6 + ((i + n) % 5)] = arr[6 + i];
  }
  // center (idx 0) stays
  for (let i = 0; i < 11; i++) arr[i] = next[i];
}

// Cycle a list of (face, idx) tuples by 'shift' positions.
// shift=k: value at position i moves to position (i + k) mod n.
type Slot = { face: MegaFace; idx: number };

function cycleSlots(state: MegaState, slots: readonly Slot[], shift: number): void {
  const n = slots.length;
  if (n === 0) return;
  const k = ((shift % n) + n) % n;
  if (k === 0) return;
  const vals = slots.map((s) => state[s.face][s.idx]);
  for (let i = 0; i < n; i++) {
    state[slots[(i + k) % n].face][slots[(i + k) % n].idx] = vals[i];
  }
}

// ─────────────────────────────────────────────────────────────────────────
// U move
// ─────────────────────────────────────────────────────────────────────────
//
// U rotates the U face 72° CW. The 5 surrounding face-tops cycle 1 → 2 → 3 → ...
// We treat each surrounding face's "U-touching strip" as 3 stickers
// (corner-edge-corner). For a CW U turn, F's strip moves to FR's strip, etc.

const U_CYCLE: readonly Slot[] = [
  { face: 'F', idx: 1 }, { face: 'F', idx: 6 }, { face: 'F', idx: 2 },
  { face: 'FR', idx: 1 }, { face: 'FR', idx: 6 }, { face: 'FR', idx: 2 },
  { face: 'BR', idx: 1 }, { face: 'BR', idx: 6 }, { face: 'BR', idx: 2 },
  { face: 'BL', idx: 1 }, { face: 'BL', idx: 6 }, { face: 'BL', idx: 2 },
  { face: 'FL', idx: 1 }, { face: 'FL', idx: 6 }, { face: 'FL', idx: 2 },
];

function applyU(state: MegaState, dir: 1 | -1): void {
  rotateFace(state.U, dir);
  // 15-element list, shift by ±3 (one face's worth).
  cycleSlots(state, U_CYCLE, dir === 1 ? 3 : -3);
}

// ─────────────────────────────────────────────────────────────────────────
// R++ / R-- (right-hemisphere 144° rotation)
// ─────────────────────────────────────────────────────────────────────────
//
// Faces affected (face centers + their stickers): the 6 "right-side" faces
//   F, FR, BR, DF, DFR, DBR
// Each rotates 144° (= 2 face-clicks) within its own frame for ++.
//
// Inter-face cycles: four parallel 5-cycles, each running through the same
// 5 of the 6 right-hemisphere faces (we use F → FR → BR → DBR → DFR → F as a
// closed ring, with DF skipped from inter-face cycles since its stickers are
// covered by face rotation alone — including it would require length-6 cycles
// which don't satisfy ^5 = id under shift 2).
//
// Each cycle has length 5 with shift 2, so (R++)^5 = id.

const R_RING: readonly MegaFace[] = ['F', 'FR', 'BR', 'DBR', 'DFR'];

function ringCycle(face: readonly MegaFace[], indices: readonly number[]): Slot[] {
  if (face.length !== indices.length) throw new Error('ringCycle: length mismatch');
  return face.map((f, i) => ({ face: f, idx: indices[i] }));
}

// Four cycles using disjoint sticker indices on each ring face.
// Indices are picked so no slot is reused across cycles.
const R_CYCLES: readonly (readonly Slot[])[] = [
  ringCycle(R_RING, [3, 5, 2, 4, 1]),  // corners
  ringCycle(R_RING, [4, 1, 3, 5, 2]),  // corners
  ringCycle(R_RING, [8, 10, 7, 9, 6]), // edges
  ringCycle(R_RING, [9, 6, 8, 10, 7]), // edges
];

const R_SPIN_FACES: readonly MegaFace[] = ['F', 'FR', 'BR', 'DF', 'DFR', 'DBR'];

function applyRPlusPlus(state: MegaState, dir: 1 | -1): void {
  // For R-- to invert R++, we apply ops in reverse order (rotate then cycle for ++,
  // cycle then rotate for --). This makes R-- the literal inverse permutation of R++.
  if (dir === 1) {
    for (const f of R_SPIN_FACES) rotateFace(state[f], 2);
    for (const c of R_CYCLES) cycleSlots(state, c, 2);
  } else {
    for (const c of R_CYCLES) cycleSlots(state, c, -2);
    for (const f of R_SPIN_FACES) rotateFace(state[f], -2);
  }
}

// ─────────────────────────────────────────────────────────────────────────
// D++ / D-- (bottom-hemisphere 144° rotation)
// ─────────────────────────────────────────────────────────────────────────
//
// Faces affected: D itself plus the 5 bottom petals DF/DFR/DBR/DBL/DFL.
// Each rotates 144° within its own frame for ++.
//
// Inter-face cycles: four parallel 5-cycles around the D-ring.

const D_RING: readonly MegaFace[] = ['DF', 'DFR', 'DBR', 'DBL', 'DFL'];

const D_CYCLES: readonly (readonly Slot[])[] = [
  ringCycle(D_RING, [3, 5, 2, 4, 1]),
  ringCycle(D_RING, [4, 1, 3, 5, 2]),
  ringCycle(D_RING, [8, 10, 7, 9, 6]),
  ringCycle(D_RING, [9, 6, 8, 10, 7]),
];

const D_SPIN_FACES: readonly MegaFace[] = ['D', 'DF', 'DFR', 'DBR', 'DBL', 'DFL'];

function applyDPlusPlus(state: MegaState, dir: 1 | -1): void {
  if (dir === 1) {
    for (const f of D_SPIN_FACES) rotateFace(state[f], 2);
    for (const c of D_CYCLES) cycleSlots(state, c, 2);
  } else {
    for (const c of D_CYCLES) cycleSlots(state, c, -2);
    for (const f of D_SPIN_FACES) rotateFace(state[f], -2);
  }
}

function applyMove(state: MegaState, raw: string): void {
  if (!raw) return;
  if (raw === 'U') return applyU(state, 1);
  if (raw === "U'") return applyU(state, -1);
  if (raw === 'R++') return applyRPlusPlus(state, 1);
  if (raw === 'R--') return applyRPlusPlus(state, -1);
  if (raw === 'D++') return applyDPlusPlus(state, 1);
  if (raw === 'D--') return applyDPlusPlus(state, -1);
  // fallback: ignore unknown tokens (e.g. line breaks)
}

export function applyMegaScramble(scramble: string): MegaState {
  const state = megaSolved();
  if (!scramble) return state;
  // Pochmann scrambles often have "\n" line breaks; treat any whitespace as separator.
  for (const t of scramble.split(/\s+/).filter(Boolean)) applyMove(state, t);
  return state;
}

// ─────────────────────────────────────────────────────────────────────────
// Self-check: assert group-theoretic invariants on every module load.
// console.assert is silent in production browsers; surfaces in dev.
// ─────────────────────────────────────────────────────────────────────────

function statesEqual(a: MegaState, b: MegaState): boolean {
  for (const f of FACES) {
    const aa = a[f];
    const bb = b[f];
    if (aa.length !== bb.length) return false;
    for (let i = 0; i < aa.length; i++) if (aa[i] !== bb[i]) return false;
  }
  return true;
}

function applyN(state: MegaState, fn: (s: MegaState) => void, n: number): void {
  for (let i = 0; i < n; i++) fn(state);
}

function megaSelfCheck(): boolean {
  const checks: Array<[string, () => boolean]> = [
    ['U U\' = id', () => {
      const s = megaSolved();
      applyU(s, 1); applyU(s, -1);
      return statesEqual(s, megaSolved());
    }],
    ['U^5 = id', () => {
      const s = megaSolved();
      applyN(s, (st) => applyU(st, 1), 5);
      return statesEqual(s, megaSolved());
    }],
    ['R++ R-- = id', () => {
      const s = megaSolved();
      applyRPlusPlus(s, 1); applyRPlusPlus(s, -1);
      return statesEqual(s, megaSolved());
    }],
    ['R-- R++ = id', () => {
      const s = megaSolved();
      applyRPlusPlus(s, -1); applyRPlusPlus(s, 1);
      return statesEqual(s, megaSolved());
    }],
    ['D++ D-- = id', () => {
      const s = megaSolved();
      applyDPlusPlus(s, 1); applyDPlusPlus(s, -1);
      return statesEqual(s, megaSolved());
    }],
    ['D-- D++ = id', () => {
      const s = megaSolved();
      applyDPlusPlus(s, -1); applyDPlusPlus(s, 1);
      return statesEqual(s, megaSolved());
    }],
    ['R++ scramble non-trivial', () => {
      const s = megaSolved();
      applyRPlusPlus(s, 1);
      return !statesEqual(s, megaSolved());
    }],
    ['D++ scramble non-trivial', () => {
      const s = megaSolved();
      applyDPlusPlus(s, 1);
      return !statesEqual(s, megaSolved());
    }],
    ['R++ U R-- U\' is non-trivial and reversible', () => {
      const s = megaSolved();
      applyRPlusPlus(s, 1); applyU(s, 1); applyRPlusPlus(s, -1); applyU(s, -1);
      const moved = !statesEqual(s, megaSolved());
      // Reverse it.
      applyU(s, 1); applyRPlusPlus(s, 1); applyU(s, -1); applyRPlusPlus(s, -1);
      return moved && statesEqual(s, megaSolved());
    }],
    ['no slot reuse across R cycles', () => {
      const seen = new Set<string>();
      for (const c of R_CYCLES) for (const slot of c) {
        const k = `${slot.face}.${slot.idx}`;
        if (seen.has(k)) return false;
        seen.add(k);
      }
      return true;
    }],
    ['no slot reuse across D cycles', () => {
      const seen = new Set<string>();
      for (const c of D_CYCLES) for (const slot of c) {
        const k = `${slot.face}.${slot.idx}`;
        if (seen.has(k)) return false;
        seen.add(k);
      }
      return true;
    }],
  ];
  let allOk = true;
  for (const [name, fn] of checks) {
    const ok = fn();
    if (!ok) {
      allOk = false;
      // eslint-disable-next-line no-console
      console.assert(false, `[megaminx_state] invariant failed: ${name}`);
    }
  }
  return allOk;
}

// Run once at module load. If invariants are violated this surfaces in dev.
megaSelfCheck();

/** Exported for explicit test harness use. Returns true iff all invariants hold. */
export function __megaSelfCheck(): boolean {
  return megaSelfCheck();
}
