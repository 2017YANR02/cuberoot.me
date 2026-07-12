/*
 * build_puzzle_metrics — precompute per-scramble "by move-count" metrics over the WCA-real scramble
 * corpus, so BOTH the /scramble distribution panel (难度 metric selector) and the timer's "按步数"
 * WCA filter read one static precomputed source instead of sampling live (rare ranges become instant
 * + reliable). Reuses the shipped timer solvers (lib/cube222-metric, timer/_lib/solver/pyra) verbatim
 * — no metric logic is reimplemented here.
 *
 * These solver modules compile to CJS under tsx, so they're pulled in via default-import interop
 * (named imports fail under tsx even though they work under vitest / the Next bundler).
 *
 * Input:  <dataRoot>/<key>/scrambles.txt        (id,scramble per line)
 * Output: <dataRoot>/222/222_metrics.csv        (id,face,layer,htm,qtm)
 *         <dataRoot>/pyraminx/pyraminx_metrics.csv (id,v,cube)
 * Incremental: existing rows are kept; only ids not yet present are computed + appended.
 *
 * Perf: 222 uses create222MetricEvaluator (one-time full-space BFS tables ~10s, then O(1)/scramble)
 * — the full 440k corpus takes ~1min single-process; the tables are only built when there are new
 * rows. Pyraminx solves per-scramble (~1000/s), fine for incremental deltas.
 *
 * Run: pnpm --filter @cuberoot/client exec tsx scripts/build_puzzle_metrics.mts [222|pyraminx ...]
 */
import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';
import cube222Mod from '../lib/cube222-metric.ts';
import pyraMod from '../app/[lang]/timer/_lib/solver/pyra.ts';

const { create222MetricEvaluator } = cube222Mod as {
  create222MetricEvaluator: () => (s: string) => { face: number; layer: number; htm: number; qtm: number } | null;
};
const { solvePyra, solvePyraV } = pyraMod as {
  solvePyra: (s: string) => { moves: string[] };
  solvePyraV: (s: string) => { moves: string[] }[];
};

/** body-only (no-tips) HTM full solve — matches pyram-metric.ts cubeDist / the timer 'cube' metric. */
function pyraCube(scr: string): number {
  return solvePyra(scr).moves.filter((m) => /^[RULB]/.test(m)).length;
}
/** V-first V step = shortest V-solve across the 4 face frames — matches pyram-metric.ts vDist / 'v'. */
function pyraV(scr: string): number {
  let best = Infinity;
  for (const f of solvePyraV(scr)) best = Math.min(best, f.moves.length);
  return Number.isFinite(best) ? best : 0;
}

const DATA_ROOT = process.env.PUZZLE_DATA_DIR || 'D:/cube/scramble/puzzle';
const FLUSH_EVERY = 20000; // 批量 append,兼顾崩溃可续跑与内存。

interface Spec {
  key: string;
  header: string[];
  compute: (scr: string) => (number | null)[];
}
// 222 查表 evaluator 惰性建表:无新打乱时(日常增量常见)完全不付建表成本。
let eval222: ((s: string) => { face: number; layer: number; htm: number; qtm: number } | null) | null = null;
const SPECS: Record<string, Spec> = {
  '222': {
    key: '222',
    header: ['id', 'face', 'layer', 'htm', 'qtm'],
    compute: (scr) => {
      if (!eval222) {
        console.log('  [222] building full-space distance tables (one-time, ~10s)...');
        eval222 = create222MetricEvaluator();
      }
      const v = eval222(scr);
      return v ? [v.face, v.layer, v.htm, v.qtm] : [null, null, null, null];
    },
  },
  pyraminx: {
    key: 'pyraminx',
    header: ['id', 'v', 'cube'],
    compute: (scr) => [pyraV(scr), pyraCube(scr)],
  },
};

/** ids already present in the output CSV (so re-runs only compute new scrambles). Only counts rows
 *  with the full column set and non-empty numeric fields — a crash-truncated tail line is thus
 *  recomputed on the next run (aggregators skip the bad line with the same strict check). */
async function loadDoneIds(csvPath: string, ncols: number): Promise<Set<string>> {
  const done = new Set<string>();
  if (!fs.existsSync(csvPath)) return done;
  const rl = readline.createInterface({ input: fs.createReadStream(csvPath, 'utf-8'), crlfDelay: Infinity });
  let first = true;
  for await (const line of rl) {
    if (!line) continue;
    if (first) { first = false; continue; } // header
    const parts = line.split(',');
    if (parts.length !== ncols || parts.some((p) => !p)) continue; // 截断/坏行 → 该 id 重算
    done.add(parts[0]);
  }
  return done;
}

async function build(spec: Spec): Promise<void> {
  const dir = path.join(DATA_ROOT, spec.key);
  const txtPath = path.join(dir, 'scrambles.txt');
  if (!fs.existsSync(txtPath)) { console.warn(`[skip] ${spec.key}: missing ${txtPath}`); return; }
  const outPath = path.join(dir, `${spec.key}_metrics.csv`);
  const done = await loadDoneIds(outPath, spec.header.length);
  if (!fs.existsSync(outPath)) fs.writeFileSync(outPath, spec.header.join(',') + '\n');

  const rl = readline.createInterface({ input: fs.createReadStream(txtPath, 'utf-8'), crlfDelay: Infinity });
  let buf: string[] = [];
  let added = 0, skipped = 0, bad = 0;
  const t0 = Date.now();
  const flush = () => { if (buf.length) { fs.appendFileSync(outPath, buf.join('')); buf = []; } };
  for await (const line of rl) {
    if (!line) continue;
    const i = line.indexOf(',');
    if (i <= 0) continue;
    const id = line.slice(0, i);
    if (done.has(id)) { skipped++; continue; }
    const scr = line.slice(i + 1).trim();
    const vals = spec.compute(scr);
    if (vals.some((v) => v == null)) { bad++; continue; } // 无法度量(WCA 真题不会命中)
    buf.push([id, ...vals].join(',') + '\n');
    added++;
    if (added % FLUSH_EVERY === 0) {
      flush();
      const rate = Math.round(added / ((Date.now() - t0) / 1000));
      console.log(`  [${spec.key}] ${added} computed (${rate}/s)...`);
    }
  }
  flush();
  const secs = ((Date.now() - t0) / 1000).toFixed(1);
  console.log(`[${spec.key}] +${added} new, ${skipped} cached${bad ? `, ${bad} unmeasurable` : ''} in ${secs}s → ${outPath}`);
}

const requested = process.argv.slice(2).filter((a) => a in SPECS);
const keys = requested.length ? requested : Object.keys(SPECS);
for (const k of keys) await build(SPECS[k]);
