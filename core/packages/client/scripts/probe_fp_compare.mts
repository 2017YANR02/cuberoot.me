import { detectStage, crossOnDRotation, F2L_SLOT_DEFS } from '../src/utils/stage_detect.ts';
import { patternFromAlg } from '../src/utils/cube3.ts';
import { CORNER_STICKERS, EDGE_STICKERS, edgeStickerOnFace, cornerStickerOnFace } from '../src/utils/sticker_tables.ts';
import { getCube3 } from '../src/utils/cube3.ts';

function fpAt(p: any, slotIdx: number): string {
  const def = F2L_SLOT_DEFS[slotIdx];
  const c = p.patternData.CENTERS.pieces;
  const dColor = c[5];
  const cornerSlotFaces = CORNER_STICKERS[def.cornerSlot];
  const edgeSlotFaces = EDGE_STICKERS[def.edgeSlot];
  const cornerSideA = c[cornerSlotFaces[1]];
  const cornerSideB = c[cornerSlotFaces[2]];
  const edgeSideA = c[edgeSlotFaces[0]];
  const edgeSideB = c[edgeSlotFaces[1]];

  let cFp = '?';
  for (let s = 0; s < 8; s++) {
    const sf = CORNER_STICKERS[s];
    const sticks = [cornerStickerOnFace(p, s, sf[0]), cornerStickerOnFace(p, s, sf[1]), cornerStickerOnFace(p, s, sf[2])];
    const set = new Set(sticks);
    if (set.size === 3 && set.has(dColor) && set.has(cornerSideA) && set.has(cornerSideB)) {
      cFp = `${s}.${sticks.indexOf(dColor)}`;
      break;
    }
  }
  let eFp = '?';
  for (let s = 0; s < 12; s++) {
    const sf = EDGE_STICKERS[s];
    const a = edgeStickerOnFace(p, s, sf[0]);
    const b = edgeStickerOnFace(p, s, sf[1]);
    if ((a === edgeSideA && b === edgeSideB) || (a === edgeSideB && b === edgeSideA)) {
      eFp = `${s}.${a === edgeSideA ? 0 : 1}`;
      break;
    }
  }
  return `${def.id}#${cFp}/${eFp}`;
}

const scramble = "L2 B2 F' L D' F2 D R' F2 R2 D' B' L' D2 B D' U L2";
const moves = "y x' F R2 U' L2' x' y U2 F' U' F";
const userState = await patternFromAlg(`${scramble} ${moves}`);
const userInfo = await detectStage(userState);
const userCanon = userInfo.canonicalPattern;

console.log('user canonical centers:', userCanon.patternData.CENTERS.pieces);
for (let i = 0; i < 4; i++) {
  console.log(`  user slot ${F2L_SLOT_DEFS[i].id}: fp=${fpAt(userCanon, i)}`);
}

console.log('\n--- Default-center cube applied with sample F2L alg "R U R\'" ---');
const kp = await getCube3();
const solvedDef = kp.defaultPattern();
// Inverse to get a state where alg "R U R'" solves the FR pair.
const sampleAlg = "R U' R'";
const sampleState = solvedDef.applyAlg(sampleAlg);
console.log('default centers:', sampleState.patternData.CENTERS.pieces);
for (let i = 0; i < 4; i++) {
  console.log(`  default slot ${F2L_SLOT_DEFS[i].id}: fp=${fpAt(sampleState, i)}`);
}

console.log('\n--- Apply same sample alg to user state, see if FR fp matches build version ---');
const userAfter = userState.applyAlg(sampleAlg);
const userAfterCanon = (await detectStage(userAfter)).canonicalPattern;
console.log('user-after canonical centers:', userAfterCanon.patternData.CENTERS.pieces);
for (let i = 0; i < 4; i++) {
  console.log(`  user-after slot ${F2L_SLOT_DEFS[i].id}: fp=${fpAt(userAfterCanon, i)}`);
}
