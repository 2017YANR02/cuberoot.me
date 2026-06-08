// Per-event distribution of WCA scramble move-counts.
//
// Streams every row of the `scrambles` table (one scan, no joins) and counts
// the moves in each scramble string via the shared per-event tokenizer, then
// writes one tiny histogram-per-event JSON the /scramble/stats length tab reads.
//
//   stats/scramble/event_lengths.json
//     { meta, events: { <eventId>: { unit, samples, counts: {<len>: n} } } }
//
// Notes:
//   - `scrambles` must be in REQUIRED_TABLES (core/database.ts) so the daily
//     import loads it; the table is ~0.5GB, negligible next to results (5.6GB).
//   - We stream rather than SELECT-all: ~several million rows would otherwise
//     blow the heap. Histograms themselves are a few KB.
//   - Multi-blind rows pack one 3x3 per line, so a row can yield many samples.
//
// Run: npx tsx src/bin/build_scramble_lengths.ts

import { writeFileSync, mkdirSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import mysql from 'mysql2';
import { scrambleMoveLengths, scrambleLengthUnit } from '@cuberoot/shared/scramble-length';
import { DB_CONFIG } from '../core/database.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(__dirname, '../../../../../stats/scramble/event_lengths.json');

// Stable WCA event order (active 17 then retired 4) — mirrors gen_comp_records.
const EVENT_ORDER = [
  '333', '222', '444', '555', '666', '777',
  '333bf', '333fm', '333oh', 'clock', 'minx', 'pyram', 'skewb', 'sq1',
  '444bf', '555bf', '333mbf', '333ft', '333mbo', 'magic', 'mmagic',
];
const orderIdx = (e: string) => {
  const i = EVENT_ORDER.indexOf(e);
  return i === -1 ? EVENT_ORDER.length : i;
};

interface ScrambleRow {
  event_id: string;
  scramble: string;
}

async function main() {
  const conn = mysql.createConnection({
    host: DB_CONFIG.host,
    user: DB_CONFIG.username,
    password: DB_CONFIG.password,
    database: DB_CONFIG.database,
  });

  // eventId -> (length -> count)
  const hist = new Map<string, Map<number, number>>();
  let rows = 0;
  let samples = 0;

  const bump = (event: string, len: number) => {
    let m = hist.get(event);
    if (!m) { m = new Map(); hist.set(event, m); }
    m.set(len, (m.get(len) ?? 0) + 1);
    samples++;
  };

  await new Promise<void>((res, rej) => {
    const stream = conn.query('SELECT event_id, scramble FROM scrambles').stream();
    stream.on('data', (row: ScrambleRow) => {
      rows++;
      for (const len of scrambleMoveLengths(row.event_id, row.scramble)) bump(row.event_id, len);
      if (rows % 1_000_000 === 0) console.log(`  ...${rows.toLocaleString()} rows`);
    });
    stream.on('end', () => res());
    stream.on('error', rej);
  });

  conn.end();

  const events: Record<string, { unit: string; samples: number; counts: Record<string, number> }> = {};
  for (const ev of [...hist.keys()].sort((a, b) => orderIdx(a) - orderIdx(b))) {
    const m = hist.get(ev)!;
    const counts: Record<string, number> = {};
    let n = 0;
    for (const len of [...m.keys()].sort((a, b) => a - b)) {
      counts[String(len)] = m.get(len)!;
      n += m.get(len)!;
    }
    events[ev] = { unit: scrambleLengthUnit(ev), samples: n, counts };
  }

  const out = {
    meta: {
      generated_at: new Date().toISOString(),
      total_scrambles: rows,
      total_samples: samples,
      events: Object.keys(events).length,
    },
    events,
  };

  mkdirSync(dirname(OUT), { recursive: true });
  writeFileSync(OUT, JSON.stringify(out));
  console.log(`Wrote ${OUT}`);
  console.log(`  ${rows.toLocaleString()} scramble rows → ${samples.toLocaleString()} samples across ${Object.keys(events).length} events`);
}

main().catch((err) => {
  console.error('FATAL:', err);
  process.exit(1);
});
