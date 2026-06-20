// Emits stats/scramble/recent_scrambles_events.json — the "近期打乱" widget data for
// EVERY WCA event (3x3 itself keeps its own rich variant/metric/color widget fed by
// recent_scrambles.json; this file covers all the other events).
//
// "Recent batch" = the genuinely-new scrambles of the latest export, replicated for all
// events via a monotonic scramble-id watermark (WCA's Scrambles.id is auto-increment):
//   - normal run : rows whose raw id > last watermark
//   - bootstrap  : no watermark yet → rows from competitions in the last RECENT_WINDOW_DAYS
// After a non-empty batch we snapshot it (so a pure re-run still shows the same batch) and
// advance the watermark to the batch max.
//
// For each event we bucket the batch by **scramble length** (move count, per-event notation).
// For 2x2x2 / Pyraminx / Skewb we ALSO bucket by **difficulty** = the whole-solve optimal
// step count, joined by id from the puzzle pipeline CSVs (update_puzzle_stats.ps1 output).
// 333 itself + multi-blind (333mbf/333mbo, multi-cube blobs) are excluded.
//
// Deliberately standalone from build.ts / build_puzzle_dist.ts — duplicates a little
// metadata/length boilerplate on purpose to stay isolated from their in-progress runs.
// Run: pnpm --filter @cuberoot/scramble-stats-build build:recent-scrambles-events

import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';
import { fileURLToPath } from 'node:url';
import YAML from 'yaml';
import { dateDisplay } from './comp_date';

const PER_BUCKET = 12;        // examples kept per (event, mode, value) — hero + up to 11 rows
const RECENT_WINDOW_DAYS = 30; // bootstrap window when no watermark exists yet

// difficulty events → puzzle-pipeline data subdir (whole-solve optimal step count).
// value column in <key>.csv = the puzzle key itself (see build_puzzle_dist.ts).
const DIFFICULTY_PUZZLES: Record<string, string> = { '222': '222', pyram: 'pyraminx', skewb: 'skewb' };

// 333 = own rich widget; multi-blind = multi-cube blob (no single length / preview).
const EXCLUDE_EVENTS = new Set(['333', '333mbf', '333mbo']);

