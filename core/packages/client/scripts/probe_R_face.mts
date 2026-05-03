import { getCube3 } from '../src/utils/cube3.ts';
import { EDGE_STICKERS, edgeStickerOnFace, CORNER_STICKERS, cornerStickerOnFace } from '../src/utils/sticker_tables.ts';

const kp = await getCube3();
const solved = kp.defaultPattern();

// solved + R: right face still all red (since R doesn't change R-face stickers)
const afterR = solved.applyAlg('R');
console.log('After R turn — R-face stickers (should all be Red=1):');
for (let slot = 0; slot < 12; slot++) {
  const [fA, fB] = EDGE_STICKERS[slot];
  if (fA === 1) console.log(`  edge slot ${slot} R-face: ${edgeStickerOnFace(afterR, slot, 1)}`);
  if (fB === 1) console.log(`  edge slot ${slot} R-face: ${edgeStickerOnFace(afterR, slot, 1)}`);
}
for (let slot = 0; slot < 8; slot++) {
  if (CORNER_STICKERS[slot].includes(1)) {
    console.log(`  corner slot ${slot} R-face: ${cornerStickerOnFace(afterR, slot, 1)}`);
  }
}

// R-face center
console.log(`  R-face center: ${afterR.patternData.CENTERS.pieces[1]}`);
console.log('Pieces:', [...afterR.patternData.EDGES.pieces]);
console.log('Orient:', [...afterR.patternData.EDGES.orientation]);

// solved + y: should be cube uniformly rotated. Read F-face stickers:
const afterY = solved.applyAlg('y');
console.log('\nAfter y rotation — F-face stickers:');
for (let slot = 0; slot < 12; slot++) {
  const [fA, fB] = EDGE_STICKERS[slot];
  if (fA === 2) console.log(`  edge slot ${slot} F-face: ${edgeStickerOnFace(afterY, slot, 2)}`);
  if (fB === 2) console.log(`  edge slot ${slot} F-face: ${edgeStickerOnFace(afterY, slot, 2)}`);
}
console.log(`  F-face center: ${afterY.patternData.CENTERS.pieces[2]}`);
