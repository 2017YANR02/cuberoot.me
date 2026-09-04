import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';

describe('gallery administrator upload access', () => {
  it('uses inherited member access and the editable profile returned by the membership hook', async () => {
    const page = await readFile(new URL('../app/[lang]/gallery/page.tsx', import.meta.url), 'utf8');
    const hook = await readFile(new URL('../hooks/useMembership.ts', import.meta.url), 'utf8');

    expect(page).toContain('const { profile, isMember, loading: membershipLoading, refresh } = useMembership()');
    expect(page).toContain('{isMember && profile ? (');
    expect(page).toContain('profile={profile}');
    expect(hook).not.toContain('if (admin) {');
    expect(hook).toContain('setProfile(r.profile ?? r.membership)');
  });
});
