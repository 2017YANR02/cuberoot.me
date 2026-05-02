// Verify src/utils/sticker_tables.ts against actual cubing.js cube3x3x3 behavior.
//
// We test that for any rotation/scramble of the solved cube, there EXISTS some
// puzzle orientation in which all 6 faces look uniform (= the cube is solved
// modulo rotation). This is the same trick stage_detect.bestOrientation uses.
// If our sticker tables are correct, we'll always find a "fully solved" view.
//
// Then we test partial scrambles: e.g., R only breaks the FR/BR slots and
// nothing else (in some canonical orientation).
//
// Run: `node scripts/verify_sticker_tables.mjs`

import { cube3x3x3 } from 'cubing/puzzles';

const EDGE_STICKERS = [
  [0, 2], [0, 1], [0, 4], [0, 3],
  [5, 2], [5, 1], [5, 4], [5, 3],
  [2, 1], [2, 3], [4, 1], [4, 3],
];
const CORNER_STICKERS = [
  [0, 1, 2], [0, 4, 1], [0, 3, 4], [0, 2, 3],
  [5, 2, 1], [5, 3, 2], [5, 4, 3], [5, 1, 4],
];

function edgeStickerOnFace(p, slot, face) {
  const piece = p.patternData.EDGES.pieces[slot];
  const ori = p.patternData.EDGES.orientation[slot] ?? 0;
  const [sFa, sFb] = EDGE_STICKERS[slot];
  const [pSa, pSb] = EDGE_STICKERS[piece];
  if (face === sFa) return ori === 0 ? pSa : pSb;
  if (face === sFb) return ori === 0 ? pSb : pSa;
  return null;
}
function cornerStickerOnFace(p, slot, face) {
  const piece = p.patternData.CORNERS.pieces[slot];
  const ori = p.patternData.CORNERS.orientation[slot] ?? 0;
  const slotFaces = CORNER_STICKERS[slot];
  const j = slotFaces.indexOf(face);
  if (j < 0) return null;
  const i = (j + 3 - ori) % 3;
  return CORNER_STICKERS[piece][i];
}
function centerColorAtFace(p, face) {
  return p.patternData.CENTERS.pieces[face];
}

function edgeSolved(p, slot) {
  const [fA, fB] = EDGE_STICKERS[slot];
  return edgeStickerOnFace(p, slot, fA) === centerColorAtFace(p, fA)
      && edgeStickerOnFace(p, slot, fB) === centerColorAtFace(p, fB);
}
function cornerSolved(p, slot) {
  const [fA, fB, fC] = CORNER_STICKERS[slot];
  return cornerStickerOnFace(p, slot, fA) === centerColorAtFace(p, fA)
      && cornerStickerOnFace(p, slot, fB) === centerColorAtFace(p, fB)
      && cornerStickerOnFace(p, slot, fC) === centerColorAtFace(p, fC);
}
function fullySolved(p) {
  for (let i = 0; i < 12; i++) if (!edgeSolved(p, i)) return false;
  for (let i = 0; i < 8; i++) if (!cornerSolved(p, i)) return false;
  return true;
}

const TOPS = ['', 'x', 'x2', "x'", 'z', "z'"];
const YS = ['', 'y', 'y2', "y'"];
const ROTATIONS = [];
for (const t of TOPS) for (const y of YS) {
  const composed = [t, y].filter(Boolean).join(' ');
  ROTATIONS.push(composed);
}

// Find the rotation under which `pattern` looks "fully solved" (all stickers
// match centers). For a cube that's truly solved (modulo rotation), exactly
// one of the 24 rotations will work.
function findSolvedOrientation(pattern) {
  for (const rot of ROTATIONS) {
    const t = rot ? pattern.applyAlg(rot) : pattern;
    if (fullySolved(t)) return rot || '(identity)';
  }
  return null;
}

const kp = await cube3x3x3.kpuzzle();
const solved = kp.defaultPattern();

let failures = 0;

// 1. Solved + every rotation alone should still be "solved modulo rotation".
const ROTATION_TESTS = ['', 'x', "x'", 'x2', 'y', "y'", 'y2', 'z', "z'", 'z2',
  "x' y", 'y x', 'x y z', 'y2 x'];
for (const rot of ROTATION_TESTS) {
  const p = rot ? solved.applyAlg(rot) : solved;
  const found = findSolvedOrientation(p);
  if (!found) {
    console.error(`✗ rot "${rot}": NO orientation makes the cube look solved`);
    failures++;
  }
}

// 2. Sune leaves F2L solved but top scrambled. Should still be "solved modulo
// orientation" only at the rotation that brings centers to canonical AND
// requires no top permutation. Actually after sune the cube isn't fully solved
// — top is OLL+PLL'd. So findSolvedOrientation will return null. Instead test:
// after sune+sune+sune (= pll skip back to solved? actually sune order is 6),
// the cube should be fully solvable from some orientation. Let's just test
// sune × 6 (returns to identity).
const sune6 = solved.applyAlg("R U R' U R U2 R' R U R' U R U2 R' R U R' U R U2 R' R U R' U R U2 R' R U R' U R U2 R' R U R' U R U2 R'");
if (!findSolvedOrientation(sune6)) {
  console.error('✗ sune × 6 should return to solved but no orientation worked');
  failures++;
}

// 3. After R move, F2L slots FL and BL should still be solved (the L-side
// slots aren't touched by R). cross is broken (DR/BR edges moved) so
// findSolvedOrientation returns null, but slotSolved on FL/BL should still
// be true in the canonical (no-rotation) orientation.
const r1 = solved.applyAlg('R');
// We need a "canonical" check. After R alone, no rotation needed (centers
// unchanged). So check directly.
if (!edgeSolved(r1, 9) || !cornerSolved(r1, 5)) { // FL slot edge=9, corner=5
  console.error('✗ post-R: FL slot should still be solved');
  failures++;
}
if (!edgeSolved(r1, 11) || !cornerSolved(r1, 6)) { // BL slot edge=11, corner=6
  console.error('✗ post-R: BL slot should still be solved');
  failures++;
}
if (edgeSolved(r1, 8) && cornerSolved(r1, 4)) { // FR
  console.error('✗ post-R: FR slot should NOT be solved');
  failures++;
}

// 4. After F move, FL slot is broken (F touches FL corner+edge); BR/BL/FR
// at least partially intact. Test some untouched slots.
const f1 = solved.applyAlg('F');
// L-side cross edges (DL, slot 7) shouldn't be touched by F.
if (!edgeSolved(f1, 7)) {
  console.error('✗ post-F: DL cross-edge should still be solved');
  failures++;
}
// BR slot (corner 7, edge 10) shouldn't be touched by F.
if (!edgeSolved(f1, 10) || !cornerSolved(f1, 7)) {
  console.error('✗ post-F: BR slot should still be solved');
  failures++;
}

if (failures === 0) {
  console.log('✓ all sticker-table predictions match cubing.js cube3x3x3 KPuzzle behavior');
} else {
  console.error(`\n${failures} failure(s) — sticker_tables.ts is out of sync with cubing.js`);
  process.exit(1);
}
