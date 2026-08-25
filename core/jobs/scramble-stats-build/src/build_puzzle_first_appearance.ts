// 非 3x3 puzzle 整解步数「首次出现」时间线数据生成(对等 build_first_appearance.ts 的 3x3 难度版)。
//
// 对每个 (puzzle, 步数 bin) 找出**最早**出现该步数的那条真实比赛打乱:
//   排序键 = (比赛开始日期 升序, 打乱 id 升序)。日期相同按 id(≈ 入库/打乱顺序)。
//   无日期的比赛(极少)排在最后。
//
// 数据三源(同 build_puzzle_examples.ts):
//   <key>.csv         id + 步数列(222/pyraminx/skewb = id,<key>,soln;sq1 = id,wca,slash)
//   Scrambles.tsv     id → competition_id / round / group / scramble_num / is_extra(按表头取列)
//   competitions.tsv  competition_id → 名称 + 日期
//
// 输出 stats/scramble/puzzle_first_appearance.json:
//   { meta, comps: { ci: [name, dateDisplay] },
//     puzzles: { <key>: { event, bins: { "<len>": [ci, round, group, num, text, extra?] }, binsAlt?: {...} } } }
//   条目形 [ci, round, group, num, text, extra?] 与长度首现 FaLenEx 同构,前端 FirstAppearanceTimeline 直接复用。
//   binsAlt 仅 sq1(slash 口径)有。
import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';
import { fileURLToPath } from 'node:url';
import YAML from 'yaml';
import { dateDisplay } from './comp_date';

interface PuzzleSpec {
  key: string;       // = JSON key = 数据子目录名
  event: string;     // WCA event_id(Scrambles.tsv 过滤 + 前端 2D 预览)
  valueCsv?: string; // 主口径 CSV 文件名(默认 = <key>.csv;金字塔 = 度量 CSV,时间线跟面板默认口径)
  valueCol?: string; // 主口径列名(默认 = key;sq1 = 'wca')
  altCol?: string;   // 备选口径列名(sq1 = 'slash' → 产 binsAlt)
}

// 与 build_puzzle_examples.ts / build_puzzle_dist.ts 的 PUZZLES 对齐。
const PUZZLES: PuzzleSpec[] = [
  // 222.csv 主列 = 整解最优 HTM,与面板「按步数」默认口径(htm)相同,无需换源。
  { key: '222', event: '222' },
  // 面板默认口径改为 cube(去 tips 整解,0..11)后,时间线同步换到度量 CSV 的 cube 列,
  // 否则旧含 tips 口径(6..14)的「12/13/14 步」条目在面板任一口径下都不存在,单位对不上。
  { key: 'pyraminx', event: 'pyram', valueCsv: 'pyraminx_metrics.csv', valueCol: 'cube' },
  { key: 'skewb', event: 'skewb' },
  { key: 'sq1', event: 'sq1', valueCol: 'wca', altCol: 'slash' },
];

// 条目 = [compId, round, group, num, text, isExtra?](= 前端 FaLenEx)
type Ex = [string, string, string, number, string, (0 | 1)?];

interface CompInfo { name: string; display: string; startInt: number }

// competitions.tsv: id\tname\tstart_date\tend_date → compId → { name, 日期展示串, 排序整数 }
async function loadCompInfo(tsvPath: string): Promise<Map<string, CompInfo>> {
  const map = new Map<string, CompInfo>();
  if (!fs.existsSync(tsvPath)) return map;
  const rl = readline.createInterface({ input: fs.createReadStream(tsvPath, 'utf-8'), crlfDelay: Infinity });
  let first = true;
  for await (const line of rl) {
    if (!line) continue;
    if (first) { first = false; continue; }
    const [id, name, start, end] = line.split('\t');
    const n = start && start !== 'NULL' ? Number(start.replaceAll('-', '')) : NaN;
    map.set(id, { name, display: dateDisplay(start, end), startInt: Number.isFinite(n) ? n : Infinity });
  }
  return map;
}

