import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { AlgFile } from '@cuberoot/shared/alg';
import { puzzles } from 'cubing/puzzles';
import { solve222TimerHints } from '@cuberoot/puzzle-solvers/cube222';
import { compute222OptimalHtm, normalize222OptimalSetup } from '@/lib/alg_222_optimal';
import { commonCaseSetup } from '@/lib/alg_case_alignment';
import { CUBE_ORIENTATIONS, reachesGoal, SET_GOAL } from '@/lib/alg_goals';
import { normalizeAlg } from '@/lib/alg_normalize';
import baseline from './fixtures/alg-222-optimal.json';

const files = (JSON.parse(readFileSync(new URL('./fixtures/alg-case-alignment.json', import.meta.url), 'utf8')) as AlgFile[])
  .filter(f => f.puzzle === '2x2' && SET_GOAL[`2x2/${f.set}`] === 'solve');

describe('exact 2x2 case distances', () => {
  it('handles rotations, opposite faces, solved states and invalid input', async () => {
    expect(await compute222OptimalHtm(['', 'x y z', 'U2', 'D2', 'L', 'B', "R U R'", 'bogus', 'M']))
      .toEqual([0, 0, 1, 1, 1, 1, 3, null, null]);
  });

  it.each(files.map(file => ({ file, set: file.set })))('$set: every case preserves its state and has a solving witness', async ({ file }) => {
    const kp = await puzzles['2x2x2'].kpuzzle();
    const setups = file.cases.map(c => commonCaseSetup('2x2', file.set, c));
    const start = performance.now();
    const lengths = await compute222OptimalHtm(setups);
    expect(lengths.join(',')).toBe(baseline[file.set as keyof typeof baseline]);
    console.info(`${file.set}: ${setups.length} exact HTM distances in ${Math.round(performance.now() - start)}ms`);
    for (const [i, setup] of setups.entries()) {
      const normalized = await normalize222OptimalSetup(setup);
      const original = kp.algToTransformation(normalizeAlg('2x2', setup));
      const fixed = kp.algToTransformation(normalized);
      expect(CUBE_ORIENTATIONS.some(r => fixed.applyTransformation(kp.algToTransformation(r)).isIdentical(original)), file.cases[i].name).toBe(true);
      const witness = solve222TimerHints(normalized).full;
      expect(lengths[i], file.cases[i].name).toBe(witness.length);
      expect(reachesGoal(kp.defaultPattern().applyAlg(`${normalized} ${witness.moves.join(' ')}`), kp, '2x2', 'solve')).toBe(true);
    }
  });
});
