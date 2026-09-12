import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { AlgFile } from '@cuberoot/shared/alg';
import { applySq1Scramble } from '@cuberoot/shared/sq1-notation';
import { classifySq1EpState } from '@/lib/sq1-ep-parity';
import { planSq1EpCorrection } from '@/scripts/sq1-ep-correct';

const before = JSON.parse(readFileSync(new URL('./fixtures/sq1-ep-before-direction-correction.json', import.meta.url), 'utf8')) as AlgFile;
const plan = planSq1EpCorrection(before);

describe('SQ1 EP physical directions and correction', () => {
  it('uses the same face-on clockwise solving cycle for top and bottom', () => {
    for (const layer of [0, 1]) {
      for (const [permutation, expected] of [[[1, 2, 0, 3], 'Ua'], [[2, 0, 1, 3], 'Ub']] as const) {
        const state = applySq1Scramble('');
        const original = state.pieces.slice();
        const slots = layer === 0 ? [2, 5, 8, 11] : [12, 15, 18, 21];
        // A piece currently at slot i moves to permutation[i] to solve it.
        slots.forEach((slot, i) => { state.pieces[slot] = original[slots[permutation[i]]]; });
        expect(classifySq1EpState(state)?.[layer]).toBe(expected);
      }
    }
  });

  it('classifies all 24 edge permutations on either layer', () => {
    const permutations = (values: number[]): number[][] => values.length === 0 ? [[]]
      : values.flatMap(value => permutations(values.filter(v => v !== value)).map(tail => [value, ...tail]));
    for (const layer of [0, 1]) {
      const counts: Record<string, number> = {};
      for (const permutation of permutations([0, 1, 2, 3])) {
        const state = applySq1Scramble('');
        const original = state.pieces.slice();
        const slots = layer === 0 ? [2, 5, 8, 11] : [12, 15, 18, 21];
        slots.forEach((slot, i) => { state.pieces[slot] = original[slots[permutation[i]]]; });
        const label = classifySq1EpState(state)![layer];
        counts[label] = (counts[label] ?? 0) + 1;
        for (let shift = 0; shift < 12; shift++) {
          const rotated = { ...state, pieces: state.pieces.slice() };
          for (let i = 0; i < 12; i++) rotated.pieces[layer * 12 + i] = state.pieces[layer * 12 + (i + shift) % 12];
          expect(classifySq1EpState(rotated)?.[layer]).toBe(label);
        }
      }
      expect(counts).toEqual({ Solved: 1, Opp: 2, Adj: 4, Ua: 4, Ub: 4, 'O+': 1, 'O-': 1, W: 4, H: 1, Z: 2 });
    }
    expect(classifySq1EpState(applySq1Scramble('/'))).toBeNull();
    expect(classifySq1EpState({ pieces: [], sliceSolved: true })).toBeNull();
  });

  it('corrects every stored variant, preserves all 181 originals and fills only the two gaps', () => {
    expect(plan.counts).toEqual({ cases: 100, before: 181, after: 183 });
    expect(plan.moves).toHaveLength(21);
    expect(plan.derived.map(d => d.target)).toEqual([9497, 9500]);
    expect(plan.after.cases.map(c => c.id)).toEqual(before.cases.map(c => c.id));
    expect(plan.after.cases.map(c => c.name)).toEqual(before.cases.map(c => c.name));
    const entries = plan.after.cases.flatMap(c => c.algs.flat());
    for (const c of before.cases) for (const entry of c.algs.flat()) {
      expect(entries).toContainEqual(entry.setup === undefined ? { ...entry, setup: c.setup } : entry);
    }
    expect(plan.after.cases.map(c => c.subgroup)).toEqual(before.cases.map(c => c.subgroup));
    // Every candidate and representative is physically traced inside the planner.
    const recheck = planSq1EpCorrection(plan.after);
    expect(recheck.changedIds).toEqual([]);
    expect(recheck.moves).toEqual([]);
    expect(recheck.derived).toEqual([]);
  });

  it('rejects a broken algorithm before producing a write plan', () => {
    const broken = structuredClone(before);
    broken.cases.find(c => c.name === 'Solved / Ua')!.algs[0][0].alg = '/';
    expect(() => planSq1EpCorrection(broken)).toThrow('Invalid or unsolved formula');
  });
});
