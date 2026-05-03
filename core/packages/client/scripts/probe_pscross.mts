import { patternFromAlg } from '../src/utils/cube3';
import { detectStage } from '../src/utils/stage_detect';
import { buildCommentSuggestions } from '../src/utils/popup_suggest';

const scramble = "B' U L' D' F' B R2 L' U F' L' D B' R' D R' D' F2";
const solution = "U L' F L R' D R";
const state = await patternFromAlg(`${scramble} ${solution}`);
const info = await detectStage(state);
console.log('stage:', info.stage, 'solvedSlots:', info.solvedSlots);

// Prev state (scramble alone)
const prevSc = await patternFromAlg(scramble);
console.log('prev stage:', (await detectStage(prevSc)).stage);

// Check defaultCentersRotation — the user's natural solving frame
import { defaultCentersRotation } from '../src/utils/stage_detect';
import { edgeStickerOnFace as esf, EDGE_STICKERS as ES } from '../src/utils/sticker_tables';
const dcr = await defaultCentersRotation(state);
console.log('defaultCentersRotation:', dcr || '(none)');
const dcState = dcr ? state.applyAlg(dcr) : state;
console.log('after dcr, centers:', dcState.patternData.CENTERS.pieces);
function ck(p: typeof state) {
  for (let s = 4; s <= 7; s++) {
    const [fA, fB] = ES[s];
    if (esf(p, s, fA) !== p.patternData.CENTERS.pieces[fA]) return false;
    if (esf(p, s, fB) !== p.patternData.CENTERS.pieces[fB]) return false;
  }
  return true;
}
console.log('crossOk at dcr-frame:', ck(dcState));
for (const d of ['D', "D'", 'D2']) {
  console.log(`crossOk at dcr-frame · ${d}:`, ck(dcState.applyAlg(d)));
}

// All 24 rotations crossOk
console.log('\nAll 24 rotations crossOk:');
const tops = ['', 'x', 'x2', "x'", 'z', "z'"];
const ys = ['', 'y', 'y2', "y'"];
for (const t of tops) for (const y of ys) {
  const r = [t, y].filter(Boolean).join(' ');
  const rs = r ? state.applyAlg(r) : state;
  if (ck(rs)) console.log(`  rot="${r||'_'}": OK`);
}

// Try adding D2 to solve cross
for (const d of ['', 'D', "D'", 'D2']) {
  const t = d ? state.applyAlg(d) : state;
  const i = await detectStage(t);
  console.log(`+${d || '_'}: stage=${i.stage} solvedSlots=[${i.solvedSlots.join(',')}]`);
}

// Comment suggestions for the user's scenario
const prev = await patternFromAlg(scramble);
const suggestions = await buildCommentSuggestions({
  prevPattern: prev,
  currPattern: state,
  lineMovesText: solution,
  moveCount: 7,
});
console.log('\nComment suggestions:', suggestions);

// And per-rotation crossSolved check (manual)
import { edgeStickerOnFace, EDGE_STICKERS } from '../src/utils/sticker_tables';
function crossOk(p: typeof state) {
  for (let s = 4; s <= 7; s++) {
    const [fA, fB] = EDGE_STICKERS[s];
    if (edgeStickerOnFace(p, s, fA) !== p.patternData.CENTERS.pieces[fA]) return false;
    if (edgeStickerOnFace(p, s, fB) !== p.patternData.CENTERS.pieces[fB]) return false;
  }
  return true;
}
console.log('\nDirect crossOk:');
for (const r of ['', 'y', 'y2', "y'", 'x', 'x2', "x'", 'z', "z'"]) {
  const t = r ? state.applyAlg(r) : state;
  const ok = crossOk(t);
  if (ok) console.log(`  rot="${r||'_'}": cross OK`);
}
