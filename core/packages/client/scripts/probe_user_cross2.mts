/**
 * Same as probe_user_cross but checks the actual sticker state — see whether
 * a cross is solved on ANY face (and which one).
 */
import { patternFromAlg } from '../src/utils/cube3.ts';
import { defaultCentersRotation, F2L_SLOT_DEFS } from '../src/utils/stage_detect.ts';
import { EDGE_STICKERS, edgeStickerOnFace, CORNER_STICKERS, cornerStickerOnFace } from '../src/utils/sticker_tables.ts';

const scramble = "F2 L' U2 R' F L B F' D U2 R' D2 U L' U R' F' U";
const moves = "y z' x' F D U' r U D R' D2";
const fullAlg = `${scramble} ${moves}`;

const p = await patternFromAlg(fullAlg);
console.log('CENTERS.pieces:', [...p.patternData.CENTERS.pieces]);

const dcr = await defaultCentersRotation(p);
console.log('defaultCentersRotation:', JSON.stringify(dcr));

const canon = dcr ? p.applyAlg(dcr) : p;
console.log('After dcr CENTERS.pieces:', [...canon.patternData.CENTERS.pieces]);

// Check each face: does the cross belong to that face?
const FACE_NAME = ['U', 'R', 'F', 'L', 'B', 'D'];
const COLOR_NAME = ['White', 'Red', 'Green', 'Orange', 'Blue', 'Yellow'];

// Edge slots adjacent to each face
const FACE_EDGES: Record<number, number[]> = {
  0: [0, 1, 2, 3],   // U
  1: [1, 5, 8, 10],  // R
  2: [0, 4, 8, 9],   // F
  3: [3, 7, 9, 11],  // L
  4: [2, 6, 10, 11], // B
  5: [4, 5, 6, 7],   // D
};

for (let face = 0; face < 6; face++) {
  const center = canon.patternData.CENTERS.pieces[face];
  let allMatch = true;
  for (const edgeSlot of FACE_EDGES[face]) {
    if (edgeStickerOnFace(canon, edgeSlot, face) !== center) { allMatch = false; break; }
  }
  console.log(`Face ${FACE_NAME[face]} (center=${COLOR_NAME[center]}): cross-edges-on-face = ${allMatch}`);
}

// Now check D face for "edges aligned to side centers" — full cross check
{
  let crossSolved = true;
  for (const slot of [4, 5, 6, 7]) {
    const [fA, fB] = EDGE_STICKERS[slot];
    const cA = canon.patternData.CENTERS.pieces[fA];
    const cB = canon.patternData.CENTERS.pieces[fB];
    const sA = edgeStickerOnFace(canon, slot, fA);
    const sB = edgeStickerOnFace(canon, slot, fB);
    const ok = sA === cA && sB === cB;
    console.log(`  D-edge slot ${slot} (faces ${FACE_NAME[fA]},${FACE_NAME[fB]}): ${COLOR_NAME[sA]}/${COLOR_NAME[sB]} vs centers ${COLOR_NAME[cA]}/${COLOR_NAME[cB]} → ${ok}`);
    if (!ok) crossSolved = false;
  }
  console.log('D-cross fully solved:', crossSolved);
}

// Also try removing the rotations from the alg (just face turns + r)
console.log('\n--- Without inspection rotations ---');
const noInsp = "x' F D U' r U D R' D2";
const p2 = await patternFromAlg(`${scramble} ${noInsp}`);
console.log('CENTERS.pieces:', [...p2.patternData.CENTERS.pieces]);
const dcr2 = await defaultCentersRotation(p2);
console.log('defaultCentersRotation:', JSON.stringify(dcr2));
