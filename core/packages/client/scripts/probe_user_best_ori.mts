import { patternFromAlg } from '../src/utils/cube3.ts';
import { bestOrientationAlg, defaultCentersRotation } from '../src/utils/stage_detect.ts';
import { EDGE_STICKERS, edgeStickerOnFace, CORNER_STICKERS, cornerStickerOnFace } from '../src/utils/sticker_tables.ts';

const scramble = "F2 L' U2 R' F L B F' D U2 R' D2 U L' U R' F' U";
const sol = "y z' x' F D U' r U D R' D2";
const p = await patternFromAlg(`${scramble} ${sol}`);

const TOPS = ['', 'x', 'x2', "x'", 'z', "z'"];
const YS = ['', 'y', 'y2', "y'"];

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

console.log('All 24 rotations on user state:');
for (const t of TOPS) {
  for (const y of YS) {
    const rot = [t, y].filter(Boolean).join(' ');
    const rp = rot ? p.applyAlg(rot) : p;
    const c = crossOk(rp);
    const ps = pscrossOk(rp);
    if (c || ps) {
      console.log(`  ${JSON.stringify(rot.padEnd(10))}: cross=${c}, pscross=${ps}`);
    }
  }
}

console.log('\nbestOrientationAlg:', JSON.stringify(await bestOrientationAlg(p)));
console.log('defaultCentersRotation:', JSON.stringify(await defaultCentersRotation(p)));
