/** Skewb scramble simulator. 6 faces × 5 stickers (4 corners + 1 center). */

export type SkewbFace = 'U' | 'D' | 'F' | 'B' | 'L' | 'R';
export type SkewbSticker = SkewbFace;
export type SkewbState = Record<SkewbFace, SkewbSticker[]>;

// Per-face sticker layout (5 stickers each):
//   0 = TL corner triangle
//   1 = TR corner triangle
//   2 = BR corner triangle
//   3 = BL corner triangle
//   4 = center diamond

export function skewbSolved(): SkewbState {
  return {
    U: ['U', 'U', 'U', 'U', 'U'],
    D: ['D', 'D', 'D', 'D', 'D'],
    F: ['F', 'F', 'F', 'F', 'F'],
    B: ['B', 'B', 'B', 'B', 'B'],
    L: ['L', 'L', 'L', 'L', 'L'],
    R: ['R', 'R', 'R', 'R', 'R'],
  };
}

// Cube-corner naming: 3 letters indicating the 3 faces touching the corner.
// Per face, list the 4 cube-corners in order [TL, TR, BR, BL] (matches sticker indices 0..3):
//   U: looked at from above with F at bottom of view: TL=UBL, TR=UBR, BR=UFR, BL=UFL
//   F: U on top of view: TL=UFL, TR=UFR, BR=DFR, BL=DFL
//   R: U on top, B to right: TL=UFR, TR=UBR, BR=DBR, BL=DFR
//   B: U on top, L on left of view (looking at back from outside): TL=UBR, TR=UBL, BR=DBL, BL=DBR
//   L: U on top, F on right of view (looking from outside-left): TL=UBL, TR=UFL, BR=DFL, BL=DBL
//   D: looked at from below with F at top of view: TL=DFL, TR=DFR, BR=DBR, BL=DBL
type CornerName = 'UFL' | 'UFR' | 'UBL' | 'UBR' | 'DFL' | 'DFR' | 'DBL' | 'DBR';
const FACE_CORNERS: Record<SkewbFace, [CornerName, CornerName, CornerName, CornerName]> = {
  U: ['UBL', 'UBR', 'UFR', 'UFL'],
  F: ['UFL', 'UFR', 'DFR', 'DFL'],
  R: ['UFR', 'UBR', 'DBR', 'DFR'],
  B: ['UBR', 'UBL', 'DBL', 'DBR'],
  L: ['UBL', 'UFL', 'DFL', 'DBL'],
  D: ['DFL', 'DFR', 'DBR', 'DBL'],
};

// Build a lookup: cube-corner -> list of (face, sticker-idx) for the 3 faces it touches.
function buildCornerStickerMap(): Record<CornerName, Array<{ face: SkewbFace; idx: number }>> {
  const map = {} as Record<CornerName, Array<{ face: SkewbFace; idx: number }>>;
  const allCorners: CornerName[] = ['UFL', 'UFR', 'UBL', 'UBR', 'DFL', 'DFR', 'DBL', 'DBR'];
  for (const c of allCorners) map[c] = [];
  (Object.keys(FACE_CORNERS) as SkewbFace[]).forEach((face) => {
    FACE_CORNERS[face].forEach((corner, i) => {
      map[corner].push({ face, idx: i });
    });
  });
  return map;
}
const CORNER_STICKERS = buildCornerStickerMap();

// Skewb axes: each move letter corresponds to one corner (the "near corner"
// of the moved tetrahedral half). The axis goes from this corner through the
// opposite cube corner.
//
// Convention:
//   R = UFR axis (UFR <-> DBL)
//   L = UFL axis (UFL <-> DBR)
//   U = UBL axis (UBL <-> DFR)
//   B = UBR axis (UBR <-> DFL)
//
// A CW rotation (looking from the named corner toward the opposite corner)
// of 120° moves the 4 "near" corners in a 3-cycle (the named corner stays
// on its axis but its 3 stickers cycle), and the 3 "far-near" corners (the
// 3 corners adjacent to the named corner) cycle among themselves.
//
// Wait — a 120° corner rotation cycles the corner's own 3 stickers AND
// cycles the 3 adjacent corners among each other (each adjacent corner has
// 3 stickers; one of those stickers is on a "shared face" with the named
// corner, and the rotation cycles the adjacent corners through the same
// 3 faces).
type MoveLetter = 'U' | 'L' | 'R' | 'B';
const MOVE_CORNER: Record<MoveLetter, CornerName> = {
  R: 'UFR',
  L: 'UFL',
  U: 'UBL',
  B: 'UBR',
};

