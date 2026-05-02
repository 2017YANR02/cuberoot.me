// Probe: verify sticker-color-aware slot/cross detection matches expected
// behavior on rotation-only and partially-solved cubes.

import { cube3x3x3 } from 'cubing/puzzles';

const kp = await cube3x3x3.kpuzzle();
const solved = kp.defaultPattern();

// Color codes 0..5 = U,R,F,L,B,D = W,R,G,O,B,Y
const EDGE_STICKERS = [
  [0, 2], [0, 1], [0, 4], [0, 3],   // UF, UR, UB, UL
  [5, 2], [5, 1], [5, 4], [5, 3],   // DF, DR, DB, DL
  [2, 1], [2, 3], [4, 1], [4, 3],   // FR, FL, BR, BL
];
const EDGE_SLOT_FACES = [
  [0, 2], [0, 1], [0, 4], [0, 3],
  [5, 2], [5, 1], [5, 4], [5, 3],
  [2, 1], [2, 3], [4, 1], [4, 3],
];

const CORNER_SLOT_FACES = [
  [0, 1, 2], [0, 4, 1], [0, 3, 4], [0, 2, 3],   // UFR, UBR, UBL, UFL
  [5, 2, 1], [5, 3, 2], [5, 4, 3], [5, 1, 4],   // DFR, DFL, DBL, DBR
];
// Piece N's sticker colors in canonical order = same shape as slot face order
const CORNER_STICKERS = CORNER_SLOT_FACES;

function edgeStickerOnFace(p, slot, face) {
  const piece = p.patternData.EDGES.pieces[slot];
  const ori = p.patternData.EDGES.orientation[slot] ?? 0;
  const [pPri, pSec] = EDGE_STICKERS[piece];
  const [sPri, sSec] = EDGE_SLOT_FACES[slot];
  if (face === sPri) return ori === 0 ? pPri : pSec;
  if (face === sSec) return ori === 0 ? pSec : pPri;
  return null;
}
function cornerStickerOnFace(p, slot, face) {
  const piece = p.patternData.CORNERS.pieces[slot];
  const ori = p.patternData.CORNERS.orientation[slot] ?? 0;
  const slotFaces = CORNER_SLOT_FACES[slot];
  const pieceStickers = CORNER_STICKERS[piece];
  const j = slotFaces.indexOf(face);
  if (j < 0) return null;
  const i = (j + 3 - ori) % 3;
  return pieceStickers[i];
}
function edgeSolved(p, slot) {
  const c = p.patternData.CENTERS.pieces;
  const [f1, f2] = EDGE_SLOT_FACES[slot];
  return edgeStickerOnFace(p, slot, f1) === c[f1]
      && edgeStickerOnFace(p, slot, f2) === c[f2];
}
function cornerSolved(p, slot) {
  const c = p.patternData.CENTERS.pieces;
  const [f1, f2, f3] = CORNER_SLOT_FACES[slot];
  return cornerStickerOnFace(p, slot, f1) === c[f1]
      && cornerStickerOnFace(p, slot, f2) === c[f2]
      && cornerStickerOnFace(p, slot, f3) === c[f3];
}
function crossSolved(p) {
  return edgeSolved(p, 4) && edgeSolved(p, 5) && edgeSolved(p, 6) && edgeSolved(p, 7);
}
const F2L_DEFS = [
  ['FR', 4, 8], ['FL', 5, 9], ['BL', 6, 11], ['BR', 7, 10],
];
function slotsSolved(p) {
  return F2L_DEFS.filter(([_, c, e]) => edgeSolved(p, e) && cornerSolved(p, c)).map(([id]) => id);
}

const cases = [
  // Identity / rotations: all should report cross + 4 slots
  { label: 'solved', alg: '' },
  { label: 'x', alg: 'x' },
  { label: "x'", alg: "x'" },
  { label: 'x2', alg: 'x2' },
  { label: 'y', alg: 'y' },
  { label: 'z', alg: 'z' },
  { label: "x' y", alg: "x' y" },
  // Partial solves
  { label: 'R (breaks FR/BR)', alg: 'R' },
  { label: 'sune (top scrambled, F2L intact)', alg: "R U R' U R U2 R'" },
  // Ground truth scramble + cross from recon-1
  { label: 'recon-1 cross only',
    alg: "F U2 R' F2 L' B2 D2 R D2 U2 B D R' U' F2 L' R2 F' x' (D U') L l D' L'".replace(/[()]/g,'') },
  // recon-1 cross + 1st pair
  { label: 'recon-1 cross + 1st pair',
    alg: "F U2 R' F2 L' B2 D2 R D2 U2 B D R' U' F2 L' R2 F' x' D U' L l D' L' U' R' U' R" },
];

for (const { label, alg } of cases) {
  const p = alg ? solved.applyAlg(alg) : solved;
  console.log(`${label.padEnd(40)} cross=${crossSolved(p)} slots=[${slotsSolved(p).join(',')}]`);
}
