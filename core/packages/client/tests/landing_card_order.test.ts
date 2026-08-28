import { describe, expect, it } from 'vitest';
import { PRIMARY_CARDS, SECTIONS } from '@/lib/landing-sections';
import { CREATOR_PROFILE } from '@/lib/creator-profile';

describe('homepage card order', () => {
  it('places competition simulation immediately to the right of competition system', () => {
    const toolCards = SECTIONS.find(({ id }) => id === 'tool')?.cards;

    expect(PRIMARY_CARDS.some(({ id }) => id === 'comp-sim')).toBe(false);
    expect(toolCards?.slice(0, 2).map(({ id }) => id)).toEqual(['contests', 'comp-sim']);
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

  it('links the homepage directly to the creator profile', () => {
    const otherCards = SECTIONS.find(({ id }) => id === 'other')?.cards;

    expect(otherCards).toContainEqual(expect.objectContaining({
      id: 'creator',
      href: CREATOR_PROFILE.href,
      internal: true,
    }));
  });
});
