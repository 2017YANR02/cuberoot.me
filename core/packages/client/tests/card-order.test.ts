import { describe, expect, it } from 'vitest';
import { applyCardOrder } from '@/lib/card-order';

describe('shared card order', () => {
  const cards = [{ id: 'pet' }, { id: 'wca' }, { id: 'progress' }];
  it('uses source order without saved preferences and handles an empty grid', () => {
    expect(applyCardOrder(cards, [])).toEqual(cards);
    expect(applyCardOrder([], ['pet'])).toEqual([]);
  });
  it('ignores unavailable and duplicate cards while appending newly visible cards', () => {
    expect(applyCardOrder(cards, ['progress', 'admin', 'progress', 'pet']).map(card => card.id))
      .toEqual(['progress', 'pet', 'wca']);
    expect(applyCardOrder(cards.filter(card => card.id !== 'wca'), ['wca', 'progress', 'pet']).map(card => card.id))
      .toEqual(['progress', 'pet']);
    expect(cards.map(card => card.id)).toEqual(['pet', 'wca', 'progress']);
  });
});
