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
// 「首次出现」时间线:每 (event, metric, length) 最早出现的那条打乱(按比赛开始日期排序)。
const OUT_FIRST = resolve(__dirname, '../../../../../stats/scramble/event_length_first_appearance.json');

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

  // 先全量拉比赛日期(~1.8 万行)。「首次出现」需在单次扫描里按日期取最早,故必须先有日期表;
  // 顺带给最终 comps(示例 + 首次出现引用到的)复用名称/日期,省一次查询。
  interface CompMeta { name: string; dateStr: string; dateInt: number }
  const compMeta = new Map<string, CompMeta>();
  await new Promise<void>((res, rej) => {
    conn.query('SELECT id, name, start_date FROM competitions', (err: unknown, rowsC: unknown) => {
      if (err) return rej(err);
      for (const c of rowsC as { id: string; name: string; start_date: Date | string }[]) {
        const dateStr = typeof c.start_date === 'string' ? c.start_date.slice(0, 10)
          : c.start_date instanceof Date ? c.start_date.toISOString().slice(0, 10) : '';
        const di = dateStr ? Number(dateStr.replaceAll('-', '')) : NaN;
        compMeta.set(c.id, { name: c.name, dateStr, dateInt: Number.isFinite(di) ? di : Infinity });
      }
      res();
    });
  });

  const hist = new Map<string, Map<number, number>>();      // event -> len -> count (HTM)
  const exMap = new Map<string, Map<number, Example[]>>();   // event -> len -> reservoir (HTM)
  const histQtm = new Map<string, Map<number, number>>();    // event -> qtmLen -> count (3x3-family)
  const exMapQtm = new Map<string, Map<number, Example[]>>(); // event -> qtmLen -> reservoir
  let rows = 0;
  let samples = 0;

  // Megaminx scrambles whose raw text glues two moves with a missing space
  // (e.g. "R--D--") — surfaced on the page so the 77-vs-76 quirk is explained.
  const MINX_MOVE = /R\+\+|R--|D\+\+|D--|U'|U/g;
  const minxGlued: { ci: string; r: string; g: string; n: number; tok: string }[] = [];

  // Events whose scramble is a fixed-length random-MOVE sequence: TNoodle always
  // emits exactly this many moves, so any other length means that competition
  // used a non-standard scrambler (surfaced on the page, by competition).
  const FIXED_MOVE_COUNT: Record<string, number> = { '555': 60, '666': 80, '777': 100 };
  const anomalyMap = new Map<string, Map<string, { lens: Set<number>; n: number }>>(); // event -> comp -> {lens,n}

  // 把一条样本计入指定的 hist + 示例 reservoir(HTM 与 QTM 复用同一逻辑)。
  const bumpInto = (
    histMap: Map<string, Map<number, number>>,
    exMaps: Map<string, Map<number, Example[]>>,
    event: string, len: number, ex: Example,
  ) => {
    let m = histMap.get(event);
    if (!m) { m = new Map(); histMap.set(event, m); }
    const c = (m.get(len) ?? 0) + 1; // running count for this bin → reservoir denominator
    m.set(len, c);

    let em = exMaps.get(event);
    if (!em) { em = new Map(); exMaps.set(event, em); }
    let arr = em.get(len);
    if (!arr) { arr = []; em.set(len, arr); }
    if (arr.length < K) arr.push(ex);
    else { const j = Math.floor(rand() * c); if (j < K) arr[j] = ex; }
  };
  // 「首次出现」:event -> len -> 最早一条。排序键 = (比赛开始日期, 同日按 compId, 再按 scramble_num)。
  type FirstLen = { dateInt: number; ex: Example };
  const firstHtm = new Map<string, Map<number, FirstLen>>();
  const firstQtm = new Map<string, Map<number, FirstLen>>();
  const firstInto = (
    fm: Map<string, Map<number, FirstLen>>,
    event: string, len: number, dateInt: number, ex: Example,
  ) => {
    let m = fm.get(event);
    if (!m) { m = new Map(); fm.set(event, m); }
    const cur = m.get(len);
    if (!cur
      || dateInt < cur.dateInt
      || (dateInt === cur.dateInt && (ex[0] < cur.ex[0] || (ex[0] === cur.ex[0] && ex[3] < cur.ex[3])))) {
      m.set(len, { dateInt, ex });
    }
  };

  // HTM(所有项目)+ 可选 QTM(3x3-family,sample.qtm 有值时)。dateInt 用于「首次出现」排序。
  const bump = (event: string, s: { len: number; qtm?: number }, ex: Example, dateInt: number) => {
    bumpInto(hist, exMap, event, s.len, ex);
    firstInto(firstHtm, event, s.len, dateInt, ex);
    samples++;
    if (s.qtm !== undefined) {
      bumpInto(histQtm, exMapQtm, event, s.qtm, ex);
      firstInto(firstQtm, event, s.qtm, dateInt, ex);
    }
  };

  await new Promise<void>((res, rej) => {
    const stream = conn.query(
      'SELECT competition_id, event_id, round_type_id, group_id, is_extra, scramble_num, scramble FROM scrambles',
    ).stream();
    stream.on('data', (row: ScrambleRow) => {
      rows++;
      const extra: 0 | 1 = row.is_extra ? 1 : 0;
      const dateInt = compMeta.get(row.competition_id)?.dateInt ?? Infinity;
      for (const s of scrambleMoveSamples(row.event_id, row.scramble)) {
        bump(row.event_id, s, [row.competition_id, row.round_type_id, row.group_id, row.scramble_num, s.text, extra], dateInt);
      }
      if (row.event_id === 'minx') {
        const glued = (row.scramble ?? '').trim().split(/\s+/).filter(Boolean)
          .filter((t) => (t.match(MINX_MOVE) ?? []).length > 1);
        if (glued.length) minxGlued.push({ ci: row.competition_id, r: row.round_type_id, g: row.group_id, n: row.scramble_num, tok: glued.join(' ') });
      }
      const canon = FIXED_MOVE_COUNT[row.event_id];
      if (canon !== undefined) {
        const len = (row.scramble ?? '').trim().split(/\s+/).filter(Boolean).length;
        if (len && len !== canon) {
          let m = anomalyMap.get(row.event_id);
          if (!m) { m = new Map(); anomalyMap.set(row.event_id, m); }
          let a = m.get(row.competition_id);
          if (!a) { a = { lens: new Set(), n: 0 }; m.set(row.competition_id, a); }
          a.lens.add(len); a.n++;
        }
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
  for (const em of exMapQtm.values()) for (const arr of em.values()) for (const ex of arr) referenced.add(ex[0]);
  for (const a of minxGlued) referenced.add(a.ci); // need their comp names too
  for (const m of anomalyMap.values()) for (const ci of m.keys()) referenced.add(ci);

  const comps: Record<string, [string, string]> = {};
  for (const id of referenced) {
    const cm = compMeta.get(id);
    if (cm) comps[id] = [cm.name, cm.dateStr];
  }

  conn.end();

  const orderedEvents = [...hist.keys()].sort((a, b) => orderIdx(a) - orderIdx(b));

  interface EventOut {
    unit: string; samples: number; counts: Record<string, number>;
    counts_qtm?: Record<string, number>; // 3x3-family:QTM 计步直方图(前端可切)
    glued?: { ci: string; cn: string; r: string; g: string; n: number; tok: string }[];
    anomalies?: { ci: string; cn: string; lens: number[]; n: number }[];
  }
  const sortedCounts = (m: Map<number, number>): Record<string, number> => {
    const counts: Record<string, number> = {};
    for (const len of [...m.keys()].sort((a, b) => a - b)) counts[String(len)] = m.get(len)!;
    return counts;
  };
  const events: Record<string, EventOut> = {};
  for (const ev of orderedEvents) {
    const m = hist.get(ev)!;
    let n = 0;
    for (const v of m.values()) n += v;
    const out: EventOut = { unit: scrambleLengthUnit(ev), samples: n, counts: sortedCounts(m) };
    const mq = histQtm.get(ev);
    if (mq) out.counts_qtm = sortedCounts(mq);
    events[ev] = out;
  }
  if (events.minx && minxGlued.length) {
    events.minx.glued = minxGlued.map((a) => ({ ci: a.ci, cn: comps[a.ci]?.[0] ?? a.ci, r: a.r, g: a.g, n: a.n, tok: a.tok }));
  }
  for (const [ev, m] of anomalyMap) {
    if (!events[ev]) continue;
    const list = [...m.entries()]
      .map(([ci, a]) => ({ ci, cn: comps[ci]?.[0] ?? ci, lens: [...a.lens].sort((x, y) => x - y), n: a.n }))
      .sort((a, b) => b.n - a.n);
    if (list.length) events[ev].anomalies = list;
  }

  const byLenObj = (em: Map<number, Example[]>): Record<string, Example[]> => {
    const byLen: Record<string, Example[]> = {};
    for (const len of [...em.keys()].sort((a, b) => a - b)) byLen[String(len)] = em.get(len)!;
    return byLen;
  };
  const exEvents: Record<string, Record<string, Example[]>> = {};
  for (const ev of orderedEvents) exEvents[ev] = byLenObj(exMap.get(ev)!);
  // QTM 示例分桶(3x3-family);前端切到 QTM 时点 bin 用这套。
  const exEventsQtm: Record<string, Record<string, Example[]>> = {};
  for (const [ev, em] of exMapQtm) exEventsQtm[ev] = byLenObj(em);

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
    events_qtm: exEventsQtm,
  }));

  // 「首次出现」:每 (event, metric, length) 最早一条 + 引用到的比赛名/日期。
  const firstReferenced = new Set<string>();
  const firstByLen = (fm: Map<number, FirstLen>): Record<string, Example> => {
    const o: Record<string, Example> = {};
    for (const len of [...fm.keys()].sort((a, b) => a - b)) {
      const f = fm.get(len)!;
      o[String(len)] = f.ex;
      firstReferenced.add(f.ex[0]);
    }
    return o;
  };
  const firstEvents: Record<string, { htm: Record<string, Example>; qtm?: Record<string, Example> }> = {};
  for (const ev of orderedEvents) {
    const h = firstHtm.get(ev);
    if (!h) continue;
    const entry: { htm: Record<string, Example>; qtm?: Record<string, Example> } = { htm: firstByLen(h) };
    const q = firstQtm.get(ev);
    if (q) entry.qtm = firstByLen(q);
    firstEvents[ev] = entry;
  }
  const firstComps: Record<string, [string, string]> = {};
  for (const id of firstReferenced) {
    const cm = compMeta.get(id);
    if (cm) firstComps[id] = [cm.name, cm.dateStr];
  }
  writeFileSync(OUT_FIRST, JSON.stringify({
    meta: { generated_at, note: 'earliest scramble per (event, metric, length) by competition start_date' },
    comps: firstComps,
    events: firstEvents,
  }));

  console.log(`Wrote ${OUT}`);
  console.log(`Wrote ${OUT_EX} (${Object.keys(comps).length} comps referenced)`);
  console.log(`Wrote ${OUT_FIRST} (${Object.keys(firstComps).length} comps referenced)`);
  console.log(`  ${rows.toLocaleString()} scramble rows → ${samples.toLocaleString()} samples across ${orderedEvents.length} events`);
}

main().catch((err) => {
  console.error('FATAL:', err);
  process.exit(1);
});
