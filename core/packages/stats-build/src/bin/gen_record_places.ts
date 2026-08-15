// Venue-based WR/CR/NR counts for the competition statistics leaderboard.
// Consumes the canonical competition and record-detail outputs generated earlier in stats.yml.
// Each detail entry already represents one single or average record marker.
// Usage: npx tsx src/bin/gen_record_places.ts

import { mkdirSync, readFileSync, writeFileSync } from 'fs';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';
import {
  buildRecordPlaces,
  type RecordPlaceSourceRow,
} from '@cuberoot/shared/record-places';

const currentDir = dirname(fileURLToPath(import.meta.url));
const OUTPUT_PATH = resolve(currentDir, '../../../../../stats/record_places.json');
const COMPS_PATH = resolve(currentDir, '../../../../../stats/all_past_comps.json');
const RECORDS_PATH = resolve(currentDir, '../../../../../stats/comp_records_detail.json');

interface CompRow {
  id: string;
  country: string;
  city?: string;
}

interface RecordEntry {
  t: string;
}

async function main() {
  const startedAt = Date.now();
  const comps = JSON.parse(readFileSync(COMPS_PATH, 'utf-8')) as CompRow[];
  const records = JSON.parse(readFileSync(RECORDS_PATH, 'utf-8')) as Record<string, RecordEntry[]>;
  const compsById = new Map(comps.map((comp) => [comp.id, comp]));
  const rows: RecordPlaceSourceRow[] = [];

  for (const [compId, entries] of Object.entries(records)) {
    const comp = compsById.get(compId);
    if (!comp || !Array.isArray(entries)) continue;
    for (const entry of entries) {
      rows.push({
        iso2: comp.country,
        city: comp.city ?? null,
        singleRecord: entry.t,
        averageRecord: null,
      });
    }
  }

  const output = buildRecordPlaces(rows);
  const json = JSON.stringify(output);
  mkdirSync(dirname(OUTPUT_PATH), { recursive: true });
  writeFileSync(OUTPUT_PATH, json, 'utf-8');

  const elapsed = ((Date.now() - startedAt) / 1000).toFixed(2);
  console.log(`Generated record_places in ${elapsed}s`);
  console.log(`  ${output.countries.length} countries, ${output.cities.length} cities, ${(json.length / 1024).toFixed(1)} KB`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
