/** Pyraminx scramble simulator. 4 faces (F, L, R, D), 9 stickers each. */

export type PyraFace = 'F' | 'L' | 'R' | 'D';
export type PyraSticker = PyraFace;
export type PyraState = Record<PyraFace, PyraSticker[]>;

// Sticker indices per face, drawn as side-3 subdivision of a triangle:
//          0
//        1 2 3
//      4 5 6 7 8
// 0,1,3,4,6,8 are up-triangles; 2,5,7 are down-triangles.

export function pyraSolved(): PyraState {
  return {
    F: Array<PyraSticker>(9).fill('F'),
    L: Array<PyraSticker>(9).fill('L'),
    R: Array<PyraSticker>(9).fill('R'),
    D: Array<PyraSticker>(9).fill('D'),
  };
}

type Corner = 'U' | 'L' | 'R' | 'B';

// CW face order around each corner (viewed from outside the corner).
const CW_FACES: Record<Corner, [PyraFace, PyraFace, PyraFace]> = {
  U: ['F', 'R', 'L'],
  L: ['F', 'L', 'D'],
  R: ['F', 'D', 'R'],
  B: ['L', 'D', 'R'],
};

// Per face, each corner's 4-sticker block listed in matched order so that
// cycling face_a[i] -> face_b[i] -> face_c[i] (where a,b,c are CW around the
// corner) implements a 120° corner-block rotation.
//
// Local face layouts (which face-vertex carries which corner):
//   F: top=U, bot-left=L, bot-right=R
//   L: top=U, bot-left=B, bot-right=L
//   R: top=U, bot-left=R, bot-right=B
//   D: top=B, bot-left=L, bot-right=R
//
// For a face vertex at idx-0 (top of face), the 4 block indices in
// [tip, "left-edge"=toward CW-prev face, mid=center down-tri, "right-edge"=toward CW-next face]
// match the face-local geometry. For idx-4 (bot-left) and idx-8 (bot-right)
// vertices we mirror similarly.
const BLOCK: Record<PyraFace, Partial<Record<Corner, [number, number, number, number]>>> = {
  // F: U at top (0); CW around U from outside is F -> R -> L. So on F, the
  // edge "toward CW-next" (R) is the right edge of F = idx 3. "Toward CW-prev" (L) = idx 1.
  F: {
    U: [0, 1, 2, 3],
    // L at idx 4 of F. CW around L (from outside): F -> L -> D.
    //   F's edge toward L-face (CW-next) = the F/L edge = F's left edge = idx 1 region.
    //   F's edge toward D (CW-prev) = bottom edge = idx 6 region.
    // tip=4, "toward CW-next"=1, mid=5 (down-tri), "toward CW-prev"=6.
    L: [4, 1, 5, 6],
    // R at idx 8 of F. CW around R: F -> D -> R.
    //   F's edge toward D (CW-next) = bottom edge = idx 6 region.
    //   F's edge toward R-face (CW-prev) = right edge = idx 3 region.
    R: [8, 6, 7, 3],
  },
  L: {
    // U at idx 0 of L. CW around U: F -> R -> L. On face L, "CW-next" relative to L = F (since F follows L cycling F->R->L->F? CW order is F,R,L meaning after L comes F).
    //   L's edge toward F-face (CW-next) = ... face L's right edge connects to face F's left edge. So idx 3 region.
    //   L's edge toward R-face (CW-prev) = ... L doesn't share an edge with R directly in our layout. Hmm.
    // Reconsider: face L touches faces F and D directly (sharing edges with F via the U-L corner and with D via the L-B corner). It also shares edges with R via the U-B... no wait, face L and face R do not share an edge. They are opposite-ish.
    // Looking at the tetrahedron: 4 faces, each sharing an edge with each of the other 3. So every pair of faces shares an edge!
    //   F-L share the edge between corner U and corner L.
    //   F-R share the edge between corner U and corner R.
    //   F-D share the edge between corner L and corner R.
    //   L-R share the edge between corner U and corner B.
    //   L-D share the edge between corner L and corner B.
    //   R-D share the edge between corner R and corner B.
    // ✓ 6 edges, one per pair.
    // So L IS adjacent to R, sharing the U-B edge.
    // On face L (layout: U top, B bot-left, L bot-right): the U-B edge is the LEFT edge of L. So idx 1 region.
    //   L's right edge (idx 3 region) connects to face F.
    //   L's bottom edge (idx 6 region) connects to face D.
    //   L's left edge (idx 1 region) connects to face R.
    // U at idx 0 of L. CW around U: F -> R -> L. On L, edge toward CW-next (F) = right edge = idx 3.
    //   Edge toward CW-prev (R) = left edge = idx 1.
    U: [0, 3, 2, 1],
    // B at idx 4 of L (bot-left). CW around B: L -> D -> R.
    //   On L, edge toward CW-next (D) = bottom = idx 6.
    //   Edge toward CW-prev: B is the FIRST in the CW cycle for L's perspective starting from L itself. CW-prev relative to L in the cycle (L,D,R) wrapping: prev of L is R. So edge toward R = left edge = idx 1.
    B: [4, 6, 5, 1],
    // L at idx 8 of L (bot-right). CW around L: F -> L -> D.
    //   On L, edge toward CW-next (D) = bottom = idx 6.
    //   Edge toward CW-prev (F) = right edge = idx 3.
    L: [8, 6, 7, 3],
  },
  R: {
    // R layout: U top, R bot-left, B bot-right.
    //   R's right edge = idx 3 region: connects to L (U-B edge)
    //   R's left edge = idx 1 region: connects to F (U-R edge)
    //   R's bottom edge = idx 6 region: connects to D (R-B edge)
    // U at idx 0. CW around U: F -> R -> L. On R, CW-next (L) = right edge = idx 3, CW-prev (F) = left edge = idx 1.
    U: [0, 1, 2, 3],
    // R at idx 4 of R (bot-left). CW around R: F -> D -> R.
    //   CW-next (R-self): wraps to F. Edge toward F = left edge = idx 1.
    //   CW-prev (D): bottom edge = idx 6.
    // Hmm. tip=4, [toward CW-next, mid, toward CW-prev] = [1, 5, 6].
    R: [4, 1, 5, 6],
    // B at idx 8 of R (bot-right). CW around B: L -> D -> R.
    //   CW-next (R-self) wraps to L. Edge toward L = right edge of R = idx 3.
    //   CW-prev (D) = bottom edge = idx 6.
    B: [8, 3, 7, 6],
  },
  D: {
    // D layout: B top, L bot-left, R bot-right.
    //   D's right edge (idx 3 region): connects to R (R-B edge)
    //   D's left edge (idx 1 region): connects to L (L-B edge)
    //   D's bottom edge (idx 6 region): connects to F (L-R edge)
    // B at idx 0 of D. CW around B: L -> D -> R. On D, CW-next (R) = right edge = idx 3, CW-prev (L) = left edge = idx 1.
    B: [0, 1, 2, 3],
    // L at idx 4 of D (bot-left). CW around L: F -> L -> D.
    //   D-self in cycle: CW-next wraps to F. Edge toward F = bottom edge = idx 6.
    //   CW-prev (L) = left edge = idx 1.
    L: [4, 6, 5, 1],
    // R at idx 8 of D (bot-right). CW around R: F -> D -> R.
    //   D-self wraps to F via CW-next: F is CW-prev of D. So CW-next (R) = right edge = idx 3, CW-prev (F) = bottom edge = idx 6.
    // Hmm wait, in cycle F -> D -> R: D's CW-next is R, CW-prev is F.
    R: [8, 3, 7, 6],
  },
};

