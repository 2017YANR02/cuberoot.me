import { getCube3 } from '../src/utils/cube3.ts';
import { EDGE_STICKERS, edgeStickerOnFace } from '../src/utils/sticker_tables.ts';

const kp = await getCube3();
const solved = kp.defaultPattern();

// Rotate so green (was at F) ends up on D.
// x' moves: F→D, D→B, B→U, U→F
const after = solved.applyAlg("x'");

console.log('CENTERS.pieces:', [...after.patternData.CENTERS.pieces]);
console.log('Center on D-slot (5) =', after.patternData.CENTERS.pieces[5], '(should be 2 = Green)');

console.log('\nEDGE_STICKERS check at D-slots:');
for (const slot of [4, 5, 6, 7]) {
  const [fA, fB] = EDGE_STICKERS[slot];
  const sA = edgeStickerOnFace(after, slot, fA);
  const sB = edgeStickerOnFace(after, slot, fB);
  const cA = after.patternData.CENTERS.pieces[fA];
  const cB = after.patternData.CENTERS.pieces[fB];
  console.log(`  slot ${slot} (faces ${fA}/${fB}): edge=${sA}/${sB}, centers=${cA}/${cB}, match=${sA === cA && sB === cB}`);
}

// Now check D-face stickers (5):
console.log('\nD-face stickers (face 5):');
for (let slot = 0; slot < 12; slot++) {
  const [fA, fB] = EDGE_STICKERS[slot];
  if (fA === 5) console.log(`  slot ${slot}: D-side = ${edgeStickerOnFace(after, slot, 5)}`);
  if (fB === 5) console.log(`  slot ${slot}: D-side = ${edgeStickerOnFace(after, slot, 5)}`);
}
