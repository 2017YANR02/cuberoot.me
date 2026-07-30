/**
 * "Is this step of the solve finished?" — for any of the 24 ways the cube can
 * be held.
 *
 * Three separate things we need all reduce to this one question:
 *   - sub-step auto-stop when training (only drilling OLL? stop when OLL is
 *     done, not when the cube is solved);
 *   - live phase splits while the timer runs (cross / F2L / OLL / PLL), instead
 *     of working them out afterwards;
 *   - method detection beyond CFOP (Roux's first block, second block, CMLL).
 *
 * Ported from csTimer's `cubeutil.js` (`lib/cubeutil.js:24`, `:105`, `:238`).
 * The trick there is worth restating because it is much simpler than it looks:
 *
 *   A step is described by a 54-character mask over the facelets. Positions
 *   sharing a letter must share a COLOUR; `-` means "don't care". Nothing says
 *   which colour — so "the D cross is built" is expressible without knowing
 *   which face the user crosses on, and "corner permutation is done" is
 *   expressible without pinning the AUF (`cpll`'s lowercase `r-r` asks only
 *   that the two corner stickers on the R side match EACH OTHER, not the
 *   centre).
 *
 * Orientation is handled by trying the mask under several rotations of the cube
 * and taking the best. Six is enough for CFOP steps — one per face that could
 * be the cross face, because those masks are invariant under turning the cube
 * about that face. Roux blocks are not (a left block is not a right block), so
 * those get all 24.
 *
 * The masks and the axis counts are upstream's, verbatim. The rotation tables
 * are derived here from sticker geometry rather than copied, and
 * `tests/cube_steps.test.ts` checks both against csTimer's real `cubeutil`
 * running in a VM.
 */

/* ────────────────────────────────────────────────────────────────────── *
 *  Masks — verbatim from cubeutil.js:24-35
 * ────────────────────────────────────────────────────────────────────── */

/**
 * A step whose completion we can test.
 *
 * Deliberately NOT here: the four individual F2L slots. Upstream has masks for
 * them but never asks about one on its own — `getCF4O2P2Progress` only ever
 * SUMS the four, and for good reason: a single slot mask is not invariant under
 * turning the cube about the cross face, so "is pair 1 done" has no
 * orientation-free answer. (Upstream's own `getStepProgress('f2l1', …)` doesn't
 * even reach that mask — `f2l1` is absent from `stepParams`, so it falls through
 * to the plain solved check. Easy to mistake for an oracle.) When we need a pair
 * COUNT for live phase splits, it goes in as the sum, the way upstream does it.
 */
export type CubeStep =
  | 'cross'
  | 'f2l'
  | 'oll' | 'eoll' | 'cpll'
  | 'fb' | 'sb' | 'cmll'
  | 'solved';

const SOLVED_FACELETS = 'UUUUUUUUURRRRRRRRRFFFFFFFFFDDDDDDDDDLLLLLLLLLBBBBBBBBB';

interface StepSpec {
  /** 54-char mask: same letter = same colour, `-` = unconstrained. */
  mask: string;
  /** How many of the 24 orientations to try. 6 = one per axis. */
  axes: 6 | 24;
}

const STEPS: Record<CubeStep, StepSpec> = {
  cross: { mask: '----U--------R--R-----F--F--D-DDD-D-----L--L-----B--B-', axes: 6 },
  f2l:   { mask: '----U-------RRRRRR---FFFFFFDDDDDDDDD---LLLLLL---BBBBBB', axes: 6 },
  oll:   { mask: 'UUUUUUUUU---RRRRRR---FFFFFFDDDDDDDDD---LLLLLL---BBBBBB', axes: 6 },
  eoll:  { mask: '-U-UUU-U----RRRRRR---FFFFFFDDDDDDDDD---LLLLLL---BBBBBB', axes: 6 },
  cpll:  { mask: 'UUUUUUUUUr-rRRRRRRf-fFFFFFFDDDDDDDDDl-lLLLLLLb-bBBBBBB', axes: 6 },
  fb:    { mask: '---------------------F--F--D--D--D-----LLLLLL-----B--B', axes: 24 },
  sb:    { mask: '------------RRRRRR---F-FF-FD-DD-DD-D---LLLLLL---B-BB-B', axes: 24 },
  cmll:  { mask: 'U-U---U-Ur-rRRRRRRf-fF-FF-FD-DD-DD-Dl-lLLLLLLb-bB-BB-B', axes: 24 },
  // Fully solved needs no rotation sweep: "every face uniform" is the same
  // statement however you hold it.
  solved: { mask: SOLVED_FACELETS, axes: 6 },
};

