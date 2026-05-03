import { getCube3 } from '../src/utils/cube3.ts';
import { EDGE_STICKERS, edgeStickerOnFace } from '../src/utils/sticker_tables.ts';

const kp = await getCube3();
const solved = kp.defaultPattern();

const TESTS = ['x', "x'", 'x2', 'z', "z'", 'z2', 'y', "y'"];
for (const rot of TESTS) {
  const p = solved.applyAlg(rot);
  // For each face, check if all edges match center color
  let allUniform = true;
  for (let face = 0; face < 6; face++) {
    const center = p.patternData.CENTERS.pieces[face];
    for (let slot = 0; slot < 12; slot++) {
      const [fA, fB] = EDGE_STICKERS[slot];
      if (fA !== face && fB !== face) continue;
      const sticker = edgeStickerOnFace(p, slot, face);
      if (sticker !== center) { allUniform = false; }
    }
  }
  console.log(`solved + ${rot}: all faces uniform = ${allUniform}`);
}