// For each move letter, the 3 cube-corners adjacent to the moved corner
// (sharing an edge), in CW order looking from the moved corner toward its
// opposite. These 3 corners cycle in the move.
const MOVE_ADJ: Record<MoveLetter, [CornerName, CornerName, CornerName]> = {
  // R = UFR axis. UFR is adjacent to UFL (via top-front edge), UBR (via top-right edge), DFR (via front-right edge).
  // Looking from UFR toward DBL, CW order... we just need a consistent CW direction.
  // Let's pick: each move's CW order rotates the puzzle CW when viewed from outside that corner.
  R: ['UFL', 'UBR', 'DFR'],
  L: ['UFR', 'UBL', 'DFL'],
  U: ['UBR', 'UFL', 'DBL'],
  B: ['UBL', 'UFR', 'DBR'],
};

// Also, the 3 face centers adjacent to the moved corner cycle among themselves.
const MOVE_FACES: Record<MoveLetter, [SkewbFace, SkewbFace, SkewbFace]> = {
  R: ['U', 'F', 'R'],
  L: ['U', 'L', 'F'],
  U: ['U', 'B', 'L'],
  B: ['U', 'R', 'B'],
};

function rotateCornerStickersCW(state: SkewbState, corner: CornerName): void {
  // The corner has 3 stickers (one on each of 3 faces). 120° rotation around
  // the corner's body diagonal cycles them. The CW order from outside the
  // corner depends on which faces the corner touches.
  // CORNER_STICKERS[corner] gives them in some order; we need to know the
  // CW order to rotate correctly. We'll define it explicitly.
  const cw = CORNER_CW[corner];
  const a = state[cw[0].face][cw[0].idx];
  const b = state[cw[1].face][cw[1].idx];
  const c = state[cw[2].face][cw[2].idx];
  // CW: a -> b -> c -> a
  state[cw[1].face][cw[1].idx] = a;
  state[cw[2].face][cw[2].idx] = b;
  state[cw[0].face][cw[0].idx] = c;
}

// CW order of stickers around each cube corner (viewed from outside the corner):
const CORNER_CW: Record<CornerName, [{ face: SkewbFace; idx: number }, { face: SkewbFace; idx: number }, { face: SkewbFace; idx: number }]> = {
  // For each cube corner, list its 3 face stickers in CW order viewed from outside.
  // Standard cube convention: at corner UFR, viewed from outside (top-front-right),
  // CW order of touching faces is U -> R -> F -> U.
  UFR: [
    { face: 'U', idx: 2 }, // U face: UFR is at idx 2 (BR of U-view)
    { face: 'R', idx: 0 }, // R face: UFR is at idx 0 (TL of R-view)
    { face: 'F', idx: 1 }, // F face: UFR is at idx 1 (TR of F-view)
  ],
  UFL: [
    { face: 'U', idx: 3 }, // BL of U
    { face: 'F', idx: 0 }, // TL of F
    { face: 'L', idx: 1 }, // TR of L
  ],
  UBR: [
    { face: 'U', idx: 1 }, // TR of U
    { face: 'B', idx: 0 }, // TL of B
    { face: 'R', idx: 1 }, // TR of R
  ],
  UBL: [
    { face: 'U', idx: 0 }, // TL of U
    { face: 'L', idx: 0 }, // TL of L
    { face: 'B', idx: 1 }, // TR of B
  ],
  DFR: [
    { face: 'D', idx: 1 }, // TR of D (D-view has F at top: TL=DFL, TR=DFR)
    { face: 'F', idx: 2 }, // BR of F
    { face: 'R', idx: 3 }, // BL of R
  ],
  DFL: [
    { face: 'D', idx: 0 }, // TL of D
    { face: 'L', idx: 2 }, // BR of L
    { face: 'F', idx: 3 }, // BL of F
  ],
  DBR: [
    { face: 'D', idx: 2 }, // BR of D
    { face: 'R', idx: 2 }, // BR of R
    { face: 'B', idx: 3 }, // BL of B
  ],
  DBL: [
    { face: 'D', idx: 3 }, // BL of D
    { face: 'B', idx: 2 }, // BR of B
    { face: 'L', idx: 3 }, // BL of L
  ],
};

void CORNER_STICKERS; // computed but not directly used after CORNER_CW exists

