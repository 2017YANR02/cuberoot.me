/** Raw EDGES.pieces and orientation, before/after y. */
import { patternFromAlg } from '../src/utils/cube3.ts';

const scramble = "B' U L' D' F' B R2 L' U F' L' D B' R' D R' D' F2";
const sol = "U L' F L R' D R";
const state = await patternFromAlg(`${scramble} ${sol}`);

console.log('At default:');
console.log('  EDGES.pieces:', [...state.patternData.EDGES.pieces]);
console.log('  EDGES.orientation:', [...state.patternData.EDGES.orientation]);
console.log('  CENTERS.pieces:', [...state.patternData.CENTERS.pieces]);

const yState = state.applyAlg('y');
console.log('\nAfter y:');
console.log('  EDGES.pieces:', [...yState.patternData.EDGES.pieces]);
console.log('  EDGES.orientation:', [...yState.patternData.EDGES.orientation]);
console.log('  CENTERS.pieces:', [...yState.patternData.CENTERS.pieces]);