// <key>.csv 流式 → id→步数(指定列)。值是小整数,id 短字符串,百万级亦数十 MB。
async function loadIdToLen(csvPath: string, valueCol: string): Promise<Map<string, number>> {
  const map = new Map<string, number>();
  const rl = readline.createInterface({ input: fs.createReadStream(csvPath, 'utf-8'), crlfDelay: Infinity });
  let idIdx = -1, valIdx = -1;
  for await (const line of rl) {
    if (!line) continue;
    if (idIdx === -1) {
      const h = line.split(',');
      idIdx = h.indexOf('id');
      valIdx = h.indexOf(valueCol);
      if (idIdx === -1 || valIdx === -1) throw new Error(`missing id/'${valueCol}' column in ${csvPath} header: ${line}`);
      continue;
    }
    const c = line.split(',');
    const s = c[valIdx];
    if (!s) continue; // 空字段(截断行)防御:Number('')===0 会造幻影 0 步
    const v = Number(s);
    if (!Number.isFinite(v)) continue;
    map.set(c[idIdx], v);
  }
  return map;
}

interface Best { idNum: number; dateInt: number; meta: [string, string, string, number, (0 | 1)] } // [ci, round, group, num, extra]

// Scrambles.tsv 流式(列序按表头名取)→ 仅取本 puzzle event 且在 idToLen 里的 id,
// 对每口径(主 / alt)按 (date, idNum) 取每步数最早。返回 主 best + alt best。
async function scanFirstAppearance(
  scramblesTsv: string,
  event: string,
  idToLen: Map<string, number>,
  idToLenAlt: Map<string, number> | null,
  compInfo: Map<string, CompInfo>,
): Promise<{ best: Map<number, Best>; bestAlt: Map<number, Best> | null }> {
  const best = new Map<number, Best>();
  const bestAlt = idToLenAlt ? new Map<number, Best>() : null;
  const rl = readline.createInterface({ input: fs.createReadStream(scramblesTsv, 'utf-8'), crlfDelay: Infinity });
  let idIdx = -1, ciIdx = -1, evIdx = -1, grpIdx = -1, exIdx = -1, rndIdx = -1, numIdx = -1;
  const consider = (m: Map<number, Best>, len: number, idNum: number, dateInt: number, meta: Best['meta']) => {
    const cur = m.get(len);
    if (!cur || dateInt < cur.dateInt || (dateInt === cur.dateInt && idNum < cur.idNum)) {
      m.set(len, { idNum, dateInt, meta });
    }
  };
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
    const c = line.split('\t');
    if (c[evIdx] !== event) continue;
    const id = c[idIdx];
    const len = idToLen.get(id);
    const lenAlt = idToLenAlt?.get(id);
    if (len === undefined && lenAlt === undefined) continue;
    const ci = c[ciIdx];
    const dateInt = compInfo.get(ci)?.startInt ?? Infinity;
    const idNum = Number(id);
    const meta: Best['meta'] = [ci, c[rndIdx], c[grpIdx], Number(c[numIdx]), c[exIdx] === '1' ? 1 : 0];
    if (len !== undefined) consider(best, len, idNum, dateInt, meta);
    if (bestAlt && lenAlt !== undefined) consider(bestAlt, lenAlt, idNum, dateInt, meta);
  }
  return { best, bestAlt };
}

// 给定 winner id 集,流式 scrambles.txt 取打乱文字。
async function loadScrambleText(txtPath: string, wanted: Set<string>): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  if (wanted.size === 0) return map;
  const rl = readline.createInterface({ input: fs.createReadStream(txtPath, 'utf-8'), crlfDelay: Infinity });
  for await (const line of rl) {
    if (!line) continue;
    const i = line.indexOf(',');
    if (i <= 0) continue;
    const id = line.slice(0, i);
    if (!wanted.has(id)) continue;
    map.set(id, line.slice(i + 1).trim());
  }
  return map;
}

