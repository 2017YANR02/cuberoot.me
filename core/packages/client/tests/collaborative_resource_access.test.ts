import { describe, expect, it } from 'vitest';
import { SECTIONS } from '@/lib/landing-sections';

describe('collaborative resource entry points', () => {
  it('keeps one collaborative docs entry visible to every visitor', () => {
    const cards = SECTIONS.flatMap((section) => section.cards);
    for (const [id, href] of [['documents', '/docs']] as const) {
      expect(cards.find((card) => card.id === id)).toMatchObject({ href, internal: true });
      expect(cards.find((card) => card.id === id)?.adminOnly).not.toBe(true);
    }
    expect(cards.some((card) => card.id === 'spreadsheets' || card.href === '/sheets')).toBe(false);
  });
});
