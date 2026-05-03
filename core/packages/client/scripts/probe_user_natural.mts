import { patternFromAlg } from '../src/utils/cube3.ts';
import { EDGE_STICKERS, edgeStickerOnFace } from '../src/utils/sticker_tables.ts';

const scramble = "F2 L' U2 R' F L B F' D U2 R' D2 U L' U R' F' U";
const sol = "y z' x' F D U' r U D R' D2";
const p = await patternFromAlg(`${scramble} ${sol}`);

console.log('CENTERS.pieces:', [...p.patternData.CENTERS.pieces]);
console.log('EDGES.pieces  :', [...p.patternData.EDGES.pieces]);
console.log('EDGES.orient  :', [...p.patternData.EDGES.orientation]);

const FACE_NAME = ['U', 'R', 'F', 'L', 'B', 'D'];
const COLOR_NAME = ['White', 'Red', 'Green', 'Orange', 'Blue', 'Yellow'];

console.log('\nUser natural frame — what each face center shows:');
for (let f = 0; f < 6; f++) {
  console.log(`  ${FACE_NAME[f]}: ${COLOR_NAME[p.patternData.CENTERS.pieces[f]]}`);
}

console.log('\nD-edge stickers (slot 4..7) at natural frame:');
for (const slot of [4, 5, 6, 7]) {
  const [fA, fB] = EDGE_STICKERS[slot];
  const sA = edgeStickerOnFace(p, slot, fA)!;
  const sB = edgeStickerOnFace(p, slot, fB)!;
  const cA = p.patternData.CENTERS.pieces[fA];
  const cB = p.patternData.CENTERS.pieces[fB];
  const ok = sA === cA && sB === cB;
  console.log(`  slot ${slot} (${FACE_NAME[fA]}/${FACE_NAME[fB]}): edge ${COLOR_NAME[sA]}/${COLOR_NAME[sB]} vs centers ${COLOR_NAME[cA]}/${COLOR_NAME[cB]} → ${ok ? '✓' : '✗'}`);
}
