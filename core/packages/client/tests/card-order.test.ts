import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { ACCOUNT_CARD_IDS } from '@cuberoot/shared/site-directory';
import { applyCardOrder } from '@/lib/card-order';

describe('shared card order', () => {
  it('keeps the complete account ordering contract aligned with conditional page entries', () => {
    const source = readFileSync(new URL('../app/[lang]/account/page.tsx', import.meta.url), 'utf8');
    const keys = [...source.matchAll(/key: '([^']+)'/g)].map(match => match[1]);
    expect([...ACCOUNT_CARD_IDS]).toEqual(['pet', ...keys]);
  });
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
