import {
  isRecordPlaceDetailShard,
  isRecordPlacesData,
  type CityRecordCounts,
  type CountryRecordCounts,
  type RecordCounts,
  type RecordMetric,
  type RecordPlaceDetailCompetition,
  type RecordPlaceDetailEntry,
  type RecordPlaceDetailShard,
  type RecordPlacesData,
  recordMetricForLevel,
} from '@cuberoot/shared/record-places';
import { statsUrl } from './stats-base';
import { countryName } from './country-name';
import { localizeCity } from './city-localize';

let inflight: Promise<RecordPlacesData> | null = null;
const detailInflight = new Map<string, Promise<RecordPlaceDetailShard>>();

export async function loadRecordPlaces(): Promise<RecordPlacesData> {
  if (!inflight) {
    inflight = fetch(statsUrl('/stats/record_places_v2.json')).then(async (response) => {
      if (!response.ok) throw new Error(`record places unavailable (${response.status})`);
      const value: unknown = await response.json();
      if (!isRecordPlacesData(value)) throw new Error('invalid record places data');
      return value;
    }).catch((error) => {
      inflight = null;
      throw error;
    });
  }
  return inflight;
}

export async function loadRecordPlaceDetails(iso2: string): Promise<RecordPlaceDetailShard> {
  const country = iso2.trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(country)) throw new Error('invalid record place country');
  const existing = detailInflight.get(country);
  if (existing) return existing;
  const request = fetch(statsUrl(`/stats/record_place_details_v2/${country}.json`)).then(async (response) => {
    if (!response.ok) throw new Error(`record place details unavailable (${response.status})`);
    const value: unknown = await response.json();
    if (!isRecordPlaceDetailShard(value) || value.iso2 !== country) {
      throw new Error('invalid record place detail data');
    }
    return value;
  }).catch((error) => {
    detailInflight.delete(country);
    throw error;
  });
  detailInflight.set(country, request);
  return request;
}

export interface RecordPlaceDetailRow {
  id: string;
  compId: string;
  comp: RecordPlaceDetailCompetition;
  entry: RecordPlaceDetailEntry;
}

export function recordPlaceDetailRows(
  shard: RecordPlaceDetailShard,
  metric: RecordMetric | null,
  city: string | null,
): RecordPlaceDetailRow[] {
  const rows: RecordPlaceDetailRow[] = [];
  for (const [compId, entries] of Object.entries(shard.records)) {
    const comp = shard.comps[compId];
    if (!comp || (city !== null && comp.c !== city)) continue;
    entries.forEach((entry, index) => {
      if (metric === null || recordMetricForLevel(entry.t) === metric) {
        rows.push({ id: `${compId}:${index}`, compId, comp, entry });
      }
    });
  }
  return rows.sort((a, b) =>
    b.comp.s.localeCompare(a.comp.s, 'en')
      || a.compId.localeCompare(b.compId, 'en')
      || a.id.localeCompare(b.id, 'en')
  );
}

export interface RankedRecordRow<T> {
  row: T;
  rank: number;
}

function normalizeRecordPlaceSearch(value: string): string {
  return value.normalize('NFKD').replace(/\p{Diacritic}/gu, '').toLocaleLowerCase().trim();
}

export function cityRecordMatches(row: CityRecordCounts, query: string): boolean {
  const needle = normalizeRecordPlaceSearch(query);
  if (!needle) return true;
  const names = [row.city, ...row.aliases];
  const haystack = [
    ...names,
    ...names.flatMap((name) => [
      localizeCity(name, true, row.iso2),
      localizeCity(name, false, row.iso2),
    ]),
    countryName(row.iso2, true),
    countryName(row.iso2, false),
    row.iso2,
  ].map(normalizeRecordPlaceSearch).join('\n');
  return haystack.includes(needle);
}

export function countryRecordMatches(row: CountryRecordCounts, query: string): boolean {
  const needle = normalizeRecordPlaceSearch(query);
  if (!needle) return true;
  const haystack = [
    countryName(row.iso2, true),
    countryName(row.iso2, false),
    row.iso2,
  ].map(normalizeRecordPlaceSearch).join('\n');
  return haystack.includes(needle);
}

function localizedCityKey(row: CityRecordCounts, isZh: boolean): string {
  return `${row.iso2}\0${localizeCity(row.city, isZh, row.iso2).toLocaleLowerCase()}`;
}

export function localizedCityCollisionKeys(
  rows: readonly CityRecordCounts[],
  isZh: boolean,
): ReadonlySet<string> {
  const counts = new Map<string, number>();
  for (const row of rows) {
    const key = localizedCityKey(row, isZh);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return new Set([...counts].filter(([, count]) => count > 1).map(([key]) => key));
}

export function recordCityDisplayName(
  row: CityRecordCounts,
  isZh: boolean,
  collisions: ReadonlySet<string>,
): string {
  const localized = localizeCity(row.city, isZh, row.iso2);
  if (!collisions.has(localizedCityKey(row, isZh))) return localized;
  return isZh && localized !== row.city ? `${localized} (${row.city})` : row.city;
}

export function rankRecordRows<T extends RecordCounts>(
  rows: readonly T[],
  metric: RecordMetric,
  keyOf: (row: T) => string,
): RankedRecordRow<T>[] {
  const sorted = [...rows].sort((a, b) => {
    const selected = b[metric] - a[metric];
    if (selected) return selected;
    const total = (b.wr + b.cr + b.nr) - (a.wr + a.cr + a.nr);
    if (total) return total;
    const wr = b.wr - a.wr;
    if (wr) return wr;
    const cr = b.cr - a.cr;
    if (cr) return cr;
    const nr = b.nr - a.nr;
    return nr || keyOf(a).localeCompare(keyOf(b), 'en');
  });

  let rank = 0;
  let lastCount: number | null = null;
  return sorted.map((row, index) => {
    if (row[metric] !== lastCount) rank = index + 1;
    lastCount = row[metric];
    return { row, rank };
  });
}
