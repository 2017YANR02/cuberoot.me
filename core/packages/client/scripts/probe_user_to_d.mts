import { patternFromAlg } from '../src/utils/cube3.ts';
import { defaultCentersRotation, F2L_SLOT_DEFS } from '../src/utils/stage_detect.ts';
import { EDGE_STICKERS, edgeStickerOnFace, CORNER_STICKERS, cornerStickerOnFace } from '../src/utils/sticker_tables.ts';

const scramble = "F2 L' U2 R' F L B F' D U2 R' D2 U L' U R' F' U";
const sol = "y z' x' F D U' r U D R' D2";
const p0 = await patternFromAlg(`${scramble} ${sol}`);

// Step 1: default centers
const dcr = await defaultCentersRotation(p0);
const p1 = dcr ? p0.applyAlg(dcr) : p0;

// Step 2: bring green (F-face) to D via x'
const p = p1.applyAlg("x'");
console.log('Centers after dcr + x\':', [...p.patternData.CENTERS.pieces]);

// Check D-cross
console.log('\nD-cross check:');
let crossOk = true;
for (const slot of [4, 5, 6, 7]) {
  const [fA, fB] = EDGE_STICKERS[slot];
  const sA = edgeStickerOnFace(p, slot, fA)!;
  const sB = edgeStickerOnFace(p, slot, fB)!;
  const cA = p.patternData.CENTERS.pieces[fA];
  const cB = p.patternData.CENTERS.pieces[fB];
  const ok = sA === cA && sB === cB;
  console.log(`  slot ${slot}: ${sA}/${sB} vs ${cA}/${cB} → ${ok}`);
  if (!ok) crossOk = false;
}
console.log('crossSolved:', crossOk);

// Check F2L slots
console.log('\nF2L slot status:');
for (const def of F2L_SLOT_DEFS) {
  const [efA, efB] = EDGE_STICKERS[def.edgeSlot];
  const eA = edgeStickerOnFace(p, def.edgeSlot, efA)!;
  const eB = edgeStickerOnFace(p, def.edgeSlot, efB)!;
  const ecA = p.patternData.CENTERS.pieces[efA];
  const ecB = p.patternData.CENTERS.pieces[efB];
  const eOk = eA === ecA && eB === ecB;
  const [cfA, cfB, cfC] = CORNER_STICKERS[def.cornerSlot];
  const ccA = cornerStickerOnFace(p, def.cornerSlot, cfA)!;
  const ccB = cornerStickerOnFace(p, def.cornerSlot, cfB)!;
  const ccC = cornerStickerOnFace(p, def.cornerSlot, cfC)!;
  const ccA0 = p.patternData.CENTERS.pieces[cfA];
  const ccB0 = p.patternData.CENTERS.pieces[cfB];
  const ccC0 = p.patternData.CENTERS.pieces[cfC];
  const cOk = ccA===ccA0 && ccB===ccB0 && ccC===ccC0;
  console.log(`  ${def.id}: edge=${eOk}, corner=${cOk}`);
}
