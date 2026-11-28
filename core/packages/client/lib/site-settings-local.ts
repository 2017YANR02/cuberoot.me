import { applyAppearancePreferences, persistAppearancePreferences, readAppearancePreferences } from '@cuberoot/app-ui/appearance';
import { decodeSiteSettings, type SiteSettings } from '@cuberoot/shared/appearance';
import { readDeskPetPreference, restoreDeskPetPreference } from '@/hooks/useDeskPetVisible';
import { readHomeBackgroundChoice, restoreImage, restoreHomeBackgroundChoices } from '@/hooks/useHomeBackgroundChoice';
import i18n, { normalizeAppLang, persistAppLanguage } from '@/i18n/i18n-client';
import { applyDisplayTimeZone, readDisplayTimeZoneChoice } from './display-time-zone';
import { persistItem } from './safe-storage';

export function readDeviceSettings(): SiteSettings {
  return {
    ...readAppearancePreferences({ locale: normalizeAppLang(i18n.language) }),
    lightBackground: readHomeBackgroundChoice('light'), darkBackground: readHomeBackgroundChoice('dark'),
    lastLightBackground: restoreImage('light'), lastDarkBackground: restoreImage('dark'),
    deskPetVisible: readDeskPetPreference(), timeZone: readDisplayTimeZoneChoice(),
  };
}

export function applyDeviceSettings(settings: SiteSettings, navigate: (path: string) => void, ownerChanged = false) {
  const old = readDeviceSettings();
  const appearanceChanged = Object.entries(readAppearancePreferences()).some(([key, value]) =>
    value !== settings[key as keyof SiteSettings]);
  if (appearanceChanged) {
    try { persistAppearancePreferences(settings); } catch { /* Still paint this document. */ }
    applyAppearancePreferences(settings);
    window.dispatchEvent(new Event('theme-change'));
  }
  if (ownerChanged || old.lightBackground !== settings.lightBackground || old.darkBackground !== settings.darkBackground
    || old.lastLightBackground !== settings.lastLightBackground || old.lastDarkBackground !== settings.lastDarkBackground) {
    restoreHomeBackgroundChoices(settings);
  }
  if (ownerChanged || old.deskPetVisible !== settings.deskPetVisible) restoreDeskPetPreference(settings.deskPetVisible);
  if (old.timeZone !== settings.timeZone) applyDisplayTimeZone(settings.timeZone);

  const url = new URL(window.location.href);
  if (/^\/(api|auth)(\/|$)/.test(url.pathname)) return;
  const zh = /^\/zh(\/|$)/.test(url.pathname);
  if (old.locale !== settings.locale || zh !== (settings.locale === 'zh')) {
    persistAppLanguage(settings.locale);
    const bare = url.pathname.replace(/^\/(en|zh)(?=\/|$)/, '') || '/';
    const path = settings.locale === 'zh' ? '/zh' + (bare === '/' ? '' : bare) : bare;
    if (url.searchParams.has('lang')) url.searchParams.set('lang', settings.locale);
    if (path !== url.pathname) navigate(path + url.search + url.hash);
  }
}

// Storage may be unavailable in embedded or private windows. Keep pending edits
// in memory for the current visit even if persistence fails.
const volatile = new Map<string, string>();
export function stored(key: string): string | null {
  if (volatile.has(key)) return volatile.get(key)!;
  try { return localStorage.getItem(key); } catch { return null; }
}
export function save(key: string, value: string) {
  if (persistItem(key, value)) volatile.delete(key);
  else volatile.set(key, value);
}
export function forget(key: string) {
  volatile.delete(key);
  try { localStorage.removeItem(key); } catch { /* restricted storage */ }
}
export function cachedSettings(key: string): SiteSettings | null {
  try { return decodeSiteSettings(JSON.parse(stored(key) ?? 'null')); } catch { return null; }
}
