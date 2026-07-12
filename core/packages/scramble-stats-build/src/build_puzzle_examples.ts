import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';
import { fileURLToPath } from 'node:url';
import YAML from 'yaml';
import { dateDisplay } from './comp_date';
import { buildCubeshapeTable, cubeshapeSlashes } from './sq1_cubeshape';

// 非 3x3 puzzle 难度分布页的「点某步数 → 看该步数真实比赛打乱」示例(EPIC 3 配套)。
// 与 3x3 难度 tab 的 ExamplesPanel 对等,但 puzzle 无底色概念,故每 bin 只蓄 K 条 [id, scramble]。
//
// 数据契约(stats/scramble/puzzle_examples.json):
//   { meta: { generated_at },
//     puzzles: { <key>: {
//       bins:   { "<len>": [[id, scramble, optScramble?], ...] }, // 每步数 bin K=20 条(确定性均匀步长采样);稀有 bin(≤FULL_BIN_CAP)存全量
//       comps:  { "<ci>": [name, dateDisplay] },        // 被采样 id 引用到的比赛
//       idMeta: { "<id>": [ci, event, num, round, group, extra(0|1)] },
//       // 各步数「按比赛所属国家」的全量计数(非采样),供前端复用 StackedBar 画国家占比条 + 按国筛选示例。
//       // 每步只留 top TOP_COUNTRIES 个国家(占比条本就折叠尾部为「其他」);其余由前端用直方图 bin 总数补「其他」。
//       // key = WCA 国家名(与 comp_countries.json 同,前端 countryToIso2 转 iso2),bins/binsAlt/binsCubeshape 与示例分桶对齐。
//       countryDist?: { bins?: { "<len>": { "<country>": n } }, binsAlt?: {...}, binsCubeshape?: {...} }
//     } } }
// optScramble = invert(analyzer 的最优解列 soln);= 最短的等价打乱(同状态),驱动「原始/最优」切换。
// 仅当 <key>.csv 带 soln 列(analyzer 开 PUZZLE_EMIT_SOLN)时有;无则该元省略,前端只显原始。
// 客户端类型在 client/lib/puzzle-examples.ts(改 shape 必须两处同步 + bump fetch v=)。
//
// 只对 puzzle_distribution.json meta.puzzles 出现的 key 产(222 / pyraminx / skewb;
// sq1 是小样本占位,dist 文件里若没有就跳过)。

const EXAMPLE_K = 20;
// bin ≤ 此阈值 → 该 bin 示例存全量(稀有步数如复形 0 步仅百余条,便于按国筛选浏览);更大 bin 仍采样 K 条。
const FULL_BIN_CAP = 300;
// countryDist 每步只保留计数最高的前 N 个国家(占比条只显 top 段 + 「其他」,尾部无需精确)。
const TOP_COUNTRIES = 20;

interface PuzzleSpec {
  key: string;       // = JSON key = 数据子目录名
  event: string;     // WCA event_id(比赛元数据按此过滤,UI 预览 event 也用它)
  valueCol?: string; // 主口径 CSV 列名(默认 = key;sq1 = 'wca')
  altCol?: string;   // 备选口径列名(sq1 = 'slash';→ 产 binsAlt)
  // 「按步数」多口径(2×2 底面/底层/魔方/QTM、金字塔 V/魔方):示例按每个口径的度量值分桶,
  // 写进 metrics.<key>.bins。值来自 <key>_metrics.csv(build_puzzle_metrics.mts 预算)。
  metricsCsv?: { file: string; cols: string[] };
  // sq1 = 可证 WCA 12c4 最优(Sq1WcaSolver)。示例源 = sq1_wca_exact.csv + 未 ingest 完成块,
  // 按 wca_exact / opt 的 slash 数分桶,写进 bins/binsAlt(近最优 2026-06-18 退役,不再产 near 示例)。
  exact?: boolean;
}

// 与 build_puzzle_dist.ts 的 PUZZLES 对齐(顺序无关,sq1 视 dist 是否存在决定产不产)。
const PUZZLES: PuzzleSpec[] = [
  { key: '222', event: '222', metricsCsv: { file: '222_metrics.csv', cols: ['face', 'layer', 'htm', 'qtm'] } },
  { key: 'pyraminx', event: 'pyram', metricsCsv: { file: 'pyraminx_metrics.csv', cols: ['v', 'cube'] } },
  { key: 'skewb', event: 'skewb' },
  { key: 'sq1', event: 'sq1', exact: true }, // 精确档:bins=wca_exact、binsAlt=slash(opt_scramble 驱动「原始/最优」)
];

