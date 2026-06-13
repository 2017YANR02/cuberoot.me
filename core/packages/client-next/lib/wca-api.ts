/**
 * WCA public persons / users API (no auth) — ported from packages/client/src/utils/wca_api.ts.
 * Module-level promise cache for searches / lookups.
 */

const WCA_API_BASE = 'https://www.worldcubeassociation.org/api/v0';

export interface WcaPersonLite {
  id: string;
  name: string;
  country_iso2: string;
}

export const WCA_ID_REGEX = /^\d{4}[A-Z]{4}\d{2}$/;

interface PersonsApiItem {
  person?: {
    wca_id?: string | null;
    id?: string;
    name?: string;
    country_iso2?: string;
    country?: { iso2?: string } | null;
  };
}

interface UserUpcomingApi {
  upcoming_competitions?: { id: string }[];
}

interface PersonGetApi {
  person?: PersonsApiItem['person'];
}

const searchCache = new Map<string, Promise<WcaPersonLite[]>>();
const personCache = new Map<string, Promise<WcaPersonLite | null>>();
const upcomingCache = new Map<string, Promise<string[]>>();

function normalizePerson(p: PersonsApiItem['person']): WcaPersonLite | null {
  if (!p) return null;
  const id = p.wca_id || p.id;
  if (!id || !WCA_ID_REGEX.test(id)) return null;
  return {
    id,
    name: p.name || id,
    country_iso2: p.country_iso2 || p.country?.iso2 || '',
  };
}

export function searchPersons(q: string, limit = 8): Promise<WcaPersonLite[]> {
  const key = q.trim().toLowerCase();
  if (!key) return Promise.resolve([]);
  const hit = searchCache.get(key);
  if (hit) return hit.then(arr => arr.slice(0, limit));
  const url = `${WCA_API_BASE}/persons?q=${encodeURIComponent(key)}`;
  const p = fetch(url)
    .then(r => r.ok ? r.json() : [])
    .then((j: unknown) => {
      if (!Array.isArray(j)) return [];
      const out: WcaPersonLite[] = [];
      for (const item of j as PersonsApiItem[]) {
        const pl = normalizePerson(item?.person);
        if (pl) out.push(pl);
      }
      return out;
    })
    .catch(() => [] as WcaPersonLite[]);
  searchCache.set(key, p);
  return p.then(arr => arr.slice(0, limit));
}

export function getPerson(wcaId: string): Promise<WcaPersonLite | null> {
  const id = wcaId.trim().toUpperCase();
  if (!WCA_ID_REGEX.test(id)) return Promise.resolve(null);
  const hit = personCache.get(id);
  if (hit) return hit;
  const url = `${WCA_API_BASE}/persons/${encodeURIComponent(id)}`;
  const p = fetch(url)
    .then(r => r.ok ? r.json() : null)
    .then((j: unknown) => normalizePerson((j as PersonGetApi)?.person))
    .catch(() => null);
  personCache.set(id, p);
  return p;
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
