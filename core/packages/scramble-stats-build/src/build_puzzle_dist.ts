import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';
import { fileURLToPath } from 'node:url';
import YAML from 'yaml';

// 非 3x3 puzzle 整解最优步数分布(EPIC 3 新管线;2x2x2 pocket 先行,后续 puzzle 照搬)。
//
// 数据契约(stats/scramble/puzzle_distribution.json):
//   {
//     meta: { generated_at, puzzles: [key, ...] },
//     puzzles: {
//       <key>: { event, label, label_zh, metric, sample_count, dist: { min, max, counts } }
//     }
//   }
// dist 形状与 distribution.json 的 HistEntry 一致({min,max,counts}),
// 前端 DiscreteHistogram / computeStats 可直接复用;客户端类型在
// client/lib/puzzle-distribution.ts(改 shape 必须两处同步 + bump fetch v= 参数)。
//
// 输入:update_puzzle_stats.ps1 产出的 <puzzle_data_dir>/<key>/<key>.csv(两列 id,<key>,
// 值 = 该打乱整解最优步数)。缺 CSV 的 puzzle 跳过并打警告(对齐 build.ts 变体语义)。

// sq1 专用:整个主口径直接取「精确 WCA 12c4 最优」(Sq1WcaSolver,独立 exact CSV + 未 ingest 块)。
// 近最优(twophase 上界)2026-06-18 退役,不再产(见 solver/src/sq1_twophase.rs 模块头的上游/参数说明)。
interface PuzzleExactPrimary {
  csv: string;       // 精确档 CSV 文件名(sq1_wca_exact.csv)
  wcaCol: string;    // 主口径列名(wca_exact)
  altMetric: string; // 备选口径 key(slash = WCA-最优解里的 / 数,slash-最优紧上界 ≤13)
}

interface PuzzleSpec {
  key: string;       // puzzle 名 = JSON key = 数据子目录名
  event: string;     // WCA event_id(语料过滤口径,meta 用)
  label: string;
  label_zh: string;
  metric: string;    // 主口径 key(2x2x2 = htm;sq1 = wca)
  valueCol?: string; // 主口径在 CSV 里的列名(默认 = key)
  exactPrimary?: PuzzleExactPrimary; // sq1:主口径 = 精确 WCA 12c4 最优(取代退役的近最优)
}

// 新 puzzle 注册处:加一行 + update_puzzle_stats.ps1 的 $PUZZLE 表加对应 analyzer 即可。
const PUZZLES: PuzzleSpec[] = [
  { key: 'pocket', event: '222', label: '2x2x2', label_zh: '二阶', metric: 'htm' },
  { key: 'pyraminx', event: 'pyram', label: 'Pyraminx', label_zh: '金字塔', metric: 'htm' }, // 总 HTM 含 tips
  { key: 'skewb', event: 'skewb', label: 'Skewb', label_zh: '斜转', metric: 'htm' },
  // sq1 主口径 = 可证 WCA 12c4 最优(Sq1WcaSolver,sq1_wca_exact.csv + 未 ingest 块),备选 slash。
  // 近最优(twophase 上界)2026-06-18 退役:不再产 near 分布(代码仍在 solver/src/sq1_twophase.rs 作对照)。
  { key: 'sq1', event: 'sq1', label: 'Square-1', label_zh: 'SQ1', metric: 'wca', exactPrimary: { csv: 'sq1_wca_exact.csv', wcaCol: 'wca_exact', altMetric: 'slash' } },
];

interface Hist { min: number; max: number; counts: Map<number, number> }

function histToJson(h: Hist) {
  const countsObj: Record<string, number> = {};
  for (const k of [...h.counts.keys()].sort((a, b) => a - b)) countsObj[String(k)] = h.counts.get(k)!;
  return { min: h.counts.size ? h.min : 0, max: h.counts.size ? h.max : 0, counts: countsObj };
}

function bump(h: Hist, v: number) {
  if (v < h.min) h.min = v;
  if (v > h.max) h.max = v;
  h.counts.set(v, (h.counts.get(v) ?? 0) + 1);
}

