import { canonicalCountryNamesByIso2 } from '@cuberoot/shared/country-flag';

export const PINNED_COUNTRIES_KEY = 'cuberoot-pinned-countries';
const countries = canonicalCountryNamesByIso2();

export function pinnedCountriesKey(user: { uid?: number; wcaId: string } | null): string | null {
  if (!user) return null;
  // Prefer the stable account ID so binding or unlinking WCA does not reset preferences.
  const owner = user.uid ? `u${user.uid}` : user.wcaId.trim().toUpperCase();
  return owner ? `${PINNED_COUNTRIES_KEY}:${owner}` : null;
}

export function resolvePinnedCountries(raw: string | null, wcaCountry: string): string[] {
  // An explicitly saved empty list must not reinstate a country the user unpinned.
  return parsePinnedCountries(raw ?? JSON.stringify([wcaCountry]));
}

export function parsePinnedCountries(raw: string): string[] {
  try {
    const value: unknown = JSON.parse(raw);
    if (!Array.isArray(value)) return [];
    return [...new Set(value.filter((v): v is string => typeof v === 'string')
      .map(v => v.toLowerCase()).filter(v => Object.hasOwn(countries, v)))];
  } catch { return []; }
}

/** Partition only the caller's available/search-matched items; preserve each original value. */
export function partitionPinnedCountries<T>(items: readonly T[], pins: readonly string[], iso2: (item: T) => string) {
  const rank = new Map(pins.map((pin, index) => [pin, index]));
  const pinned = items.filter(item => rank.has(iso2(item).toLowerCase()));
  pinned.sort((a, b) => rank.get(iso2(a).toLowerCase())! - rank.get(iso2(b).toLowerCase())!);
  return { pinned, others: items.filter(item => !rank.has(iso2(item).toLowerCase())) };
}
