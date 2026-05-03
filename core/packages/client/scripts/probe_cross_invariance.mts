/**
 * Verify whether cube rotations preserve the cross-vs-side-center alignment
 * relationship. Theory: yes (geometric invariant). Probe says no for the
 * old user state — figure out which is right.
 */
import { patternFromAlg } from '../src/utils/cube3.ts';
import { EDGE_STICKERS, edgeStickerOnFace } from '../src/utils/sticker_tables.ts';

const scramble = "B' U L' D' F' B R2 L' U F' L' D B' R' D R' D' F2";
const sol = "U L' F L R' D R";
const state = await patternFromAlg(`${scramble} ${sol}`);

const FACE_NAME = ['U', 'R', 'F', 'L', 'B', 'D'];
const COLOR_NAME = ['White', 'Red', 'Green', 'Orange', 'Blue', 'Yellow'];

function dump(p: any, label: string) {
  console.log(`\n=== ${label} ===`);
  console.log('Centers (face → color):');
  for (let f = 0; f < 6; f++) {
    console.log(`  ${FACE_NAME[f]} → ${COLOR_NAME[p.patternData.CENTERS.pieces[f]]}`);
  }
  console.log('D-layer edges (slot 4..7):');
  for (const slot of [4, 5, 6, 7]) {
    const [fA, fB] = EDGE_STICKERS[slot];
    const sA = edgeStickerOnFace(p, slot, fA)!;
    const sB = edgeStickerOnFace(p, slot, fB)!;
    const cA = p.patternData.CENTERS.pieces[fA];
    const cB = p.patternData.CENTERS.pieces[fB];
    const ok = sA === cA && sB === cB;
    console.log(`  slot ${slot} (faces ${FACE_NAME[fA]}/${FACE_NAME[fB]}): edge stickers ${COLOR_NAME[sA]}/${COLOR_NAME[sB]} vs centers ${COLOR_NAME[cA]}/${COLOR_NAME[cB]} → ${ok ? '✓' : '✗'}`);
  }
}

dump(state, 'state (no rotation)');
dump(state.applyAlg('y'), 'state.applyAlg("y")');
dump(state.applyAlg('y2'), 'state.applyAlg("y2")');
dump(state.applyAlg("y'"), 'state.applyAlg("y\'")');
