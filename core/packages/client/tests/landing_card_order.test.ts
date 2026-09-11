import { describe, expect, it } from 'vitest';
import { PRIMARY_CARDS, SEARCH_CARDS, SECTIONS, applyLandingCardOrder, isLandingSearchCardVisible } from '@/lib/landing-sections';
import { CREATOR_PROFILE } from '@/lib/creator-profile';

describe('homepage card order', () => {
  it.each(['platform', 'teaching-management', 'learning-center'])('keeps %s visible but locked for non-admins and searchable only by admins', (id) => {
    const card = SECTIONS.find((section) => section.id === 'learn')?.cards.find((entry) => entry.id === id);
    const searchCard = SEARCH_CARDS.find((entry) => entry.id === id)!;
    expect(card?.lockedForNonAdmin).toBe(true);
    expect(card?.adminOnly).toBeUndefined();
    expect(card?.comingSoon).toBeUndefined();
    expect(searchCard.lockedForNonAdmin).toBe(true);
    expect(isLandingSearchCardVisible(searchCard, false)).toBe(false);
    expect(isLandingSearchCardVisible(searchCard, true)).toBe(true);
  });

  it('applies saved known ids once and appends new cards in source order', () => {
    const cards = SECTIONS.find(({ id }) => id === 'tool')!.cards;
    const ordered = applyLandingCardOrder(cards, ['timezone', 'missing', 'timezone', 'contests']);

    expect(ordered.map(({ id }) => id)).toEqual([
      'timezone',
      'contests',
      ...cards.map(({ id }) => id).filter((id) => id !== 'timezone' && id !== 'contests'),
    ]);
  });

  it('groups the competition system, online competitions, and simulation first', () => {
    const toolCards = SECTIONS.find(({ id }) => id === 'tool')?.cards;

    expect(PRIMARY_CARDS.some(({ id }) => id === 'comp-sim')).toBe(false);
    expect(toolCards?.slice(0, 3).map(({ id }) => id)).toEqual(['contests', 'online-competitions', 'comp-sim']);
  });

  it('links the learning section to the complete notation guide', () => {
    const learnCards = SECTIONS.find(({ id }) => id === 'learn')?.cards;

    expect(learnCards).toContainEqual(expect.objectContaining({
      id: 'notation',
      href: '/notation',
      internal: true,
    }));
  });

  it('links the homepage to the contact page', () => {
    const otherCards = SECTIONS.find(({ id }) => id === 'other')?.cards;

    expect(otherCards).toContainEqual(expect.objectContaining({
      id: 'contact',
      href: '/contact',
      internal: true,
    }));
  });

  it('links the homepage to the music player', () => {
    const otherCards = SECTIONS.find(({ id }) => id === 'other')?.cards;

    expect(otherCards).toContainEqual(expect.objectContaining({
      id: 'music',
      href: '/music',
      internal: true,
    }));
  });

  it('links the homepage directly to the creator profile', () => {
    const otherCards = SECTIONS.find(({ id }) => id === 'other')?.cards;

    expect(otherCards).toContainEqual(expect.objectContaining({
      id: 'creator',
      href: CREATOR_PROFILE.href,
      internal: true,
    }));
  });
});
