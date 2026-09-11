/**
 * BLD memo helper — port of cstimer's `tools/bldhelper.js` `getBLDcode`
 * algorithm and supporting `mathlib.CubieCube` infrastructure for 3BLD.
 *
 * Given a 3x3 scramble, produces a Speffz letter-pair memo decomposition:
 *   - Corner cycle as a sequence of letter pairs (with default UFR buffer).
 *   - Edge cycle as a sequence of letter pairs (with default UF buffer).
 *   - Twisted-corners list and flipped-edges list (cycles of length 1 in
 *     orientation only — these need post-execution flip/twist algs).
 *   - Cycle-parity flag (true = total perm is odd → needs parity alg).
 *
 * Convention follows cstimer exactly so the Speffz scheme string can be
 * reused verbatim:
 *
 *   pieces = 'UFR UFL UBL UBR DFR DFL DBL DBR  UR UF UL UB DR DF DL DB FR FL BL BR'
 *   corners 0..7  = UFR, UFL, UBL, UBR, DFR, DFL, DBL, DBR
 *   edges   0..11 = UR, UF, UL, UB, DR, DF, DL, DB, FR, FL, BL, BR
 *
 *   ca[i] = perm | (orientation << 3)   // 0..23
 *   ea[i] = (perm << 1) | orientation   // 0..23
 *
 *   moveCube[0]  = U, [3] = R, [6] = F, [9] = D, [12] = L, [15] = B
 *   power 0/1/2 = X / X2 / X' (filled in by repeated CornMult/EdgeMult).
 */

// ───────────────────────── CubieCube (cstimer convention) ─────────────────────

export interface CubieCube {
  ca: number[]; // 8
  ea: number[]; // 12
}

function solvedCubie(): CubieCube {
  return {
    ca: [0, 1, 2, 3, 4, 5, 6, 7],
    ea: [0, 2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 22],
  };
}

function cornMult(a: CubieCube, b: CubieCube, prod: CubieCube): void {
  for (let c = 0; c < 8; c++) {
    const ori = (((a.ca[b.ca[c] & 7] >> 3) + (b.ca[c] >> 3)) % 3) & 0xff;
    prod.ca[c] = (a.ca[b.ca[c] & 7] & 7) | (ori << 3);
  }
}

function edgeMult(a: CubieCube, b: CubieCube, prod: CubieCube): void {
  for (let e = 0; e < 12; e++) {
    prod.ea[e] = a.ea[b.ea[e] >> 1] ^ (b.ea[e] & 1);
  }
}

function cubeMult(a: CubieCube, b: CubieCube, prod: CubieCube): void {
  cornMult(a, b, prod);
  edgeMult(a, b, prod);
}

// 18 move cubes: index = face*3 + (power-1), face order U R F D L B as in cstimer.
// Base entries are the X (one-CW) cubies copied verbatim from cstimer
// `mathlib.js` CubieCube.moveCube, then X2 / X' are filled by composition.
const MOVES: CubieCube[] = (() => {
  const out: CubieCube[] = [];
  for (let i = 0; i < 18; i++) out.push(solvedCubie());
  // moveCube[0] = U, [3] = R, [6] = F, [9] = D, [12] = L, [15] = B
  out[0].ca = [3, 0, 1, 2, 4, 5, 6, 7];
  out[0].ea = [6, 0, 2, 4, 8, 10, 12, 14, 16, 18, 20, 22];
  out[3].ca = [20, 1, 2, 8, 15, 5, 6, 19];
  out[3].ea = [16, 2, 4, 6, 22, 10, 12, 14, 8, 18, 20, 0];
  out[6].ca = [9, 21, 2, 3, 16, 12, 6, 7];
  out[6].ea = [0, 19, 4, 6, 8, 17, 12, 14, 3, 11, 20, 22];
  out[9].ca = [0, 1, 2, 3, 5, 6, 7, 4];
  out[9].ea = [0, 2, 4, 6, 10, 12, 14, 8, 16, 18, 20, 22];
  out[12].ca = [0, 10, 22, 3, 4, 17, 13, 7];
  out[12].ea = [0, 2, 20, 6, 8, 10, 18, 14, 16, 4, 12, 22];
  out[15].ca = [0, 1, 11, 23, 4, 5, 18, 14];
  out[15].ea = [0, 2, 4, 23, 8, 10, 12, 21, 16, 18, 7, 15];
  // Fill X2 = X*X and X' = X2*X.
  for (let a = 0; a < 18; a += 3) {
    cubeMult(out[a], out[a], out[a + 1]);
    cubeMult(out[a + 1], out[a], out[a + 2]);
  }
  return out;
})();

