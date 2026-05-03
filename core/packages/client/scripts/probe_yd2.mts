// Quick check: does y · D2 == D2 · y? And what does state · D2 look like?
import { patternFromAlg } from '../src/utils/cube3';

const a = await patternFromAlg("y D2");
const b = await patternFromAlg("D2 y");
const same = JSON.stringify(a.patternData) === JSON.stringify(b.patternData);
console.log("y D2 == D2 y:", same);

// User's state
const sc = "B' U L' D' F' B R2 L' U F' L' D B' R' D R' D' F2 U L' F L R' D R";
const state = await patternFromAlg(sc);
const sD2 = state.applyAlg("D2");

import { edgeStickerOnFace as esf, EDGE_STICKERS as ES } from '../src/utils/sticker_tables';
function ck(p: typeof state) {
  for (let s = 4; s <= 7; s++) {
    const [fA, fB] = ES[s];
    if (esf(p, s, fA) !== p.patternData.CENTERS.pieces[fA]) return false;
    if (esf(p, s, fB) !== p.patternData.CENTERS.pieces[fB]) return false;
  }
  return true;
}

console.log('\nstate · D2 crossOk at all 24 rotations:');
const tops = ['', 'x', 'x2', "x'", 'z', "z'"];
const ys = ['', 'y', 'y2', "y'"];
for (const t of tops) for (const y of ys) {
  const r = [t, y].filter(Boolean).join(' ');
  const rs = r ? sD2.applyAlg(r) : sD2;
  if (ck(rs)) console.log(`  rot="${r||'_'}": OK`);
}