// best(len→Best,winner id 即 Best.idNum)→ bins(len→Ex)。winner id 由调用方先映回字符串。
function assembleBins(
  best: Map<number, Best>,
  idStrOf: Map<number, string>,
  textOf: Map<string, string>,
  comps: Record<string, [string, string]>,
  compInfo: Map<string, CompInfo>,
): Record<string, Ex> {
  const bins: Record<string, Ex> = {};
  for (const len of [...best.keys()].sort((a, b) => a - b)) {
    const b = best.get(len)!;
    const idStr = idStrOf.get(b.idNum);
    const text = idStr ? textOf.get(idStr) : undefined;
    if (text === undefined) continue; // txt 缺该打乱(正常不应发生)
    const [ci, round, group, num, extra] = b.meta;
    bins[String(len)] = extra ? [ci, round, group, num, text, extra] : [ci, round, group, num, text];
    if (!(ci in comps)) {
      const info = compInfo.get(ci);
      comps[ci] = info ? [info.name, info.display] : [ci, ''];
    }
  }
  return bins;
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

  const scramblesTsv = 'D:/cube/scramble/wca_scramble/incremental/tsv/Scrambles.tsv';
  const compTsv = 'D:/cube/scramble/wca_scramble/competitions.tsv';

  // 只对 puzzle_distribution.json 里 live 的 key 产(与 build_puzzle_examples 一致)。
  const distPath = path.join(repoRoot, 'stats', 'scramble', 'puzzle_distribution.json');
  let liveKeys: string[] | null = null;
  if (fs.existsSync(distPath)) {
    const dist = JSON.parse(fs.readFileSync(distPath, 'utf-8')) as { meta?: { puzzles?: string[] } };
    liveKeys = dist.meta?.puzzles ?? null;
  }

  console.log('Loading competitions...');
  const compInfo = await loadCompInfo(compTsv);
  const dated = [...compInfo.values()].filter((c) => Number.isFinite(c.startInt)).length;
  console.log(`  ${compInfo.size} comps (${dated} dated)`);

  const generatedAt = process.env.SCRAMBLE_STATS_STAMP || new Date().toISOString();
  const comps: Record<string, [string, string]> = {};
  const puzzlesOut: Record<string, unknown> = {};

  for (const spec of PUZZLES) {
    if (liveKeys && !liveKeys.includes(spec.key)) { console.log(`  [skip] ${spec.key}: not in puzzle_distribution.json`); continue; }
    const csvPath = path.join(dataRoot, spec.key, spec.valueCsv ?? `${spec.key}.csv`);
    const txtPath = path.join(dataRoot, spec.key, 'scrambles.txt');
    if (!fs.existsSync(csvPath) || !fs.existsSync(txtPath)) { console.warn(`  [skip] ${spec.key}: missing csv/txt (${csvPath})`); continue; }

    console.log(`[${spec.key}] loading id→len...`);
    const idToLen = await loadIdToLen(csvPath, spec.valueCol ?? spec.key);
    const idToLenAlt = spec.altCol ? await loadIdToLen(csvPath, spec.altCol) : null;
    console.log(`  ${idToLen.size} ids${idToLenAlt ? ` (+${idToLenAlt.size} alt)` : ''}`);
    // 度量 CSV 源的覆盖率守卫(与 build_puzzle_dist 同款):半截回填会把「首次出现」判给错误的比赛。
    if (spec.valueCsv) {
      let corpus = 0;
      const rlc = readline.createInterface({ input: fs.createReadStream(txtPath, 'utf-8'), crlfDelay: Infinity });
      for await (const line of rlc) if (line && line.includes(',')) corpus++;
      if (idToLen.size < corpus * 0.995) {
        throw new Error(`[${spec.key}] ${spec.valueCsv} covers ${idToLen.size}/${corpus} corpus scrambles — run build_puzzle_metrics.mts first (update_puzzle_stats.ps1 step 2.9)`);
      }
    }

    console.log(`[${spec.key}] scanning Scrambles.tsv (event=${spec.event})...`);
    const { best, bestAlt } = await scanFirstAppearance(scramblesTsv, spec.event, idToLen, idToLenAlt, compInfo);

    // winner id(主 + alt 并集)→ 取打乱文字。
    const idStrOf = new Map<number, string>();
    const wanted = new Set<string>();
    for (const b of best.values()) { wanted.add(String(b.idNum)); idStrOf.set(b.idNum, String(b.idNum)); }
    if (bestAlt) for (const b of bestAlt.values()) { wanted.add(String(b.idNum)); idStrOf.set(b.idNum, String(b.idNum)); }
    const textOf = await loadScrambleText(txtPath, wanted);

    const bins = assembleBins(best, idStrOf, textOf, comps, compInfo);
    const binsAlt = bestAlt ? assembleBins(bestAlt, idStrOf, textOf, comps, compInfo) : null;
    puzzlesOut[spec.key] = binsAlt
      ? { event: spec.event, bins, binsAlt }
      : { event: spec.event, bins };
    console.log(`  [${spec.key}] ${Object.keys(bins).length} bins${binsAlt ? ` + ${Object.keys(binsAlt).length} alt` : ''}`);
  }

  const outDir = path.join(repoRoot, 'stats', 'scramble');
  fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, 'puzzle_first_appearance.json');
  fs.writeFileSync(outPath, JSON.stringify({
    meta: { generated_at: generatedAt },
    comps,
    puzzles: puzzlesOut,
  }));
  console.log(`\nWrote ${outPath} (${(fs.statSync(outPath).size / 1024).toFixed(1)} KB)`);
}

main().catch((err) => { console.error(err); process.exit(1); });
