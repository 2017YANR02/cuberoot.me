import { cube3x3x3 } from 'cubing/puzzles';
const kp = await cube3x3x3.kpuzzle();
const solved = kp.defaultPattern();
const yState = solved.applyAlg("y");
console.log('After y, CORNERS.pieces:', yState.patternData.CORNERS.pieces);
// Slot 4=DFR, 5=DFL, 6=DBL, 7=DBR
// Default: each piece at home slot
// After y: pieces shift among D-corners
