import { afterEach, describe, expect, it, vi } from 'vitest';
import { listPublicMembers, publicMemberBadgeKind } from '@/lib/membership-api';

afterEach(() => vi.unstubAllGlobals());

describe('public membership achievement identity', () => {
  it('distinguishes individual and enterprise plans without granting a badge for admin access', () => {
    expect(publicMemberBadgeKind(undefined)).toBeNull();
    expect(publicMemberBadgeKind({ planSlug: 'admin' })).toBeNull();
    expect(publicMemberBadgeKind({ planSlug: '' })).toBeNull();
    for (const planSlug of ['monthly', 'yearly', 'lifetime', 'monthly_auto_renew']) {
      expect(publicMemberBadgeKind({ planSlug })).toBe('personalMember');
    }
    for (const planSlug of ['enterprise_monthly', 'enterprise_yearly']) {
      expect(publicMemberBadgeKind({ planSlug })).toBe('enterpriseMember');
    }
  });

  it('uses the active public opt-in feed, bypasses stale caching, and forwards cancellation', async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({ members: [
      { wcaId: '2017YANR02', planSlug: 'yearly' },
      { wcaId: 'internal-admin', planSlug: 'admin' },
    ] }), { headers: { 'Content-Type': 'application/json' } }));
    vi.stubGlobal('fetch', fetcher);
    const controller = new AbortController();
    const members = await listPublicMembers(controller.signal);
    expect(members).toEqual([{ wcaId: '2017YANR02', planSlug: 'yearly' }]);
    expect(fetcher).toHaveBeenCalledWith(expect.stringMatching(/\/v1\/membership\/members$/), { signal: controller.signal, cache: 'no-store' });
  });
});