type Sample = [string, string, string?]; // [id, scramble, optScramble?]

// 反演解法 → 最优(最短)等价打乱:复现同一状态所需的最少步数序列(前端「原始/最优」切换用)。
// 通用记号规则:X2 自逆;X' ↔ X;pyraminx 小写 tip(u/l/r/b)同理。
function invertAlg(s: string): string {
  return s.trim().split(/\s+/).filter(Boolean).reverse()
    .map((m) => (m.endsWith('2') ? m : m.endsWith("'") ? m.slice(0, -1) : `${m}'`))
    .join(' ');
}

// 流式读 <key>.csv 的 soln 列(analyzer 开 PUZZLE_EMIT_SOLN 时产),仅取被采样 id,
// 反演为「最优等价打乱」。无 soln 列(如 sq1 近最优口径)→ 返回空表,前端自动只显原始。
async function loadOptScrambles(csvPath: string, wantedIds: Set<string>): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  if (wantedIds.size === 0) return out;
  const rl = readline.createInterface({ input: fs.createReadStream(csvPath, 'utf-8'), crlfDelay: Infinity });
  let idIdx = -1, solnIdx = -1, headerDone = false;
  for await (const line of rl) {
    if (!line) continue;
    if (!headerDone) {
      const h = line.split(',');
      idIdx = h.indexOf('id');
      solnIdx = h.indexOf('soln');
      headerDone = true;
      if (solnIdx === -1) break; // 该 puzzle 未产解列,整文件无 soln,提前退出
      continue;
    }
    const c = line.split(','); // soln 无逗号(空格分隔),c[solnIdx] 即整条解
    const id = c[idIdx];
    if (!wantedIds.has(id)) continue;
    const soln = c[solnIdx];
    if (soln && soln !== '-') out.set(id, invertAlg(soln));
  }
  return out;
}

// Pass 1: 流式读 <key>.csv,按 len 分桶收集全部 id(短字符串,百万级亦 ~数十 MB)。
async function bucketIdsByLen(csvPath: string, valueCol: string): Promise<Map<number, string[]>> {
  const buckets = new Map<number, string[]>();
  const rl = readline.createInterface({ input: fs.createReadStream(csvPath, 'utf-8'), crlfDelay: Infinity });
  let valIdx = -1;
  let idIdx = -1;
  for await (const line of rl) {
    if (!line) continue;
    if (valIdx === -1) {
      const header = line.split(',');
      idIdx = header.indexOf('id');
      valIdx = header.indexOf(valueCol);
      if (idIdx === -1 || valIdx === -1) throw new Error(`missing id/'${valueCol}' column in ${csvPath} header: ${line}`);
      continue;
    }
    const cols = line.split(',');
    const v = Number(cols[valIdx]);
    if (!Number.isFinite(v)) continue;
    const id = cols[idIdx];
    let arr = buckets.get(v);
    if (!arr) { arr = []; buckets.set(v, arr); }
    arr.push(id);
  }
  return buckets;
}

// 「按步数」多口径分桶:读 <key>_metrics.csv(id,<col1>,<col2>,...),每列(度量)按值分桶 id。
// 一趟读文件,同时给所有口径分桶(值列都在同一行)。
async function bucketIdsByMetrics(csvPath: string, cols: string[]): Promise<Record<string, Map<number, string[]>>> {
  const out: Record<string, Map<number, string[]>> = {};
  for (const c of cols) out[c] = new Map();
  const rl = readline.createInterface({ input: fs.createReadStream(csvPath, 'utf-8'), crlfDelay: Infinity });
  const idx: Record<string, number> = {};
  let idIdx = -1;
  for await (const line of rl) {
    if (!line) continue;
    if (idIdx === -1) {
      const header = line.split(',');
      idIdx = header.indexOf('id');
      for (const c of cols) {
        const i = header.indexOf(c);
        if (idIdx === -1 || i === -1) throw new Error(`missing id/'${c}' in ${csvPath} header: ${line}`);
        idx[c] = i;
      }
      continue;
    }
    const parts = line.split(',');
    const id = parts[idIdx];
    if (!id) continue;
    // 整行有效才分桶(与 build_puzzle_dist.aggregateMetrics 同款):任一列缺/空/非数(崩溃截断尾行,
    // Number('')===0 会进幻影 0 步桶)→ 整行跳过;该 id 会被增量重算补一条好行。
    let ok = true;
    for (const c of cols) {
      const s = parts[idx[c]];
      if (!s || !Number.isFinite(Number(s))) { ok = false; break; }
    }
    if (!ok) continue;
    for (const c of cols) {
      const v = Number(parts[idx[c]]);
      let arr = out[c].get(v);
      if (!arr) { arr = []; out[c].set(v, arr); }
      arr.push(id);
    }
  }
  return out;
}

