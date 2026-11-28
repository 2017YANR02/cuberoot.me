// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { DEFAULT_SITE_SETTINGS, type SiteSettings } from '@cuberoot/shared/appearance';
import { startAccountSiteSettings } from '@/lib/account-site-settings';
import { readDeviceSettings } from '@/lib/site-settings-local';
import { setDisplayTimeZone } from '@/lib/display-time-zone';
import { syncSiteSettings } from '@/lib/account-api';
import { siteSettingEdited } from '@/lib/site-setting-change';

const session = vi.hoisted(() => ({ uid: null as number | null, change: () => {} }));
vi.mock('@/lib/auth-store', () => ({
  getAuthUser: () => session.uid === null ? null : { uid: session.uid },
  getRolePreview: () => null,
  subscribeAuthUser: (fn: () => void) => { session.change = fn; return () => {}; },
}));
vi.mock('@/lib/account-api', () => ({ syncSiteSettings: vi.fn() }));
const remote = new Map<number, SiteSettings>();
let stop: () => void;
function login(uid: number | null) { session.uid = uid; session.change(); }
const navigate = (path: string) => history.replaceState(null, '', path);

beforeEach(() => {
  localStorage.clear();
  session.uid = null;
  remote.clear();
  vi.useFakeTimers();
  vi.mocked(syncSiteSettings).mockReset().mockImplementation(async (uid, _signal, update) => {
    if (update) remote.set(uid, { ...(remote.get(uid) ?? update.seed), ...update.patch });
    return remote.get(uid) ?? null;
  });
  navigate('/zh/account?settings=general');
  localStorage.setItem('trainer-lang', 'zh');
  stop = startAccountSiteSettings(navigate);
});
afterEach(() => { stop(); vi.useRealTimers(); localStorage.clear(); });

it('imports device settings only for a new account, restores guests and applies all saved fields on another browser', async () => {
  setDisplayTimeZone('Asia/Shanghai');
  expect(syncSiteSettings).not.toHaveBeenCalled();
  login(1);
  await vi.advanceTimersByTimeAsync(1);
  expect(remote.get(1)?.timeZone).toBe('Asia/Shanghai');
  const personal: SiteSettings = { ...DEFAULT_SITE_SETTINGS, locale: 'en', theme: 'dark', contrast: 'soft',
    accent: '#123456', timeZone: '', deskPetVisible: false, lightBackground: '02', darkBackground: '05',
    lastLightBackground: '02', lastDarkBackground: '05' };
  siteSettingEdited(personal);
  await vi.advanceTimersByTimeAsync(100);
  expect(remote.get(1)).toEqual(personal);
  expect(readDeviceSettings()).toEqual(personal);
  login(null);
  expect(readDeviceSettings()).toMatchObject({ locale: 'zh', theme: 'system', deskPetVisible: true, timeZone: 'Asia/Shanghai' });

  stop(); localStorage.clear();
  setDisplayTimeZone('Asia/Tokyo');
  stop = startAccountSiteSettings(navigate);
  login(1);
  await vi.advanceTimersByTimeAsync(1);
  expect(readDeviceSettings()).toEqual(personal);
  expect(location.pathname).toBe('/account');
  login(2);
  await vi.advanceTimersByTimeAsync(1);
  expect(remote.get(2)).toMatchObject({ timeZone: 'Asia/Tokyo', deskPetVisible: true });
});

it('retains edits when offline and sends only changed fields after reloading', async () => {
  remote.set(1, { ...DEFAULT_SITE_SETTINGS, locale: 'zh', theme: 'dark' });
  login(1); await vi.advanceTimersByTimeAsync(1);
  vi.mocked(syncSiteSettings).mockRejectedValueOnce(new Error('offline'));
  setDisplayTimeZone('America/New_York');
  await vi.advanceTimersByTimeAsync(100);
  stop();
  remote.set(1, { ...remote.get(1)!, accent: 'green' });
  stop = startAccountSiteSettings(navigate);
  await vi.advanceTimersByTimeAsync(1);
  expect(remote.get(1)).toMatchObject({ theme: 'dark', accent: 'green', timeZone: 'America/New_York' });
  expect(vi.mocked(syncSiteSettings).mock.lastCall?.[2]?.patch).toEqual({ timeZone: 'America/New_York' });
});

it('ignores a delayed response after switching accounts', async () => {
  let resolve!: (s: SiteSettings) => void;
  vi.mocked(syncSiteSettings).mockImplementationOnce(() => new Promise(done => { resolve = done; }));
  login(1);
  remote.set(2, { ...DEFAULT_SITE_SETTINGS, locale: 'zh', timeZone: 'Europe/Paris' });
  login(2); await vi.advanceTimersByTimeAsync(1);
  resolve({ ...DEFAULT_SITE_SETTINGS, timeZone: 'Asia/Tokyo' }); await vi.advanceTimersByTimeAsync(1);
  expect(readDeviceSettings().timeZone).toBe('Europe/Paris');
});
