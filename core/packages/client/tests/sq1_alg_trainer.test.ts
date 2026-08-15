import { describe, expect, it } from 'vitest';
import { invertSq1Alg } from '@cuberoot/shared/sq1-notation';
import {
  SQ1_ALG_TRAINER_CASES,
  SQ1_ALG_TRAINER_GROUPS,
  chooseSq1AlgTrainerCase,
  createSq1AlgTrainerRound,
  normalizeSquanmateSq1Algorithm,
} from '@/lib/sq1-alg-trainer';
import { sq1ParityAtDefaultLayerPositions, traceSq1Algorithm } from '@/lib/sq1-tools';

function seededRandom(seedText: string): () => number {
  let seed = [...seedText].reduce((value, char) => Math.imul(value ^ char.charCodeAt(0), 16777619), 2166136261) >>> 0;
  return () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 0x1_0000_0000;
  };
}

function valuesRandom(values: readonly number[]): () => number {
  let index = 0;
  return () => values[Math.min(index++, values.length - 1)]!;
}

describe('Square-1 algorithm trainer data', () => {
  it('keeps Squanmate’s five groups and all 232 parity-aware cases', () => {
    expect(SQ1_ALG_TRAINER_GROUPS.map((group) => [group.label, group.cases.length])).toEqual([
      ['Cubeshape', 2],
      ['Edge permutation (EP)', 99],
      ['Permute last layer (PLL)', 43],
      ['Lin corner permutation', 16],
      ['Lin PLL+1', 72],
    ]);
    expect(SQ1_ALG_TRAINER_CASES).toHaveLength(232);
    expect(new Set(SQ1_ALG_TRAINER_CASES.map((item) => item.id)).size).toBe(232);
    expect(SQ1_ALG_TRAINER_GROUPS.map((group) => ({
      even: group.cases.filter((item) => item.parity === 'even').length,
      odd: group.cases.filter((item) => item.parity === 'odd').length,
    }))).toEqual([
      { even: 1, odd: 1 },
      { even: 49, odd: 50 },
      { even: 21, odd: 22 },
      { even: 8, odd: 8 },
      { even: 72, odd: 0 },
    ]);
  });

  it('normalizes M2, U/D aliases, curly primes, stars, and top-only turns', () => {
    const normalized = normalizeSquanmateSq1Algorithm("M2 U’ D2 U' D * / -1");
    expect(normalized).toContain('(1, 0) / (-1, -1) / (0, 1)');
    expect(normalized).toContain('(-3, 0)');
    expect(normalized).toContain('(0, 6)');
    expect(normalized).toContain('(0, 3)');
    expect(normalized).toContain('(-1, 0)');
    expect(normalized).not.toMatch(/[MUD*’]/);
    expect(() => normalizeSquanmateSq1Algorithm('R2')).toThrow('Unsupported Squanmate notation');
  });

  it('parses every upstream solving algorithm and produces a legal inverse setup', () => {
    for (const item of SQ1_ALG_TRAINER_CASES) {
      if (!item.algorithm) continue;
      const normalized = normalizeSquanmateSq1Algorithm(item.algorithm);
      expect(normalized, item.id).not.toBe('');
      expect(traceSq1Algorithm(invertSq1Alg(normalized)), item.id).toMatchObject({ ok: true });
    }
  });
});

describe('Square-1 algorithm trainer rounds', () => {
  it('generates legal setups with the requested case parity and middle state', () => {
    for (const item of SQ1_ALG_TRAINER_CASES) {
      const solvedMiddle = createSq1AlgTrainerRound(item, 'never', seededRandom(item.id));
      const flippedMiddle = createSq1AlgTrainerRound(item, 'always', seededRandom(item.id));
      const parity = sq1ParityAtDefaultLayerPositions(solvedMiddle.state);

      expect(traceSq1Algorithm(solvedMiddle.scramble), item.id).toMatchObject({ ok: true });
      expect(solvedMiddle.state.sliceSolved, item.id).toBe(true);
      expect(flippedMiddle.state.sliceSolved, item.id).toBe(false);
      expect(flippedMiddle.state.pieces, item.id).toEqual(solvedMiddle.state.pieces);
      expect(parity, item.id).toBe(item.parity);
    }
  }, 30_000);

  it('chooses only from the selected case ids', () => {
    const wanted = SQ1_ALG_TRAINER_CASES[120]!;
    expect(chooseSq1AlgTrainerCase(new Set([wanted.id]), () => 0)?.id).toBe(wanted.id);
    expect(chooseSq1AlgTrainerCase(new Set(), () => 0)).toBeNull();
  });

  it('uses the random middle strategy without changing the outer pieces', () => {
    const item = SQ1_ALG_TRAINER_CASES.find((candidate) => candidate.groupId === 'edge-permutation')!;
    const flipped = createSq1AlgTrainerRound(item, 'random', valuesRandom([0, 0, 0]));
    const solved = createSq1AlgTrainerRound(item, 'random', valuesRandom([0, 0, 0.9]));

    expect(flipped.middleFlipped).toBe(true);
    expect(solved.middleFlipped).toBe(false);
    expect(flipped.state.pieces).toEqual(solved.state.pieces);
  });
});