// sq1 精确档双分桶:读 sq1_wca_exact.csv + _exact_chunks/*_sq1.csv(全量灌注进行中时块未 ingest),
// 按 wca_exact、按 opt_scramble 的 / 数(slash)各分桶 id(主 CSV 优先去重),并留 id → 最优等价打乱
// (opt_scramble 已是 SQ1 简写记号 `tb/tb/…`,前端直接渲染,驱动「原始/最优」切换)。与 build_puzzle_dist 的 exact 口径对齐。
async function bucketExactSq1(dataDir: string): Promise<{ wca: Map<number, string[]>; slash: Map<number, string[]>; optOf: Map<string, string> } | null> {
  const files: string[] = [];
  const exCsv = path.join(dataDir, 'sq1_wca_exact.csv');
  if (fs.existsSync(exCsv)) files.push(exCsv);
  const chunkDir = path.join(dataDir, '_exact_chunks');
  if (fs.existsSync(chunkDir)) {
    for (const n of fs.readdirSync(chunkDir).filter((x: string) => x.endsWith('_sq1.csv')).sort())
      files.push(path.join(chunkDir, n));
  }
  if (files.length === 0) return null;
  const seen = new Set<string>();
  const wca = new Map<number, string[]>();
  const slash = new Map<number, string[]>();
  const optOf = new Map<string, string>();
  const add = (m: Map<number, string[]>, k: number, id: string) => {
    let a = m.get(k); if (!a) { a = []; m.set(k, a); } a.push(id);
  };
  for (const file of files) {
    const rl = readline.createInterface({ input: fs.createReadStream(file, 'utf-8'), crlfDelay: Infinity });
    let idIdx = -1, wcaIdx = -1, optIdx = -1;
    for await (const line of rl) {
      if (!line) continue;
      if (idIdx === -1) {
        const h = line.split(',');
        idIdx = h.indexOf('id'); wcaIdx = h.indexOf('wca_exact'); optIdx = h.indexOf('opt_scramble');
        if (idIdx === -1 || wcaIdx === -1) throw new Error(`missing id/wca_exact in ${file}`);
        continue;
      }
      const c = line.split(','); // opt_scramble 用 ':' 不含逗号 → 恰 3 列
      const id = c[idIdx];
      if (!id || seen.has(id)) continue;
      const w = Number(c[wcaIdx]);
      if (!Number.isFinite(w)) continue;  // 防御坏行/半截块(WCA 真打乱永远合法)
      seen.add(id);
      add(wca, w, id);
      if (optIdx >= 0) {
        const opt = c[optIdx] ?? '';
        let s = 0; for (let k = 0; k < opt.length; k++) if (opt.charCodeAt(k) === 47 /* '/' */) s++;
        add(slash, s, id);
        if (opt) optOf.set(id, opt); // 已是 SQ1 简写记号,原样存
      }
    }
  }
  return { wca, slash, optOf };
}

// sq1 **真 slash 最优**档分桶:读 sq1_slash_exact.csv(id,slash_exact,opt_scramble)。
// 按 slash_exact(twist God 13)分桶 id + 留 id → slash 最优等价打乱(SQ1 简写记号,驱动「slash 最优打乱」)。
// 缺该文件 → null,调用方回退 bucketExactSq1 的 slash(WCA-最优解 / 数,紧上界)。
async function bucketSlashSq1(dataDir: string): Promise<{ slash: Map<number, string[]>; optOf: Map<string, string> } | null> {
  const csv = path.join(dataDir, 'sq1_slash_exact.csv');
  if (!fs.existsSync(csv)) return null;
  const slash = new Map<number, string[]>();
  const optOf = new Map<string, string>();
  const rl = readline.createInterface({ input: fs.createReadStream(csv, 'utf-8'), crlfDelay: Infinity });
  let idIdx = -1, valIdx = -1, optIdx = -1;
  for await (const line of rl) {
    if (!line) continue;
    if (idIdx === -1) {
      const h = line.split(',');
      idIdx = h.indexOf('id'); valIdx = h.indexOf('slash_exact'); optIdx = h.indexOf('opt_scramble');
      if (idIdx === -1 || valIdx === -1) throw new Error(`missing id/slash_exact in ${csv}`);
      continue;
    }
    const c = line.split(',');
    const id = c[idIdx];
    const v = Number(c[valIdx]);
    if (!id || !Number.isFinite(v)) continue;
    let a = slash.get(v); if (!a) { a = []; slash.set(v, a); } a.push(id);
    if (optIdx >= 0 && c[optIdx]) optOf.set(id, c[optIdx]);
  }
  return { slash, optOf };
}

