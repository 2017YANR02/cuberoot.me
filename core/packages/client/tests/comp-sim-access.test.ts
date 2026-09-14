import { afterEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { proxy } from '@/proxy';
import { verifyForumPageAccess } from '@/lib/page-admin-session';

const profile = { fullName: 'Test User', birthDate: '2000-01-01', gender: 'male', countryIso2: 'CN', regionCode: 'GD', cityName: 'Shenzhen', countrySource: 'self' };
function mockProfile(value: unknown, status = 200, locked = false, role: 'login' | 'user' | 'admin' = 'login') {
  const fetcher = vi.fn(async (url: string) => {
    if (url.includes('home-locks')) return Response.json({ locks: { 'comp-sim': locked } });
    if (url.includes('/auth/me')) return role === 'login' ? new Response(null, { status: 401 })
      : Response.json({ user: { uid: 42, wcaId: null, name: 'Test', avatar: '', avatarSource: 'auto', avatarPreset: null, isAdmin: role === 'admin' } });
    return Response.json({ profile: value }, { status });
  });
  vi.stubGlobal('fetch', fetcher);
  return fetcher;
}
afterEach(() => vi.unstubAllGlobals());

describe('forum profile eligibility remains independent from public practice', () => {
  it('requires a verified session and rejects expired sessions', async () => {
    const fetcher = mockProfile(profile, 401);
    expect(await verifyForumPageAccess('')).toBe('login');
    expect(fetcher).not.toHaveBeenCalled();
    expect(await verifyForumPageAccess('expired')).toBe('login');
  });
  it('allows complete profiles and existing forum exemptions, but never banned users', async () => {
    mockProfile(profile);
    expect(await verifyForumPageAccess('token')).toBe('allowed');
    for (const field of ['fullName', 'birthDate', 'gender', 'countryIso2', 'regionCode', 'cityName']) {
      mockProfile({ ...profile, [field]: null });
      expect(await verifyForumPageAccess('token')).toBe('profile');
    }
    mockProfile({ ...profile, fullName: null, forumProfileExempt: true });
    expect(await verifyForumPageAccess('token')).toBe('allowed');
    mockProfile({ ...profile, forumProfileExempt: true, forumBanned: true });
    expect(await verifyForumPageAccess('token')).toBe('banned');
  });
  it('fails closed when the profile service fails or omits the profile', async () => {
    mockProfile(null);
    await expect(verifyForumPageAccess('token')).rejects.toThrow();
    mockProfile(null, 503);
    await expect(verifyForumPageAccess('token')).rejects.toThrow();
  });
  it('serves practice for guests and every session without profile or role checks', async () => {
    const fetcher = vi.fn(async () => { throw new Error('offline'); });
    vi.stubGlobal('fetch', fetcher);
    for (const path of ['/comp-sim', '/zh/comp-sim', '/en/comp-sim/', '/zh/comp-sim/child', '/comp-sim?_rsc=abc']) {
      for (const token of ['', 'member', 'expired', 'admin']) {
        const response = await proxy(new NextRequest(`https://cuberoot.me${path}`, {
          headers: { cookie: `cuberoot_page_session=${token}` },
        }));
        expect(response.status).toBe(200);
        expect(response.headers.get('location')).toBeNull();
      }
    }
    expect(fetcher).not.toHaveBeenCalled();
  });
});
