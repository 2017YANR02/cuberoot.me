// Emits stats/scramble/recent_scrambles.json — the "近期打乱" (simplest scrambles of the
// latest export batch), per variant × metric × bottom-color, bucketed by step count.
//
// Reads incremental/new_split_mbf.csv (this batch's new ids + comp metadata) and each
// variant CSV (std/eo/pseudo/pseudo_pair/...), and for every (variant, metric, color)
// keeps up to PER_STEP example ids at each distinct step count (so the landing widget can
// let users pick any move count, not just the minimum), joins competition names, and writes
// one JSON consumed by the landing page RecentScrambles widget.
//
// Deliberately standalone from build.ts / build_wca_cross.ts (which the live refresh
// pipeline runs mid-flight) — duplicates a little variant/metadata boilerplate on purpose
// to stay isolated from their in-progress runs.
// Run: pnpm --filter @cuberoot/scramble-stats-build build:recent-scrambles

import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';
import { fileURLToPath } from 'node:url';
import YAML from 'yaml';
import { dateDisplay } from './comp_date';

const PER_STEP = 12; // examples kept per (variant, metric, color, step) — hero + up to 11 rows

// metric (stage index) order — same keys as client SheetView METRIC_STAGE.
const METRICS = ['cross', 'xc', 'xxc', 'xxxc', 'xxxxc'] as const;

// color letter -> CSV angle suffix (std notation): z0=Y z1=R z2=W z3=O x1=B x3=G.
const COLOR_ANGLE: Record<string, string> = {
  W: 'z2', Y: 'z0', R: 'z1', O: 'z3', B: 'x1', G: 'x3',
};
const COLORS = ['W', 'Y', 'R', 'O', 'B', 'G'];

// 13 子集底色 = 单色 6 + 双色 3(相反色对)+ 四色 3(排除一对相反色)+ 六色 1。
// key = 字母按字母序拼接,与 build.ts / distribution.json 的 subset_keys 一致;每子集排名取其颜色 min(色中性)。
const OPPOSITE_PAIRS: [string, string][] = [['W', 'Y'], ['B', 'G'], ['O', 'R']];
const ALL6 = ['B', 'G', 'O', 'R', 'W', 'Y'];
const subsetKey = (letters: string[]) => [...letters].sort().join('');
const SUBSETS: { key: string; colors: string[] }[] = [
  ...ALL6.map((c) => ({ key: c, colors: [c] })),
  ...OPPOSITE_PAIRS.map((p) => ({ key: subsetKey(p), colors: [...p] })),
  ...OPPOSITE_PAIRS.map((p) => { const cs = ALL6.filter((c) => !p.includes(c)); return { key: subsetKey(cs), colors: cs }; }),
  { key: subsetKey(ALL6), colors: [...ALL6] },
];

interface Variant { key: string; file: string; stages: string[] }
// stages mirror build.ts VARIANTS; std/eo = 5 stages, the rest = 4 (no xxxxcross).
const VARIANTS: Variant[] = [
  { key: 'std', file: 'std.csv', stages: ['cross', 'xcross', 'xxcross', 'xxxcross', 'xxxxcross'] },
  { key: 'eo', file: 'eo.csv', stages: ['eo_cross', 'eo_xcross', 'eo_xxcross', 'eo_xxxcross', 'eo_xxxxcross'] },
  { key: 'pseudo', file: 'pseudo.csv', stages: ['pseudo_cross', 'pseudo_xcross', 'pseudo_xxcross', 'pseudo_xxxcross'] },
  { key: 'pseudo_pair', file: 'pseudo_pair.csv', stages: ['pseudo_cross_pseudo_pair', 'pseudo_xcross_pseudo_pair', 'pseudo_xxcross_pseudo_pair', 'pseudo_xxxcross_pseudo_pair'] },
  { key: 'pair', file: 'pair.csv', stages: ['cross_pair', 'xcross_pair', 'xxcross_pair', 'xxxcross_pair'] },
  { key: 'f2leo', file: 'f2leo.csv', stages: ['f2leo_cross', 'f2leo_xcross', 'f2leo_xxcross', 'f2leo_xxxcross'] },
  { key: 'pseudo_f2leo', file: 'pseudo_f2leo.csv', stages: ['pseudo_f2leo_cross', 'pseudo_f2leo_xcross', 'pseudo_f2leo_xxcross', 'pseudo_f2leo_xxxcross'] },
];