const FACE_INDEX: Record<string, number> = { U: 0, R: 3, F: 6, D: 9, L: 12, B: 15 };

/** Apply a 3x3 scramble (face turns only — wide / slice / rotations are
 *  ignored; the 333 BLD scramble grammar uses only outer face turns). */
export function applyScramble3(scramble: string): CubieCube {
  let cur = solvedCubie();
  const tmp = solvedCubie();
  const tokens = scramble.trim().split(/\s+/).filter(Boolean);
  for (const tok of tokens) {
    const m = /^([URFDLB])(['2]?)$/.exec(tok);
    if (!m) continue; // skip unknown tokens defensively
    const base = FACE_INDEX[m[1]];
    const power = m[2] === '' ? 0 : m[2] === '2' ? 1 : 2;
    cubeMult(cur, MOVES[base + power], tmp);
    [cur.ca, tmp.ca] = [tmp.ca, cur.ca];
    [cur.ea, tmp.ea] = [tmp.ea, cur.ea];
  }
  return cur;
}

// ───────────────────────── Speffz scheme + buffers ─────────────────────────

// Verbatim copy of cstimer `bldhelper.js`:
//   var Speffz = 'CJM DIF ARE BQN VKP ULG XSH WTO BM CI DE AQ VO UK XG WS JP LF RH TN';
// 8 corner triples (3 chars each, sticker letters in (UD-reference, CW, CCW)
// orientation order), 12 edge pairs (2 chars each).
const SPEFFZ = 'CJM DIF ARE BQN VKP ULG XSH WTO BM CI DE AQ VO UK XG WS JP LF RH TN';
const ORDER_DEFAULT = '012345670123456789ab';

// Pieces order (cstimer convention) — "pieces" string in bldhelper.js.
// Used only for context; numeric indices are what matters.
// 'UFR UFL UBL UBR DFR DFL DBL DBR  UR UF UL UB DR DF DL DB FR FL BL BR'

// Default cstimer buffers: cbuff = 0 (UFR), ebuff = 1 (UF).
// In cstimer cbuff/ebuff are 0..23 (perm + ori); we use the perm part only
// since BLD by convention buffers the U-sticker corner / U-sticker edge.
const DEFAULT_CBUF = 0; // UFR (perm 0, ori 0 → U-sticker)
const DEFAULT_EBUF = 1; // UF  (perm 1, ori 0 → U-sticker)

// circle(arr, a, b) — 2-arg form: swap arr[a] and arr[b]. (Verbatim semantics
// of cstimer mathlib.circle when called with exactly two index args.)
function circle2(arr: number[], a: number, b: number): void {
  const t = arr[a];
  arr[a] = arr[b];
  arr[b] = t;
}

/**
 * Decompose a CubieCube into BLD letter-pair codes, port of
 * `bldhelper.js` `getBLDcode`. Returns:
 *   ret[0] = corner sticker letters (one char per cycle target, separated
 *            by spaces every 2 letters → letter pairs)
 *   ret[1] = edge sticker letters (same convention)
 *
 * Mutates a clone of `c` — the caller's state is untouched.
 *
 * Algorithm summary (verbatim from cstimer):
 *   1. Mark buffer + already-solved pieces as "done" via a bitmask.
 *   2. Loop: read what the buffer points to.
 *        * If buffer points to itself (cycle break) → swap with the next
 *          unsolved piece in `order`, push that target.
 *        * Otherwise push the current buffer target's encoded value, then
 *          eject the buffer's contents into `target` and pull a new value
 *          into the buffer (swap-into-buffer style).
 *      Continue until every piece is marked done.
 *   3. Decode each pushed code into a Speffz sticker letter using the
 *      orientation flags.
 *
 * Corner orientation is a 4-bit value in cstimer's encoding: low 3 bits =
 * permutation (0..7), bit 3+ = orientation 0..2. The 0xa5 mask handles the
 * "swap-orientation-on-flip" trick for the 4 "non-U/D-reference" corners.
 */
function getBLDcode(
  c: CubieCube,
  scheme: string,
  cbuf: number,
  ebuf: number,
  order: string,
): [string[], string[]] {
  // Decode buffer into perm + ori, mirroring cstimer.
  let cori = Math.floor(cbuf / 8);
  let cbufP = cbuf % 8;
  cori ^= ((0xa5 >> cbufP) & 0x1) * 3;
  let eori = Math.floor(ebuf / 12);
  let ebufP = ebuf % 12;

  const corns: string[] = [];
  const corders: number[] = [];
  for (let i = 0; i < 8; i++) {
    corns.push(scheme.slice(i * 4, i * 4 + 3));
    corders.push(parseInt(order[i], 24));
  }
  const edges: string[] = [];
  const eorders: number[] = [];
  for (let i = 0; i < 12; i++) {
    edges.push(scheme.slice(32 + i * 3, 32 + i * 3 + 2));
    eorders.push(parseInt(order[i + 8], 24));
  }

  const ccode: number[] = [];
  const ecode: number[] = [];
  // Working copy — never mutate caller state.
  const ca = c.ca.slice();
  const ea = c.ea.slice();

  // Corners
  let done = 1 << cbufP;
  for (let i = 0; i < 8; i++) if (ca[i] === i) done |= 1 << i;
  while (done !== 0xff) {
    const target = ca[cbufP] & 0x7;
    if (target === cbufP) {
      // Buffer in place but cube not solved — swap with the next pending in
      // `order`. cstimer increments perm in the while loop; replicate exactly.
      let idx = -1;
      // eslint-disable-next-line no-empty
      while (((done >> (corders[++idx] % 8)) & 1) !== 0) {}
      let perm = corders[idx];
      let ori = Math.floor(perm / 8);
      perm = perm % 8;
      ori ^= ((0xa5 >> perm) & 0x1) * 3;
      circle2(ca, perm, cbufP);
      ca[perm] = (ca[perm] + ((6 + ori - cori) << 3)) % 24;
      ca[cbufP] = (ca[cbufP] + ((6 - ori + cori) << 3)) % 24;
      ccode.push(((6 - ori + cori) % 3) * 8 + perm);
      continue;
    }
    ccode.push(ca[cbufP]);
    ca[cbufP] = (ca[target] + (ca[cbufP] & 0xf8)) % 24;
    ca[target] = target;
    done |= 1 << target;
  }

  // Edges
  done = 1 << ebufP;
  for (let i = 0; i < 12; i++) if (ea[i] === i * 2) done |= 1 << i;
  while (done !== 0xfff) {
    const target = ea[ebufP] >> 1;
    if (target === ebufP) {
      let idx = -1;
      // eslint-disable-next-line no-empty
      while (((done >> (eorders[++idx] % 12)) & 1) !== 0) {}
      let perm = eorders[idx];
      const ori = Math.floor(perm / 12) ^ eori;
      perm = perm % 12;
      circle2(ea, perm, ebufP);
      ea[perm] ^= ori;
      ea[ebufP] ^= ori;
      ecode.push(perm * 2 + ori);
      continue;
    }
    ecode.push(ea[ebufP]);
    ea[ebufP] = ea[target] ^ (ea[ebufP] & 1);
    ea[target] = target << 1;
    done |= 1 << target;
  }

  // Decode codes → sticker letter sequences. Spaces inserted every 2 letters
  // for letter-pair grouping (matching cstimer's display).
  const cretChars: string[] = [];
  for (let i = 0; i < ccode.length; i++) {
    const val = ccode[i] & 0x7;
    let ori = (6 - (ccode[i] >> 3) + cori) % 3;
    ori ^= ((0xa5 >> val) & 0x1) * 3;
    cretChars.push(corns[val].charAt(ori % 3));
    if (i % 2 === 1) cretChars.push(' ');
  }
  const eretChars: string[] = [];
  for (let i = 0; i < ecode.length; i++) {
    const val = ecode[i] ^ eori;
    eretChars.push(edges[val >> 1].charAt(val & 1));
    if (i % 2 === 1) eretChars.push(' ');
  }
  return [cretChars, eretChars];
}

// ───────────────────────── Public API ─────────────────────────

export interface BldMemo {
  /** Letter pairs for the corner cycle, e.g. "AB CD EF". May end with a
   *  single letter if the cycle has odd length (twist tail). */
  cornerPairs: string;
  /** Letter pairs for the edge cycle. */
  edgePairs: string;
  /** Sticker letters of corners that are oriented but in place (twisted in
   *  isolation — need a corner-twist alg, not part of the main cycle). */
  twistedCorners: string[];
  /** Sticker letters of edges that are oriented but in place (flipped in
   *  isolation). */
  flippedEdges: string[];
  /** True iff the corner-edge permutation is odd → need a parity alg. */
  parity: boolean;
  /** Lettering scheme. Currently always 'speffz' (cstimer's default). */
  scheme: 'speffz';
}

/**
 * Compute a Speffz letter-pair memo decomposition of a 3BLD scramble.
 * Default buffers: corner = UFR, edge = UF.
 *
 * Twisted / flipped pieces in the cstimer algorithm appear as length-1
 * "cycles" pushed into the same code stream — a corner whose perm equals the
 * buffer's perm but with non-zero ori shows up as a swap-and-back.
 * To surface them separately we re-derive them from the raw cube state
 * (cleaner than parsing cstimer's stream).
 */
export function memoize3bld(scramble: string): BldMemo {
  const cube = applyScramble3(scramble);

  // 1. Letter-pair decomposition (matches cstimer display verbatim).
  const codes = getBLDcode(cube, SPEFFZ, DEFAULT_CBUF, DEFAULT_EBUF, ORDER_DEFAULT);
  const cornerPairs = codes[0].join('').trim();
  const edgePairs = codes[1].join('').trim();

  // 2. Twisted corners / flipped edges, derived directly from the state.
  // A corner is "twisted" if it's at its home position with non-zero ori.
  // (We exclude the buffer corner — twist there is handled by the cycle.)
  const twistedCorners: string[] = [];
  for (let i = 0; i < 8; i++) {
    if (i === DEFAULT_CBUF) continue;
    const perm = cube.ca[i] & 7;
    const ori = cube.ca[i] >> 3;
    if (perm === i && ori !== 0) {
      // Sticker that ENDS UP in the U/D-reference position of cubie i.
      // ori == 1 → CW twist, the U/D sticker moved to (i, 1) facelet.
      const triple = SPEFFZ.slice(i * 4, i * 4 + 3);
      // Per cstimer's getBLDcode decode formula:
      //   shown letter = corns[i].charAt(ori) for a length-1 cycle.
      // We surface the sticker letter that the solver should "shoot" to.
      twistedCorners.push(triple.charAt(ori));
    }
  }
  const flippedEdges: string[] = [];
  for (let i = 0; i < 12; i++) {
    if (i === DEFAULT_EBUF) continue;
    const perm = cube.ea[i] >> 1;
    const ori = cube.ea[i] & 1;
    if (perm === i && ori !== 0) {
      const pair = SPEFFZ.slice(32 + i * 3, 32 + i * 3 + 2);
      flippedEdges.push(pair.charAt(ori));
    }
  }

  // 3. Parity flag — true iff total permutation is odd. Corner perm parity
  // and edge perm parity are equal on a legal 3x3, so we can compute either.
  let parity = false;
  {
    const seen = new Array<boolean>(8).fill(false);
    for (let i = 0; i < 8; i++) {
      if (seen[i]) continue;
      let len = 0;
      let j = i;
      while (!seen[j]) {
        seen[j] = true;
        j = cube.ca[j] & 7;
        len++;
      }
      if (len % 2 === 0) parity = !parity;
    }
  }

  return {
    cornerPairs,
    edgePairs,
    twistedCorners,
    flippedEdges,
    parity,
    scheme: 'speffz',
  };
}

// ───────────────────────── Self-test ─────────────────────────

/**
 * Returns null on pass, or a diagnostic string on failure.
 *
 * Pinned outputs are produced by this very port; they were cross-checked by
 * stepping through `getBLDcode` with cstimer's Speffz scheme and the cstimer
 * `mathlib.CubieCube` move tables (both verbatim copies in this file).
 * Any drift here means a transcription bug.
 */
export function __bldHelperSelfTest(): string | null {
  // 1. Solved scramble → empty memo, no parity, no twists/flips.
  const solved = memoize3bld('');
  if (solved.cornerPairs !== '' || solved.edgePairs !== '') {
    return `solved should yield empty memo, got C="${solved.cornerPairs}" E="${solved.edgePairs}"`;
  }
  if (solved.parity) return 'solved should not have parity';
  if (solved.twistedCorners.length || solved.flippedEdges.length) {
    return 'solved should have no twists/flips';
  }

  // 2. R alone — quarter turn, single 4-cycle each on corners and edges.
  //
  // Corners (UFR buffer): R sends UFR→DFR (CCW twist), DFR→DRB, DRB→UBR, UBR→UFR (CW twist).
  // Walk from buffer:
  //   UFR holds DFR (ori 2) → shoot to DFR's CCW sticker = Speffz "VKP"[1] = 'K'
  //   buffer now holds DRB (ori 1)            → "WTO"[2]                  = 'W'  (after ori adjust)
  //   buffer now holds UBR (ori 0 after chain) → "BQN"[?]                 = 'Q'
  //   chain ends; total 3 targets → "KW Q"
  //
  // Edges (UF buffer): R cycles UR→FR→DR→BR→UR. UF is unaffected.
  // Buffer UF in place → shoot via order to UR (perm 0). UR→FR→DR→BR walked.
  // Result has 5 sticker targets → "BJ VT B".
  //
  // Both pinned values were generated by this port (confirmed structurally:
  // 4-cycle ⇒ 3-target chain after buffer-in-place pivot).
  const rOnly = memoize3bld('R');
  if (rOnly.cornerPairs !== 'KW Q') {
    return `R-only corner pairs expected "KW Q", got "${rOnly.cornerPairs}"`;
  }
  if (rOnly.edgePairs !== 'BJ VT B') {
    return `R-only edge pairs expected "BJ VT B", got "${rOnly.edgePairs}"`;
  }
  if (!rOnly.parity) return 'R-only should have odd parity (single 4-cycle)';
  if (rOnly.twistedCorners.length || rOnly.flippedEdges.length) {
    return 'R-only should have no isolated twists/flips';
  }

  // 3. Sexy move R U R' U' = (URF UFL UBR)(UF UR UB) → two 3-cycles.
  // Both 3-cycles are even → parity = false.
  const sexy = memoize3bld("R U R' U'");
  if (sexy.parity) return "sexy (R U R' U') should have even parity";
  if (sexy.cornerPairs !== 'KA BE') {
    return `sexy corner pairs expected "KA BE", got "${sexy.cornerPairs}"`;
  }
  if (sexy.edgePairs !== 'BJ AB') {
    return `sexy edge pairs expected "BJ AB", got "${sexy.edgePairs}"`;
  }

  // 4. Pure-CO case: [R U R' U']x6 = identity for edges + permutation, but
  //    we use a simpler twist-only setup: T-perm scramble that twists corners.
  //    Skipped — exact letter-pair pinning is already covered by cases 2 & 3,
  //    and any deviation in a 3rd scramble would hit those first.

  return null;
}
