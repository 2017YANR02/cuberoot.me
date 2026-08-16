import { isMultiLocationCity } from './comp_city_identity';

export const RECORD_PLACE_VERSION = 3 as const;
export const RECORD_PLACE_DETAIL_VERSION = 2 as const;

export const RECORD_METRICS = ['wr', 'cr', 'nr'] as const;
export type RecordMetric = (typeof RECORD_METRICS)[number];

export interface RecordCounts {
  wr: number;
  cr: number;
  nr: number;
}

export interface RecordCountsByEvent {
  [eventId: string]: RecordCounts;
}

export interface CountryRecordCounts extends RecordCounts {
  iso2: string;
  events: RecordCountsByEvent;
}

export interface CityRecordCounts extends CountryRecordCounts {
  city: string;
  aliases: string[];
}

export interface RecordPlacesData {
  version: typeof RECORD_PLACE_VERSION;
  events: string[];
  countries: CountryRecordCounts[];
  cities: CityRecordCounts[];
}

export type RecordResultKind = 's' | 'a';

export interface RecordPlaceDetailEntry {
  /** Exact WCA marker: WR, AfR, AsR, ER, NAR, OcR, SAR, or NR. */
  t: string;
  /** Single or average. */
  k: RecordResultKind;
  /** WCA event id. */
  e: string;
  /** WCA person id. */
  p: string;
  /** Raw WCA person name. */
  n: string;
  /** Raw WCA result value. */
  v: number;
  /** Ordered round attempts. */
  a: number[] | null;
}

export interface RecordPlaceDetailCompetition {
  /** Raw WCA competition name. */
  n: string;
  /** ISO start date. */
  s: string;
  /** ISO end date. */
  d: string;
  /** Resolved canonical city label; null for multi-location competitions. */
  c: string | null;
}

export interface RecordPlaceDetailShard {
  version: typeof RECORD_PLACE_DETAIL_VERSION;
  iso2: string;
  comps: Record<string, RecordPlaceDetailCompetition>;
  records: Record<string, RecordPlaceDetailEntry[]>;
}

export interface RecordPlaceSourceRow {
  iso2: string | null;
  city: string | null;
  /** Canonical resolver key. Falls back to country + raw city for simple callers. */
  cityKey?: string | null;
  cityAliases?: readonly string[];
  eventId: string | null;
  singleRecord: string | null;
  averageRecord: string | null;
}

const CONTINENTAL_RECORDS = new Set(['AfR', 'AsR', 'ER', 'NAR', 'OcR', 'SAR']);
const MULTI_REGIONS = new Set(['XA', 'XE', 'XF', 'XM', 'XN', 'XO', 'XS', 'XW']);

export function recordMetricForLevel(level: string | null): RecordMetric | null {
  if (level === 'WR') return 'wr';
  if (level && CONTINENTAL_RECORDS.has(level)) return 'cr';
  if (level === 'NR') return 'nr';
  return null;
}

function emptyCounts(): RecordCounts {
  return { wr: 0, cr: 0, nr: 0 };
}

function normalizeIso2(raw: string | null): string | null {
  const iso2 = (raw ?? '').trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(iso2) || MULTI_REGIONS.has(iso2)) return null;
  return iso2;
}

function usableCity(raw: string | null): string | null {
  const city = (raw ?? '').trim().replace(/\s+/g, ' ');
  if (!city || isMultiLocationCity(city)) return null;
  return city;
}

interface MutableCityRecordCounts extends CityRecordCounts {
  aliasSet: Set<string>;
}

function usableEventId(raw: string | null): string | null {
  const eventId = (raw ?? '').trim();
  return eventId || null;
}

function addEventRecord(
  counts: RecordCounts & { events: RecordCountsByEvent },
  eventId: string,
  level: string | null,
): boolean {
  const metric = recordMetricForLevel(level);
  if (!metric) return false;
  counts[metric]++;
  const eventCounts = counts.events[eventId] ?? emptyCounts();
  eventCounts[metric]++;
  counts.events[eventId] = eventCounts;
  return true;
}

function stableEventCounts(events: RecordCountsByEvent): RecordCountsByEvent {
  return Object.fromEntries(
    Object.entries(events).sort(([a], [b]) => a.localeCompare(b, 'en')),
  );
}

