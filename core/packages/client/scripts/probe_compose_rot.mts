/**
 * Test whether composite rotations (mixing y/z) preserve sticker correctness
 * on a solved cube. If `y' x'` produces a state where all faces are uniform
 * (per edgeStickerOnFace), then composite is safe even though y' alone breaks.
 */
import { getCube3 } from '../src/utils/cube3.ts';
import { EDGE_STICKERS, edgeStickerOnFace } from '../src/utils/sticker_tables.ts';

const kp = await getCube3();
const solved = kp.defaultPattern();

const TESTS = ["y' x'", "y x", "y' x", "y x'", "z' x", "z x'", "x y'"];
for (const rot of TESTS) {
  const p = solved.applyAlg(rot);
  let allUniform = true;
  for (let face = 0; face < 6; face++) {
    const center = p.patternData.CENTERS.pieces[face];
    for (let slot = 0; slot < 12; slot++) {
      const [fA, fB] = EDGE_STICKERS[slot];
      if (fA !== face && fB !== face) continue;
      const sticker = edgeStickerOnFace(p, slot, face);
      if (sticker !== center) allUniform = false;
    }
  }
  console.log(`solved + "${rot}": uniform = ${allUniform}, centers = ${[...p.patternData.CENTERS.pieces]}`);
}