// sq1「复形 / cubeshape」分桶:读 scrambles.txt(id,scramble),逐条即时算到 cube shape 的最少 slash
// 数(0..7),按值分桶 id。复形是 shape 约简、无「整解」概念 → 不产最优等价打乱,前端只显原始打乱。
async function bucketCubeshapeSq1(txtPath: string): Promise<Map<number, string[]>> {
  const table = buildCubeshapeTable();
  const buckets = new Map<number, string[]>();
  const rl = readline.createInterface({ input: fs.createReadStream(txtPath, 'utf-8'), crlfDelay: Infinity });
  for await (const line of rl) {
    if (!line) continue;
    const i = line.indexOf(',');
    if (i <= 0) continue;
    const id = line.slice(0, i);
    const scr = line.slice(i + 1).trim();
    const d = cubeshapeSlashes(table, scr);
    if (d < 0) continue;
    let a = buckets.get(d); if (!a) { a = []; buckets.set(d, a); } a.push(id);
  }
  return buckets;
}

// 每 bin 确定性均匀步长取 K 条(可复现,不依赖 Math.random)。
// n≤K 全取;否则按 floor(i*(n-1)/(K-1)) 均匀采样,首尾两端都覆盖,中间均布。
function pickUniform(ids: string[], k: number): string[] {
  const n = ids.length;
  if (n <= k) return ids.slice();
  const out: string[] = [];
  for (let i = 0; i < k; i++) {
    out.push(ids[Math.floor((i * (n - 1)) / (k - 1))]);
  }
  return out;
}

// competitions.tsv: id\tname\tstart_date\tend_date → compId → [name, 日期串](照 build.ts loadCompNames)
async function loadCompNames(tsvPath: string): Promise<Map<string, [string, string]>> {
  const map = new Map<string, [string, string]>();
  if (!fs.existsSync(tsvPath)) return map;
  const rl = readline.createInterface({ input: fs.createReadStream(tsvPath, 'utf-8'), crlfDelay: Infinity });
  let first = true;
  for await (const line of rl) {
    if (!line) continue;
    if (first) { first = false; continue; }
    const [id, name, start, end] = line.split('\t');
    map.set(id, [name, dateDisplay(start, end)]);
  }
  return map;
}

// comp_countries.json: compId → WCA 国家名(如 "United States";与前端 loadFlagData 同一份源)。
async function loadCompCountries(jsonPath: string): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  if (!fs.existsSync(jsonPath)) return map;
  const raw = JSON.parse(fs.readFileSync(jsonPath, 'utf-8')) as Record<string, string>;
  for (const [ci, country] of Object.entries(raw)) if (country) map.set(ci, country);
  return map;
}

// 某口径的全量分桶(step → 全部 id)按「比赛所属国家」聚合成 step → { country: n },每步只留 top TOP_COUNTRIES。
// id → compId 走 idToComp(Scrambles.tsv 扫出),compId → 国家名走 compCountries(comp_countries.json)。
function aggregateCountry(
  fullBuckets: Map<number, string[]>,
  idToComp: Map<string, string>,
  compCountries: Map<string, string>,
): Record<string, Record<string, number>> {
  const out: Record<string, Record<string, number>> = {};
  for (const [step, ids] of fullBuckets) {
    const acc = new Map<string, number>();
    for (const id of ids) {
      const ci = idToComp.get(id);
      if (!ci) continue;
      const country = compCountries.get(ci);
      if (!country) continue;
      acc.set(country, (acc.get(country) ?? 0) + 1);
    }
    if (acc.size === 0) continue;
    const top = [...acc.entries()].sort((a, b) => b[1] - a[1]).slice(0, TOP_COUNTRIES);
    out[String(step)] = Object.fromEntries(top);
  }
  return out;
}

