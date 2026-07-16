/**
 * Gear Cube state model + notation for /sim.
 *
 * The Gear Cube is a 3×3-shaped puzzle whose 12 edges are GEARS. One move = a 180°
 * turn of a face; the gearing forces the adjacent middle slab (4 side centers + the
 * core + the 4 equator gears) to follow by 90°, and spins those 4 equator gears by
 * 60° about their own radial axes. The 4 edge gears riding the turning face do NOT
 * spin — they only travel with the face (verified against cstimer's facelet move
 * maps: face-edge windows stay solid-colored, equator windows cycle with period 12).
 * 90° face turns are physically impossible, so every token is a whole number of
 * 180° flips; a single flip has period 12 (corners 2 × middle 4 × gear phase 3).
 *
 * Discrete state (piece-level): corners perm(8), centers perm(6) — the whole center
 * spider rotates 90° with the middle every move — and 3 gear RINGS (one per axis,
 * 4 slots each) with a shared spin phase ∈ Z3 per ring (only equator moves spin a
 * ring, all 4 of its gears together, so gears of a ring always share one phase).
 * All permutations are derived at module init from exact integer rotation matrices —
 * nothing hand-written. tests/gear_state.test.ts locks this model two ways: a full
 * BFS over U/R/F reaches exactly 41,472 states (Jaap's 4!·(4·3)³), and random token
 * sequences agree with lib/gear-solver (the cstimer-bit-exact abstract model) on
 * state equality/solvedness.
 *
 * Notation = cstimer's gear alphabet extended to all 6 faces for free play:
 * `U` = one clockwise 180° flip (viewed from outside that face), `U'` its inverse,
 * `U2`..`U6` / `U2'`..`U5'` = 2..6 flips (12 ≡ identity, so ±6 coincide → `6`).
 * Scrambles come from lib/gear-solver (uniform random state + optimal path) and use
 * only U/R/F exactly like cstimer's `gearo`.
 */
import { randomGearScramble } from '@/lib/gear-solver';

// ── slot geometry (integer coordinates on the unit cube) ───────────────────────────
export const GEAR_FACE_NAMES = ['U', 'R', 'F', 'D', 'L', 'B'] as const;
/** Outward unit axis per face, indexed like GEAR_FACE_NAMES. */
export const FACE_AXIS: ReadonlyArray<readonly [number, number, number]> = [
  [0, 1, 0], [1, 0, 0], [0, 0, 1], [0, -1, 0], [-1, 0, 0], [0, 0, -1],
];

/** Corner slots 0..7 (position sign vectors). */
export const CORNER_POS: ReadonlyArray<readonly [number, number, number]> = [
  [1, 1, 1], [-1, 1, 1], [-1, 1, -1], [1, 1, -1],   // UFR UFL UBL UBR
  [1, -1, 1], [-1, -1, 1], [-1, -1, -1], [1, -1, -1], // DFR DFL DBL DBR
];
export const CORNER_NAMES = ['UFR', 'UFL', 'UBL', 'UBR', 'DFR', 'DFL', 'DBL', 'DBR'] as const;

/** Center slots 0..5, indexed like GEAR_FACE_NAMES (center i sits on face i). */
export const CENTER_POS: ReadonlyArray<readonly [number, number, number]> = FACE_AXIS;

/** Gear rings: ring r encircles axis r (0=y, 1=x, 2=z); 4 slots each, in the cyclic
 *  order that a +90° rotation about the ring's axis maps slot i → slot i+1. */
export const RING_AXIS: ReadonlyArray<readonly [number, number, number]> = [
  [0, 1, 0], [1, 0, 0], [0, 0, 1],
];
export const RING_SLOT_POS: ReadonlyArray<ReadonlyArray<readonly [number, number, number]>> = [
  [[1, 0, 1], [1, 0, -1], [-1, 0, -1], [-1, 0, 1]],   // y-ring: FR BR BL FL
  [[0, 1, 1], [0, -1, 1], [0, -1, -1], [0, 1, -1]],   // x-ring: UF DF DB UB
  [[1, 1, 0], [-1, 1, 0], [-1, -1, 0], [1, -1, 0]],   // z-ring: UR UL DL DR
];
export const RING_SLOT_NAMES: ReadonlyArray<ReadonlyArray<string>> = [
  ['FR', 'BR', 'BL', 'FL'],
  ['UF', 'DF', 'DB', 'UB'],
  ['UR', 'UL', 'DL', 'DR'],
];

