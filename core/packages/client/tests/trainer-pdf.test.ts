import { describe, expect, it } from 'vitest';
import type { AlgCase } from '@cuberoot/shared';

import { trainerSheetFromCases, type TrainerSheetOptions } from '@/lib/alg_pdf/from_trainer';

function f2lCase(name: string, setup: string, solution = `solution-${name}`): AlgCase {
  return {
    name,
    subgroup: 'Test',
    setup,
    sticker: { kind: 'f2l', fl: '' },
    algs: [[{ alg: solution }]],
  };
}

const CASES = [
  f2lCase('A', 'R'),
  f2lCase('B', 'F'),
  f2lCase('C', 'L'),
];

function options(overrides: Partial<TrainerSheetOptions> = {}): TrainerSheetOptions {
  return {
    puzzle: '3x3',
    set: 'f2l',
    cases: CASES,
    title: '3x3 F2L Practice',
    subtitle: '3 scrambles',
    filename: 'f2l-trainer',
    mode: 'recap',
    probMode: 'uniform',
    recapOrder: 'seq',
    scrambleKind: 'inv',
    scrambleOpts: {
      preAuf: false,
      postAuf: false,
      randomFinalAuf: false,
      f2lSlots: ['FR'],
    },
    showThumb: false,
    pureScramble: false,
    ...overrides,
  };
}

describe('trainer PDF', () => {
  it('prints sequential coverage as numbered scrambles without case names or solutions', async () => {
    const sheet = await trainerSheetFromCases(options());

    expect(sheet.cases.map(c => c.name)).toEqual(['', '', '']);
    expect(sheet.cases.map(c => c.algs)).toEqual([['1. R'], ['2. F'], ['3. L']]);
    expect(sheet.cases.every(c => c.setup === undefined && c.thumb === undefined)).toBe(true);
    expect(JSON.stringify(sheet.cases)).not.toContain('solution-');
    expect(JSON.stringify(sheet.cases)).not.toContain('"A"');
  });

  it('shuffles every selected case exactly once in coverage shuffle mode', async () => {
    const sheet = await trainerSheetFromCases(options({
      recapOrder: 'shuffle',
      random: () => 0,
    }));

    expect(sheet.cases.map(c => c.algs[0])).toEqual(['1. F', '2. L', '3. R']);
    expect(new Set(sheet.cases.map(c => c.algs[0].replace(/^\d+\. /, '')))).toEqual(new Set(['R', 'F', 'L']));
  });

  it('draws independently with replacement in random mode', async () => {
    const sheet = await trainerSheetFromCases(options({
      mode: 'train',
      random: () => 0.99,
    }));

    expect(sheet.cases.map(c => c.algs[0])).toEqual(['1. L', '2. L', '3. L']);
  });

  it('uses pure scramble only for printed text and keeps the raw scramble for the optional image', async () => {
    const annotated = f2lCase('Annotated', "(R U R')");
    const sheet = await trainerSheetFromCases(options({
      cases: [annotated],
      pureScramble: true,
      showThumb: true,
    }));

    expect(sheet.cases[0].algs).toEqual(["1. R U R'"]);
    expect(sheet.cases[0].thumb?.setup).toBe("(R U R')");
  });

  it('covers all enabled AUF and slot endings once per adjustment bag', async () => {
    const repeated = Array.from({ length: 16 }, (_, i) => f2lCase(`F2L-${i}`, 'R'));
    const sheet = await trainerSheetFromCases(options({
      cases: repeated,
      scrambleOpts: {
        preAuf: false,
        postAuf: false,
        randomFinalAuf: true,
        f2lSlots: ['FR', 'FL', 'BL', 'BR'],
      },
      showThumb: true,
      random: () => 0,
    }));

    const endings = sheet.cases.map(c => c.thumb?.setup?.replace(/^R(?:\s+|$)/, '') ?? '');
    expect(new Set(endings)).toEqual(new Set([
      '', 'y', 'y2', "y'",
      'U', 'U y', 'U y2', "U y'",
      'U2', 'U2 y', 'U2 y2', "U2 y'",
      "U'", "U' y", "U' y2", "U' y'",
    ]));
  });
});
