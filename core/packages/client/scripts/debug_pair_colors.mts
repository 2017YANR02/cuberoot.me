// Inspect what cube state recon-1 tab #2 produces, and what slot was just solved.
// Goal: deduce cubedb's pair color naming convention.

import { RECON_GROUND_TRUTH } from '../src/pages/recon/components/__fixtures__/cubedb_ground_truth';
import { patternFromAlg } from '../src/utils/cube3';
import { F2L_SLOT_DEFS, detectStage } from '../src/utils/stage_detect';
import { EDGE_STICKERS } from '../src/utils/sticker_tables';

function lineRange(text: string, idx: number) {
  let s = idx;
  while (s > 0 && text[s - 1] !== '\n') s--;
  let e = idx;
  while (e < text.length && text[e] !== '\n') e++;
  return { start: s, end: e };
}
function movesOnly(text: string) {
  return text.split('\n').map(l => {
    const i = l.indexOf('//');
    return i >= 0 ? l.substring(0, i) : l;
  }).join(' ').replace(/[()]/g, ' ').replace(/[↑↓·]/g, ' ').replace(/\s+/g, ' ').trim();
}

const FACE_NAMES = ['U', 'R', 'F', 'L', 'B', 'D'];
const COLOR = ['W', 'R', 'G', 'O', 'B', 'Y'];

async function dump(fixId: string, tabIdx: number, expectedPair: string) {
  const fixture = RECON_GROUND_TRUTH.find(f => f.id === fixId)!;
  const tp = fixture.tabPoints[tabIdx];
  const value = tp.afterText;
  const caret = value.length;
  const { start, end } = lineRange(value, caret);
  const linesBefore = value.substring(0, start);
  const linesUpToHere = value.substring(0, end);
  const prevAlg = [fixture.scramble, movesOnly(linesBefore)].filter(Boolean).join(' ');
  const currAlg = [fixture.scramble, movesOnly(linesUpToHere)].filter(Boolean).join(' ');
  const prev = await patternFromAlg(prevAlg);
  const curr = await patternFromAlg(currAlg);
  const prevInfo = await detectStage(prev);
  const currInfo = await detectStage(curr);
  const newSlots = currInfo.solvedSlots.filter(s => !prevInfo.solvedSlots.includes(s));

  const canonical = currInfo.canonicalPattern;
  console.log(`=== ${fixId} tab #${tabIdx} (expected pair: ${expectedPair}) ===`);
  console.log(`  raw curr CENTERS:       [${curr.patternData.CENTERS.pieces.map(p => COLOR[p]).join(',')}]`);
  console.log(`  canonical CENTERS:      [${canonical.patternData.CENTERS.pieces.map(p => COLOR[p]).join(',')}]`);
  console.log(`  prev solved slots: [${prevInfo.solvedSlots.join(',')}], curr: [${currInfo.solvedSlots.join(',')}], newly: [${newSlots.join(',')}]`);
  console.log(`  prev stage: ${prevInfo.stage}, curr stage: ${currInfo.stage}`);
  console.log(`  cross color: ${currInfo.crossColor?.letter}`);

  // For each F2L slot in CANONICAL pattern, show the edge piece + its stickers.
  for (const def of F2L_SLOT_DEFS) {
    const ePiece = canonical.patternData.EDGES.pieces[def.edgeSlot];
    const eOri = canonical.patternData.EDGES.orientation[def.edgeSlot] ?? 0;
    const cPiece = canonical.patternData.CORNERS.pieces[def.cornerSlot];
    const cOri = canonical.patternData.CORNERS.orientation[def.cornerSlot] ?? 0;
    const eStickers = EDGE_STICKERS[ePiece].map(c => COLOR[c]).join('+');
    const slotFaces = EDGE_STICKERS[def.edgeSlot].map(f => FACE_NAMES[f]).join('+');
    const isNewly = newSlots.includes(def.id);
    console.log(`    ${def.id}${isNewly ? ' ←NEW' : ''}: edge slot ${def.edgeSlot} (faces ${slotFaces}) has piece ${ePiece} ori${eOri} stickers ${eStickers}; corner slot ${def.cornerSlot} piece ${cPiece} ori${cOri}`);
  }
  console.log();
}

// Two cases of "L U' L'" applied to different scrambles:
await dump('recon-2', 2, 'GO');  // expected "GO"
await dump('recon-4', 2, 'OG');  // expected "OG"
// Two cases of "GR" cubie at BR slot:
await dump('recon-1', 2, 'GR');
await dump('recon-3', 1, 'BR');  // BR cubie at BR slot - "BR"
// FR cases:
await dump('recon-3', 2, 'GR');
await dump('recon-1', 4, 'RB');
await dump('recon-9', 4, 'WR');