/**
 * Mask → groups of facelet indices that must all share a colour.
 * csTimer's `toEqus` (`cubeutil.js:5`). Single-member groups are dropped:
 * one sticker is always equal to itself.
 */
function toEquivalences(mask: string): number[][] {
  const byLetter = new Map<string, number[]>();
  for (let i = 0; i < mask.length; i++) {
    const ch = mask[i];
    if (ch === '-') continue;
    const group = byLetter.get(ch);
    if (group) group.push(i);
    else byLetter.set(ch, [i]);
  }
  const out: number[][] = [];
  for (const group of byLetter.values()) if (group.length > 1) out.push(group);
  return out;
}

const EQUIVALENCES: Record<CubeStep, number[][]> = Object.fromEntries(
  (Object.keys(STEPS) as CubeStep[]).map((s) => [s, toEquivalences(STEPS[s].mask)]),
) as Record<CubeStep, number[][]>;

/* ────────────────────────────────────────────────────────────────────── *
 *  The 24 orientations, from geometry
 * ────────────────────────────────────────────────────────────────────── */

type Vec = readonly [number, number, number];

/** Outward normal of each face, in URFDLB order. */
const FACE_NORMAL: readonly Vec[] = [
  [0, 1, 0],   // U
  [1, 0, 0],   // R
  [0, 0, 1],   // F
  [0, -1, 0],  // D
  [-1, 0, 0],  // L
  [0, 0, -1],  // B
];

/**
 * In-plane axes of each face: `u` is the direction of increasing column, `v` of
 * increasing row, for the row-major facelet numbering the whole codebase uses
 * (U seen with F in front, D seen with F nearest the top row, and so on).
 *
 * These are what pin the numbering to real geometry, so the test asserts the
 * consequence: the three stickers of every corner in `CORNER_FACELET` must come
 * out at the same corner of the cube, and both stickers of every edge at the
 * same edge.
 */
const FACE_U: readonly Vec[] = [
  [1, 0, 0],   // U: columns run left → right
  [0, 0, -1],  // R: columns run front → back
  [1, 0, 0],   // F
  [1, 0, 0],   // D
  [0, 0, 1],   // L: columns run back → front
  [-1, 0, 0],  // B: columns run right → left
];
const FACE_V: readonly Vec[] = [
  [0, 0, 1],   // U: rows run back → front
  [0, -1, 0],  // R: rows run top → bottom
  [0, -1, 0],  // F
  [0, 0, -1],  // D: rows run front → back
  [0, -1, 0],  // L
  [0, -1, 0],  // B
];

/** Where facelet `i` sits in space: face centre plus its offset within the face. */
export function faceletPosition(i: number): { normal: Vec; pos: Vec } {
  const f = Math.floor(i / 9);
  const p = i % 9;
  const row = Math.floor(p / 3) - 1;
  const col = (p % 3) - 1;
  const n = FACE_NORMAL[f];
  const u = FACE_U[f];
  const v = FACE_V[f];
  return {
    normal: n,
    pos: [
      n[0] + col * u[0] + row * v[0],
      n[1] + col * u[1] + row * v[1],
      n[2] + col * u[2] + row * v[2],
    ],
  };
}

/** Whole-cube rotations, as maps on space. Names follow WCA: `x` sends F to U. */
const ROTATIONS: ReadonlyArray<(v: Vec) => Vec> = [
  ([x, y, z]) => [x, z, -y],   // x
  ([x, y, z]) => [-z, y, x],   // y  (F → L)
  ([x, y, z]) => [y, -x, z],   // z  (U → R)
];

function keyOf(normal: Vec, pos: Vec): string {
  return `${normal.join(',')}|${pos.join(',')}`;
}