/** Build venue-based record counts from WCA result markers. */
export function buildRecordPlaces(rows: Iterable<RecordPlaceSourceRow>): RecordPlacesData {
  const countries = new Map<string, RecordCounts & { events: RecordCountsByEvent }>();
  const cities = new Map<string, MutableCityRecordCounts>();
  const eventIds = new Set<string>();

  for (const row of rows) {
    const iso2 = normalizeIso2(row.iso2);
    const eventId = usableEventId(row.eventId);
    if (!iso2 || !eventId) continue;

    const levels = [row.singleRecord, row.averageRecord];
    const countryCounts = countries.get(iso2) ?? { ...emptyCounts(), events: {} };
    const city = usableCity(row.city);
    const cityKey = city
      ? (row.cityKey?.trim() || `${iso2}\0${city.toLocaleLowerCase('en')}`)
      : null;
    const cityCounts = city && cityKey
      ? (cities.get(cityKey) ?? {
          iso2,
          city,
          aliases: [],
          aliasSet: new Set<string>(),
          events: {},
          ...emptyCounts(),
        })
      : null;

    if (cityCounts) {
      for (const alias of row.cityAliases ?? []) {
        const cleaned = usableCity(alias);
        if (cleaned && cleaned !== cityCounts.city) cityCounts.aliasSet.add(cleaned);
      }
    }

    let hasRecord = false;
    for (const level of levels) {
      hasRecord = addEventRecord(countryCounts, eventId, level) || hasRecord;
      if (cityCounts) addEventRecord(cityCounts, eventId, level);
    }
    if (!hasRecord) continue;

    eventIds.add(eventId);
    countries.set(iso2, countryCounts);
    if (cityCounts && cityKey) cities.set(cityKey, cityCounts);
  }

  return {
    version: RECORD_PLACE_VERSION,
    events: [...eventIds].sort((a, b) => a.localeCompare(b, 'en')),
    countries: [...countries].map(([iso2, counts]) => ({
      iso2,
      ...counts,
      events: stableEventCounts(counts.events),
    }))
      .sort((a, b) => a.iso2.localeCompare(b.iso2, 'en')),
    cities: [...cities.values()].map(({ aliasSet, ...city }) => ({
      ...city,
      events: stableEventCounts(city.events),
      aliases: [...aliasSet].sort((a, b) => a.localeCompare(b, 'en')),
    })).sort((a, b) =>
      a.iso2.localeCompare(b.iso2, 'en') || a.city.localeCompare(b.city, 'en')
    ),
  };
}

function isCount(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
}

function isRecordCounts(value: unknown): value is RecordCounts {
  if (!value || typeof value !== 'object') return false;
  const counts = value as Partial<RecordCounts>;
  return isCount(counts.wr) && isCount(counts.cr) && isCount(counts.nr);
}

function isEventCounts(value: unknown, totals: RecordCounts): value is RecordCountsByEvent {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const entries = Object.entries(value);
  if (entries.some(([eventId, counts]) => !eventId.trim() || !isRecordCounts(counts))) return false;
  const sums = entries.reduce<RecordCounts>((result, [, counts]) => ({
    wr: result.wr + (counts as RecordCounts).wr,
    cr: result.cr + (counts as RecordCounts).cr,
    nr: result.nr + (counts as RecordCounts).nr,
  }), emptyCounts());
  return sums.wr === totals.wr && sums.cr === totals.cr && sums.nr === totals.nr;
}

function isCountryRow(value: unknown): value is CountryRecordCounts {
  if (!value || typeof value !== 'object') return false;
  const row = value as Partial<CountryRecordCounts>;
  return typeof row.iso2 === 'string' && /^[A-Z]{2}$/.test(row.iso2)
    && isCount(row.wr) && isCount(row.cr) && isCount(row.nr)
    && isEventCounts(row.events, row as RecordCounts);
}

function isCityRow(value: unknown): value is CityRecordCounts {
  if (!isCountryRow(value)) return false;
  const row = value as Partial<CityRecordCounts>;
  return typeof row.city === 'string'
    && row.city.trim().length > 0
    && Array.isArray(row.aliases)
    && row.aliases.every((alias) => typeof alias === 'string' && alias.trim().length > 0)
    && new Set(row.aliases).size === row.aliases.length
    && !row.aliases.includes(row.city);
}

