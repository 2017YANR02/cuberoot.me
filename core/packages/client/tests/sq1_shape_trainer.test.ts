import { describe, expect, it } from 'vitest';
import { applySq1Scramble } from '@cuberoot/shared/sq1-notation';
import { SQ1_SHAPES } from '@/lib/sq1-shapes';
import {
  SQ1_CSP_PAIR_KEYS,
  filterSq1ShapePairGroups,
  generateSq1ShapeScramble,
  groupSq1ShapePairs,
  pickSq1ShapePair,
  sq1CspCaseIndex,
  sq1ParityAtDefaultLayerPositions,
  sq1ShapeTrainerRepeatAction,
} from '@/lib/sq1-tools';

const SQUARE_SAMPLES = [
  '(1,-3)/ (3,0)/ (-4,2)/ (4,0)/ (-3,-3)/ (-5,0)/ (0,-2)/ (4,0)/ (0,-4)/ (-2,0)/ (0,-1)/ (-3,-3)/ (-1,0)/ (3,0)',
  '(-3,-4)/ (1,-5)/ (0,-3)/ (-3,0)/ (-1,-4)/ (0,-3)/ (0,-5)/ (6,0)/ (6,0)/ (-5,0)/',
  '(0,2)/ (0,-3)/ (-3,-3)/ (-2,-5)/ (-3,0)/ (3,-4)/ (0,-3)/ (-3,-3)/ (0,-3)/ (3,0)',
  '(-5,0)/ (5,2)/ (0,3)/ (3,0)/ (-2,-2)/ (-3,0)/ (3,-4)/ (3,0)/ (0,-3)/ (0,-3)/ (3,0)/ (0,-4)/',
  '(4,0)/ (0,-3)/ (2,-1)/ (3,-2)/ (3,0)/ (-3,-4)/ (-5,-4)/ (-4,0)/ (-4,0)/ (1,-4)/ (-3,-4)/ (3,0)/',
  '(-2,3)/ (-3,0)/ (-1,-1)/ (-2,-3)/ (0,-3)/ (5,-2)/ (2,-2)/ (2,-2)/ (2,-5)/ (3,0)/ (-5,0)/ (6,0)',
] as const;

describe('SQ1 shape trainer sampling', () => {
  it('locks cstimer\'s 90 unique unordered legal shape pairs', () => {
    expect(SQ1_CSP_PAIR_KEYS).toHaveLength(90);
    expect(new Set(SQ1_CSP_PAIR_KEYS)).toHaveLength(90);
    const names = new Set<string>(SQ1_SHAPES.map((shape) => shape.name));
    for (const key of SQ1_CSP_PAIR_KEYS) {
      for (const name of key.split(' / ')) expect(names.has(name)).toBe(true);
    }
    expect(sq1CspCaseIndex('Star', '8')).toBe(0);
    expect(sq1CspCaseIndex('8', 'Star')).toBe(0);
    expect(sq1CspCaseIndex('Square', 'Square')).toBe(12);
  });

  it('groups duplicate DB rows before selection and filters ordered layer ranges', () => {
    const groups = groupSq1ShapePairs([
      { id: 'a', top: 'Square', bottom: 'Kite' },
      { id: 'b', top: 'Square', bottom: 'Kite' },
      { id: 'c', top: 'Kite', bottom: 'Square' },
      { id: 'd', top: 'Square', bottom: 'Square' },
    ]);
    expect(groups).toHaveLength(2);
    const filtered = filterSq1ShapePairGroups(
      groups,
      new Set(['Kite']),
      new Set(['Square']),
      new Set(),
    );
    expect(filtered).toHaveLength(1);
    expect(filtered[0].variants.map((item) => item.id)).toEqual(['c']);
    expect(filterSq1ShapePairGroups(groups, new Set(['Kite']), new Set(['Square']), new Set([filtered[0].key]))).toEqual([]);

    const all = new Set(['Kite', 'Square']);
    expect(filterSq1ShapePairGroups(groups, new Set(), all, new Set())).toEqual([]);
    expect(filterSq1ShapePairGroups(groups, all, new Set(), new Set())).toEqual([]);
    expect(filterSq1ShapePairGroups(groups, all, all, new Set())).toHaveLength(2);
  });

  it('selects unordered groups uniformly instead of weighting their variant count', () => {
    const groups = groupSq1ShapePairs([
      { top: 'Square', bottom: 'Kite' },
      { top: 'Square', bottom: 'Kite' },
      { top: 'Square', bottom: 'Square' },
      { top: 'Star', bottom: '8' },
    ]);
    expect(groups).toHaveLength(3);
    expect(pickSq1ShapePair(groups, () => 0)?.key).toBe(groups[0].key);
    expect(pickSq1ShapePair(groups, () => 0.5)?.key).toBe(groups[1].key);
    expect(pickSq1ShapePair(groups, () => 0.999)?.key).toBe(groups[2].key);
  });

  it('maps all four R-prefix shortcuts and ignores unrelated keys', () => {
    expect(['r', 's', 'o', 'f'].map(sq1ShapeTrainerRepeatAction)).toEqual([
      'repeat',
      'same-parity',
      'opposite-parity',
      'swap-layers',
    ]);
    expect(sq1ShapeTrainerRepeatAction('x')).toBeNull();
  });

  it('retries until parity and middle strategy match', async () => {
    const byParity = new Map(SQUARE_SAMPLES.map((scramble) => [
      sq1ParityAtDefaultLayerPositions(applySq1Scramble(scramble)),
      scramble,
    ]));
    expect([...byParity.keys()].sort()).toEqual(['even', 'odd']);
    const normal = SQUARE_SAMPLES.find((scramble) => applySq1Scramble(scramble).sliceSolved)!;
    const flipped = SQUARE_SAMPLES.find((scramble) => !applySq1Scramble(scramble).sliceSolved)!;
    expect(normal).toBeTruthy();
    expect(flipped).toBeTruthy();

    const parityCalls = [byParity.get('even')!, byParity.get('odd')!];
    const odd = await generateSq1ShapeScramble({
      pairKey: 'Square / Square',
      allowedOrientations: [{ top: 'Square', bottom: 'Square' }],
      parity: 'odd',
      middle: 'random',
    }, async () => parityCalls.shift()!);
    expect(odd.parity).toBe('odd');

    const middleCalls = [normal, flipped];
    const alwaysFlipped = await generateSq1ShapeScramble({
      pairKey: 'Square / Square',
      allowedOrientations: [{ top: 'Square', bottom: 'Square' }],
      middle: 'always',
    }, async () => middleCalls.shift()!);
    expect(alwaysFlipped.middleFlipped).toBe(true);
  });

  it('Repeat rejects the previous scramble and accepts a fresh layer rotation', async () => {
    const previous = '(3, 0)';
    const calls = [previous, '(6, 0)'];
    const next = await generateSq1ShapeScramble({
      pairKey: 'Square / Square',
      allowedOrientations: [{ top: 'Square', bottom: 'Square' }],
      middle: 'never',
      previousScramble: previous,
    }, async () => calls.shift()!);
    expect(next.scramble).not.toBe(previous);
    expect(next.scramble).toBe('(6, 0)');
    expect(next.top).toBe('Square');
    expect(next.bottom).toBe('Square');
  });
});
