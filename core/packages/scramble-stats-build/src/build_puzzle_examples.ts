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
// 客户端类型在 client/lib/puzzle-examples.ts(改 shape 必须两处同步 + bump fetch v=)。
//
// 只对 puzzle_distribution.json meta.puzzles 出现的 key 产(pocket / pyraminx / skewb;
// sq1 是小样本占位,dist 文件里若没有就跳过)。

const EXAMPLE_K = 20;

interface PuzzleSpec {
  key: string;       // = JSON key = 数据子目录名
  event: string;     // WCA event_id(比赛元数据按此过滤,UI 预览 event 也用它)
  valueCol?: string; // 主口径 CSV 列名(默认 = key;sq1 = 'wca')
  altCol?: string;   // 备选口径列名(sq1 = 'slash';→ 产 binsAlt)
  // sq1 已切「可证 WCA 12c4 最优」(Sq1WcaSolver)。精确化后**只产精确档示例**(exactBins/exactBinsAlt,
  // 源 = sq1_wca_exact.csv + 未 ingest 完成块,按 wca_exact / opt 的 slash 数分桶),不再产 near 档示例。
  exact?: boolean;
}

// 与 build_puzzle_dist.ts 的 PUZZLES 对齐(顺序无关,sq1 视 dist 是否存在决定产不产)。
const PUZZLES: PuzzleSpec[] = [
  { key: 'pocket', event: '222' },
  { key: 'pyraminx', event: 'pyram' },
  { key: 'skewb', event: 'skewb' },
  { key: 'sq1', event: 'sq1', exact: true }, // 精确档:exactBins=wca_exact、exactBinsAlt=slash(只显原始打乱)
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

    // 1. 采样 helper(确定性均匀步长 K 条 + 收 wantedIds);near 与 exact 共用。
    const wantedIds = new Set<string>();
    const sampleFrom = (buckets: Map<number, string[]>): Map<number, string[]> => {
      const sampled = new Map<number, string[]>();
      for (const [len, ids] of buckets) {
        const picked = pickUniform(ids, EXAMPLE_K);
        sampled.set(len, picked);
        for (const id of picked) wantedIds.add(id);
      }
      return sampled;
    };

    // near 档采样(主 + 可选 alt 口径);sq1 已精确化(spec.exact)→ 不产 near 示例。
    let sampledByBin: Map<number, string[]> | null = null;
    let sampledAlt: Map<number, string[]> | null = null;
    if (!spec.exact) {
      sampledByBin = sampleFrom(await bucketIdsByLen(csvPath, spec.valueCol ?? spec.key));
      if (spec.altCol) sampledAlt = sampleFrom(await bucketIdsByLen(csvPath, spec.altCol));
    }

    // 精确档采样(sq1):wca_exact + opt 的 slash 数双分桶,源含未 ingest 完成块;exactOpt = 最优等价打乱(标准记号)。
    let exactWca: Map<number, string[]> | null = null;
    let exactSlash: Map<number, string[]> | null = null;
    let exactOpt = new Map<string, string>();
    if (spec.exact) {
      const ex = await bucketExactSq1(path.join(dataRoot, spec.key));
      if (ex) { exactWca = sampleFrom(ex.wca); exactSlash = sampleFrom(ex.slash); exactOpt = ex.optOf; }
      else console.warn(`  [${spec.key}] 无精确档数据(sq1_wca_exact.csv + 完成块都缺)`);
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

    // 4. 比赛元数据 join(near + exact 采样 id 并集)。
    const { comps, idMeta } = await buildCompMeta(wantedIds, scramblesTsv, compTsv);

    const out: Record<string, unknown> = { comps, idMeta };
    const note: string[] = [];
    const setBins = (k: string, sampled: Map<number, string[]> | null, optMap: Map<string, string>) => {
      if (!sampled) return;
      const b = assemble(sampled, optMap);
      out[k] = b;
      let n = 0; for (const v of Object.values(b)) n += v.length;
      note.push(`${k}=${Object.keys(b).length}bin/${n}`);
    };
    setBins('bins', sampledByBin, nearOpt);
    setBins('binsAlt', sampledAlt, nearOpt);
    setBins('exactBins', exactWca, exactOpt);
    setBins('exactBinsAlt', exactSlash, exactOpt);
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
