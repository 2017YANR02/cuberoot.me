// Emits stats/scramble/recent_scrambles.json — the "近期打乱" (simplest scrambles of the
// latest export batch), per variant × metric × bottom-color, bucketed by step count.
//
// Reads incremental/new_split_mbf.csv (this batch's new ids + comp metadata) and each
// variant CSV (std/eo/pseudo/pseudo_pair/...), and for every (variant, metric, color)
// keeps up to PER_STEP example ids at each distinct step count (so the landing widget can
// let users pick any move count, not just the minimum), joins competition names, and writes
// one JSON consumed by the landing page RecentScrambles widget.
//
// Also emits `opt` (id -> optimal equivalent scramble, from solver/333opt/out.0.csv) — the landing
// widget displays THAT instead of the raw scramble (same as /timer's 最优打乱). Same cube state, so
// every bucketed step count still applies verbatim.
//
// The same out.0.csv feeds the '333' variant (whole-solve optimal HTM). It has no bottom-color
// dimension, so it gets a single subset key 'ALL' — matching distribution.json's
// sets.wca.variants['333'].data['333'].ALL, which the widget reads for the probability hint.
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

interface Variant { key: string; file: string; stages: string[]; metrics?: string[] }
// stages mirror build.ts VARIANTS; std/eo = 5 stages, the rest = 4 (no xxxxcross).
// metrics 缺省 = 按位置映射 METRICS(cross/xc/...);块类变体(222/roux/223)的阶段不是
// 十字递进, 直接用 stage 名当 metric 键, 客户端 METRIC_LABEL 同名注册。
const VARIANTS: Variant[] = [
  { key: 'std', file: 'std.csv', stages: ['cross', 'xcross', 'xxcross', 'xxxcross', 'xxxxcross'] },
  { key: 'eo', file: 'eo.csv', stages: ['eo_cross', 'eo_xcross', 'eo_xxcross', 'eo_xxxcross', 'eo_xxxxcross'] },
  { key: 'pseudo', file: 'pseudo.csv', stages: ['pseudo_cross', 'pseudo_xcross', 'pseudo_xxcross', 'pseudo_xxxcross'] },
  { key: 'pseudo_pair', file: 'pseudo_pair.csv', stages: ['pseudo_cross_pseudo_pair', 'pseudo_xcross_pseudo_pair', 'pseudo_xxcross_pseudo_pair', 'pseudo_xxxcross_pseudo_pair'] },
  { key: 'pair', file: 'pair.csv', stages: ['cross_pair', 'xcross_pair', 'xxcross_pair', 'xxxcross_pair'] },
  { key: 'f2leo', file: 'f2leo.csv', stages: ['f2leo_cross', 'f2leo_xcross', 'f2leo_xxcross', 'f2leo_xxxcross'] },
  { key: 'pseudo_f2leo', file: 'pseudo_f2leo.csv', stages: ['pseudo_f2leo_cross', 'pseudo_f2leo_xcross', 'pseudo_f2leo_xxcross', 'pseudo_f2leo_xxxcross'] },
  { key: '123', file: 'roux.csv', stages: ['fbsquare', 'rouxs1'], metrics: ['fbsquare', 'rouxs1'] },
  { key: '222', file: '222.csv', stages: ['block222'], metrics: ['block222'] },
  { key: '223', file: '223.csv', stages: ['block223'], metrics: ['block223'] },
  { key: '123x2', file: 'f2b.csv', stages: ['f2b'], metrics: ['f2b'] },
  { key: 'eoline', file: 'eoline.csv', stages: ['eo', 'eoline'], metrics: ['eo', 'eoline'] },
  { key: 'dr', file: 'dr.csv', stages: ['dr'], metrics: ['dr'] },
];

interface NewMeta { scramble: string; compId: string; event: string; round: string; group: string; num: number; extra: boolean }
// step(字符串) -> 该步数的样例 [id, 取最少步的底色字母] 列表（每桶 ≤ PER_STEP）
type StepBuckets = Record<string, [string, string][]>;

// 最优打乱(首页强制显示的那份,与 /timer「最优打乱」同源):invert(333opt 整解最优解) =
// 到达该核心态的最短打乱(纯面转,故 invert 也是纯面转、无宽块后缀)。
//  - 333/单手/脚拧/最少步:纯面转打乱 → invert 与原打乱严格同态。
//  - 三盲/多盲:WCA 打乱末尾带宽块定向后缀(整体旋转中心),master 语料已剥离 → 我们解的是剥后的核心态,
//    invert 到达的态与原打乱相差一个整体旋转(中心朝向不同,拧解难度 / 各阶段步数完全相同);首页按核心态
//    展示即可(点进 analyzer 的分析也据核心态,与卡片标注的阶段步数一致),故一并纳入、直接用纯面转最优。
const OPTIMAL_EVENTS = new Set(['333', '333oh', '333ft', '333fm', '333bf', '333mbf']);
const invertAlg = (alg: string) => alg.trim().split(/\s+/).filter(Boolean).reverse()
  .map((m) => (m.endsWith("'") ? m.slice(0, -1) : m.endsWith('2') ? m : `${m}'`)).join(' ');

