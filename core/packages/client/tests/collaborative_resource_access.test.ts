import { describe, expect, it } from 'vitest';
import { SECTIONS } from '@/lib/landing-sections';

describe('collaborative resource entry points', () => {
  it('keeps document and spreadsheet cards visible to every visitor', () => {
    const cards = SECTIONS.flatMap((section) => section.cards);
    for (const [id, href] of [['documents', '/docs'], ['spreadsheets', '/sheets']] as const) {
      expect(cards.find((card) => card.id === id)).toMatchObject({ href, internal: true });
      expect(cards.find((card) => card.id === id)?.adminOnly).not.toBe(true);
    }
  });
});
