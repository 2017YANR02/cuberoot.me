/**
 * Re-test the earlier "pscross looks like cross" claim with bestOrientationAlg.
 *
 * Earlier session theory: bestOrientationAlg gave crossSolved=true on a state
 * that's actually pscross. But geometrically, whole-cube rotations preserve
 * the cross-vs-side-centers offset, so crossSolved should be invariant under
 * rotation. Verify or refute.
 *
 * Test scramble + solution:
 *   scramble: B' U L' D' F' B R2 L' U F' L' D B' R' D R' D' F2
 *   solution: U L' F L R' D R
 * (User claimed pscross.)
 */
import { patternFromAlg } from '../src/utils/cube3.ts';
import { bestOrientationAlg, defaultCentersRotation } from '../src/utils/stage_detect.ts';
import { EDGE_STICKERS } from '../src/utils/sticker_tables.ts';

const scramble = "B' U L' D' F' B R2 L' U F' L' D B' R' D R' D' F2";
const sol = "U L' F L R' D R";
const state = await patternFromAlg(`${scramble} ${sol}`);

const TOPS = ['', 'x', 'x2', "x'", 'z', "z'"];
const YS = ['', 'y', 'y2', "y'"];

function crossSolvedAtFrame(p: any): boolean {
  for (const slot of [4, 5, 6, 7]) {
    const [fA, fB] = EDGE_STICKERS[slot];
    const cA = p.patternData.CENTERS.pieces[fA];
    const cB = p.patternData.CENTERS.pieces[fB];
    const sA = p.patternData.EDGES.pieces[slot];
    const sB = p.patternData.EDGES.pieces[slot]; // need actual sticker color, not piece
  }
  return false;
}

import { edgeStickerOnFace } from '../src/utils/sticker_tables.ts';
function crossOk(p: any): boolean {
  for (const slot of [4, 5, 6, 7]) {
    const [fA, fB] = EDGE_STICKERS[slot];
    const cA = p.patternData.CENTERS.pieces[fA];
    const cB = p.patternData.CENTERS.pieces[fB];
    if (edgeStickerOnFace(p, slot, fA) !== cA) return false;
    if (edgeStickerOnFace(p, slot, fB) !== cB) return false;
  }
  return true;
}
function pscrossOk(p: any): boolean {
  if (crossOk(p)) return false;
  for (const d of ['D', "D'", 'D2']) {
    if (crossOk(p.applyAlg(d))) return true;
  }
  return false;
}

console.log('Searching all 24 orientations for cross/pscross...');
for (const t of TOPS) {
  for (const y of YS) {
    const rot = [t, y].filter(Boolean).join(' ');
    const rp = rot ? state.applyAlg(rot) : state;
    const cOk = crossOk(rp);
    const pOk = pscrossOk(rp);
    if (cOk || pOk) {
      console.log(`  rot=${JSON.stringify(rot)}: cross=${cOk}, pscross=${pOk}, dColor=${rp.patternData.CENTERS.pieces[5]}`);
    }
  }
}

console.log('---');
console.log('bestOrientationAlg:', JSON.stringify(await bestOrientationAlg(state)));
console.log('defaultCentersRotation:', JSON.stringify(await defaultCentersRotation(state)));