/** Ring whose 4 gears are the EQUATOR of face f's move (= the ring about f's axis). */
export const FACE_EQUATOR_RING: ReadonlyArray<number> = [0, 1, 2, 0, 1, 2];

type V3 = readonly [number, number, number];
const dot = (a: V3, b: V3): number => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a: V3, b: V3): V3 => [
  a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0],
];
const eq = (a: V3, b: V3): boolean => a[0] === b[0] && a[1] === b[1] && a[2] === b[2];
/** 180° rotation about unit axis n: v ↦ 2(v·n)n − v (exact on integer vectors). */
const rot180 = (v: V3, n: V3): V3 => {
  const d = 2 * dot(v, n);
  return [d * n[0] - v[0], d * n[1] - v[1], d * n[2] - v[2]];
};

// ── move ────────────────────────────────────────────────────────────────────────────
/** A move: `amt` signed 180°-flips of face `face` (positive = clockwise seen from
 *  outside that face). Canonical amt ∈ {−5..−1, 1..6}; 12 flips ≡ identity. */
export interface GearMove {
  face: number;
  amt: number;
}

// ── static membership tables (derived from coordinates) ────────────────────────────
/** Corner slots in face f's layer (pos·axis > 0). */
export const FACE_CORNER_SLOTS: ReadonlyArray<ReadonlyArray<number>> = FACE_AXIS.map((n) =>
  CORNER_POS.map((_, i) => i).filter((i) => dot(CORNER_POS[i], n) > 0));
/** [ring, slot] pairs of the gears riding face f's layer (pos·axis > 0). */
export const FACE_GEAR_SLOTS: ReadonlyArray<ReadonlyArray<readonly [number, number]>> = FACE_AXIS.map((n) => {
  const out: Array<readonly [number, number]> = [];
  RING_SLOT_POS.forEach((slots, r) => slots.forEach((p, s) => { if (dot(p, n) > 0) out.push([r, s]); }));
  return out;
});
/** Center slots in face f's middle slab (pos·axis = 0). */
export const MIDDLE_CENTER_SLOTS: ReadonlyArray<ReadonlyArray<number>> = FACE_AXIS.map((n) =>
  CENTER_POS.map((_, i) => i).filter((i) => dot(CENTER_POS[i], n) === 0));

// per-face permutations for ONE clockwise flip, derived from the rotation matrices.
interface FlipGen {
  /** cornerTo[slot] = where the corner in `slot` lands. Identity off the face. */
  cornerTo: number[];
  /** centerTo[slot] = where the center in `slot` lands (middle 4-cycle; face/opposite stay). */
  centerTo: number[];
  /** ringTo[r][s] = destination slot (within ring r) of the gear in slot s. */
  ringTo: number[][];
}

function buildFlip(face: number, sign: 1 | -1): FlipGen {
  const n = FACE_AXIS[face];
  // face layer: 180° about n (sign-independent for positions); middle: ∓90° about n:
  // clockwise-from-outside = −sign·90° about the outward axis n ⇒ v' = −sign·(n×v).
  const mapPos = (v: V3): V3 => {
    const d = dot(v, n);
    if (d > 0) return rot180(v, n);
    if (d < 0) return v;
    const c = cross(n, v);
    return [-sign * c[0], -sign * c[1], -sign * c[2]];
  };
  const cornerTo = CORNER_POS.map((p) => CORNER_POS.findIndex((q) => eq(q, mapPos(p))));
  const centerTo = CENTER_POS.map((p) => CENTER_POS.findIndex((q) => eq(q, mapPos(p))));
  const ringTo = RING_SLOT_POS.map((slots) =>
    slots.map((p) => slots.findIndex((q) => eq(q, mapPos(p)))));
  return { cornerTo, centerTo, ringTo };
}