// Scramble move-count, per-event notation. Mirrors shared/scramble_length.ts; kept inline so
// this builder stays standalone (multi-blind is excluded upstream, so no per-line split here).
function moveCount(event: string, scramble: string): number | null {
  const s = (scramble ?? '').trim();
  if (!s) return null;
  if (event === 'sq1') {
    const pairs = s.match(/\(\s*-?\d+\s*,\s*-?\d+\s*\)/g);
    if (!pairs) return null;
    const slashes = (s.match(/\//g) ?? []).length;
    return pairs.length + slashes;
  }
  if (event === 'minx') {
    const m = s.match(/R\+\+|R--|D\+\+|D--|U'|U/g);
    return m && m.length > 0 ? m.length : null;
  }
  const n = s.split(/\s+/).filter(Boolean).length;
  return n > 0 ? n : null;
}

const rawIdNum = (id: string): number => Number(String(id).split('_')[0]);

// keep the PER_BUCKET smallest-id examples in a bucket (numeric id asc, deterministic).
function insertCapped(arr: string[], id: string, cap: number) {
  const v = rawIdNum(id);
  if (arr.length >= cap && v >= rawIdNum(arr[arr.length - 1])) return;
  let lo = 0, hi = arr.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (rawIdNum(arr[mid]) < v) lo = mid + 1; else hi = mid;
  }
  if (arr[lo] === id) return;
  arr.splice(lo, 0, id);
  if (arr.length > cap) arr.pop();
}

interface BatchRow { event: string; scr: string; ci: string; r: string; g: string; n: number; x: 0 | 1 }

// YYYY-MM-DD string `daysAgo` days before the given date string (UTC, no time component).
function shiftDate(ymd: string, days: number): string {
  const [y, m, d] = ymd.split('-').map(Number);
  const t = Date.UTC(y, m - 1, d) - days * 86400_000;
  return new Date(t).toISOString().slice(0, 10);
}

async function loadCompMeta(tsvPath: string): Promise<Map<string, { name: string; date: string; di: number }>> {
  const map = new Map<string, { name: string; date: string; di: number }>();
  if (!fs.existsSync(tsvPath)) return map;
  const rl = readline.createInterface({ input: fs.createReadStream(tsvPath, 'utf-8'), crlfDelay: Infinity });
  let first = true;
  for await (const line of rl) {
    if (!line) continue;
    if (first) { first = false; continue; }
    const [id, name, start, end] = line.split('\t');
    const di = start && start !== 'NULL' ? Number(start.replaceAll('-', '')) : 0;
    map.set(id, { name, date: dateDisplay(start, end), di: Number.isFinite(di) ? di : 0 });
  }
  return map;
}

// stream a puzzle <key>.csv, returning id -> optimal step for the wanted ids only.
async function loadPuzzleSteps(csvPath: string, valueCol: string, wanted: Set<string>): Promise<Map<string, number>> {
  const out = new Map<string, number>();
  if (wanted.size === 0 || !fs.existsSync(csvPath)) return out;
  const rl = readline.createInterface({ input: fs.createReadStream(csvPath, 'utf-8'), crlfDelay: Infinity });
  let idIdx = -1, valIdx = -1;
  for await (const line of rl) {
    if (!line) continue;
    if (idIdx === -1) {
      const h = line.split(',');
      idIdx = h.indexOf('id');
      valIdx = h.indexOf(valueCol);
      if (idIdx === -1 || valIdx === -1) throw new Error(`puzzle csv missing id/${valueCol}: ${csvPath}`);
      continue;
    }
    const c = line.split(',');
    const id = c[idIdx];
    if (!wanted.has(id)) continue;
    const v = Number(c[valIdx]);
    if (Number.isFinite(v)) out.set(id, v);
  }
  return out;
}

async function main() {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const pkgRoot = path.resolve(here, '..');
  const repoRoot = path.resolve(pkgRoot, '..', '..', '..');
  const config = YAML.parse(fs.readFileSync(path.join(pkgRoot, 'config.yml'), 'utf-8'));
  const wca = (config.sets || []).find((s: { key: string }) => s.key === 'wca') ?? config.sets?.[0];
  if (!wca) throw new Error('no wca set in config.yml');
  const dataRoot = path.dirname(wca.csv_dir as string);
  const puzzleRoot: string = config.puzzle_data_dir ?? 'D:/cube/scramble/puzzle';

  const scramblesTsv = path.join(dataRoot, 'incremental', 'tsv', 'Scrambles.tsv');
  const compTsv = wca.comp_csv ?? path.join(dataRoot, 'competitions.tsv');
  const watermarkFile = path.join(dataRoot, 'incremental', 'recent_events_watermark.txt');
  const snapFile = path.join(dataRoot, 'incremental', 'recent_events_batch.csv');

  const compMeta = await loadCompMeta(compTsv);

  const watermark = fs.existsSync(watermarkFile) ? Number((fs.readFileSync(watermarkFile, 'utf-8') || '0').trim()) || 0 : 0;
  // bootstrap cutoff (only used when no watermark): RECENT_WINDOW_DAYS before the export date.
  // Anchor on the export stamp (not the max competition date) — competitions.tsv also carries
  // future/upcoming comps that have no scrambles yet, which would push the cutoff past every
  // held comp and match nothing.
  let cutoffDi = 0;
  if (watermark <= 0) {
    const exportDateFile = path.join(dataRoot, 'incremental', 'export_date.txt');
    const anchor = (process.env.SCRAMBLE_STATS_STAMP
      || (fs.existsSync(exportDateFile) ? fs.readFileSync(exportDateFile, 'utf-8').trim() : '')
      || new Date().toISOString().slice(0, 10)).slice(0, 10);
    if (/^\d{4}-\d{2}-\d{2}$/.test(anchor)) cutoffDi = Number(shiftDate(anchor, RECENT_WINDOW_DAYS).replaceAll('-', ''));
  }

  const newRows = new Map<string, BatchRow>();
  let globalMax = watermark;
  let fromSnapshot = false;

  if (!fs.existsSync(scramblesTsv)) {
    console.warn(`[recent-events] no ${scramblesTsv}; trying snapshot only`);
  } else {
    const rl = readline.createInterface({ input: fs.createReadStream(scramblesTsv, 'utf-8'), crlfDelay: Infinity });
    let idIdx = -1, scrIdx = -1, ciIdx = -1, evIdx = -1, rndIdx = -1, grpIdx = -1, exIdx = -1, numIdx = -1;
    let scanned = 0;
    for await (const line of rl) {
      if (!line) continue;
      if (idIdx === -1) {
        const h = line.split('\t');
        idIdx = h.indexOf('id'); scrIdx = h.indexOf('scramble'); ciIdx = h.indexOf('competition_id');
        evIdx = h.indexOf('event_id'); rndIdx = h.indexOf('round_type_id'); grpIdx = h.indexOf('group_id');
        exIdx = h.indexOf('is_extra'); numIdx = h.indexOf('scramble_num');
        if ([idIdx, scrIdx, ciIdx, evIdx].some((i) => i === -1)) throw new Error(`Scrambles.tsv missing key column; header=${line}`);
        continue;
      }
      scanned++;
      if (scanned % 2_000_000 === 0) console.log(`  ...scanned ${scanned.toLocaleString()} rows`);
      const c = line.split('\t');
      const id = c[idIdx];
      const rid = rawIdNum(id);
      if (Number.isFinite(rid) && rid > globalMax) globalMax = rid;
      const event = c[evIdx];
      if (EXCLUDE_EVENTS.has(event)) continue;
      const ci = c[ciIdx];
      const isNew = watermark > 0 ? rid > watermark : (compMeta.get(ci)?.di ?? 0) >= cutoffDi;
      if (!isNew) continue;
      newRows.set(id, {
        event,
        scr: (c[scrIdx] ?? '').trim(),
        ci,
        r: c[rndIdx] ?? '',
        g: c[grpIdx] ?? '',
        n: Number(c[numIdx] ?? 0) || 0,
        x: c[exIdx] === '1' ? 1 : 0,
      });
    }
  }

  // empty delta (pure re-run / no new export) → fall back to the last snapshot.
  if (newRows.size === 0 && fs.existsSync(snapFile)) {
    fromSnapshot = true;
    const rl = readline.createInterface({ input: fs.createReadStream(snapFile, 'utf-8'), crlfDelay: Infinity });
    let first = true;
    for await (const line of rl) {
      if (!line) continue;
      if (first) { first = false; continue; }
      // id,event,ci,r,g,n,x,scr   (scr last; may contain commas? scrambles don't, but join rest defensively)
      const c = line.split(',');
      const [id, event, ci, r, g, n, x] = c;
      const scr = c.slice(7).join(',');
      newRows.set(id, { event, scr, ci, r, g, n: Number(n) || 0, x: x === '1' ? 1 : 0 });
    }
  } else if (newRows.size > 0) {
    // snapshot this fresh batch + advance the watermark.
    const lines = ['id,event,ci,r,g,n,x,scr'];
    for (const [id, b] of newRows) lines.push(`${id},${b.event},${b.ci},${b.r},${b.g},${b.n},${b.x},${b.scr}`);
    fs.writeFileSync(snapFile, lines.join('\n') + '\n');
    fs.writeFileSync(watermarkFile, String(globalMax));
  }

  const newCount = newRows.size;
  console.log(`[recent-events] ${newCount} scrambles ${fromSnapshot ? '(last-batch snapshot)' : `(new batch; watermark→${globalMax})`}`);

  // events[event] = { length:{<len>:[id]}, difficulty?:{metric,byStep:{<step>:[id]}} }
  interface EventOut { length: Record<string, string[]>; difficulty?: { metric: string; byStep: Record<string, string[]> } }
  const events: Record<string, EventOut> = {};
  const ensure = (ev: string): EventOut => (events[ev] ??= { length: {} });

  // length buckets (all batch events).
  for (const [id, b] of newRows) {
    const len = moveCount(b.event, b.scr);
    if (len == null) continue;
    const ev = ensure(b.event);
    (ev.length[String(len)] ??= []);
    insertCapped(ev.length[String(len)], id, PER_BUCKET);
  }

  // difficulty buckets (222/pyram/skewb) via puzzle CSV join.
  for (const [event, key] of Object.entries(DIFFICULTY_PUZZLES)) {
    const ids = new Set<string>();
    for (const [id, b] of newRows) if (b.event === event) ids.add(id);
    if (ids.size === 0) continue;
    const csvPath = path.join(puzzleRoot, key, `${key}.csv`);
    const steps = await loadPuzzleSteps(csvPath, key, ids);
    if (steps.size === 0) { console.warn(`  [difficulty] ${event}: no steps joined from ${csvPath}`); continue; }
    const ev = ensure(event);
    const byStep: Record<string, string[]> = {};
    for (const [id, step] of steps) {
      (byStep[String(step)] ??= []);
      insertCapped(byStep[String(step)], id, PER_BUCKET);
    }
    ev.difficulty = { metric: 'htm', byStep };
  }

  // collect referenced ids → scr + comp-name-joined meta.
  const usedIds = new Set<string>();
  for (const ev of Object.values(events)) {
    for (const arr of Object.values(ev.length)) for (const id of arr) usedIds.add(id);
    if (ev.difficulty) for (const arr of Object.values(ev.difficulty.byStep)) for (const id of arr) usedIds.add(id);
  }
  const scr: Record<string, string> = {};
  const meta: Record<string, unknown> = {};
  for (const id of [...usedIds].sort((a, b) => rawIdNum(a) - rawIdNum(b))) {
    const b = newRows.get(id)!;
    scr[id] = b.scr;
    const cm = compMeta.get(b.ci);
    meta[id] = { ci: b.ci, cn: cm?.name ?? b.ci, cd: cm?.date ?? '', r: b.r, g: b.g, n: b.n, e: b.event, x: b.x };
  }

  const stamp = process.env.SCRAMBLE_STATS_STAMP || new Date().toISOString().slice(0, 10);
  const out = { export_date: stamp, generated_at: stamp, new_count: newCount, scr, meta, events };
  const outDir = path.join(repoRoot, 'stats', 'scramble');
  fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, 'recent_scrambles_events.json');
  fs.writeFileSync(outPath, JSON.stringify(out));
  const evList = Object.entries(events).map(([e, v]) => `${e}${v.difficulty ? '*' : ''}`).join(' ');
  console.log(`[recent-events] wrote ${outPath} (${(fs.statSync(outPath).size / 1024).toFixed(1)} KB, ${usedIds.size} scrambles; events: ${evList})`);
}

main().catch((err) => { console.error(err); process.exit(1); });