// 流式扫 Scrambles.tsv(列序 scramble id competition_id event_id group_id is_extra round_type_id scramble_num,
// 按表头名取列)一趟同时:① 给被采样 id(wantedIds)补 [ci, event, num, round, group, extra] + comps 名;
// ② 给全量 id(allIds,含 wantedIds)记 id → compId,供 countryDist 按国聚合。照 build.ts buildExampleCompMeta 口径。
async function buildCompMeta(
  wantedIds: Set<string>,
  allIds: Set<string>,
  scramblesTsv: string,
  compTsv: string,
): Promise<{
  comps: Record<string, [string, string]>;
  idMeta: Record<string, [string, string, number, string, string, (0 | 1)]>;
  idToComp: Map<string, string>;
}> {
  const comps: Record<string, [string, string]> = {};
  const idMeta: Record<string, [string, string, number, string, string, (0 | 1)]> = {};
  const idToComp = new Map<string, string>();
  if (allIds.size === 0) return { comps, idMeta, idToComp };
  const compNames = await loadCompNames(compTsv);
  const rl = readline.createInterface({ input: fs.createReadStream(scramblesTsv, 'utf-8'), crlfDelay: Infinity });
  let idIdx = -1, ciIdx = -1, evIdx = -1, grpIdx = -1, exIdx = -1, rndIdx = -1, numIdx = -1;
  for await (const line of rl) {
    if (!line) continue;
    if (idIdx === -1) {
      const h = line.split('\t');
      idIdx = h.indexOf('id');
      ciIdx = h.indexOf('competition_id');
      evIdx = h.indexOf('event_id');
      grpIdx = h.indexOf('group_id');
      exIdx = h.indexOf('is_extra');
      rndIdx = h.indexOf('round_type_id');
      numIdx = h.indexOf('scramble_num');
      if ([idIdx, ciIdx, evIdx, grpIdx, exIdx, rndIdx, numIdx].some((i) => i === -1)) {
        throw new Error(`Scrambles.tsv missing key column; header=${line}`);
      }
      continue;
    }
    // 快速首列预筛:id 不一定在第 0 列,直接 split(列数固定,行数百万级可接受)。
    const c = line.split('\t');
    const id = c[idIdx];
    if (!allIds.has(id)) continue;
    const ci = c[ciIdx];
    idToComp.set(id, ci);
    if (wantedIds.has(id)) {
      idMeta[id] = [ci, c[evIdx], Number(c[numIdx]), c[rndIdx], c[grpIdx], c[exIdx] === '1' ? 1 : 0];
      if (!(ci in comps)) comps[ci] = compNames.get(ci) ?? [ci, ''];
    }
  }
  return { comps, idMeta, idToComp };
}

