/**
 * Reproduce the user's scenario:
 *   optimal scramble: F2 L' U2 R' F L B F' D U2 R' D2 U L' U R' F' U
 *   line 1: y z' // insp
 *   line 2: x' F D U' r U D R' D2  (caret at end)
 * Expected: comment popup with `// cross` etc.
 */
import { patternFromAlg, countMoves } from '../src/utils/cube3.ts';
import { movesOnly, lineRange } from '../src/utils/recon_autofill_core.ts';
import { detectStage } from '../src/utils/stage_detect.ts';
import { buildCommentSuggestions } from '../src/utils/popup_suggest.ts';

const scramble = "F2 L' U2 R' F L B F' D U2 R' D2 U L' U R' F' U";
const value = "y z' // insp\nx'F D U' r U D R'D2 ";
const caret = value.length;

const { start, end } = lineRange(value, caret);
const linesBefore = value.substring(0, start);
const linesUpToHere = value.substring(0, end);
const fullLine = value.substring(start, end);

const prevMoves = movesOnly(linesBefore);
const currMoves = movesOnly(linesUpToHere);
const thisLineMovesText = movesOnly(fullLine);
const moveCount = countMoves(thisLineMovesText);

console.log('prevMoves:', JSON.stringify(prevMoves));
console.log('currMoves:', JSON.stringify(currMoves));
console.log('thisLineMovesText:', JSON.stringify(thisLineMovesText));
console.log('moveCount:', moveCount);

const prevAlg = [scramble, prevMoves].filter(Boolean).join(' ');
const currAlg = [scramble, currMoves].filter(Boolean).join(' ');
console.log('prevAlg:', prevAlg);
console.log('currAlg:', currAlg);

const prevPattern = await patternFromAlg(prevAlg);
const currPattern = await patternFromAlg(currAlg);

const prev = await detectStage(prevPattern);
const curr = await detectStage(currPattern);
console.log('prev.stage:', prev.stage, 'solvedSlots:', prev.solvedSlots);
console.log('curr.stage:', curr.stage, 'solvedSlots:', curr.solvedSlots);
console.log('curr.crossColor:', curr.crossColor);

const entries = await buildCommentSuggestions({
  prevPattern,
  currPattern,
  lineMovesText: thisLineMovesText,
  moveCount,
});

console.log('entries:', entries);
