import { patternFromAlg } from '../src/utils/cube3';
import { detectStage } from '../src/utils/stage_detect';
import { edgeStickerOnFace, EDGE_STICKERS } from '../src/utils/sticker_tables';

// Simplest pscross: solved + D2 (cross-rotated 180°).
const state = await patternFromAlg('D2');
console.log('solved + D2:');
const info = await detectStage(state);
console.log('  detectStage:', info.stage);
console.log('  centers:', state.patternData.CENTERS.pieces);

// Manually: are D-edges (slots 4..7) showing D-color on D-face?
for (let s = 4; s <= 7; s++) {
  const [fA, fB] = EDGE_STICKERS[s];
  const sA = edgeStickerOnFace(state, s, fA);
  const sB = edgeStickerOnFace(state, s, fB);
  console.log(`  slot ${s}: D-sticker=${sA} side-sticker=${sB} (centers: D=${state.patternData.CENTERS.pieces[fA]}, side=${state.patternData.CENTERS.pieces[fB]})`);
}

// Now applying D2 should fix it.
const fixed = state.applyAlg('D2');
console.log('\nstate + D2 (should be solved):');
console.log('  detectStage:', (await detectStage(fixed)).stage);