// 流式 solver/333opt/out.0.csv (id,htm,solution),只取 wanted 里的 id。缺文件/缺 id -> 该条回退原打乱。
// htm = 整解最优步数(= '333' 变体的难度值),scr = invert(最优解) = 最优等态打乱。一趟扫出两者。
interface Opt333 { htm: number; scr: string }
async function loadOptimal333(outCsv: string, wanted: Set<string>): Promise<Map<string, Opt333>> {
  const out = new Map<string, Opt333>();
  if (wanted.size === 0 || !fs.existsSync(outCsv)) return out;
  const rl = readline.createInterface({ input: fs.createReadStream(outCsv, 'utf-8'), crlfDelay: Infinity });
  for await (const line of rl) {
    if (!line) continue;
    const c = line.split(',');
    if (c.length < 3 || !c[2] || !wanted.has(c[0])) continue;
    const htm = Number(c[1]);
    if (!Number.isFinite(htm)) continue;
    out.set(c[0], { htm, scr: invertAlg(c[2]) });
  }
  return out;
}

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

async function maxIdOf(p: string): Promise<number> {
  if (!fs.existsSync(p)) return 0;
  let max = 0;
  const rl = readline.createInterface({ input: fs.createReadStream(p, 'utf-8'), crlfDelay: Infinity });
  let first = true;
  for await (const line of rl) {
    if (!line) continue;
    if (first) { first = false; continue; }
    const c = line.indexOf(',');
    if (c <= 0) continue;
    const id = Number(line.slice(0, c));
    if (Number.isFinite(id) && id > max) max = id;
  }
  return max;
}

