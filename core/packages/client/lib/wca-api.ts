/**
 * WCA public persons / users API (no auth) — ported from packages/client-vite/src/utils/wca_api.ts.
 * Module-level promise cache for searches / lookups.
 */

import {
  WCA_ID_REGEX,
  getWcaPerson,
  searchWcaPersons,
  type WcaPersonLite,
} from '@cuberoot/shared/wca-person';

export { WCA_ID_REGEX, type WcaPersonLite };

const WCA_API_BASE = 'https://www.worldcubeassociation.org/api/v0';

interface UserUpcomingApi {
  upcoming_competitions?: { id: string }[];
}

const upcomingCache = new Map<string, Promise<string[]>>();

export function searchPersons(q: string, limit = 8): Promise<WcaPersonLite[]> {
  return searchWcaPersons(q, limit);
}

export function getPerson(wcaId: string): Promise<WcaPersonLite | null> {
  return getWcaPerson(wcaId);
}

export interface WcaPersonCard {
  id: string;
  name: string;
  country_iso2: string;
  avatar: string;
}

const cardCache = new Map<string, Promise<WcaPersonCard | null>>();

interface PersonCardApi {
  person?: {
    name?: string;
    country_iso2?: string;
    country?: { iso2?: string } | null;
    avatar?: { thumb_url?: string; url?: string } | null;
  };
}

/** Fetch a person's display card (name + country + avatar thumb) by WCA ID. */
export function fetchPersonCard(wcaId: string): Promise<WcaPersonCard | null> {
  const id = wcaId.trim().toUpperCase();
  if (!WCA_ID_REGEX.test(id)) return Promise.resolve(null);
  const hit = cardCache.get(id);
  if (hit) return hit;
  const url = `${WCA_API_BASE}/persons/${encodeURIComponent(id)}`;
  const p = fetch(url)
    .then(r => r.ok ? r.json() : null)
    .then((j: unknown) => {
      const person = (j as PersonCardApi)?.person;
      if (!person) return null;
      return {
        id,
        name: person.name || id,
        country_iso2: person.country_iso2 || person.country?.iso2 || '',
        avatar: person.avatar?.thumb_url || person.avatar?.url || '',
      };
    })
    .catch(() => null);
  cardCache.set(id, p);
  return p;
}

export function fetchUserUpcoming(wcaId: string): Promise<string[]> {
  const id = wcaId.trim().toUpperCase();
  if (!WCA_ID_REGEX.test(id)) return Promise.resolve([]);
  const hit = upcomingCache.get(id);
  if (hit) return hit;
  const url = `${WCA_API_BASE}/users/${encodeURIComponent(id)}?upcoming_competitions=true`;
  const p = fetch(url)
    .then(r => r.ok ? r.json() : null)
    .then((j: unknown) => {
      const arr = (j as UserUpcomingApi)?.upcoming_competitions;
      if (!Array.isArray(arr)) return [];
      return arr.map(c => c.id).filter(Boolean);
    })
    .catch(() => [] as string[]);
  upcomingCache.set(id, p);
  return p;
}