export function isRecordPlacesData(value: unknown): value is RecordPlacesData {
  if (!value || typeof value !== 'object') return false;
  const data = value as Partial<RecordPlacesData>;
  if (data.version !== RECORD_PLACE_VERSION
    || !Array.isArray(data.events)
    || data.events.some((eventId) => typeof eventId !== 'string' || !eventId.trim())
    || new Set(data.events).size !== data.events.length
    || !Array.isArray(data.countries) || !data.countries.every(isCountryRow)
    || !Array.isArray(data.cities) || !data.cities.every(isCityRow)) return false;
  const countries = data.countries as CountryRecordCounts[];
  const cities = data.cities as CityRecordCounts[];
  const eventIds = new Set(data.events as string[]);
  if (countries.some((row) => Object.keys(row.events).some((eventId) => !eventIds.has(eventId)))
    || cities.some((row) => Object.keys(row.events).some((eventId) => !eventIds.has(eventId)))) return false;
  const usedEventIds = new Set(countries.flatMap((row) => Object.keys(row.events)));
  if (usedEventIds.size !== eventIds.size || [...eventIds].some((eventId) => !usedEventIds.has(eventId))) return false;
  const countryIds = new Set(countries.map((row) => row.iso2));
  if (countryIds.size !== countries.length) return false;
  const cityIds = new Set(cities.map((row) => `${row.iso2}\0${row.city.toLocaleLowerCase('en')}`));
  if (cityIds.size !== cities.length || cities.some((row) => !countryIds.has(row.iso2))) return false;
  return true;
}

function isIsoDate(value: unknown): value is string {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function isDetailCompetition(value: unknown): value is RecordPlaceDetailCompetition {
  if (!value || typeof value !== 'object') return false;
  const comp = value as Partial<RecordPlaceDetailCompetition>;
  return typeof comp.n === 'string' && comp.n.trim().length > 0
    && isIsoDate(comp.s) && isIsoDate(comp.d)
    && (comp.c === null || (typeof comp.c === 'string' && comp.c.trim().length > 0));
}

function isDetailEntry(value: unknown): value is RecordPlaceDetailEntry {
  if (!value || typeof value !== 'object') return false;
  const entry = value as Partial<RecordPlaceDetailEntry>;
  return recordMetricForLevel(entry.t ?? null) !== null
    && (entry.k === 's' || entry.k === 'a')
    && typeof entry.e === 'string' && entry.e.length > 0
    && typeof entry.p === 'string' && entry.p.length > 0
    && typeof entry.n === 'string' && entry.n.trim().length > 0
    && typeof entry.v === 'number' && Number.isSafeInteger(entry.v) && entry.v > 0
    && (entry.a === null || (Array.isArray(entry.a)
      && entry.a.every((attempt) => Number.isSafeInteger(attempt))));
}

export function isRecordPlaceDetailShard(value: unknown): value is RecordPlaceDetailShard {
  if (!value || typeof value !== 'object') return false;
  const shard = value as Partial<RecordPlaceDetailShard>;
  if (shard.version !== RECORD_PLACE_DETAIL_VERSION
    || typeof shard.iso2 !== 'string' || !/^[A-Z]{2}$/.test(shard.iso2)
    || !shard.comps || typeof shard.comps !== 'object' || Array.isArray(shard.comps)
    || !shard.records || typeof shard.records !== 'object' || Array.isArray(shard.records)) return false;
  const comps = shard.comps as Record<string, RecordPlaceDetailCompetition>;
  const records = shard.records as Record<string, RecordPlaceDetailEntry[]>;
  const compIds = Object.keys(comps);
  const recordIds = Object.keys(records);
  return compIds.length === recordIds.length
    && compIds.every((id) => id.length > 0
      && isDetailCompetition(comps[id])
      && Array.isArray(records[id])
      && records[id].length > 0
      && records[id].every(isDetailEntry))
    && recordIds.every((id) => Object.hasOwn(comps, id));
}
