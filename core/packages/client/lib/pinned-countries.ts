import { canonicalCountryNamesByIso2 } from '@cuberoot/shared/country-flag';

export const PINNED_COUNTRIES_KEY = 'cuberoot-pinned-countries';
const countries = canonicalCountryNamesByIso2();

export function pinnedCountriesKey(user: { uid?: number; wcaId: string } | null): string | null {
  if (!user) return null;
  // Prefer the stable account ID so binding or unlinking WCA does not reset preferences.
  const owner = user.uid ? `u${user.uid}` : user.wcaId.trim().toUpperCase();
  return owner ? `${PINNED_COUNTRIES_KEY}:${owner}` : null;
}

function preferences(raw: string | null, wcaCountry: string): { pins: string[]; excluded: string[] } {
  try {
    const value: unknown = JSON.parse(raw ?? 'null');
    if (Array.isArray(value)) {
      const pins = parsePinnedCountries(raw!);
      // Legacy arrays recorded the whole list, including removal of the WCA default.
      return { pins, excluded: normalize([wcaCountry]).filter(code => !pins.includes(code)) };
    }
    if (value && typeof value === 'object' && 'pins' in value && 'excluded' in value) {
      return { pins: normalize(value.pins), excluded: normalize(value.excluded) };
    }
  } catch { /* Invalid storage falls back to available defaults. */ }
  return { pins: [], excluded: [] };
}

export function resolvePinnedCountries(raw: string | null, wcaCountry: string, ipCountry = ''): string[] {
  const { pins, excluded } = preferences(raw, wcaCountry);
  return normalize([wcaCountry, ipCountry, ...pins]).filter(code => !excluded.includes(code));
}

export function togglePinnedCountry(raw: string | null, wcaCountry: string, ipCountry: string, iso2: string): string {
  const prefs = preferences(raw, wcaCountry);
  const pin = normalize([iso2])[0];
  if (!pin) return JSON.stringify(prefs);
  if (resolvePinnedCountries(raw, wcaCountry, ipCountry).includes(pin)) {
    prefs.pins = prefs.pins.filter(code => code !== pin);
    prefs.excluded = normalize([...prefs.excluded, pin]);
  } else {
    prefs.pins = normalize([...prefs.pins, pin]);
    prefs.excluded = prefs.excluded.filter(code => code !== pin);
  }
  return JSON.stringify(prefs);
}

function normalize(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.filter((v): v is string => typeof v === 'string')
    .map(v => v.toLowerCase()).filter(v => Object.hasOwn(countries, v)))];
}

export function parsePinnedCountries(raw: string): string[] {
  try {
    return normalize(JSON.parse(raw));
  } catch { return []; }
}

/** Partition only the caller's available/search-matched items; preserve each original value. */
export function partitionPinnedCountries<T>(items: readonly T[], pins: readonly string[], iso2: (item: T) => string) {
  const rank = new Map(pins.map((pin, index) => [pin, index]));
  const pinned = items.filter(item => rank.has(iso2(item).toLowerCase()));
  pinned.sort((a, b) => rank.get(iso2(a).toLowerCase())! - rank.get(iso2(b).toLowerCase())!);
  return { pinned, others: items.filter(item => !rank.has(iso2(item).toLowerCase())) };
}
