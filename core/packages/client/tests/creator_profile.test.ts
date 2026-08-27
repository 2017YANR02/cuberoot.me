import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { AWARD_GROUPS, EDUCATION } from '@/app/[lang]/about/ruimin/profile-data';
import { CREATOR_PROFILE, creatorProfileHrefForWcaId } from '@/lib/creator-profile';

describe('creator profile', () => {
  it('maps only Ruimin Yan\'s WCA ID to the profile route', () => {
    expect(creatorProfileHrefForWcaId(CREATOR_PROFILE.wcaId)).toBe(CREATOR_PROFILE.href);
    expect(creatorProfileHrefForWcaId('2017OTHER01')).toBeNull();
    expect(creatorProfileHrefForWcaId(null)).toBeNull();
  });

  it('keeps the four resume education entries, including the presidential scholarship', () => {
    expect(EDUCATION).toHaveLength(4);
    expect(EDUCATION[0]?.note?.en).toContain('USD 10,000 per year');
  });

  it('ships all ten award photographs inside the client public directory', () => {
    const awards = AWARD_GROUPS.flatMap((group) => group.awards);
    expect(awards).toHaveLength(10);
    expect(new Set(awards.map((award) => award.image)).size).toBe(10);

    for (const award of awards) {
      expect(award.image).toMatch(/^\/images\/ruimin\/awards\/[a-z0-9-]+\.webp$/);
      expect(existsSync(join(process.cwd(), 'public', award.image.slice(1)))).toBe(true);
    }
  });
});