interface NewMeta { scramble: string; compId: string; event: string; round: string; group: string; num: number; extra: boolean }
// step(字符串) -> 该步数的样例 [id, 取最少步的底色字母] 列表（每桶 ≤ PER_STEP）
type StepBuckets = Record<string, [string, string][]>;

async function loadCompMeta(tsvPath: string): Promise<Map<string, { name: string; date: string }>> {
  const map = new Map<string, { name: string; date: string }>();
  if (!fs.existsSync(tsvPath)) return map;
  const rl = readline.createInterface({ input: fs.createReadStream(tsvPath, 'utf-8'), crlfDelay: Infinity });
  let first = true;
  for await (const line of rl) {
    if (!line) continue;
    if (first) { first = false; continue; }
    const [id, name, start, end] = line.split('\t');
    map.set(id, { name, date: dateDisplay(start, end) });
  }
  return map;
}

async function readNewMeta(p: string): Promise<Map<string, NewMeta>> {
  const m = new Map<string, NewMeta>();
  if (!fs.existsSync(p)) return m;
  const rl = readline.createInterface({ input: fs.createReadStream(p, 'utf-8'), crlfDelay: Infinity });
  let first = true;
  for await (const line of rl) {
    if (!line) continue;
    if (first) { first = false; continue; }
    const c = line.split(',');
    m.set(c[0], { scramble: c[1], compId: c[2], event: c[3], round: c[4], group: c[5], num: Number(c[7]), extra: c[6] === '1' });
  }
  return m;
}

// keep the smallest-`cap` ids in a step bucket (id asc, deterministic regardless of CSV order).
// each entry carries the bottom-color letter that attained this bucket's step count.
function insertCapped(arr: [string, string][], id: string, color: string, cap: number) {
  if (arr.length >= cap && id >= arr[arr.length - 1][0]) return;
  let lo = 0, hi = arr.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (arr[mid][0] < id) lo = mid + 1; else hi = mid;
  }
  if (arr[lo]?.[0] === id) return; // ids are unique; guard against accidental dup
  arr.splice(lo, 0, [id, color]);
  if (arr.length > cap) arr.pop();
}