const FACELET_BY_KEY: Map<string, number> = (() => {
  const m = new Map<string, number>();
  for (let i = 0; i < 54; i++) {
    const { normal, pos } = faceletPosition(i);
    m.set(keyOf(normal, pos), i);
  }
  return m;
})();

/**
 * One rotation as a facelet permutation: `perm[i]` is the facelet whose sticker
 * ENDS UP at position `i` — i.e. the index to read when evaluating a mask
 * against the rotated cube. (csTimer stores the other direction and inverts at
 * the read site; the parity test would fail loudly if this were backwards.)
 */
function permutationFor(rotate: (v: Vec) => Vec): number[] {
  const perm = new Array<number>(54);
  for (let i = 0; i < 54; i++) {
    const { normal, pos } = faceletPosition(i);
    const dest = FACELET_BY_KEY.get(keyOf(rotate(normal), rotate(pos)));
    if (dest === undefined) throw new Error(`rotation left facelet ${i} nowhere`);
    perm[dest] = i;
  }
  return perm;
}

function composePerm(a: readonly number[], b: readonly number[]): number[] {
  // Read through b, then a.
  return a.map((i) => b[i]);
}

const IDENTITY_PERM: number[] = Array.from({ length: 54 }, (_, i) => i);

/**
 * All 24 orientations, ordered so the first six are one per axis — i.e. six
 * different faces brought to the bottom, with no further turning about it.
 * That ordering is what makes `axes: 6` mean "try every cross face once".
 */
const ORIENTATIONS: readonly number[][] = (() => {
  const generators = ROTATIONS.map(permutationFor);
  const seen = new Map<string, number[]>();
  const queue: number[][] = [IDENTITY_PERM];
  seen.set(IDENTITY_PERM.join(','), IDENTITY_PERM);
  while (queue.length > 0) {
    const cur = queue.shift()!;
    for (const g of generators) {
      const next = composePerm(cur, g);
      const key = next.join(',');
      if (seen.has(key)) continue;
      seen.set(key, next);
      queue.push(next);
    }
  }
  const all = [...seen.values()];
  if (all.length !== 24) throw new Error(`expected 24 orientations, got ${all.length}`);
  // Group by which face ends up at D (facelet 31 is the D centre), then take one
  // representative per group first, so a prefix of length 6 covers every axis.
  const byDownFace = new Map<number, number[][]>();
  for (const perm of all) {
    const downFace = Math.floor(perm[31] / 9);
    const bucket = byDownFace.get(downFace);
    if (bucket) bucket.push(perm);
    else byDownFace.set(downFace, [perm]);
  }
  const firstSix = [...byDownFace.values()].map((b) => b[0]);
  const rest = [...byDownFace.values()].flatMap((b) => b.slice(1));
  if (firstSix.length !== 6) throw new Error(`expected 6 axes, got ${firstSix.length}`);
  return [...firstSix, ...rest];
})();

/* ────────────────────────────────────────────────────────────────────── *
 *  The question itself
 * ────────────────────────────────────────────────────────────────────── */

function maskHolds(facelets: string, groups: readonly number[][], orientation: readonly number[]): boolean {
  for (const group of groups) {
    const first = facelets[orientation[group[0]]];
    for (let j = 1; j < group.length; j++) {
      if (facelets[orientation[group[j]]] !== first) return false;
    }
  }
  return true;
}

/**
 * Is `step` complete in this state, holding the cube any way you like?
 *
 * `facelets` is the 54-character URFDLB string. Anything that is not 54
 * characters is not a cube state and is reported as "not done" rather than
 * throwing — this runs on every notification from the cube, and a malformed
 * read should not take the timer down with it.
 */
export function stepSolved(step: CubeStep, facelets: string): boolean {
  if (facelets.length !== 54) return false;
  const groups = EQUIVALENCES[step];
  const axes = STEPS[step].axes;
  for (let a = 0; a < axes; a++) {
    if (maskHolds(facelets, groups, ORIENTATIONS[a])) return true;
  }
  return false;
}

/** For tests and diagnostics: the orientation tables this module derived. */
export function orientationTables(): readonly number[][] {
  return ORIENTATIONS;
}
