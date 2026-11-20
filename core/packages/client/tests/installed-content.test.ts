import { afterEach, describe, expect, it, vi } from 'vitest';
import { installedContentUnavailable } from '@cuberoot/shared/installed-content';
import { MOBILE_EMBED_FRAME_NAMES, MOBILE_EMBED_NO_GENERATIVE_AI_FRAME_NAMES, mobileEmbedSurfaceFromFrameName } from '@cuberoot/shared/mobile-embed';
import { resolveAccountAvatar } from '@/lib/account-avatar';
import { installedCommunityDisabled, installedGenerativeAiDisabled, installedPetAvailable, isInstalledCommunityHref } from '@/lib/installed-content';
import { GET as installedForumRegion } from '@/app/api/installed-forum/route';
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });
describe('first-release installed content exclusions', () => {
  it.each(['/music', '/zh/music/song/123', '/alg/sq1/pbl', '/zh/alg/sq1/pbl/case/1', '/alg/sq1/pbl-finder', '/alg/sq1/karnaukh-notation', '/zh/alg/sq1/karnaukh-notation', '/pets?pet=clawd'])('blocks %s', href => {
    expect(installedContentUnavailable(href)).toBe(true);
  });
  it.each(['/timer', '/account', '/alg/sq1', '/pets?pet=rootbeast'])('preserves %s', href => {
    expect(installedContentUnavailable(href)).toBe(false);
  });
  it.each(['/chat', '/zh/chat/share?id=example', 'https://www.cuberoot.me/en/chat/share', '/zh/%63hat'])(
    'blocks %s only in the installed release without generative AI', href => {
      expect(installedContentUnavailable(href, true)).toBe(true);
      expect(installedContentUnavailable(href)).toBe(false);
    },
  );
  it.each(['tools', 'account'] as const)('retains the %s bridge with generative AI disabled', surface => {
    const name = MOBILE_EMBED_NO_GENERATIVE_AI_FRAME_NAMES[surface];
    expect(mobileEmbedSurfaceFromFrameName(name)).toBe(surface);
    vi.stubGlobal('window', { parent: {}, name });
    expect(installedGenerativeAiDisabled()).toBe(true);
    expect(installedContentUnavailable(`/${surface}`, true)).toBe(false);
    vi.stubGlobal('window', { parent: {}, name: MOBILE_EMBED_FRAME_NAMES[surface] });
    expect(installedGenerativeAiDisabled()).toBe(false);
  });
  it('withholds existing and default Clawd avatars only in installed surfaces', () => {
    vi.stubGlobal('window', { parent: {}, name: 'cuberoot-mobile-account' });
    expect(installedPetAvailable('clawd')).toBe(false);
    expect(installedPetAvailable('rootbeast')).toBe(true);
    expect(resolveAccountAvatar(null, null).src).toBe('/icons/CubeRoot.png');
    expect(resolveAccountAvatar('/deskpet/clawd.svg', null, 'clawd').isClawd).toBe(false);
    expect(resolveAccountAvatar('/uploads/avatar.webp', null, 'upload').src).toBe('/uploads/avatar.webp');
    vi.unstubAllGlobals();
    expect(installedPetAvailable('clawd')).toBe(true);
    expect(resolveAccountAvatar(null, null).isClawd).toBe(true);
  });
});

describe('regional community availability on Apple App Store clients', () => {
  it.each([
    '/forum', '/zh/forum/t/42', '/forum/new', '/en/%66orum/search', '/platform/community/posts/new',
    '/zh/platform/admin/community', 'https://www.cuberoot.me/forum/feed', '/zh/feedback', '/quiz/new?edit=1',
    '/zh/recon/42/alt', '/recon/42/alt/new', '/recon/42/alt/1/edit', '/timer/watch#session',
    '/zh/timer?share=42', '/timer?r=sample', '/timer?replay=sample', '/timer?players=net&room=sample',
    '/calendar/s/abc',
  ])('recognizes the restricted destination %s', href => {
    expect(isInstalledCommunityHref(href)).toBe(true);
  });

  it.each(['/forum-guide', '/platform/courses', 'https://community.example/forum', '/recon/submit/42',
    '/recon/42/alt/1', '/timer', '/timer?players=2', '/drive', '/docs/edit?id=123', '/calendar'])('preserves destinations such as %s', href => {
    expect(isInstalledCommunityHref(href)).toBe(false);
  });

  it('withholds public community features before region verification only in Apple store frames', () => {
    expect(installedCommunityDisabled()).toBe(false);
    vi.stubGlobal('window', { parent: {}, name: MOBILE_EMBED_FRAME_NAMES.tools });
    expect(installedCommunityDisabled()).toBe(false);
    vi.stubGlobal('window', { parent: {}, name: MOBILE_EMBED_NO_GENERATIVE_AI_FRAME_NAMES.tools });
    expect(installedCommunityDisabled()).toBe(true);
  });

  it.each([
    ['1', { 'x-vercel-ip-country': 'CN', 'x-cuberoot-cn-exempt': '0' }, false],
    ['1', { 'x-vercel-ip-country': 'HK' }, true],
    ['1', { 'x-vercel-ip-country': 'US' }, true],
    ['1', { 'x-vercel-ip-country': 'XX' }, false],
    ['1', { 'x-cuberoot-cn-exempt': '0' }, false],
    ['', { 'x-cuberoot-cn-exempt': '1', 'x-vercel-ip-country': 'US' }, false],
    ['', { 'x-cuberoot-cn-exempt': '0' }, true],
    ['', {}, false],
  ] as const)('uses only the visitor region supplied by the active ingress (%s, %j)', async (vercel, headers, available) => {
    vi.stubEnv('VERCEL', vercel);
    const response = installedForumRegion(new Request('https://cuberoot.me/api/installed-forum', { headers }));
    expect(response.headers.get('Cache-Control')).toBe('private, no-store');
    expect(response.headers.get('Access-Control-Allow-Origin')).toBe('*');
    expect(await response.json()).toEqual({ available });
  });
});
