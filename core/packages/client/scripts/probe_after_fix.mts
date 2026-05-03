/** Verify the cross-detection fix on both cases. */
import { patternFromAlg } from '../src/utils/cube3.ts';
import { detectStage } from '../src/utils/stage_detect.ts';

const cases = [
  {
    label: 'Current (color-neutral green cross — expect "cross")',
    scramble: "F2 L' U2 R' F L B F' D U2 R' D2 U L' U R' F' U",
    sol: "y z' x' F D U' r U D R' D2",
    expectStage: 'cross',
    expectCrossColor: 'Green',
  },
  {
    label: 'Previous (yellow pseudo cross by D2 — expect "pscross")',
    scramble: "B' U L' D' F' B R2 L' U F' L' D B' R' D R' D' F2",
    sol: "U L' F L R' D R",
    expectStage: 'pscross',
    expectCrossColor: 'Yellow',
  },
  {
    label: 'Solved cube (expect "solved")',
    scramble: '',
    sol: '',
    expectStage: 'solved',
    expectCrossColor: 'Yellow',
  },
];

let pass = 0, fail = 0;
for (const c of cases) {
  const p = await patternFromAlg(`${c.scramble} ${c.sol}`.trim());
  const info = await detectStage(p);
  const ok = info.stage === c.expectStage && info.crossColor?.name === c.expectCrossColor;
  console.log(`${ok ? '✓' : '✗'} ${c.label}`);
  console.log(`  got: stage=${info.stage}, crossColor=${info.crossColor?.name}, solvedSlots=[${info.solvedSlots.join(',')}]`);
  console.log(`  expected: stage=${c.expectStage}, crossColor=${c.expectCrossColor}`);
  ok ? pass++ : fail++;
}
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
