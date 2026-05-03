import { getCube3 } from '../src/utils/cube3.ts';

const kp = await getCube3();
const solved = kp.defaultPattern();

const yState = solved.applyAlg('y');
const ySolvedAgain = yState.applyAlg("y'");

console.log('solved EDGES :', [...solved.patternData.EDGES.pieces]);
console.log('y EDGES      :', [...yState.patternData.EDGES.pieces]);
console.log('y y\' EDGES   :', [...ySolvedAgain.patternData.EDGES.pieces]);
console.log('y CENTERS    :', [...yState.patternData.CENTERS.pieces]);

// On a solved cube, after y, check if the cube is still "fully solved" in the
// usual sense (each face uniform). For each face, compute the colors at all
// edge slots that touch it; should all match the center.
import { EDGE_STICKERS, edgeStickerOnFace } from '../src/utils/sticker_tables.ts';

function dump(p: any) {
  for (let face = 0; face < 6; face++) {
    const center = p.patternData.CENTERS.pieces[face];
    const edges: number[] = [];
    for (let slot = 0; slot < 12; slot++) {
      const [fA, fB] = EDGE_STICKERS[slot];
      if (fA === face) edges.push(edgeStickerOnFace(p, slot, face)!);
      if (fB === face) edges.push(edgeStickerOnFace(p, slot, face)!);
    }
    console.log(`  face ${face}: center=${center}, edges around it = ${edges.join(',')}`);
  }
}
console.log('\nsolved cube view:');
dump(solved);
console.log('\nafter y view:');
dump(yState);
