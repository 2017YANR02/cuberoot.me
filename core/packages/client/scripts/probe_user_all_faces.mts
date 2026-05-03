import { patternFromAlg } from '../src/utils/cube3.ts';
import { EDGE_STICKERS, edgeStickerOnFace } from '../src/utils/sticker_tables.ts';

const scramble = "F2 L' U2 R' F L B F' D U2 R' D2 U L' U R' F' U";
const sol = "y z' x' F D U' r U D R' D2";
const p = await patternFromAlg(`${scramble} ${sol}`);

const FACE_NAME = ['U', 'R', 'F', 'L', 'B', 'D'];
const COLOR_NAME = ['White', 'Red', 'Green', 'Orange', 'Blue', 'Yellow'];

const FACE_EDGES: Record<number, number[]> = {
  0: [0, 1, 2, 3],
  1: [1, 5, 8, 10],
  2: [0, 4, 8, 9],
  3: [3, 7, 9, 11],
  4: [2, 6, 10, 11],
  5: [4, 5, 6, 7],
};

for (let face = 0; face < 6; face++) {
  const fCenter = p.patternData.CENTERS.pieces[face];
  let crossOk = true;
  let halfOk = true;
  const detail: string[] = [];
  for (const slot of FACE_EDGES[face]) {
    const [fA, fB] = EDGE_STICKERS[slot];
    const otherFace = fA === face ? fB : fA;
    const onFace = edgeStickerOnFace(p, slot, face)!;
    const onOther = edgeStickerOnFace(p, slot, otherFace)!;
    const otherCenter = p.patternData.CENTERS.pieces[otherFace];
    if (onFace !== fCenter) halfOk = false;
    if (onFace !== fCenter || onOther !== otherCenter) crossOk = false;
    detail.push(`${COLOR_NAME[onFace]}/${COLOR_NAME[onOther]} (need ${COLOR_NAME[fCenter]}/${COLOR_NAME[otherCenter]})`);
  }
  console.log(`Face ${FACE_NAME[face]} (center=${COLOR_NAME[fCenter]}): half=${halfOk ? '✓' : '✗'} full=${crossOk ? '✓' : '✗'}`);
  for (const d of detail) console.log(`  ${d}`);
}