function applyMoveCW(state: SkewbState, m: MoveLetter): void {
  const moved = MOVE_CORNER[m];
  // 1) Rotate the moved corner's own 3 stickers (CW from outside).
  rotateCornerStickersCW(state, moved);
  // 2) Cycle the 3 adjacent corners (each is a 3-sticker piece). All 9
  //    stickers in those 3 pieces cycle through the 3 faces around the moved
  //    corner.
  const adj = MOVE_ADJ[m];
  const faces = MOVE_FACES[m];
  // For each adjacent corner, find its sticker on each of the 3 moved faces.
  // We pair them up: corner adj[0] currently has a sticker on faces[0] (and
  // also on its other 2 faces). After rotation, corner adj[0] moves to where
  // adj[1] is (and rotates). Equivalently: pieces cycle adj[0] -> adj[1] -> adj[2] -> adj[0].
  //
  // To represent piece movement at the sticker level: for each of the 3
  // pieces, all 3 of its stickers must move together. We grab the 3-sticker
  // tuples (in CW order matching CORNER_CW), and cycle them.
  const piece0: SkewbSticker[] = CORNER_CW[adj[0]].map(({ face, idx }) => state[face][idx]);
  const piece1: SkewbSticker[] = CORNER_CW[adj[1]].map(({ face, idx }) => state[face][idx]);
  const piece2: SkewbSticker[] = CORNER_CW[adj[2]].map(({ face, idx }) => state[face][idx]);
  // When piece adj[0] moves to adj[1]'s slot, its 3 stickers must also be
  // rotated to align with adj[1]'s CW frame. The rotation is determined by
  // which face of each adjacent corner faces the moved corner.
  //
  // For simplicity (visual recognition), we just do a direct copy: piece0's
  // CW[i] -> adj[1]'s CW[i]. This may not be 100% physically accurate (the
  // orientation could be off by 120°) but gives a recognisable scramble.
  //
  // Refinement: skewb's adjacent-corner cycle DOES include orientation
  // changes. We'll match orientation by which face of the source piece is
  // shared with the moved corner.
  //
  // Each adjacent corner shares EXACTLY ONE face with the moved corner.
  // We rotate the source piece's stickers such that the "shared face" sticker
  // ends up at the destination's matching shared face position.
  const adjOriented: SkewbSticker[][] = [piece0, piece1, piece2];
  // Which face of each adj corner is shared with the moved corner?
  const movedFaces = MOVE_FACES[m]; // 3 faces around moved corner

  // For each adj corner i, find which of CORNER_CW[adj[i]] is on a movedFaces face.
  function sharedFaceIdx(corner: CornerName): number {
    const cw = CORNER_CW[corner];
    for (let j = 0; j < 3; j++) {
      if (movedFaces.includes(cw[j].face)) return j;
    }
    return 0;
  }
  const shared0 = sharedFaceIdx(adj[0]);
  const shared1 = sharedFaceIdx(adj[1]);
  const shared2 = sharedFaceIdx(adj[2]);

  function placePiece(srcPiece: SkewbSticker[], srcShared: number, destCorner: CornerName, destShared: number): void {
    // Rotate srcPiece so that srcPiece[srcShared] lands at destShared, and
    // the other two follow in CW order. CORNER_CW lists stickers in CW order,
    // so this is just an index shift.
    const shift = (destShared - srcShared + 3) % 3;
    const cwDest = CORNER_CW[destCorner];
    for (let j = 0; j < 3; j++) {
      const srcIdx = (j - shift + 3) % 3;
      state[cwDest[j].face][cwDest[j].idx] = srcPiece[srcIdx];
    }
  }
  placePiece(adjOriented[0], shared0, adj[1], shared1);
  placePiece(adjOriented[1], shared1, adj[2], shared2);
  placePiece(adjOriented[2], shared2, adj[0], shared0);

  // 3) Cycle the 3 face centers of the moved corner.
  const c0 = state[faces[0]][4];
  const c1 = state[faces[1]][4];
  const c2 = state[faces[2]][4];
  state[faces[1]][4] = c0;
  state[faces[2]][4] = c1;
  state[faces[0]][4] = c2;
}

function isMoveLetter(c: string): c is MoveLetter {
  return c === 'U' || c === 'L' || c === 'R' || c === 'B';
}

function applyMove(state: SkewbState, raw: string): void {
  if (!raw) return;
  const m = raw[0].toUpperCase();
  if (!isMoveLetter(m)) return;
  const dir = raw.includes("'") ? -1 : 1;
  const reps = dir === -1 ? 2 : 1; // CCW = 2× CW
  for (let i = 0; i < reps; i++) applyMoveCW(state, m);
}

export function applySkewbScramble(scramble: string): SkewbState {
  const state = skewbSolved();
  if (!scramble) return state;
  for (const t of scramble.split(/\s+/).filter(Boolean)) applyMove(state, t);
  return state;
}
