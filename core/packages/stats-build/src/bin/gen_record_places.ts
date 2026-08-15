// Venue-based WR/CR/NR counts for the competition statistics leaderboard.
// Consumes the record-detail output and the complete WCA competitions table.
// Each detail entry already represents one single or average record marker.
// Usage: npx tsx src/bin/gen_record_places.ts

import { mkdirSync, readFileSync, writeFileSync } from 'fs';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';
import type { RowDataPacket } from 'mysql2';
import {
  buildRecordPlaces,
  type RecordCounts,
  type RecordPlaceSourceRow,
} from '@cuberoot/shared/record-places';
import { resolveCompCityIdentities } from '@cuberoot/shared/comp-city-identity';
import { closePool, query } from '../core/database.js';

const currentDir = dirname(fileURLToPath(import.meta.url));
const OUTPUT_PATH = resolve(currentDir, '../../../../../stats/record_places_v2.json');
const RECORDS_PATH = resolve(currentDir, '../../../../../stats/comp_records_detail.json');
const FALLBACK_COMP_PATHS = [
  resolve(currentDir, '../../../../../stats/all_past_comps.json'),
  resolve(currentDir, '../../../../../stats/all_upcoming_comps.json'),
];

interface CompRow extends RowDataPacket {
  id: string;
  country: string;
  city: string | null;
  latitude: number | string | null;
  longitude: number | string | null;
  start: Date | string;
}

interface CompVenue {
  id: string;
  country: string;
  city: string | null;
  latitude: number | null;
  longitude: number | null;
  start: string;
}

interface JsonCompRow {
  id: string;
  country: string;
  city?: string;
  latitude_degrees?: number | null;
  longitude_degrees?: number | null;
  start_date: string;
}

interface RecordEntry {
  t: string;
}

const CONTINENTAL_RECORDS = new Set(['AfR', 'AsR', 'ER', 'NAR', 'OcR', 'SAR']);
const MULTI_REGIONS = new Set(['XA', 'XE', 'XF', 'XM', 'XN', 'XO', 'XS', 'XW']);

function metricFor(level: string): keyof RecordCounts | null {
  if (level === 'WR') return 'wr';
  if (CONTINENTAL_RECORDS.has(level)) return 'cr';
  if (level === 'NR') return 'nr';
  return null;
}

function addExpected(map: Map<string, RecordCounts>, key: string, level: string): void {
  const metric = metricFor(level);
  if (!metric) return;
  const counts = map.get(key) ?? { wr: 0, cr: 0, nr: 0 };
  counts[metric]++;
  map.set(key, counts);
}

function dateString(value: Date | string): string {
  return value instanceof Date ? value.toISOString().slice(0, 10) : String(value).slice(0, 10);
}