async function main() {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const pkgRoot = path.resolve(here, '..');
  const repoRoot = path.resolve(pkgRoot, '..', '..', '..');

  const configPath = path.join(pkgRoot, 'config.yml');
  let dataRoot = 'D:/cube/scramble/puzzle';
  if (fs.existsSync(configPath)) {
    const config = YAML.parse(fs.readFileSync(configPath, 'utf-8')) as { puzzle_data_dir?: string };
    if (config?.puzzle_data_dir) dataRoot = config.puzzle_data_dir;
  }

  // 比赛元数据源(与 update_puzzle_stats.ps1 / 3x3 管道一致):
  const scramblesTsv = 'D:/cube/scramble/wca_scramble/incremental/tsv/Scrambles.tsv';
  const compTsv = 'D:/cube/scramble/wca_scramble/competitions.tsv';
  // compId → 国家名(前端 loadFlagData 用的同一份;countryDist 按国聚合用)。仓库根 stats/comp_countries.json。
  const compCountries = await loadCompCountries(path.join(repoRoot, 'stats', 'comp_countries.json'));
  if (compCountries.size === 0) console.warn('  [countryDist] comp_countries.json 缺失/空 → 跳过国家聚合');

  // 只对 puzzle_distribution.json 里出现的 key 产(避免 sq1 占位污染)。
  const distPath = path.join(repoRoot, 'stats', 'scramble', 'puzzle_distribution.json');
  let liveKeys: string[] | null = null;
  if (fs.existsSync(distPath)) {
    const dist = JSON.parse(fs.readFileSync(distPath, 'utf-8')) as { meta?: { puzzles?: string[] } };
    liveKeys = dist.meta?.puzzles ?? null;
  }

  const generatedAt = process.env.SCRAMBLE_STATS_STAMP || new Date().toISOString();
  const puzzlesOut: Record<string, unknown> = {};

  for (const spec of PUZZLES) {
    if (liveKeys && !liveKeys.includes(spec.key)) {
      console.log(`  [skip] ${spec.key}: not in puzzle_distribution.json meta.puzzles`);
      continue;
    }
    // 「按步数」多口径(2×2 / 金字塔):每个口径按度量值分桶示例,写进 metrics.<key>.bins。
    // 稀有桶(≤FULL_BIN_CAP)存全量 —— 既供面板「点某步数看真题」,也供计时器稀有区间即时取真题。
    if (spec.metricsCsv) {
      const mcsvPath = path.join(dataRoot, spec.key, spec.metricsCsv.file);
      const mtxtPath = path.join(dataRoot, spec.key, 'scrambles.txt');
      if (!fs.existsSync(mcsvPath) || !fs.existsSync(mtxtPath)) {
        console.warn(`  [skip] ${spec.key}: missing metrics csv/txt (${mcsvPath})`);
        continue;
      }
      const perMetricFull = await bucketIdsByMetrics(mcsvPath, spec.metricsCsv.cols);
      // 覆盖率守卫(与 build_puzzle_dist 同款):<99.5% = build_puzzle_metrics 没跑完,硬失败防半截样本发布。
      {
        let corpus = 0;
        const rlc = readline.createInterface({ input: fs.createReadStream(mtxtPath, 'utf-8'), crlfDelay: Infinity });
        for await (const line of rlc) if (line && line.includes(',')) corpus++;
        let rows = 0;
        for (const ids of perMetricFull[spec.metricsCsv.cols[0]].values()) rows += ids.length;
        if (rows < corpus * 0.995) {
          throw new Error(`[${spec.key}] metrics CSV covers ${rows}/${corpus} corpus scrambles — run build_puzzle_metrics.mts first (update_puzzle_stats.ps1 step 2.9)`);
        }
      }
      const wantedIds = new Set<string>();
      const sampledPerMetric: Record<string, Map<number, string[]>> = {};
      for (const col of spec.metricsCsv.cols) {
        const sampled = new Map<number, string[]>();
        for (const [v, ids] of perMetricFull[col]) {
          const picked = pickUniform(ids, ids.length <= FULL_BIN_CAP ? ids.length : EXAMPLE_K);
          sampled.set(v, picked);
          for (const id of picked) wantedIds.add(id);
        }
        sampledPerMetric[col] = sampled;
      }
      // 原始打乱串(仅被采样 id)
      const scrambleOf = new Map<string, string>();
      {
        const rl = readline.createInterface({ input: fs.createReadStream(mtxtPath, 'utf-8'), crlfDelay: Infinity });
        for await (const line of rl) {
          if (!line) continue;
          const i = line.indexOf(',');
          if (i <= 0) continue;
          const id = line.slice(0, i);
          if (!wantedIds.has(id)) continue;
          scrambleOf.set(id, line.slice(i + 1).trim());
        }
      }
      // 最优等价打乱 = <key>.csv 的 soln 反演(状态属性,与口径无关)→ 保住示例卡「原始/最优」切换。
      const optOf = await loadOptScrambles(path.join(dataRoot, spec.key, `${spec.key}.csv`), wantedIds);
      // 全量 id(countryDist 按国聚合用)= 各口径全量桶并集(所有口径同一 id 集)。
      const allIds = new Set<string>();
      for (const col of spec.metricsCsv.cols) for (const ids of perMetricFull[col].values()) for (const id of ids) allIds.add(id);
      const { comps, idMeta, idToComp } = await buildCompMeta(wantedIds, allIds, scramblesTsv, compTsv);
      const metricsOut: Record<string, unknown> = {};
      const note: string[] = [];
      for (const col of spec.metricsCsv.cols) {
        const bins: Record<string, Sample[]> = {};
        for (const v of [...sampledPerMetric[col].keys()].sort((a, b) => a - b)) {
          const arr: Sample[] = [];
          for (const id of sampledPerMetric[col].get(v)!) {
            const scr = scrambleOf.get(id);
            if (scr === undefined) continue;
            const opt = optOf.get(id);
            arr.push(opt ? [id, scr, opt] : [id, scr]);
          }
          if (arr.length) bins[String(v)] = arr;
        }
        const entry: Record<string, unknown> = { bins };
        if (compCountries.size > 0) {
          const cd = aggregateCountry(perMetricFull[col], idToComp, compCountries);
          if (Object.keys(cd).length) entry.countryDist = cd;
        }
        metricsOut[col] = entry;
        let n = 0; for (const b of Object.values(bins)) n += b.length;
        note.push(`${col}=${Object.keys(bins).length}bin/${n}`);
      }
      puzzlesOut[spec.key] = { comps, idMeta, metrics: metricsOut };
      console.log(`  [${spec.key}] ${note.join(', ')}, ${Object.keys(comps).length} comps`);
      continue;
    }
    const csvPath = path.join(dataRoot, spec.key, `${spec.key}.csv`);
    const txtPath = path.join(dataRoot, spec.key, 'scrambles.txt');
    // sq1(exact)不读近最优 <key>.csv,只需 txt(原始打乱)+ exact CSV;其它 puzzle 仍需 <key>.csv。
    if ((!spec.exact && !fs.existsSync(csvPath)) || !fs.existsSync(txtPath)) {
      console.warn(`  [skip] ${spec.key}: missing csv/txt (${csvPath})`);
      continue;
    }

    // 1. 采样 helper(确定性均匀步长 K 条 + 收 wantedIds);near 与 exact 共用。
    //    稀有 bin(≤FULL_BIN_CAP)存全量,便于「按国筛选」时把该国该步数的打乱都列出来。
    //    同时把每个口径的全量分桶(采样前)收进 fullBuckets,供 countryDist 按国聚合。
    const wantedIds = new Set<string>();
    const fullBuckets: Record<string, Map<number, string[]>> = {};
    const sampleFrom = (buckets: Map<number, string[]>, binsKey?: string): Map<number, string[]> => {
      if (binsKey) fullBuckets[binsKey] = buckets;
      const sampled = new Map<number, string[]>();
      for (const [len, ids] of buckets) {
        const picked = pickUniform(ids, ids.length <= FULL_BIN_CAP ? ids.length : EXAMPLE_K);
        sampled.set(len, picked);
        for (const id of picked) wantedIds.add(id);
      }
      return sampled;
    };

    // near 档采样(主 + 可选 alt 口径);sq1 已精确化(spec.exact)→ 不产 near 示例。
    let sampledByBin: Map<number, string[]> | null = null;
    let sampledAlt: Map<number, string[]> | null = null;
    if (!spec.exact) {
      sampledByBin = sampleFrom(await bucketIdsByLen(csvPath, spec.valueCol ?? spec.key), 'bins');
      if (spec.altCol) sampledAlt = sampleFrom(await bucketIdsByLen(csvPath, spec.altCol), 'binsAlt');
    }

    // 精确档采样(sq1):wca_exact 分桶(bins,exactOpt=WCA 最优打乱)+ 真 slash 最优分桶
    // (binsAlt,exactSlashOpt=slash 最优打乱)。slash 最优档缺则回退 bucketExactSq1 的 slash(紧上界 + WCA 打乱)。
    let exactWca: Map<number, string[]> | null = null;
    let exactSlash: Map<number, string[]> | null = null;
    let exactCubeshape: Map<number, string[]> | null = null;
    let exactOpt = new Map<string, string>();
    let exactSlashOpt = new Map<string, string>();
    if (spec.exact) {
      const ex = await bucketExactSq1(path.join(dataRoot, spec.key));
      if (ex) {
        exactWca = sampleFrom(ex.wca, 'bins'); exactSlash = sampleFrom(ex.slash, 'binsAlt');
        exactOpt = ex.optOf; exactSlashOpt = ex.optOf; // 默认回退:slash 视图也用 WCA 最优打乱
      } else console.warn(`  [${spec.key}] 无精确档数据(sq1_wca_exact.csv + 完成块都缺)`);
      const sl = await bucketSlashSq1(path.join(dataRoot, spec.key));
      if (sl) { exactSlash = sampleFrom(sl.slash, 'binsAlt'); exactSlashOpt = sl.optOf; } // 真 slash 最优覆盖(同覆盖 fullBuckets.binsAlt)
      // 复形:从原始语料即时分桶(slash 数 0..7),示例只显原始打乱(无整解 → 无最优等价打乱)。
      if (fs.existsSync(txtPath)) exactCubeshape = sampleFrom(await bucketCubeshapeSq1(txtPath), 'binsCubeshape');
    }

    // 2. 流式读 scrambles.txt 仅取被采样 id 的原始打乱(标准 (x,y) 记号)。
    const scrambleOf = new Map<string, string>();
    {
      const rl = readline.createInterface({ input: fs.createReadStream(txtPath, 'utf-8'), crlfDelay: Infinity });
      for await (const line of rl) {
        if (!line) continue;
        const i = line.indexOf(',');
        if (i <= 0) continue;
        const id = line.slice(0, i);
        if (!wantedIds.has(id)) continue;
        scrambleOf.set(id, line.slice(i + 1).trim());
      }
    }

    // 2b. near 档最优等价打乱(invert soln);精确档用 bucketExactSq1 已转标准记号的 exactOpt。
    const nearOpt = spec.exact ? new Map<string, string>() : await loadOptScrambles(csvPath, wantedIds);

    // 3. 组装 bins(丢弃 txt 里缺失打乱的 id,正常不应发生)。原始 + 最优都标准记号,前端统一 compact 成简写。
    const assemble = (sampled: Map<number, string[]>, optMap: Map<string, string>): Record<string, Sample[]> => {
      const bins: Record<string, Sample[]> = {};
      for (const len of [...sampled.keys()].sort((a, b) => a - b)) {
        const arr: Sample[] = [];
        for (const id of sampled.get(len)!) {
          const scr = scrambleOf.get(id);
          if (scr === undefined) continue;
          const opt = optMap.get(id);
          arr.push(opt ? [id, scr, opt] : [id, scr]);
        }
        if (arr.length > 0) bins[String(len)] = arr;
      }
      return bins;
    };

    // 4. 比赛元数据 join(near + exact 采样 id 并集)+ 全量 id → compId(countryDist 用)。
    //    allIds = 各口径全量分桶里出现过的所有 id(sq1 三口径同一 id 集,union 天然去重)。
    const allIds = new Set<string>();
    for (const buckets of Object.values(fullBuckets)) {
      for (const ids of buckets.values()) for (const id of ids) allIds.add(id);
    }
    const { comps, idMeta, idToComp } = await buildCompMeta(wantedIds, allIds, scramblesTsv, compTsv);

    // 5. countryDist:各口径全量分桶 → 每步 top 国家计数(comp_countries 缺则整体省略)。
    let countryDist: Record<string, Record<string, Record<string, number>>> | undefined;
    if (compCountries.size > 0) {
      countryDist = {};
      for (const [binsKey, buckets] of Object.entries(fullBuckets)) {
        const agg = aggregateCountry(buckets, idToComp, compCountries);
        if (Object.keys(agg).length > 0) countryDist[binsKey] = agg;
      }
      if (Object.keys(countryDist).length === 0) countryDist = undefined;
    }

    const out: Record<string, unknown> = { comps, idMeta };
    if (countryDist) out.countryDist = countryDist;
    const note: string[] = [];
    const setBins = (k: string, sampled: Map<number, string[]> | null, optMap: Map<string, string>) => {
      if (!sampled) return;
      const b = assemble(sampled, optMap);
      out[k] = b;
      let n = 0; for (const v of Object.values(b)) n += v.length;
      note.push(`${k}=${Object.keys(b).length}bin/${n}`);
    };
    if (spec.exact) {
      // sq1:精确档作为唯一档,写进 bins/binsAlt(对齐其它 puzzle 的 key;近最优已退役)。
      // bins = WCA 12c4 最优(打乱 = WCA 最优解逆);binsAlt = 真 slash 最优(打乱 = slash 最优解逆)。
      setBins('bins', exactWca, exactOpt);
      setBins('binsAlt', exactSlash, exactSlashOpt);
      setBins('binsCubeshape', exactCubeshape, new Map()); // 复形:只原始打乱

    } else {
      setBins('bins', sampledByBin, nearOpt);
      setBins('binsAlt', sampledAlt, nearOpt);
    }
    puzzlesOut[spec.key] = out;
    console.log(`  [${spec.key}] ${note.join(', ') || '空'}, ${Object.keys(comps).length} comps`);
  }

  const outDir = path.join(repoRoot, 'stats', 'scramble');
  fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, 'puzzle_examples.json');
  fs.writeFileSync(outPath, JSON.stringify({
    meta: { generated_at: generatedAt },
    puzzles: puzzlesOut,
  }));
  console.log(`Wrote ${outPath} (${(fs.statSync(outPath).size / 1024).toFixed(1)} KB)`);
}

main().catch((err) => { console.error(err); process.exit(1); });