// stream the master split_mbf, keep rows whose numeric id > `after`, and rewrite `snap` (header +
// those raw rows, identical column layout to new_split_mbf) so the snapshot tracks the corpus.
async function readMetaAfter(masterPath: string, after: number, snap: string): Promise<Map<string, NewMeta>> {
  const m = new Map<string, NewMeta>();
  if (!fs.existsSync(masterPath)) return m;
  const rows: string[] = [];
  let header = 'id,scramble,competition_id,event_id,round_type_id,group_id,is_extra,scramble_num';
  const rl = readline.createInterface({ input: fs.createReadStream(masterPath, 'utf-8'), crlfDelay: Infinity });
  let first = true;
  for await (const line of rl) {
    if (!line) continue;
    if (first) { first = false; header = line; continue; }
    const k = line.indexOf(',');
    if (k <= 0) continue;
    const id = Number(line.slice(0, k));
    if (!Number.isFinite(id) || id <= after) continue;
    const c = line.split(',');
    m.set(c[0], { scramble: c[1], compId: c[2], event: c[3], round: c[4], group: c[5], num: Number(c[7]), extra: c[6] === '1' });
    rows.push(line);
  }
  if (rows.length > 0) fs.writeFileSync(snap, `${header}\n${rows.join('\n')}\n`);
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
  const masterMbf = path.join(dataRoot, 'input', 'wca_scrambles_split_mbf.csv');

  // batch source priority:
  //  1. this run's new_split_mbf (normal incremental path) — snapshot it for later reuse.
  //  2. empty new_split_mbf but the master corpus advanced past the last snapshot -> derive the
  //     delta from master's tail (id > snapshot max) and refresh the snapshot. Self-heals 近期打乱
  //     when new scrambles landed in master via a run that never reached this step (failed
  //     mid-pipeline, or -PublishOnly) — that leaves new_split_mbf cleared while the snapshot
  //     stays stale. Mirrors the id-watermark the all-events build already relies on.
  //  3. else reuse the last snapshot (e.g. pure variant backfill, nothing new in master).
  let newMeta = await readNewMeta(newMbf);
  let source: string;
  if (newMeta.size > 0) {
    fs.copyFileSync(newMbf, batchSnap); // remember this batch for later variant-only refreshes
    source = 'new batch; snapshot updated';
  } else {
    const snapMax = await maxIdOf(batchSnap);
    const tail = snapMax > 0 ? await readMetaAfter(masterMbf, snapMax, batchSnap) : new Map<string, NewMeta>();
    if (tail.size > 0) {
      newMeta = tail;
      source = `master tail (id > ${snapMax}); snapshot refreshed`;
    } else {
      newMeta = await readNewMeta(batchSnap);
      source = 'last-batch snapshot';
    }
  }
  const newCount = newMeta.size;
  if (newCount === 0) { console.log('[recent-scrambles] no batch (no new_split_mbf, no snapshot) — skipping.'); return; }
  console.log(`[recent-scrambles] ${newCount} scrambles (${source})`);

  // 2. per variant: stream its full CSV, bucket ids by step per (metric, color) among the new ids
  const rank: Record<string, Record<string, Record<string, StepBuckets>>> = {};
  for (const v of VARIANTS) {
    const csvPath = path.join(csvDir, v.file);
    if (!fs.existsSync(csvPath)) { console.log(`[recent-scrambles] skip ${v.key} (no ${v.file})`); continue; }
    const mkeys = v.metrics ?? METRICS;
    const vr: Record<string, Record<string, StepBuckets>> = {};
    for (let si = 0; si < v.stages.length; si++) {
      vr[mkeys[si]] = {};
      for (const s of SUBSETS) vr[mkeys[si]][s.key] = {};
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
          const m = mkeys[si];
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
        const m = mkeys[si];
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

  // 2b. '333' 变体 = 整解:难度值 = 整解最优 HTM(solver/333opt/out.0.csv 的 htm 列),与底色无关
  //     -> 单一子集键 'ALL',与 distribution.json 的 sets.wca.variants['333'].data['333'].ALL 同键
  //     (客户端对该变体固定用 'ALL',不走底色选择)。桶里的颜色字母留空 = 无底色语义。
  const same333 = new Set<string>();
  for (const [id, nm] of newMeta) if (OPTIMAL_EVENTS.has(nm.event)) same333.add(id);
  const optMap = await loadOptimal333(path.join(repoRoot, 'solver', '333opt', 'out.0.csv'), same333);
  if (optMap.size > 0) {
    const buckets: StepBuckets = {};
    for (const id of [...optMap.keys()].sort()) {
      const k = String(optMap.get(id)!.htm);
      if (!buckets[k]) buckets[k] = [];
      insertCapped(buckets[k], id, '', PER_STEP);
    }
    rank['333'] = { '333': { ALL: buckets } };
    console.log(`[recent-scrambles] 333: ${optMap.size}/${same333.size} new rows ranked (whole-solve HTM)`);
  } else {
    console.log(`[recent-scrambles] skip 333 (solver/333opt/out.0.csv has no row for this batch)`);
  }

  // 3. collect referenced ids -> dedup scramble text + comp-name-joined metadata
  const compMeta = await loadCompMeta(compTsv);
  const usedIds = new Set<string>();
  for (const vk in rank) for (const m in rank[vk]) for (const c in rank[vk][m]) for (const k in rank[vk][m][c]) for (const [id] of rank[vk][m][c][k]) usedIds.add(id);
  const scr: Record<string, string> = {};
  const meta: Record<string, unknown> = {};
  const optWanted = new Set<string>();
  for (const id of [...usedIds].sort()) {
    const nm = newMeta.get(id)!;
    scr[id] = nm.scramble;
    if (OPTIMAL_EVENTS.has(nm.event)) optWanted.add(id);
    const cm = compMeta.get(nm.compId);
    meta[id] = { ci: nm.compId, cn: cm?.name ?? nm.compId, cd: cm?.date ?? '', r: nm.round, g: nm.group, n: nm.num, e: nm.event, x: nm.extra ? 1 : 0 };
  }

  // 4. 最优等态打乱(首页显示这份;同态 -> rank 里的各阶段步数不变,仍适用)。复用 2b 已扫出的 optMap。
  const opt: Record<string, string> = {};
  for (const id of [...optWanted].sort()) {
    const o = optMap.get(id);
    if (o) opt[id] = o.scr;
  }
  const optHit = Object.keys(opt).length;
  console.log(`[recent-scrambles] optimal: ${optHit}/${optWanted.size} 3x3-family ids solved${optHit < optWanted.size ? ' (rest fall back to the raw scramble)' : ''}`);

  const stamp = process.env.SCRAMBLE_STATS_STAMP || new Date().toISOString().slice(0, 10);
  const out = { export_date: stamp, generated_at: stamp, new_count: newCount, scr, opt, meta, rank };
  const outDir = path.join(repoRoot, 'stats', 'scramble');
  fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, 'recent_scrambles.json');
  fs.writeFileSync(outPath, JSON.stringify(out));
  console.log(`[recent-scrambles] wrote ${outPath} (${(fs.statSync(outPath).size / 1024).toFixed(1)} KB, ${usedIds.size} distinct scrambles)`);
}

main().catch((err) => { console.error(err); process.exit(1); });