async function main() {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const pkgRoot = path.resolve(here, '..');
  const repoRoot = path.resolve(pkgRoot, '..', '..', '..');
  const config = YAML.parse(fs.readFileSync(path.join(pkgRoot, 'config.yml'), 'utf-8'));
  const wca = (config.sets || []).find((s: { key: string }) => s.key === 'wca') ?? config.sets?.[0];
  if (!wca) throw new Error('no wca set in config.yml');

  const csvDir: string = wca.csv_dir;
  const dataRoot = path.dirname(csvDir);
  const newMbf = path.join(dataRoot, 'incremental', 'new_split_mbf.csv');
  const compTsv = wca.comp_csv ?? path.join(dataRoot, 'competitions.tsv');

  const batchSnap = path.join(dataRoot, 'incremental', 'recent_scrambles_batch.csv');

  // 1. batch source: prefer this run's new_split_mbf; if it's empty (a no-new-scramble run, e.g.
  //    a pure f2leo/pseudo_f2leo backfill that re-fetched and found nothing), fall back to the
  //    last-batch snapshot so newly filled variants still join the most recent 近期打乱 batch.
  let newMeta = await readNewMeta(newMbf);
  let fromSnapshot = false;
  if (newMeta.size > 0) {
    fs.copyFileSync(newMbf, batchSnap); // remember this batch for later variant-only refreshes
  } else {
    newMeta = await readNewMeta(batchSnap);
    fromSnapshot = true;
  }
  const newCount = newMeta.size;
  if (newCount === 0) { console.log('[recent-scrambles] no batch (no new_split_mbf, no snapshot) — skipping.'); return; }
  console.log(`[recent-scrambles] ${newCount} scrambles ${fromSnapshot ? '(last-batch snapshot)' : '(new batch; snapshot updated)'}`);

  // 2. per variant: stream its full CSV, bucket ids by step per (metric, color) among the new ids
  const rank: Record<string, Record<string, Record<string, StepBuckets>>> = {};
  for (const v of VARIANTS) {
    const csvPath = path.join(csvDir, v.file);
    if (!fs.existsSync(csvPath)) { console.log(`[recent-scrambles] skip ${v.key} (no ${v.file})`); continue; }
    const vr: Record<string, Record<string, StepBuckets>> = {};
    for (let si = 0; si < v.stages.length; si++) {
      vr[METRICS[si]] = {};
      for (const s of SUBSETS) vr[METRICS[si]][s.key] = {};
    }
    const colIdx: Record<string, Record<string, number>> = {}; // metric -> color -> col index
    const rl = readline.createInterface({ input: fs.createReadStream(csvPath, 'utf-8'), crlfDelay: Infinity });
    let parsedHeader = false;
    let hit = 0;
    for await (const line of rl) {
      if (!line) continue;
      if (!parsedHeader) {
        parsedHeader = true;
        const cols = line.split(',');
        const idxMap = new Map<string, number>();
        cols.forEach((h, i) => idxMap.set(h, i));
        for (let si = 0; si < v.stages.length; si++) {
          const m = METRICS[si];
          colIdx[m] = {};
          for (const c of COLORS) {
            const col = `${v.stages[si]}_${COLOR_ANGLE[c]}`;
            const idx = idxMap.get(col);
            if (idx === undefined) throw new Error(`[${v.key}] missing column ${col}`);
            colIdx[m][c] = idx;
          }
        }
        continue;
      }
      const comma = line.indexOf(',');
      if (comma <= 0 || !newMeta.has(line.slice(0, comma))) continue;
      const parts = line.split(',');
      const id = parts[0];
      for (let si = 0; si < v.stages.length; si++) {
        const m = METRICS[si];
        const vals: Record<string, number> = {};
        for (const c of COLORS) vals[c] = Number(parts[colIdx[m][c]]);
        for (const s of SUBSETS) {
          let best = Infinity;
          let bestColor = '';
          for (const c of s.colors) { const x = vals[c]; if (Number.isFinite(x) && x < best) { best = x; bestColor = c; } }
          if (best !== Infinity) {
            const buckets = vr[m][s.key];
            const k = String(best);
            let arr = buckets[k];
            if (!arr) arr = buckets[k] = [];
            insertCapped(arr, id, bestColor, PER_STEP);
          }
        }
      }
      hit++;
    }
    rank[v.key] = vr;
    console.log(`[recent-scrambles] ${v.key}: ${hit} new rows ranked`);
  }

  // 3. collect referenced ids -> dedup scramble text + comp-name-joined metadata
  const compMeta = await loadCompMeta(compTsv);
  const usedIds = new Set<string>();
  for (const vk in rank) for (const m in rank[vk]) for (const c in rank[vk][m]) for (const k in rank[vk][m][c]) for (const [id] of rank[vk][m][c][k]) usedIds.add(id);
  const scr: Record<string, string> = {};
  const meta: Record<string, unknown> = {};
  for (const id of [...usedIds].sort()) {
    const nm = newMeta.get(id)!;
    scr[id] = nm.scramble;
    const cm = compMeta.get(nm.compId);
    meta[id] = { ci: nm.compId, cn: cm?.name ?? nm.compId, cd: cm?.date ?? '', r: nm.round, g: nm.group, n: nm.num, e: nm.event, x: nm.extra ? 1 : 0 };
  }

  const stamp = process.env.SCRAMBLE_STATS_STAMP || new Date().toISOString().slice(0, 10);
  const out = { export_date: stamp, generated_at: stamp, new_count: newCount, scr, meta, rank };
  const outDir = path.join(repoRoot, 'stats', 'scramble');
  fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, 'recent_scrambles.json');
  fs.writeFileSync(outPath, JSON.stringify(out));
  console.log(`[recent-scrambles] wrote ${outPath} (${(fs.statSync(outPath).size / 1024).toFixed(1)} KB, ${usedIds.size} distinct scrambles)`);
}

main().catch((err) => { console.error(err); process.exit(1); });
