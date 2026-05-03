import { patternFromAlg } from '../src/utils/cube3.ts';
import { defaultCentersRotation } from '../src/utils/stage_detect.ts';
import { EDGE_STICKERS, edgeStickerOnFace } from '../src/utils/sticker_tables.ts';

const scramble = "F2 L' U2 R' F L B F' D U2 R' D2 U L' U R' F' U";
const sol = "y z' x' F D U' r U D R' D2";
const p0 = await patternFromAlg(`${scramble} ${sol}`);

const dcr = await defaultCentersRotation(p0);
console.log('defaultCentersRotation:', JSON.stringify(dcr));
const p = dcr ? p0.applyAlg(dcr) : p0;
console.log('Centers after dcr:', [...p.patternData.CENTERS.pieces]);

const FACE_EDGES: Record<number, number[]> = {
  0: [0, 1, 2, 3], 1: [1, 5, 8, 10], 2: [0, 4, 8, 9],
  3: [3, 7, 9, 11], 4: [2, 6, 10, 11], 5: [4, 5, 6, 7],
};
const FACE_NAME = ['U', 'R', 'F', 'L', 'B', 'D'];

for (let face = 0; face < 6; face++) {
  const center = p.patternData.CENTERS.pieces[face];
  let halfOk = true, fullOk = true;
  const detail: string[] = [];
  for (const slot of FACE_EDGES[face]) {
    const [fA, fB] = EDGE_STICKERS[slot];
    const otherFace = fA === face ? fB : fA;
    const onFace = edgeStickerOnFace(p, slot, face)!;
    const onOther = edgeStickerOnFace(p, slot, otherFace)!;
    const otherC = p.patternData.CENTERS.pieces[otherFace];
    if (onFace !== center) halfOk = false;
    if (onFace !== center || onOther !== otherC) fullOk = false;
    detail.push(`slot${slot}: ${onFace}/${onOther} (need ${center}/${otherC})`);
  }
  console.log(`Face ${FACE_NAME[face]} (center=${center}): half=${halfOk}, full=${fullOk}`);
  for (const d of detail) console.log(`  ${d}`);
}
