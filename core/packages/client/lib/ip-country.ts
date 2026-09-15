import { apiUrl } from '@/lib/api-base';
import { parsePinnedCountries } from '@/lib/pinned-countries';

let request: Promise<string> | undefined;

/** One bounded request per page session, shared by all country menus. */
export function loadIpCountry(): Promise<string> {
  return request ??= (async () => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5_000);
    try {
      const response = await fetch(apiUrl('/v1/geo/country'), { signal: controller.signal, cache: 'no-store' });
      if (!response.ok) return '';
      const data: unknown = await response.json();
      if (!data || typeof data !== 'object' || !('country' in data)) return '';
      return parsePinnedCountries(JSON.stringify([data.country]))[0] ?? '';
    } catch { return ''; }
    finally { clearTimeout(timeout); }
  })();
}
