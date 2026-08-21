import { describe, expect, it } from 'vitest';
import { CUBE_OPPOSITE_FACE } from '@/lib/cube-colors';
import {
  ALL_COLOR_PAIRS,
  CUBE_COLOR_FACES,
  buildColorRound,
  getColorRelation,
} from '@/app/[lang]/color-test/_lib/relations';
import { SEARCH_CARDS, SECTIONS } from '@/lib/landing-sections';

describe('cube colour relationships', () => {
  it('covers all 15 unordered pairs exactly once', () => {
    expect(CUBE_COLOR_FACES).toHaveLength(6);
    expect(ALL_COLOR_PAIRS).toHaveLength(15);
    expect(new Set(ALL_COLOR_PAIRS.map(({ first, second }) => [first, second].sort().join(''))).size).toBe(15);
  });

  it('classifies exactly the three opposite pairs', () => {
    const opposites = ALL_COLOR_PAIRS.filter(({ relation }) => relation === 'opposite');
    expect(opposites).toHaveLength(3);
    for (const { first, second } of opposites) {
      expect(CUBE_OPPOSITE_FACE[first]).toBe(second);
    }
    expect(getColorRelation('U', 'U')).toBeNull();
    expect(getColorRelation('R', 'F')).toBe('adjacent');
  });

  it('builds a shuffled copy without losing or duplicating pairs', () => {
    const round = buildColorRound(() => 0);
    expect(round).not.toBe(ALL_COLOR_PAIRS);
    expect(round).toHaveLength(15);
    expect(new Set(round.map(({ first, second }) => [first, second].sort().join(''))).size).toBe(15);
    expect(ALL_COLOR_PAIRS[0]).toEqual({ first: 'U', second: 'D', relation: 'opposite' });
  });
});

describe('colour-test discovery', () => {
  it('uses one homepage hub card and keeps both tests searchable', () => {
    const train = SECTIONS.find(({ id }) => id === 'train');
    expect(train?.cards.some(({ id, href }) => id === 'color-test' && href === '/color-test')).toBe(true);
    expect(train?.cards.some(({ id }) => id === 'stroop')).toBe(false);
    expect(SEARCH_CARDS.some(({ href }) => href === '/color-test/relations')).toBe(true);
    expect(SEARCH_CARDS.some(({ href }) => href === '/stroop')).toBe(true);
  });
});
