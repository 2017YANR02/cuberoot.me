import { getCube3 } from '../src/utils/cube3.ts';

const kp = await getCube3();
const solved = kp.defaultPattern();

const afterU = solved.applyAlg('U');
console.log('After U (face turn):');
console.log('  EDGES.pieces:', [...afterU.patternData.EDGES.pieces]);
console.log('  CORNERS.pieces:', [...afterU.patternData.CORNERS.pieces]);
console.log('  CENTERS.pieces:', [...afterU.patternData.CENTERS.pieces]);

const afterDwp = solved.applyAlg("Dw'");
console.log('\nAfter Dw\' (wide turn):');
console.log('  EDGES.pieces:', [...afterDwp.patternData.EDGES.pieces]);
console.log('  CORNERS.pieces:', [...afterDwp.patternData.CORNERS.pieces]);
console.log('  CENTERS.pieces:', [...afterDwp.patternData.CENTERS.pieces]);
