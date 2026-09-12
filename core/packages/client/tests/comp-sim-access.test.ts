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

describe('competition practice uses forum eligibility', () => {
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
  it('protects bare, localized, trailing-slash, descendant and RSC requests', async () => {
    mockProfile(profile);
    for (const path of ['/comp-sim', '/zh/comp-sim', '/en/comp-sim/', '/zh/comp-sim/child', '/comp-sim?_rsc=abc']) {
      const response = await proxy(new NextRequest(`http://localhost${path}`));
      expect(response.status).toBe(307);
      const target = new URL(response.headers.get('location')!);
      expect(target.pathname.replace(/\/$/, '')).toBe(path.startsWith('/zh/') ? '/zh/account' : '/account');
      expect(target.searchParams.has('require')).toBe(false);
      expect(target.searchParams.get('next')).toBe(path.split('?')[0]);
      expect(target.searchParams.get('next')).not.toContain('_rsc');
      expect(response.headers.get('Cache-Control')).toBe('private, no-store');
    }
  });
  it('sends signed-in ordinary users home regardless of profile completeness or page lock', async () => {
    for (const locked of [false, true]) {
      for (const saved of [profile, { ...profile, fullName: null }]) {
        mockProfile(saved, 200, locked, 'user');
        for (const [path, home] of [['/comp-sim', '/'], ['/en/comp-sim/', '/'], ['/zh/comp-sim?next=foo&_rsc=a', '/zh']]) {
          const response = await proxy(new NextRequest(`http://localhost${path}`, { headers: { cookie: 'cuberoot_page_session=token' } }));
          expect(response.status).toBe(307);
          const target = new URL(response.headers.get('location')!);
          expect(target.pathname.replace(/\/$/, '') || '/').toBe(home);
          expect(target.search).toBe('');
          expect(response.headers.get('Cache-Control')).toBe('private, no-store');
        }
      }
    }
  });
  it('keeps administrators on the training page even without a complete profile', async () => {
    for (const locked of [false, true]) {
      const fetcher = mockProfile(null, 200, locked, 'admin');
      const response = await proxy(new NextRequest('http://localhost/zh/comp-sim', { headers: { cookie: 'cuberoot_page_session=token' } }));
      expect(response.status).toBe(200);
      expect(response.headers.get('location')).toBeNull();
      expect(fetcher.mock.calls.some(([url]) => url.includes('/auth/profile'))).toBe(false);
    }
  });
});
