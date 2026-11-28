import { DEFAULT_SITE_SETTINGS, decodeSiteSettingsPatch, type SiteSettings } from '@cuberoot/shared/appearance';
import { getAuthUser, getRolePreview, subscribeAuthUser } from './auth-store';
import { syncSiteSettings } from './account-api';
import { applyDeviceSettings, cachedSettings, forget, readDeviceSettings, save, stored } from './site-settings-local';
import { SITE_SETTING_EDIT } from './site-setting-change';

const PREFIX = 'cuberoot.site-settings.';
const OWNER = PREFIX + 'active';
const GUEST = PREFIX + 'guest';
const fields = Object.keys(DEFAULT_SITE_SETTINGS) as (keyof SiteSettings)[];
const profileKey = (uid: number) => PREFIX + uid;
const editKey = (uid: number, field: string) => profileKey(uid) + '.edit.' + field;

// Keep individual fields durable until acknowledged. Changing the accent in
// one tab must not replace a pending time-zone edit in another.
function pending(uid: number): Partial<SiteSettings> {
  const entries = fields.flatMap(field => {
    const raw = stored(editKey(uid, field));
    if (raw === null) return [];
    try { return [[field, JSON.parse(raw)]]; } catch { return []; }
  });
  return decodeSiteSettingsPatch(Object.fromEntries(entries)) ?? {};
}

export function startAccountSiteSettings(navigate: (path: string) => void) {
  let owner: number | null | undefined;
  let session = new AbortController();
  let busy = false;
  let timer: number | undefined;
  let retryDelay = 5000;
  const uidNow = () => getAuthUser()?.uid ?? null;
  const current = (uid: number, signal: AbortSignal) =>
    !signal.aborted && owner === uid && uidNow() === uid && !getRolePreview();

  function schedule(delay = 0) {
    window.clearTimeout(timer);
    timer = window.setTimeout(refresh, delay);
  }

  async function exchange(uid: number, signal: AbortSignal) {
    if (!current(uid, signal)) return;
    const patch = pending(uid);
    const seed = cachedSettings(GUEST) ?? readDeviceSettings();
    let result = await syncSiteSettings(uid, signal, Object.keys(patch).length ? { seed, patch } : undefined);
    if (!current(uid, signal)) return;
    if (result === null) {
      // Two new devices may both see an empty account. The server adopts just
      // the first seed and returns the winning settings to both.
      result = await syncSiteSettings(uid, signal, { seed, patch });
      if (!result || !current(uid, signal)) return;
    }
    for (const [field, value] of Object.entries(patch)) {
      const key = editKey(uid, field);
      if (stored(key) === JSON.stringify(value)) forget(key);
    }
    const key = profileKey(uid);
    const serialized = JSON.stringify(result);
    if (stored(key) !== serialized) save(key, serialized);
    const more = pending(uid);
    applyDeviceSettings({ ...result, ...more }, navigate);
    retryDelay = 5000;
    if (Object.keys(more).length) schedule();
  }

  async function refresh() {
    if (!owner || busy || getRolePreview()) return;
    const uid = owner;
    const signal = session.signal;
    busy = true;
    try {
      if (navigator.locks) {
        await navigator.locks.request(profileKey(uid), { signal }, () => exchange(uid, signal));
      } else await exchange(uid, signal);
    } catch {
      if (current(uid, signal) && document.visibilityState === 'visible') {
        schedule(retryDelay);
        retryDelay = Math.min(300000, retryDelay * 2);
      }
    } finally {
      if (!signal.aborted) busy = false;
    }
  }

  function changeOwner() {
    if (getRolePreview()) {
      session.abort();
      owner = undefined;
      window.clearTimeout(timer);
      return;
    }
    const uid = uidNow();
    if (owner === uid) return;
    const previousUid = owner;
    owner = uid;
    session.abort();
    session = new AbortController();
    busy = false;
    retryDelay = 5000;
    window.clearTimeout(timer);
    const previous = stored(OWNER);
    if (uid === null) {
      if (previous || previousUid != null) {
        forget(OWNER);
        const guest = cachedSettings(GUEST);
        if (guest) applyDeviceSettings(guest, navigate, true);
      }
      return;
    }
    if (!previous) save(GUEST, JSON.stringify(readDeviceSettings()));
    save(OWNER, String(uid));
    const base = cachedSettings(profileKey(uid)) ?? cachedSettings(GUEST) ?? readDeviceSettings();
    applyDeviceSettings({ ...base, ...pending(uid) }, navigate, previous !== String(uid));
    void refresh();
  }

  function edited(event: Event) {
    if (!owner || owner !== uidNow() || getRolePreview()) return;
    const patch = decodeSiteSettingsPatch((event as CustomEvent).detail);
    for (const [field, value] of Object.entries(patch ?? {})) {
      save(editKey(owner, field), JSON.stringify(value));
    }
    schedule(80);
  }
  function storage(event: StorageEvent) {
    if (!owner || owner !== uidNow() || getRolePreview() || event.key !== profileKey(owner)) return;
    const settings = cachedSettings(event.key);
    if (settings) applyDeviceSettings({ ...settings, ...pending(owner) }, navigate);
  }
  const resume = () => { if (document.visibilityState === 'visible' && owner) schedule(); };
  const unsubscribe = subscribeAuthUser(changeOwner);
  window.addEventListener(SITE_SETTING_EDIT, edited);
  window.addEventListener('storage', storage);
  window.addEventListener('focus', resume);
  window.addEventListener('online', resume);
  document.addEventListener('visibilitychange', resume);
  changeOwner();
  return () => {
    session.abort();
    window.clearTimeout(timer);
    unsubscribe();
    window.removeEventListener(SITE_SETTING_EDIT, edited);
    window.removeEventListener('storage', storage);
    window.removeEventListener('focus', resume);
    window.removeEventListener('online', resume);
    document.removeEventListener('visibilitychange', resume);
  };
}
