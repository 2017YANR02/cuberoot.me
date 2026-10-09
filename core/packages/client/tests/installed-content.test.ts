import { afterEach, describe, expect, it, vi } from 'vitest';
import { installedContentUnavailable } from '@cuberoot/shared/installed-content';
import { resolveAccountAvatar } from '@/lib/account-avatar';
import { installedPetAvailable } from '@/lib/installed-content';
afterEach(() => vi.unstubAllGlobals());
describe('first-release installed content exclusions', () => {
  it.each(['/music', '/zh/music/song/123', '/alg/sq1/pbl', '/zh/alg/sq1/pbl/case/1', '/alg/sq1/pbl-finder', '/alg/sq1/karnaukh-notation', '/zh/alg/sq1/karnaukh-notation', '/pets?pet=clawd'])('blocks %s', href => {
    expect(installedContentUnavailable(href)).toBe(true);
  });
  it.each(['/timer', '/account', '/alg/sq1', '/pets?pet=rootbeast'])('preserves %s', href => {
    expect(installedContentUnavailable(href)).toBe(false);
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
