import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';
import { fileURLToPath } from 'node:url';
import YAML from 'yaml';
import { dateDisplay } from './comp_date';

// 非 3x3 puzzle 难度分布页的「点某步数 → 看该步数真实比赛打乱」示例(EPIC 3 配套)。
// 与 3x3 难度 tab 的 ExamplesPanel 对等,但 puzzle 无底色概念,故每 bin 只蓄 K 条 [id, scramble]。
//
// 数据契约(stats/scramble/puzzle_examples.json):
//   { meta: { generated_at },
//     puzzles: { <key>: {
//       bins:   { "<len>": [[id, scramble, optScramble?], ...] }, // 每步数 bin K=20 条(确定性均匀步长采样)
//       comps:  { "<ci>": [name, dateDisplay] },        // 被采样 id 引用到的比赛
//       idMeta: { "<id>": [ci, event, num, round, group, extra(0|1)] }
//     } } }
// optScramble = invert(analyzer 的最优解列 soln);= 最短的等价打乱(同状态),驱动「原始/最优」切换。
// 仅当 <key>.csv 带 soln 列(analyzer 开 PUZZLE_EMIT_SOLN)时有;无则该元省略,前端只显原始。
// 客户端类型在 client-next/lib/puzzle-examples.ts(改 shape 必须两处同步 + bump fetch v=)。
//
// 只对 puzzle_distribution.json meta.puzzles 出现的 key 产(pocket / pyraminx / skewb;
// sq1 是小样本占位,dist 文件里若没有就跳过)。

const EXAMPLE_K = 20;

interface PuzzleSpec {
  key: string;       // = JSON key = 数据子目录名
  event: string;     // WCA event_id(比赛元数据按此过滤,UI 预览 event 也用它)
  valueCol?: string; // 主口径 CSV 列名(默认 = key;sq1 = 'wca')
  altCol?: string;   // 备选口径列名(sq1 = 'slash';→ 产 binsAlt)
}

// 与 build_puzzle_dist.ts 的 PUZZLES 对齐(顺序无关,sq1 视 dist 是否存在决定产不产)。
const PUZZLES: PuzzleSpec[] = [
  { key: 'pocket', event: '222' },
  { key: 'pyraminx', event: 'pyram' },
  { key: 'skewb', event: 'skewb' },
  { key: 'sq1', event: 'sq1', valueCol: 'wca', altCol: 'slash' }, // 双口径:bins=wca、binsAlt=slash
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

// 流式扫 Scrambles.tsv(列序 scramble id competition_id event_id group_id is_extra round_type_id scramble_num,
// 按表头名取列)→ 给被采样 id 补 [ci, event, num, round, group, extra]。照 build.ts buildExampleCompMeta 口径。
async function buildCompMeta(
  ids: Set<string>,
  scramblesTsv: string,
  compTsv: string,
): Promise<{ comps: Record<string, [string, string]>; idMeta: Record<string, [string, string, number, string, string, (0 | 1)]> }> {
  const comps: Record<string, [string, string]> = {};
  const idMeta: Record<string, [string, string, number, string, string, (0 | 1)]> = {};
  if (ids.size === 0) return { comps, idMeta };
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
    if (!ids.has(id)) continue;
    const ci = c[ciIdx];
    idMeta[id] = [ci, c[evIdx], Number(c[numIdx]), c[rndIdx], c[grpIdx], c[exIdx] === '1' ? 1 : 0];
    if (!(ci in comps)) comps[ci] = compNames.get(ci) ?? [ci, ''];
  }
  return { comps, idMeta };
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
    const csvPath = path.join(dataRoot, spec.key, `${spec.key}.csv`);
    const txtPath = path.join(dataRoot, spec.key, 'scrambles.txt');
    if (!fs.existsSync(csvPath) || !fs.existsSync(txtPath)) {
      console.warn(`  [skip] ${spec.key}: missing csv/txt (${csvPath})`);
      continue;
    }

    // 1. 分桶 + 确定性采样(主口径 + 可选 alt 口径)。wantedIds = 两口径采样并集。
    const wantedIds = new Set<string>();
    const sampleBuckets = async (col: string): Promise<Map<number, string[]>> => {
      const buckets = await bucketIdsByLen(csvPath, col);
      const sampled = new Map<number, string[]>();
      for (const [len, ids] of buckets) {
        const picked = pickUniform(ids, EXAMPLE_K);
        sampled.set(len, picked);
        for (const id of picked) wantedIds.add(id);
      }
      return sampled;
    };
    const sampledByBin = await sampleBuckets(spec.valueCol ?? spec.key);
    const sampledAlt = spec.altCol ? await sampleBuckets(spec.altCol) : null;

    // 2. 流式读 scrambles.txt 仅取被采样 id 的打乱文字。
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

    // 2b. 读 soln 列 → 反演为最优等价打乱(仅采样 id;无解列的 puzzle 得空表)。
    const optOf = await loadOptScrambles(csvPath, wantedIds);

    // 3. 组装 bins(丢弃 txt 里缺失打乱的 id,正常不应发生)。
    const assemble = (sampled: Map<number, string[]>): { bins: Record<string, Sample[]>; binCount: number; sampleCount: number } => {
      const bins: Record<string, Sample[]> = {};
      let binCount = 0, sampleCount = 0;
      for (const len of [...sampled.keys()].sort((a, b) => a - b)) {
        const arr: Sample[] = [];
        for (const id of sampled.get(len)!) {
          const scr = scrambleOf.get(id);
          if (scr === undefined) continue;
          const opt = optOf.get(id);
          arr.push(opt ? [id, scr, opt] : [id, scr]);
        }
        if (arr.length === 0) continue;
        bins[String(len)] = arr;
        binCount++;
        sampleCount += arr.length;
      }
      return { bins, binCount, sampleCount };
    };
    const primary = assemble(sampledByBin);
    const altBuilt = sampledAlt ? assemble(sampledAlt) : null;

    // 4. 比赛元数据 join。
    const { comps, idMeta } = await buildCompMeta(wantedIds, scramblesTsv, compTsv);

    puzzlesOut[spec.key] = altBuilt
      ? { bins: primary.bins, binsAlt: altBuilt.bins, comps, idMeta }
      : { bins: primary.bins, comps, idMeta };
    const altNote = altBuilt ? ` + ${altBuilt.binCount} alt bins/${altBuilt.sampleCount}` : '';
    console.log(`  [${spec.key}] ${primary.binCount} bins, ${primary.sampleCount} samples${altNote}, ${Object.keys(comps).length} comps`);
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
