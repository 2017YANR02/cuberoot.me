import { getCube3 } from '../src/utils/cube3.ts';
import { EDGE_STICKERS, edgeStickerOnFace } from '../src/utils/sticker_tables.ts';

const kp = await getCube3();
const solved = kp.defaultPattern();
const after = solved.applyAlg('y');

console.log('CENTERS.pieces after y:', [...after.patternData.CENTERS.pieces]);

// D-face check
console.log('\nD-slot edges check:');
for (const slot of [4, 5, 6, 7]) {
  const [fA, fB] = EDGE_STICKERS[slot];
  const sA = edgeStickerOnFace(after, slot, fA);
  const sB = edgeStickerOnFace(after, slot, fB);
  const cA = after.patternData.CENTERS.pieces[fA];
  const cB = after.patternData.CENTERS.pieces[fB];
  console.log(`  slot ${slot} (faces ${fA}/${fB}): edge ${sA}/${sB} vs centers ${cA}/${cB} → ${sA===cA && sB===cB}`);
}

// Now apply x' to solved, and check D-face which should be Green:
console.log('\n\nFor comparison, solved + x\' D-edges:');
const xp = solved.applyAlg("x'");
for (const slot of [4, 5, 6, 7]) {
  const [fA, fB] = EDGE_STICKERS[slot];
  const sA = edgeStickerOnFace(xp, slot, fA);
  const sB = edgeStickerOnFace(xp, slot, fB);
  console.log(`  slot ${slot}: edge ${sA}/${sB}`);
}

// Solved + y'
console.log('\n\nsolved + y\' D-edges:');
const yp = solved.applyAlg("y'");
for (const slot of [4, 5, 6, 7]) {
  const [fA, fB] = EDGE_STICKERS[slot];
  const sA = edgeStickerOnFace(yp, slot, fA);
  const sB = edgeStickerOnFace(yp, slot, fB);
  const cA = yp.patternData.CENTERS.pieces[fA];
  const cB = yp.patternData.CENTERS.pieces[fB];
  console.log(`  slot ${slot}: edge ${sA}/${sB} vs centers ${cA}/${cB} → ${sA===cA && sB===cB}`);
}
