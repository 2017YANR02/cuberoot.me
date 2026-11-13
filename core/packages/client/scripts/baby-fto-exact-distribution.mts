/** Reproducible small-state export; replay witnesses independently with cubing.js. */
import assert from 'node:assert/strict';
import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { puzzles } from 'cubing/puzzles';
import { babyFtoAllScramblesByLength, babyFtoGraphStats, solveBabyFto } from '@cuberoot/puzzle-solvers/baby-fto';

const [flag, outputArg, ...extra] = process.argv.slice(2);
assert(flag === '--output' && outputArg && !extra.length, 'Usage: baby-fto-exact-distribution.mts --output REPORT.json');
const output = resolve(outputArg);
const reference = JSON.parse(readFileSync(new URL('../app/[lang]/scramble/stats/_data/precomputed-exact-puzzles.json', import.meta.url), 'utf8')).puzzles.dmd;
const stats = await babyFtoGraphStats();
assert.equal(stats.total, reference.total);
assert.deepEqual(stats.histogram, reference.histogram, 'Diamond-isomorphic distance histogram changed');
const all = await babyFtoAllScramblesByLength();
const puzzle = await puzzles.baby_fto.kpuzzle();
const solved = puzzle.defaultPattern();
const seen = new Set<string>();
const examples: Array<{ depth: number; scramble: string; solution: string }> = [];
const examplesPerDepthLimit = 12;
const godsNumber = stats.histogram.length - 1;
let checkedStates = 0;

for (let depth = 0; depth <= godsNumber; depth++) {
  const scrambles = all[depth];
  assert.equal(scrambles.length, stats.histogram[depth]);
  const exampleLimit = depth === godsNumber ? scrambles.length : examplesPerDepthLimit;
  for (const [index, scramble] of scrambles.entries()) {
    const tokens = scramble.trim().split(/\s+/).filter(Boolean);
    assert.equal(tokens.length, depth);
    assert(tokens.every(token => /^(?:U|F|BR|BL)'?$/.test(token)), 'Export left the canonical face alphabet');
    const pattern = solved.applyAlg(scramble);
    const { C4RNER, CENTERS } = pattern.patternData;
    // Unmarked centre twists are invisible; named Baby FTO sets orientationMod=1.
    const key = `${C4RNER.pieces.join('')}/${C4RNER.orientation.join('')}/${CENTERS.pieces.join('')}`;
    assert(!seen.has(key), 'Two exported scrambles represent the same physical state');
    seen.add(key);
    checkedStates++;
    if (checkedStates % 4096 === 0) assert(process.memoryUsage().rss < 512 * 1024 ** 2, 'Small-state export exceeded its 512 MiB budget');
    if (index >= exampleLimit) continue;
    const answer = await solveBabyFto(scramble);
    assert.equal(answer.length, depth);
    assert(pattern.applyAlg(answer.solution).isIdentical(solved), `Independent sample replay failed at depth ${depth}`);
    examples.push({ depth, scramble, solution: answer.solution });
  }
}
assert.equal(checkedStates, stats.total);
assert.equal(seen.size, stats.total);
const report = {
  event: 'baby_fto', completed: true, generatedAt: new Date().toISOString(),
  total: stats.total, godsNumber, histogram: stats.histogram, examples,
  examplesPerDepthLimit, deepestExamplesComplete: true,
  verification: {
    fullSpaceEnumerated: true, historicalHistogramMatched: true,
    independentlyReplayedStates: checkedStates, distinctPhysicalStates: seen.size,
    independentlyReplayedExamples: examples.length,
  },
};
mkdirSync(dirname(output), { recursive: true });
const temporary = `${output}.${process.pid}.tmp`;
writeFileSync(temporary, JSON.stringify(report, null, 2) + '\n', { flush: true });
renameSync(temporary, output);
console.log(JSON.stringify({ output, total: stats.total, histogram: stats.histogram,
  independentlyReplayedStates: checkedStates, examples: examples.length, rssBytes: process.memoryUsage().rss }));
