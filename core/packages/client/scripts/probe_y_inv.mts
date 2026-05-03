import { cube3x3x3 } from 'cubing/puzzles';
const kp = await cube3x3x3.kpuzzle();
const solved = kp.defaultPattern();
const after = solved.applyAlg("y'");
console.log('CENTERS:', after.patternData.CENTERS.pieces);
console.log('EDGES.pieces:', after.patternData.EDGES.pieces);
console.log('EDGES.orient:', after.patternData.EDGES.orientation);
