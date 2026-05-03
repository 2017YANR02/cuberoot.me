import { lookupF2lAlgs, warmupF2lTable } from '../src/utils/f2l_lookup.ts';

await warmupF2lTable();

// Hack: re-build to extract keys directly. Re-import with side effect.
// Instead, just call lookupF2lAlgs with a dummy and inspect via reflection.
// Easier: iterate every reachable fp. Actually, let's just count entries per slot prefix.

import { F2L_SLOT_DEFS } from '../src/utils/stage_detect.ts';
import { CORNER_STICKERS, EDGE_STICKERS, edgeStickerOnFace, cornerStickerOnFace } from '../src/utils/sticker_tables.ts';
import { getCube3, simplifyAlg, invertAlg, patternFromAlg } from '../src/utils/cube3.ts';
import { loadAlg } from '@cuberoot/shared/alg';

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

// Manually rebuild the table to get keys
const [f2l, advF2l] = await Promise.all([loadAlg('3x3', 'f2l'), loadAlg('3x3', 'adv-f2l')]);
const kp = await getCube3();
const solved = kp.defaultPattern();

const AUFS = ['', 'U', 'U2', "U'"];
const allKeys = new Set<string>();
const flKeys = new Set<string>();

for (const c of [...f2l.cases, ...advF2l.cases]) {
  for (let oriIdx = 0; oriIdx < 4; oriIdx++) {
    const variants = c.algs[oriIdx];
    if (!variants) continue;
    for (const variant of variants) {
      const a = variant.alg;
      if (!a) continue;
      const invA = invertAlg(a);
      if (!invA) continue;
      let baseState;
      try { baseState = solved.applyAlg(invA); } catch { continue; }
      for (let aufIdx = 0; aufIdx < 4; aufIdx++) {
        let state;
        try { state = AUFS[aufIdx] ? baseState.applyAlg(AUFS[aufIdx]) : baseState; } catch { continue; }
        const fp = fpAt(state, oriIdx);
        allKeys.add(fp);
        if (oriIdx === 1) flKeys.add(fp);
      }
    }
  }
}

console.log(`Total unique fps: ${allKeys.size}`);
console.log(`FL fps: ${flKeys.size}`);
console.log(`\nSample FL fps:`);
let n = 0;
for (const k of flKeys) {
  console.log(`  ${k}`);
  if (++n >= 30) break;
}
console.log(`\nIs user's FL#2.2/10.1 in the set?`, flKeys.has('FL#2.2/10.1'));
console.log(`Is user's BL#7.0/2.1 in the set?`, allKeys.has('BL#7.0/2.1'));
console.log(`Is user's BR#6.2/11.1 in the set?`, allKeys.has('BR#6.2/11.1'));
