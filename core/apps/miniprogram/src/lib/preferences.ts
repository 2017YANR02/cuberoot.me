import { decodeNativeAppearance, decodeMiniProgramPreferences, MINI_PROGRAM_PREFERENCES_QUERY } from '@cuberoot/shared/appearance';
import { miniProgramApi } from './platform';
import { receiveNativeAppearance } from './appearance';
import { getMiniProgramLocale, receiveNativeLocale } from './i18n';

const KEY = 'cuberoot.preferences.v1';
export function readNativePreferences() {
  try { return decodeMiniProgramPreferences(miniProgramApi().getStorageSync(KEY)); }
  catch { return null; }
}
export function receiveNativePreferences(value: unknown, source?: object): boolean {
  if (!value || typeof value !== 'object') return false;
  const message = value as { preferences?: unknown; appearance?: unknown };
  const preferences = decodeMiniProgramPreferences(message.preferences);
  const appearance = decodeNativeAppearance(message.appearance);
  if (!preferences || !appearance) return false;
  const changed = JSON.stringify(readNativePreferences()) !== JSON.stringify(preferences);
  try { miniProgramApi().setStorageSync(KEY, preferences); } catch { return false; }
  if (source && 'acceptPreferences' in source && typeof source.acceptPreferences === 'function') source.acceptPreferences();
  receiveNativeLocale({ type: 'cuberoot:locale', locale: preferences.locale });
  receiveNativeAppearance(appearance);
  if (changed && typeof getCurrentPages === 'function') {
    for (const page of getCurrentPages()) {
      if (page !== source) page.invalidatePreferences?.();
    }
  }
  return true;
}
/** Each opened document gets an explicit snapshot, even if WebView storage is isolated. */
export function withNativePreferences(url: string): string {
  const index = url.indexOf('#');
  const base = (index < 0 ? url : url.slice(0, index)).replace(/([?&])lang=[^&]*&?/g, '$1').replace(/[?&]$/, '');
  const hash = index < 0 ? '' : url.slice(index);
  const preferences = readNativePreferences();
  const payload = encodeURIComponent(JSON.stringify({ preferences, nonce: Date.now() }));
  return `${base}${base.includes('?') ? '&' : '?'}lang=${preferences?.locale ?? getMiniProgramLocale()}&${MINI_PROGRAM_PREFERENCES_QUERY}=${payload}${hash}`;
}
