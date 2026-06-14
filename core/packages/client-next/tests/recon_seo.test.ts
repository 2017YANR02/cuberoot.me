import { describe, it, expect } from 'vitest';
import {
  parseReconId, reconSlug, reconPathSeg, reconCanonical,
} from '@/lib/recon-seo';

describe('parseReconId', () => {
  it('returns a bare numeric id unchanged', () => {
    expect(parseReconId('2375')).toBe('2375');
  });
  it('strips a cosmetic slug suffix, keeping the leading digits', () => {
    expect(parseReconId('2375-feliks-zemdegs-333-7-08')).toBe('2375');
    expect(parseReconId('2375-anything-at-all')).toBe('2375');
  });
  it('preserves leading zeros (id is a string, not a number)', () => {
    expect(parseReconId('007-foo')).toBe('007');
  });
  it('falls back to the whole segment when there are no leading digits', () => {
    expect(parseReconId('abc')).toBe('abc');
    expect(parseReconId('')).toBe('');
  });
});

describe('reconSlug', () => {
  it('builds a kebab slug from an ASCII solver name', () => {
    expect(reconSlug({ id: 1, person: 'Feliks Zemdegs' })).toBe('feliks-zemdegs');
  });
  it('joins solver / event / comp / round', () => {
    expect(
      reconSlug({ id: 2, person: 'Feliks Zemdegs', event: '333', comp: 'WC 2023', round: 'Final' }),
    ).toBe('feliks-zemdegs-333-wc-2023-final');
  });
  it('collapses the × in a display event name to a hyphen', () => {
    // eventNameForSeo('3x3') -> '3×3'; × is non-[a-z0-9] so it splits to 3-3.
    expect(reconSlug({ id: 3, person: 'Max Park', event: '3x3' })).toBe('max-park-3-3');
  });
  it('drops a CJK paren and slugs only the Latin name', () => {
    expect(reconSlug({ id: 5, person: 'Yiheng Wang (王艺衡)' })).toBe('yiheng-wang');
  });
  it('returns empty when nothing ASCII is derivable (CJK-only, no event/comp)', () => {
    expect(reconSlug({ id: 4, person: '王艺衡' })).toBe('');
  });
  it('caps at 60 chars with no trailing partial-word hyphen', () => {
    const slug = reconSlug({
      id: 6,
      person: 'Feliks Zemdegs',
      comp: 'Some Very Long Competition Name That Exceeds The Sixty Character Cap Easily',
    });
    expect(slug.length).toBeLessThanOrEqual(60);
    expect(slug.endsWith('-')).toBe(false);
    expect(slug).toMatch(/^[a-z0-9-]+$/);
    expect(slug.startsWith('feliks-zemdegs-')).toBe(true);
  });
});

describe('reconPathSeg', () => {
  it('emits <id>-<slug> when a slug is derivable', () => {
    expect(reconPathSeg({ id: 2, person: 'Feliks Zemdegs', event: '333' })).toBe('2-feliks-zemdegs-333');
  });
  it('falls back to the bare id when no slug is derivable', () => {
    expect(reconPathSeg({ id: 4, person: '王艺衡' })).toBe('4');
  });
  it('round-trips: parseReconId(reconPathSeg(solve)) === id', () => {
    const solve = { id: 2375, person: 'Feliks Zemdegs', event: '333', comp: 'WC 2023' };
    expect(parseReconId(reconPathSeg(solve))).toBe('2375');
  });
});

describe('reconCanonical', () => {
  it('en is bare, zh under /zh', () => {
    expect(reconCanonical('2375', 'en')).toBe('https://www.cuberoot.me/recon/2375');
    expect(reconCanonical('2375', 'zh')).toBe('https://www.cuberoot.me/zh/recon/2375');
  });
  it('uses the slugged segment when provided', () => {
    expect(reconCanonical('2375', 'en', '2375-feliks')).toBe('https://www.cuberoot.me/recon/2375-feliks');
  });
});