// Tip-only stickers per corner across the 3 CW faces.
const TIP_IDX: Record<Corner, [number, number, number]> = {
  // For each corner, the tip sticker's index on each of CW_FACES[corner].
  U: [0, 0, 0], // tip is at idx 0 on F, R, L
  L: [4, 8, 4], // F has L at idx 4, L-face has L at idx 8, D has L at idx 4
  R: [8, 4, 4], // F has R at idx 8, D has R at idx 8? wait CW_FACES[R]=[F,D,R]. F:R=8, D:R=8, R-face:R=4.
  B: [4, 0, 8], // CW_FACES[B]=[L,D,R]. L-face:B=4, D:B=0, R-face:B=8.
};
// Fix R: CW_FACES[R]=[F,D,R]. F:R=8, D:R=8, R-face:R=4. So [8, 8, 4].
TIP_IDX.R = [8, 8, 4];

function cycleCW3<T>(arr: [T, T, T]): [T, T, T] {
  return [arr[2], arr[0], arr[1]];
}

function applyTip(state: PyraState, corner: Corner, dir: 1 | -1): void {
  const faces = CW_FACES[corner];
  const idxs = TIP_IDX[corner];
  const vals: [PyraSticker, PyraSticker, PyraSticker] = [
    state[faces[0]][idxs[0]],
    state[faces[1]][idxs[1]],
    state[faces[2]][idxs[2]],
  ];
  const next = dir === 1 ? cycleCW3(vals) : cycleCW3(cycleCW3(vals));
  state[faces[0]][idxs[0]] = next[0];
  state[faces[1]][idxs[1]] = next[1];
  state[faces[2]][idxs[2]] = next[2];
}

function applyBlock(state: PyraState, corner: Corner, dir: 1 | -1): void {
  const faces = CW_FACES[corner];
  for (let i = 0; i < 4; i++) {
    const b0 = BLOCK[faces[0]][corner];
    const b1 = BLOCK[faces[1]][corner];
    const b2 = BLOCK[faces[2]][corner];
    if (!b0 || !b1 || !b2) continue;
    const vals: [PyraSticker, PyraSticker, PyraSticker] = [
      state[faces[0]][b0[i]],
      state[faces[1]][b1[i]],
      state[faces[2]][b2[i]],
    ];
    const next = dir === 1 ? cycleCW3(vals) : cycleCW3(cycleCW3(vals));
    state[faces[0]][b0[i]] = next[0];
    state[faces[1]][b1[i]] = next[1];
    state[faces[2]][b2[i]] = next[2];
  }
}

function isCorner(c: string): c is Corner {
  return c === 'U' || c === 'L' || c === 'R' || c === 'B';
}

function applyMove(state: PyraState, raw: string): void {
  if (!raw) return;
  const head = raw[0];
  const isTip = head === head.toLowerCase();
  const corner = head.toUpperCase();
  if (!isCorner(corner)) return;
  const suffix = raw.slice(1);
  const dir: 1 | -1 = suffix.includes("'") ? -1 : 1;
  const reps = suffix.includes('2') ? 2 : 1;
  for (let i = 0; i < reps; i++) {
    if (isTip) applyTip(state, corner, dir);
    else applyBlock(state, corner, dir);
  }
}

export function applyPyraScramble(scramble: string): PyraState {
  const state = pyraSolved();
  if (!scramble) return state;
  for (const t of scramble.split(/\s+/).filter(Boolean)) applyMove(state, t);
  return state;
}
