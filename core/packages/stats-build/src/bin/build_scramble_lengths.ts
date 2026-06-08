// Per-event distribution of WCA scramble move-counts, plus example scrambles
// per length bin (so the UI can surface the rare extreme-long / extreme-short
// scrambles with their source competition).
//
// Streams every row of the `scrambles` table (one scan, no joins) and counts
// the moves in each scramble via the shared per-event tokenizer, reservoir-
// sampling example scrambles per (event, length). Two tiny JSONs:
//
//   stats/scramble/event_lengths.json
//     { meta, events: { <eventId>: { unit, samples, counts: {<len>: n} } } }
//   stats/scramble/event_length_examples.json   (lazy-loaded by the length tab)
//     { meta, comps: { <compId>: [name, startDate] },
//       events: { <eventId>: { <len>: [ [compId, round, group, num, text], ... ] } } }
//
// Rare bins keep ALL their scrambles (count <= K); common bins keep a K-sized
// reservoir. `scrambles` must be in REQUIRED_TABLES (core/database.ts).
//
// Run: npx tsx src/bin/build_scramble_lengths.ts

import { writeFileSync, mkdirSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import mysql from 'mysql2';
import { scrambleMoveSamples, scrambleLengthUnit } from '@cuberoot/shared/scramble-length';
import { DB_CONFIG } from '../core/database.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(__dirname, '../../../../../stats/scramble/event_lengths.json');
const OUT_EX = resolve(__dirname, '../../../../../stats/scramble/event_length_examples.json');

const K = 12; // examples kept per (event, length) bin

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

// Deterministic PRNG so reservoir output is stable across runs.
let seed = 0x9e3779b9 >>> 0;
const rand = () => {
  seed = (seed + 0x6d2b79f5) >>> 0;
  let t = seed;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

type Example = [string, string, string, number, string, 0 | 1]; // [compId, round, group, num, text, isExtra]

interface ScrambleRow {
  competition_id: string;
  event_id: string;
  round_type_id: string;
  group_id: string;
  is_extra: number;
  scramble_num: number;
  scramble: string;
}

async function main() {
  const conn = mysql.createConnection({
    host: DB_CONFIG.host,
    user: DB_CONFIG.username,
    password: DB_CONFIG.password,
    database: DB_CONFIG.database,
  });

  const hist = new Map<string, Map<number, number>>();      // event -> len -> count
  const exMap = new Map<string, Map<number, Example[]>>();   // event -> len -> reservoir
  let rows = 0;
  let samples = 0;

  // Megaminx scrambles whose raw text glues two moves with a missing space
  // (e.g. "R--D--") — surfaced on the page so the 77-vs-76 quirk is explained.
  const MINX_MOVE = /R\+\+|R--|D\+\+|D--|U'|U/g;
  const minxGlued: { ci: string; r: string; g: string; n: number; tok: string }[] = [];

  const bump = (event: string, len: number, ex: Example) => {
    let m = hist.get(event);
    if (!m) { m = new Map(); hist.set(event, m); }
    const c = (m.get(len) ?? 0) + 1; // running count for this bin → reservoir denominator
    m.set(len, c);
    samples++;

    let em = exMap.get(event);
    if (!em) { em = new Map(); exMap.set(event, em); }
    let arr = em.get(len);
    if (!arr) { arr = []; em.set(len, arr); }
    if (arr.length < K) arr.push(ex);
    else { const j = Math.floor(rand() * c); if (j < K) arr[j] = ex; }
  };

  await new Promise<void>((res, rej) => {
    const stream = conn.query(
      'SELECT competition_id, event_id, round_type_id, group_id, is_extra, scramble_num, scramble FROM scrambles',
    ).stream();
    stream.on('data', (row: ScrambleRow) => {
      rows++;
      const extra: 0 | 1 = row.is_extra ? 1 : 0;
      for (const s of scrambleMoveSamples(row.event_id, row.scramble)) {
        bump(row.event_id, s.len, [row.competition_id, row.round_type_id, row.group_id, row.scramble_num, s.text, extra]);
      }
      if (row.event_id === 'minx') {
        const glued = (row.scramble ?? '').trim().split(/\s+/).filter(Boolean)
          .filter((t) => (t.match(MINX_MOVE) ?? []).length > 1);
        if (glued.length) minxGlued.push({ ci: row.competition_id, r: row.round_type_id, g: row.group_id, n: row.scramble_num, tok: glued.join(' ') });
      }
      if (rows % 1_000_000 === 0) console.log(`  ...${rows.toLocaleString()} rows`);
    });
    stream.on('end', () => res());
    stream.on('error', rej);
  });

  // compIds may over-count (deleted entries on reservoir replace are imperfect);
  // recompute the exact referenced set from the final reservoirs.
  const referenced = new Set<string>();
  for (const em of exMap.values()) for (const arr of em.values()) for (const ex of arr) referenced.add(ex[0]);
  for (const a of minxGlued) referenced.add(a.ci); // need their comp names too

  const comps: Record<string, [string, string]> = {};
  await new Promise<void>((res, rej) => {
    conn.query('SELECT id, name, start_date FROM competitions', (err: unknown, rowsC: unknown) => {
      if (err) return rej(err);
      for (const c of rowsC as { id: string; name: string; start_date: Date | string }[]) {
        if (!referenced.has(c.id)) continue;
        const d = typeof c.start_date === 'string' ? c.start_date.slice(0, 10)
          : c.start_date instanceof Date ? c.start_date.toISOString().slice(0, 10) : '';
        comps[c.id] = [c.name, d];
      }
      res();
    });
  });

  conn.end();

  const orderedEvents = [...hist.keys()].sort((a, b) => orderIdx(a) - orderIdx(b));

  interface EventOut {
    unit: string; samples: number; counts: Record<string, number>;
    glued?: { ci: string; cn: string; r: string; g: string; n: number; tok: string }[];
  }
  const events: Record<string, EventOut> = {};
  for (const ev of orderedEvents) {
    const m = hist.get(ev)!;
    const counts: Record<string, number> = {};
    let n = 0;
    for (const len of [...m.keys()].sort((a, b) => a - b)) { counts[String(len)] = m.get(len)!; n += m.get(len)!; }
    events[ev] = { unit: scrambleLengthUnit(ev), samples: n, counts };
  }
  if (events.minx && minxGlued.length) {
    events.minx.glued = minxGlued.map((a) => ({ ci: a.ci, cn: comps[a.ci]?.[0] ?? a.ci, r: a.r, g: a.g, n: a.n, tok: a.tok }));
  }

  const exEvents: Record<string, Record<string, Example[]>> = {};
  for (const ev of orderedEvents) {
    const em = exMap.get(ev)!;
    const byLen: Record<string, Example[]> = {};
    for (const len of [...em.keys()].sort((a, b) => a - b)) byLen[String(len)] = em.get(len)!;
    exEvents[ev] = byLen;
  }

  const generated_at = new Date().toISOString();
  mkdirSync(dirname(OUT), { recursive: true });
  writeFileSync(OUT, JSON.stringify({
    meta: { generated_at, total_scrambles: rows, total_samples: samples, events: orderedEvents.length },
    events,
  }));
  writeFileSync(OUT_EX, JSON.stringify({
    meta: { generated_at, per_bin: K },
    comps,
    events: exEvents,
  }));

  console.log(`Wrote ${OUT}`);
  console.log(`Wrote ${OUT_EX} (${Object.keys(comps).length} comps referenced)`);
  console.log(`  ${rows.toLocaleString()} scramble rows → ${samples.toLocaleString()} samples across ${orderedEvents.length} events`);
}

main().catch((err) => {
  console.error('FATAL:', err);
  process.exit(1);
});
