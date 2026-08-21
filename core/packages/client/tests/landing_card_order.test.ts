import { describe, expect, it } from 'vitest';
import { PRIMARY_CARDS, SECTIONS } from '@/lib/landing-sections';

describe('homepage card order', () => {
  it('places competition simulation immediately to the right of competition system', () => {
    const toolCards = SECTIONS.find(({ id }) => id === 'tool')?.cards;

    expect(PRIMARY_CARDS.some(({ id }) => id === 'comp-sim')).toBe(false);
    expect(toolCards?.slice(0, 2).map(({ id }) => id)).toEqual(['contests', 'comp-sim']);
  });
});
