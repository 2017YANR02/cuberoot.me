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

const WCA_API_BASE = 'https://www.worldcubeassociation.org/api/v0';
const searchCache = new Map<string, Promise<WcaPersonLite[]>>();
const personCache = new Map<string, Promise<WcaPersonLite | null>>();

function normalizeWcaPerson(person: PersonsApiItem['person']): WcaPersonLite | null {
  if (!person) return null;
  const id = person.wca_id || person.id;
  if (!id || !WCA_ID_REGEX.test(id)) return null;
  return {
    id,
    name: person.name || id,
    country_iso2: person.country_iso2 || person.country?.iso2 || '',
  };
}

export function searchWcaPersons(
  query: string,
  limit = 8,
  fetcher: typeof fetch = fetch,
): Promise<WcaPersonLite[]> {
  const key = query.trim().toLowerCase();
  if (!key) return Promise.resolve([]);
  const cacheable = fetcher === globalThis.fetch;
  const hit = cacheable ? searchCache.get(key) : undefined;
  if (hit) return hit.then((people) => people.slice(0, limit));
  const request = fetcher(`${WCA_API_BASE}/persons?q=${encodeURIComponent(key)}`)
    .then((response) => response.ok ? response.json() : [])
    .then((value: unknown) => {
      if (!Array.isArray(value)) return [];
      return value.flatMap((item: PersonsApiItem) => {
        const person = normalizeWcaPerson(item?.person);
        return person ? [person] : [];
      });
    })
    .catch(() => [] as WcaPersonLite[]);
  if (cacheable) searchCache.set(key, request);
  return request.then((people) => people.slice(0, limit));
}

export function getWcaPerson(
  wcaId: string,
  fetcher: typeof fetch = fetch,
): Promise<WcaPersonLite | null> {
  const id = wcaId.trim().toUpperCase();
  if (!WCA_ID_REGEX.test(id)) return Promise.resolve(null);
  const cacheable = fetcher === globalThis.fetch;
  const hit = cacheable ? personCache.get(id) : undefined;
  if (hit) return hit;
  const request = fetcher(`${WCA_API_BASE}/persons/${encodeURIComponent(id)}`)
    .then((response) => response.ok ? response.json() : null)
    .then((value: unknown) => normalizeWcaPerson((value as { person?: PersonsApiItem['person'] } | null)?.person))
    .catch(() => null);
  if (cacheable) personCache.set(id, request);
  return request;
}