const FLIP_CW: ReadonlyArray<FlipGen> = FACE_AXIS.map((_, f) => buildFlip(f, 1));
const FLIP_CCW: ReadonlyArray<FlipGen> = FACE_AXIS.map((_, f) => buildFlip(f, -1));

// ── discrete state ──────────────────────────────────────────────────────────────────
export interface GearPieceState {
  /** cp[slot] = corner pieceId in that slot. */
  cp: number[];
  /** cent[slot] = center pieceId in that slot (the spider turns with every move). */
  cent: number[];
  /** ring[r][slot] = gear pieceId (0..3 within its ring; gears never change rings). */
  ring: number[][];
  /** phase[r] ∈ Z3 — shared 60°-spin phase of ring r's four gears. */
  phase: number[];
}

export function solvedGear(): GearPieceState {
  return {
    cp: [0, 1, 2, 3, 4, 5, 6, 7],
    cent: [0, 1, 2, 3, 4, 5],
    ring: [[0, 1, 2, 3], [0, 1, 2, 3], [0, 1, 2, 3]],
    phase: [0, 0, 0],
  };
}

/** Apply ONE signed flip. Returns a new state. */
export function applyGearFlip(st: GearPieceState, face: number, sign: 1 | -1): GearPieceState {
  const g = sign === 1 ? FLIP_CW[face] : FLIP_CCW[face];
  const cp = new Array<number>(8);
  const cent = new Array<number>(6);
  for (let s = 0; s < 8; s++) cp[g.cornerTo[s]] = st.cp[s];
  for (let s = 0; s < 6; s++) cent[g.centerTo[s]] = st.cent[s];
  const ring = st.ring.map((slots, r) => {
    const out = new Array<number>(4);
    for (let s = 0; s < 4; s++) out[g.ringTo[r][s]] = slots[s];
    return out;
  });
  const phase = st.phase.slice();
  const er = FACE_EQUATOR_RING[face];
  phase[er] = ((phase[er] + sign) % 3 + 3) % 3;
  return { cp, cent, ring, phase };
}

export function applyGearMove(st: GearPieceState, move: GearMove): GearPieceState {
  const sign = move.amt >= 0 ? 1 : -1;
  let s = st;
  for (let i = 0; i < Math.abs(move.amt); i++) s = applyGearFlip(s, move.face, sign as 1 | -1);
  return s;
}

// ── solved check (up to whole-cube rotation — reorienting the cube isn't a scramble) ─
/** The 24 rotation images of the solved state, precomputed from integer rotation
 *  matrices (each rotation = a permutation of every slot table; phases stay 0). */
const ROTATED_SOLVED: ReadonlyArray<GearPieceState> = (() => {
  // generate the 24 proper rotations as integer matrices via BFS over two generators
  const I: number[][] = [[1, 0, 0], [0, 1, 0], [0, 0, 1]];
  const Rx: number[][] = [[1, 0, 0], [0, 0, -1], [0, 1, 0]];
  const Ry: number[][] = [[0, 0, 1], [0, 1, 0], [-1, 0, 0]];
  const mul = (a: number[][], b: number[][]): number[][] =>
    a.map((row, i) => row.map((_, j) => a[i][0] * b[0][j] + a[i][1] * b[1][j] + a[i][2] * b[2][j]));
  const key = (m: number[][]): string => m.flat().join(',');
  const seen = new Map<string, number[][]>([[key(I), I]]);
  const queue = [I];
  while (queue.length) {
    const m = queue.pop()!;
    for (const g of [Rx, Ry]) {
      const nm = mul(g, m);
      if (!seen.has(key(nm))) { seen.set(key(nm), nm); queue.push(nm); }
    }
  }
  const apply = (m: number[][], v: V3): V3 => [
    m[0][0] * v[0] + m[0][1] * v[1] + m[0][2] * v[2],
    m[1][0] * v[0] + m[1][1] * v[1] + m[1][2] * v[2],
    m[2][0] * v[0] + m[2][1] * v[1] + m[2][2] * v[2],
  ];
  return [...seen.values()].map((m) => {
    const st = solvedGear();
    CORNER_POS.forEach((p, i) => { st.cp[CORNER_POS.findIndex((q) => eq(q, apply(m, p)))] = i; });
    CENTER_POS.forEach((p, i) => { st.cent[CENTER_POS.findIndex((q) => eq(q, apply(m, p)))] = i; });
    RING_SLOT_POS.forEach((slots, r) => {
      // Gears never leave their ring (every move permutes within rings), so the only
      // REACHABLE whole-cube rotations map each ring onto itself: {I, x180, y180, z180}.
      // Ring-mixing rotations get a −1 marker and are dropped below.
      slots.forEach((p, s) => {
        const img = apply(m, p);
        const r2 = RING_SLOT_POS.findIndex((ss) => ss.some((q) => eq(q, img)));
        const s2 = RING_SLOT_POS[r2].findIndex((q) => eq(q, img));
        st.ring[r2][s2] = r2 === r ? s : -1;
      });
    });
    return st;
  }).filter((st) => st.ring.every((slots) => slots.every((x) => x >= 0)));
})();

