/**
 * Two states that look identical via 24-rotation cross/pscross search:
 * - Both have pscross at identity, cross at y/y'.
 * But user labels one "cross" (current case) and the other "pscross" (previous case).
 * Investigate the actual cube states to understand the difference.
 */
import { patternFromAlg } from '../src/utils/cube3.ts';
import { defaultCentersRotation } from '../src/utils/stage_detect.ts';

const cases = [
  {
    label: 'CURRENT (user expects cross)',
    scramble: "F2 L' U2 R' F L B F' D U2 R' D2 U L' U R' F' U",
    sol: "y z' x' F D U' r U D R' D2",
  },
  {
    label: 'PREVIOUS (user expects pscross)',
    scramble: "B' U L' D' F' B R2 L' U F' L' D B' R' D R' D' F2",
    sol: "U L' F L R' D R",
  },
];

for (const c of cases) {
  const p = await patternFromAlg(`${c.scramble} ${c.sol}`);
  const dcr = await defaultCentersRotation(p);
  const pNorm = dcr ? p.applyAlg(dcr) : p;
  console.log(`\n=== ${c.label} ===`);
  console.log(`raw centers     : ${[...p.patternData.CENTERS.pieces]}`);
  console.log(`dcr             : ${JSON.stringify(dcr)}`);
  console.log(`norm centers    : ${[...pNorm.patternData.CENTERS.pieces]}`);

  // Check cross on each face at default-centers
  const FACE_EDGES: Record<number, number[]> = {
    0: [0, 1, 2, 3], 1: [1, 5, 8, 10], 2: [0, 4, 8, 9],
    3: [3, 7, 9, 11], 4: [2, 6, 10, 11], 5: [4, 5, 6, 7],
  };
  const FACE_NAME = ['U', 'R', 'F', 'L', 'B', 'D'];
  const { EDGE_STICKERS, edgeStickerOnFace } = await import('../src/utils/sticker_tables.ts');

  for (let face = 0; face < 6; face++) {
    const center = pNorm.patternData.CENTERS.pieces[face];
    let half = true, full = true;
    for (const slot of FACE_EDGES[face]) {
      const [fA, fB] = EDGE_STICKERS[slot];
      const otherFace = fA === face ? fB : fA;
      const onFace = edgeStickerOnFace(pNorm, slot, face)!;
      const onOther = edgeStickerOnFace(pNorm, slot, otherFace)!;
      const otherC = pNorm.patternData.CENTERS.pieces[otherFace];
      if (onFace !== center) { half = false; full = false; }
      if (onOther !== otherC) full = false;
    }
    if (half) console.log(`  ${FACE_NAME[face]} half=${half}, full=${full}`);
  }
}
