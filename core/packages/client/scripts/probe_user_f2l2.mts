/**
 * Probe: simulate user's recon state to see why F2L2 alg suggestion is empty.
 *
 * URL: optimal=L2 B2 F' L D' F2 R2 R2 D' B' L' D2 B D' U L2
 *      alg = y // insp \n x' F R2 U' L2' x' // W cross \n y U2 F' U' F // RB \n
 * Caret is on blank line 4. Tab → suggestAlg path.
 */
import { suggestAlg } from '../src/utils/recon_autofill_core.ts';
import { detectStage } from '../src/utils/stage_detect.ts';
import { patternFromAlg } from '../src/utils/cube3.ts';
import { crossOnDRotation, evaluateCanonical, F2L_SLOT_DEFS } from '../src/utils/stage_detect.ts';

const scramble = "L2 B2 F' L D' F2 D R' F2 R2 D' B' L' D2 B D' U L2";
const value = `y // insp\nx' F R2 U' L2' x' // W cross\ny U2 F' U' F // RB\n`;
const caret = value.length;  // end of value, on blank line 4

console.log('=== prevMoves ===');
const moves = "y x' F R2 U' L2' x' y U2 F' U' F";
console.log(moves);

console.log('\n=== detectStage(startState) ===');
const startState = await patternFromAlg(`${scramble} ${moves}`);
const stageInfo = await detectStage(startState);
console.log('stage:', stageInfo.stage);
console.log('solvedSlots:', stageInfo.solvedSlots);
console.log('solvedPairs:', stageInfo.solvedPairs);
console.log('crossColor:', stageInfo.crossColor);
console.log('canonical centers:', stageInfo.canonicalPattern.patternData.CENTERS.pieces);

console.log('\n=== crossOnDRotation(startState) ===');
const rot = await crossOnDRotation(startState);
console.log('rotation:', JSON.stringify(rot));
const startCanonical = rot ? startState.applyAlg(rot) : startState;
console.log('startCanonical centers:', startCanonical.patternData.CENTERS.pieces);

console.log('\n=== evaluateCanonical(startCanonical) ===');
const ev = evaluateCanonical(startCanonical);
console.log('crossOk:', ev.crossOk);
console.log('solvedSlots:', ev.solvedSlots);

console.log('\n=== suggestAlg ===');
const sug = await suggestAlg(scramble, value, caret);
if (!sug) console.log('result: NULL');
else if (sug.kind === 'empty') console.log('result: empty, reasonKey =', sug.reasonKey);
else {
  console.log('result:', sug.suggestions.length, 'suggestions');
  for (const s of sug.suggestions.slice(0, 5)) {
    console.log(`  ${s.text} (${s.category}/${s.caseName})`);
  }
}