/** True iff the state is the solved cube in any reachable whole-cube orientation
 *  (reorienting the cube isn't a scramble — see ROTATED_SOLVED). */
export function isSolvedGear(st: GearPieceState): boolean {
  if (st.phase[0] !== 0 || st.phase[1] !== 0 || st.phase[2] !== 0) return false;
  outer: for (const sol of ROTATED_SOLVED) {
    for (let i = 0; i < 8; i++) if (st.cp[i] !== sol.cp[i]) continue outer;
    for (let i = 0; i < 6; i++) if (st.cent[i] !== sol.cent[i]) continue outer;
    for (let r = 0; r < 3; r++) for (let s = 0; s < 4; s++) if (st.ring[r][s] !== sol.ring[r][s]) continue outer;
    return true;
  }
  return false;
}

// ── notation: parse / render / invert / reduce ──────────────────────────────────────
const FACE_IDX: Record<string, number> = { U: 0, R: 1, F: 2, D: 3, L: 4, B: 5 };
const TOKEN_RE = /^([URFDLB])([2-6]?)('?)$/;

/** Canonicalize a flip count into (−6, 6] with 0 dropped by callers. */
export function normalizeAmt(amt: number): number {
  let a = ((amt % 12) + 12) % 12; // 0..11
  if (a > 6) a -= 12;             // −5..6
  return a;
}

/** Parse a scramble/alg string into moves; unknown tokens are skipped (the /sim
 *  input box must never crash on a stray token — strict parsing lives in the solver). */
export function parseGearMoves(text: string): GearMove[] {
  const out: GearMove[] = [];
  for (const tok of text.trim().split(/\s+/)) {
    if (!tok) continue;
    const m = TOKEN_RE.exec(tok);
    if (!m) continue;
    const n = m[2] ? parseInt(m[2], 10) : 1;
    const amt = normalizeAmt(m[3] ? -n : n);
    if (amt !== 0) out.push({ face: FACE_IDX[m[1]], amt });
  }
  return out;
}

export function gearMoveToString(move: GearMove): string {
  const a = normalizeAmt(move.amt);
  const f = GEAR_FACE_NAMES[move.face];
  if (a >= 0) return a === 1 ? f : `${f}${a}`;
  return a === -1 ? `${f}'` : `${f}${-a}'`;
}

export function gearMovesToString(moves: GearMove[]): string {
  return moves.map(gearMoveToString).join(' ');
}

export function invertGearMoves(moves: GearMove[]): GearMove[] {
  return moves.slice().reverse()
    .map((m) => ({ face: m.face, amt: normalizeAmt(-m.amt) }))
    .filter((m) => m.amt !== 0);
}

/** Fold adjacent same-face tokens mod 12 (消步). */
export function reduceGearAlg(s: string): string {
  const out: GearMove[] = [];
  for (const m of parseGearMoves(s)) {
    const last = out[out.length - 1];
    if (last && last.face === m.face) {
      const net = normalizeAmt(last.amt + m.amt);
      out.pop();
      if (net !== 0) out.push({ face: m.face, amt: net });
    } else {
      out.push(m);
    }
  }
  return gearMovesToString(out);
}

/** cstimer-uniform random scramble (random reachable state + optimal path, U/R/F). */
export function randomGearScrambleMoves(): GearMove[] {
  return parseGearMoves(randomGearScramble());
}
