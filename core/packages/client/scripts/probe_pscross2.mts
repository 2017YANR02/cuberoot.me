import { patternFromAlg } from '../src/utils/cube3';
import { detectStage } from '../src/utils/stage_detect';

// Build a real pscross state: cross done + D2 applied (so it's now "needs D2 to fix").
const crossSolve = "F R U' R'";  // arbitrary cross moves on a scramble
const scramble = "R U R' U R U2 R' F R U R' U' F'"; // some random scramble
// True cross-done state:
const crossState = await patternFromAlg(`${scramble} ${crossSolve}`);
console.log('after cross:', (await detectStage(crossState)).stage);

// pscross = cross + D2 / D / D':
for (const d of ['D', "D'", 'D2']) {
  const t = crossState.applyAlg(d);
  const i = await detectStage(t);
  console.log(`cross + ${d} (= pscross): stage=${i.stage} solvedSlots=[${i.solvedSlots.join(',')}]`);
}

// Now: from pscross, applying D'/D/D2 should give cross.
console.log('\nValidate undoing:');
for (const d of ['D', "D'", 'D2']) {
  const ps = crossState.applyAlg(d);
  for (const undo of ['D', "D'", 'D2']) {
    const t = ps.applyAlg(undo);
    const i = await detectStage(t);
    if (i.stage !== 'none') console.log(`  pscross(via ${d}).apply(${undo}) → stage=${i.stage}`);
  }
}