// SQ1 精确档聚合:同时产 WCA 12c4(可证最优,wca_exact 列)+ slash(WCA-最优解里的 / 数,slash-最优紧上界)两口径。
//
// 关键:全量灌注(inject_sq1_wca_exact.ps1)把所有块喂给一个长跑 analyzer,主 CSV 只在进程启动/结束各 ingest 一次
// (8 天级长跑期间主 CSV 一直停在初始行数)。完成的块堆在 sq1/_exact_chunks/*_sq1.csv 里。故这里**额外读这些块**
// (只读不删,绝不碰运行中的 job),按 id 去重(主 CSV 优先),才能让网站反映真实进度而非停在初始值。
async function aggregateExactSq1(exCsvPath: string, wcaCol: string): Promise<{
  sampleCount: number; wcaHist: Hist; slashHist: Hist;
} | null> {
  const files: string[] = [];
  if (fs.existsSync(exCsvPath)) files.push(exCsvPath);
  const chunkDir = path.join(path.dirname(exCsvPath), '_exact_chunks');
  if (fs.existsSync(chunkDir)) {
    for (const n of fs.readdirSync(chunkDir).filter((x: string) => x.endsWith('_sq1.csv')).sort())
      files.push(path.join(chunkDir, n));
  }
  if (files.length === 0) return null;
  const seen = new Set<string>();
  const wcaHist: Hist = { min: Infinity, max: -Infinity, counts: new Map() };
  const slashHist: Hist = { min: Infinity, max: -Infinity, counts: new Map() };
  let sampleCount = 0;
  for (const file of files) {
    const rl = readline.createInterface({ input: fs.createReadStream(file, 'utf-8'), crlfDelay: Infinity });
    let wcaIdx = -1; let optIdx = -1;
    for await (const line of rl) {
      if (!line) continue;
      if (wcaIdx === -1) {
        const h = line.split(',');
        wcaIdx = h.indexOf(wcaCol);
        optIdx = h.indexOf('opt_scramble');
        if (wcaIdx === -1) throw new Error(`missing column '${wcaCol}' in ${file}`);
        continue;
      }
      const cols = line.split(',');         // opt_scramble 用 ':' 不含逗号,故 split(',') 恰 3 列
      const id = cols[0];
      if (!id || seen.has(id)) continue;
      const wca = Number(cols[wcaIdx]);
      if (!Number.isFinite(wca)) continue;  // 防御坏行(WCA 真打乱永远合法,无 '-')
      seen.add(id);
      sampleCount++;
      bump(wcaHist, wca);
      if (optIdx >= 0) {
        const opt = cols[optIdx] ?? '';
        let slash = 0;
        for (let k = 0; k < opt.length; k++) if (opt.charCodeAt(k) === 47 /* '/' */) slash++;
        bump(slashHist, slash);
      }
    }
  }
  return { sampleCount, wcaHist, slashHist };
}

async function aggregate(csvPath: string, valueCol: string): Promise<{ sampleCount: number; hist: Hist }> {
  const hist: Hist = { min: Infinity, max: -Infinity, counts: new Map() };
  const rl = readline.createInterface({
    input: fs.createReadStream(csvPath, 'utf-8'), crlfDelay: Infinity,
  });
  let valIdx = -1;
  let sampleCount = 0;
  for await (const line of rl) {
    if (!line) continue;
    if (valIdx === -1) {
      const header = line.split(',');
      valIdx = header.indexOf(valueCol);
      if (valIdx === -1) throw new Error(`missing column '${valueCol}' in ${csvPath} header: ${line}`);
      continue;
    }
    const v = Number(line.split(',')[valIdx]);
    if (!Number.isFinite(v)) continue; // 防御:坏行跳过(puzzle 任意态可解,正常无 '-')
    if (v < hist.min) hist.min = v;
    if (v > hist.max) hist.max = v;
    hist.counts.set(v, (hist.counts.get(v) ?? 0) + 1);
    sampleCount++;
  }
  return { sampleCount, hist };
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

  const generatedAt = process.env.SCRAMBLE_STATS_STAMP || new Date().toISOString();
  const puzzlesOut: Record<string, unknown> = {};
  const keys: string[] = [];
  for (const spec of PUZZLES) {
    // sq1:主口径直接取精确 WCA 12c4 最优(exact CSV + 未 ingest 块),无近最优。
    if (spec.exactPrimary) {
      const exCsv = path.join(dataRoot, spec.key, spec.exactPrimary.csv);
      const ex = await aggregateExactSq1(exCsv, spec.exactPrimary.wcaCol);
      if (!ex) { console.warn(`  [skip] ${spec.key}: missing exact CSV ${exCsv} + 无完成块`); continue; }
      console.log(`  [${spec.key}] exact ${ex.sampleCount} rows; wca ${ex.wcaHist.min}..${ex.wcaHist.max}, slash ${ex.slashHist.min}..${ex.slashHist.max} (含未 ingest 块)`);
      const entry: Record<string, unknown> = {
        event: spec.event, label: spec.label, label_zh: spec.label_zh,
        metric: spec.metric, sample_count: ex.sampleCount, dist: histToJson(ex.wcaHist),
      };
      // slash 口径 = WCA-最优解里的 / 数(slash-最优紧上界,≤13);仅当有 opt_scramble 列时产出。
      if (ex.slashHist.counts.size > 0) {
        entry.alt = { metric: spec.exactPrimary.altMetric, dist: histToJson(ex.slashHist) };
      }
      puzzlesOut[spec.key] = entry;
      keys.push(spec.key);
      continue;
    }
    const csvPath = path.join(dataRoot, spec.key, `${spec.key}.csv`);
    if (!fs.existsSync(csvPath)) {
      console.warn(`  [skip] ${spec.key}: missing CSV ${csvPath}`);
      continue;
    }
    const { sampleCount, hist } = await aggregate(csvPath, spec.valueCol ?? spec.key);
    console.log(`  [${spec.key}] ${sampleCount} rows, dist ${hist.min}..${hist.max} (${spec.metric})`);
    puzzlesOut[spec.key] = {
      event: spec.event,
      label: spec.label,
      label_zh: spec.label_zh,
      metric: spec.metric,
      sample_count: sampleCount,
      dist: histToJson(hist),
    };
    keys.push(spec.key);
  }

  const outDir = path.join(repoRoot, 'stats', 'scramble');
  fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, 'puzzle_distribution.json');
  fs.writeFileSync(outPath, JSON.stringify({
    meta: { generated_at: generatedAt, puzzles: keys },
    puzzles: puzzlesOut,
  }));
  console.log(`Wrote ${outPath} (${(fs.statSync(outPath).size / 1024).toFixed(1)} KB)`);
}

main().catch((err) => { console.error(err); process.exit(1); });
