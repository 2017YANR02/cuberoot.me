import { detectStage, F2L_SLOT_DEFS } from '../src/utils/stage_detect.ts';
import { patternFromAlg } from '../src/utils/cube3.ts';
import { CORNER_STICKERS, EDGE_STICKERS, edgeStickerOnFace, cornerStickerOnFace } from '../src/utils/sticker_tables.ts';
import { lookupF2lAlgs } from '../src/utils/f2l_lookup.ts';

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

// Try lookupF2lAlgs on each slot, with all 4 y-rotations, to see if any produces a hit
console.log('user canonical centers:', userCanon.patternData.CENTERS.pieces);
console.log('user solvedSlots:', userInfo.solvedSlots);

const AUFS = ['', 'U', 'U2', "U'"];
for (let slotIdx = 0; slotIdx < 4; slotIdx++) {
  const def = F2L_SLOT_DEFS[slotIdx];
  if (userInfo.solvedSlots.includes(def.id as any)) continue;
  console.log(`\nSlot ${def.id}:`);
  for (let k = 0; k < 4; k++) {
    const rotated = AUFS[k] ? userCanon.applyAlg(AUFS[k]) : userCanon;
    const fp = fpAt(rotated, slotIdx);
    console.log(`  AUF=${AUFS[k] || 'identity'}: fp=${fp}`);
  }
  const entries = await lookupF2lAlgs(userCanon, slotIdx);
  console.log(`  lookupF2lAlgs returned: ${entries.length} entries`);
}

// Now compare with a YELLOW-cross variant of the same scenario, to check if it's a color-neutral issue
console.log('\n=== Yellow-cross equivalent (same case but with default centers) ===');
// Build a yellow-cross + first-F2L state, then compare slot fp with user's
import { getCube3 } from '../src/utils/cube3.ts';
const kp = await getCube3();
const solved = kp.defaultPattern();
// A scramble that puts cross+first pair, all done with yellow-on-D (default).
// E.g., "R U R'" then "R' F R F'" — these shouldn't fully solve a yellow case but let's just construct manually.
// Or: scramble + reasonable alg.
const yellowState = solved.applyAlg("R U R' U2 R U' R'");  // some F2L alg
const yInfo = await detectStage(yellowState);
console.log('yellow state stage:', yInfo.stage, 'solvedSlots:', yInfo.solvedSlots);
console.log('yellow canonical centers:', yInfo.canonicalPattern.patternData.CENTERS.pieces);

// Just check: from a partial state (cross only), call lookupF2lAlgs for FR
// Actually let me just build a known F2L1-only state with default centers
const yellowF1 = solved.applyAlg("R U R' U' R U R' U' R U R'"); // some perm
const yF1Info = await detectStage(yellowF1);
console.log('\nyellowF1 stage:', yF1Info.stage, 'solvedSlots:', yF1Info.solvedSlots);
if (yF1Info.solvedSlots.length > 0) {
  for (let i = 0; i < 4; i++) {
    if (yF1Info.solvedSlots.includes(F2L_SLOT_DEFS[i].id as any)) continue;
    const e = await lookupF2lAlgs(yF1Info.canonicalPattern, i);
    console.log(`  yellow slot ${F2L_SLOT_DEFS[i].id}: ${e.length} entries`);
  }
}
