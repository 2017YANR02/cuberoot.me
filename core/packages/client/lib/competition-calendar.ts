import type { CalendarManifest, CalendarMonth } from '@cuberoot/shared/competition-calendar';
import { statsUrl } from './stats-base';
let manifestPromise: Promise<CalendarManifest> | null = null;
const monthCache = new Map<string, Promise<CalendarMonth>>();
export function loadCalendarManifest(): Promise<CalendarManifest> {
  manifestPromise ??= fetch(statsUrl('/stats/comp_calendar/index.json?v=1'), { cache: 'no-cache' }).then(async response => {
    if (!response.ok) throw new Error('Calendar index unavailable');
    const data = await response.json() as CalendarManifest;
    if (data.version !== 1 || !data.months || !data.countryOptions || !data.yearMonths || !data.firstCountry || !data.firstEvent || !data.maxRounds) throw new Error('Invalid calendar index');
    return data;
  }).finally(() => { manifestPromise = null; });
  return manifestPromise;
}
export function loadCalendarMonth(manifest: CalendarManifest, month: string): Promise<CalendarMonth> {
  const hash = manifest.months[month];
  if (!hash) return Promise.resolve({ past: [], upcoming: [], contentHash: '' });
  const key = `${month}:${hash}`;
  let pending = monthCache.get(key);
  if (!pending) {
    pending = fetch(statsUrl(`/stats/comp_calendar/${month}.json?v=${hash}`)).then(async response => {
      if (!response.ok) throw new Error('Calendar month unavailable');
      const data = await response.json() as CalendarMonth;
      if (data.contentHash !== hash || !Array.isArray(data.past) || !Array.isArray(data.upcoming)) throw new Error('Calendar version mismatch');
      return data;
    }).catch(error => { monthCache.delete(key); throw error; });
    monthCache.set(key, pending);
    if (monthCache.size > 12) monthCache.delete(monthCache.keys().next().value!);
  }
  return pending;
}