function nullableNumber(value: number | string | null): number | null {
  if (value == null || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function assertCounts<T extends RecordCounts>(
  expected: Map<string, RecordCounts>,
  actual: Iterable<T>,
  keyOf: (row: T) => string,
  label: string,
): void {
  const actualMap = new Map<string, RecordCounts>();
  for (const row of actual) actualMap.set(keyOf(row), row);
  for (const [key, counts] of expected) {
    const value = actualMap.get(key);
    if (!value || value.wr !== counts.wr || value.cr !== counts.cr || value.nr !== counts.nr) {
      throw new Error(`${label} conservation failed for ${key}`);
    }
  }
  if (actualMap.size !== expected.size) throw new Error(`${label} conservation failed: row count differs`);
}

async function main() {
  const startedAt = Date.now();
  const databaseComps = await query<CompRow[]>(`
    SELECT
      c.id,
      COALESCE(co.iso2, c.country_id) AS country,
      c.city_name AS city,
      c.latitude / 1000000.0 AS latitude,
      c.longitude / 1000000.0 AS longitude,
      c.start_date AS start
    FROM competitions c
    LEFT JOIN countries co ON co.id = c.country_id
  `);
  const compsById = new Map<string, CompVenue>();
  for (const comp of databaseComps) {
    compsById.set(comp.id, {
      id: comp.id,
      country: comp.country,
      city: comp.city,
      latitude: nullableNumber(comp.latitude),
      longitude: nullableNumber(comp.longitude),
      start: dateString(comp.start),
    });
  }
  for (const path of FALLBACK_COMP_PATHS) {
    const fallback = JSON.parse(readFileSync(path, 'utf-8')) as JsonCompRow[];
    for (const comp of fallback) {
      if (compsById.has(comp.id)) continue;
      compsById.set(comp.id, {
        id: comp.id,
        country: comp.country,
        city: comp.city ?? null,
        latitude: comp.latitude_degrees ?? null,
        longitude: comp.longitude_degrees ?? null,
        start: comp.start_date,
      });
    }
  }
  const comps = [...compsById.values()];
  const records = JSON.parse(readFileSync(RECORDS_PATH, 'utf-8')) as Record<string, RecordEntry[]>;
  const resolved = resolveCompCityIdentities(comps.map((comp) => ({
    id: comp.id,
    country: comp.country,
    city: comp.city ?? undefined,
    latitude: comp.latitude,
    longitude: comp.longitude,
    start: comp.start,
  })));
  const rows: RecordPlaceSourceRow[] = [];
  const expectedCountries = new Map<string, RecordCounts>();
  const expectedCities = new Map<string, RecordCounts>();
  const unmatched: string[] = [];

  for (const [compId, entries] of Object.entries(records)) {
    const comp = compsById.get(compId);
    if (!comp) {
      unmatched.push(compId);
      continue;
    }
    if (!Array.isArray(entries)) throw new Error(`Invalid record entries for ${compId}`);
    const iso2 = comp.country.trim().toUpperCase();
    const identity = resolved.byCompId.get(compId);
    for (const entry of entries) {
      if (!entry || typeof entry.t !== 'string') throw new Error(`Invalid record entry for ${compId}`);
      rows.push({
        iso2,
        city: identity?.label ?? comp.city,
        cityKey: identity?.key ?? null,
        cityAliases: identity?.aliases,
        singleRecord: entry.t,
        averageRecord: null,
      });
      if (/^[A-Z]{2}$/.test(iso2) && !MULTI_REGIONS.has(iso2)) {
        addExpected(expectedCountries, iso2, entry.t);
        if (identity) addExpected(expectedCities, identity.key, entry.t);
      }
    }
  }
  if (unmatched.length > 0) {
    throw new Error(`Record competitions missing from competitions table: ${unmatched.sort().join(', ')}`);
  }

  const output = buildRecordPlaces(rows);
  assertCounts(expectedCountries, output.countries, (row) => row.iso2, 'country');
  const cityKeyByLabel = new Map(resolved.identities.map((identity) => {
    const iso2 = identity.key.slice(0, 2);
    return [`${iso2}\0${identity.label}`, identity.key];
  }));
  assertCounts(expectedCities, output.cities, (row) => {
    const key = cityKeyByLabel.get(`${row.iso2}\0${row.city}`);
    if (!key) throw new Error(`Generated city has no identity: ${row.iso2} / ${row.city}`);
    return key;
  }, 'city');
  const json = JSON.stringify(output);
  mkdirSync(dirname(OUTPUT_PATH), { recursive: true });
  writeFileSync(OUTPUT_PATH, json, 'utf-8');

  const elapsed = ((Date.now() - startedAt) / 1000).toFixed(2);
  console.log(`Generated record_places in ${elapsed}s`);
  console.log(`  ${output.countries.length} countries, ${output.cities.length} cities, ${(json.length / 1024).toFixed(1)} KB`);
  console.log(`  city identity: ${resolved.audit.mergedIdentities} merged groups, ${resolved.audit.mergedAliases} aliases, ${resolved.audit.splitNameGroups} split name groups, ${resolved.audit.repairedOutliers} repaired outliers`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
}).finally(() => closePool());
