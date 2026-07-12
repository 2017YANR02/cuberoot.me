import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';
import { fileURLToPath } from 'node:url';
import YAML from 'yaml';
import { buildCubeshapeTable, cubeshapeSlashes } from './sq1_cubeshape';

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
  csv: string;        // 主口径精确档 CSV(sq1_wca_exact.csv)
  wcaCol: string;     // 主口径列名(wca_exact)
  altMetric: string;  // 备选口径 key(slash)
  slashCsv?: string;  // slash 最优档 CSV(sq1_slash_exact.csv,列 slash_exact)= 真 slash 最优(twist God 13);
                      // 缺则回退数 WCA-最优解里的 / 数(slash 最优紧上界 ≤13)
}

// 「按步数」多口径(2×2 底面/底层/魔方/QTM、金字塔 V/魔方):值由 build_puzzle_metrics.mts(client 端复用
// 计时器求解器)预算进 <key>_metrics.csv,列名 = 度量 key。与 step-metrics.ts(前端 + 计时器)同一套 key。
interface PuzzleMetricsCsv {
  file: string;       // 度量 CSV 文件名(id,<key1>,<key2>,...)
  cols: string[];     // 度量 key 列(= step-metrics.ts 的 key)
  default: string;    // 主口径 key(entry.metric / dist 取它,前端默认选它)
}

interface PuzzleSpec {
  key: string;       // puzzle 名 = JSON key = 数据子目录名
  event: string;     // WCA event_id(语料过滤口径,meta 用)
  label: string;
  label_zh: string;
  metric: string;    // 主口径 key(2x2x2 = htm;sq1 = wca)
  valueCol?: string; // 主口径在 CSV 里的列名(默认 = key)
  metricsCsv?: PuzzleMetricsCsv; // 「按步数」多口径:整个 dist 从此 CSV 出(取代 <key>.csv 单口径)
  exactPrimary?: PuzzleExactPrimary; // sq1:主口径 = 精确 WCA 12c4 最优(取代退役的近最优)
}

// 新 puzzle 注册处:加一行 + update_puzzle_stats.ps1 的 $PUZZLE 表加对应 analyzer 即可。
const PUZZLES: PuzzleSpec[] = [
  // 2×2 / 金字塔:多口径「按步数」(值来自 build_puzzle_metrics.mts 的 <key>_metrics.csv)。
  { key: '222', event: '222', label: '2x2x2', label_zh: '二阶', metric: 'htm', metricsCsv: { file: '222_metrics.csv', cols: ['face', 'layer', 'htm', 'qtm'], default: 'htm' } },
  { key: 'pyraminx', event: 'pyram', label: 'Pyraminx', label_zh: '金字塔', metric: 'cube', metricsCsv: { file: 'pyraminx_metrics.csv', cols: ['v', 'cube'], default: 'cube' } },
  { key: 'skewb', event: 'skewb', label: 'Skewb', label_zh: '斜转', metric: 'htm' },
  // sq1 主口径 = 可证 WCA 12c4 最优(Sq1WcaSolver,sq1_wca_exact.csv + 未 ingest 块),备选 slash。
  // 近最优(twophase 上界)2026-06-18 退役:不再产 near 分布(代码仍在 solver/src/sq1_twophase.rs 作对照)。
  { key: 'sq1', event: 'sq1', label: 'Square-1', label_zh: 'SQ1', metric: 'wca', exactPrimary: { csv: 'sq1_wca_exact.csv', wcaCol: 'wca_exact', altMetric: 'slash', slashCsv: 'sq1_slash_exact.csv' } },
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
async function aggregateExactSq1(exCsvPath: string, wcaCol: string, slashCsvPath?: string): Promise<{
  sampleCount: number; wcaHist: Hist; wcaOptSlashHist: Hist; slashOptHist: Hist;
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
  // 格3(2×2):每条数 WCA 最优解 opt_scramble 里的 / 数 = WCA 最优解的 slash 含量分布(≥ 真 slash 最优)。
  const wcaOptSlashHist: Hist = { min: Infinity, max: -Infinity, counts: new Map() };
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
        bump(wcaOptSlashHist, slash);
      }
    }
  }
  // 格2(2×2):slash 最优解的 slash 数 —— 优先读**真 slash 最优**档(sq1_slash_exact.csv 的
  // slash_exact 列,twist God 13);缺则回退 = 格3 紧上界(WCA-最优解里的 / 数,≤13)。
  let slashOptHist: Hist = {
    min: wcaOptSlashHist.min, max: wcaOptSlashHist.max, counts: new Map(wcaOptSlashHist.counts),
  };
  if (slashCsvPath && fs.existsSync(slashCsvPath)) {
    const t: Hist = { min: Infinity, max: -Infinity, counts: new Map() };
    const rl = readline.createInterface({ input: fs.createReadStream(slashCsvPath, 'utf-8'), crlfDelay: Infinity });
    let idx = -1; let n = 0;
    for await (const line of rl) {
      if (!line) continue;
      if (idx === -1) {
        idx = line.split(',').indexOf('slash_exact');
        if (idx === -1) throw new Error(`missing slash_exact in ${slashCsvPath}`);
        continue;
      }
      const v = Number(line.split(',')[idx]);
      if (!Number.isFinite(v)) continue;
      bump(t, v); n++;
    }
    if (n > 0) slashOptHist = t;
  }
  return { sampleCount, wcaHist, wcaOptSlashHist, slashOptHist };
}

// SQ1「复形 / cubeshape」聚合:对原始打乱语料(scrambles.txt,id,scramble)逐条算到 cube shape
// 的最少 slash 数(0..7),按值直方图。每条都是确定性即时查表,不依赖昂贵的整解 solver,故 sample_count
// = 全部可解析打乱(通常 ≥ WCA/slash 口径,后者全量灌注期间可能滞后)。
async function aggregateCubeshape(txtPath: string): Promise<{ sampleCount: number; hist: Hist }> {
  const table = buildCubeshapeTable();
  const hist: Hist = { min: Infinity, max: -Infinity, counts: new Map() };
  let sampleCount = 0;
  const rl = readline.createInterface({ input: fs.createReadStream(txtPath, 'utf-8'), crlfDelay: Infinity });
  for await (const line of rl) {
    if (!line) continue;
    const i = line.indexOf(',');
    if (i <= 0) continue;
    const scr = line.slice(i + 1).trim();
    const d = cubeshapeSlashes(table, scr);
    if (d < 0) continue; // 理论不应发生(任意 SQ1 shape 都在 170 态表里)
    bump(hist, d);
    sampleCount++;
  }
  return { sampleCount, hist };
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

// 「按步数」多口径聚合:读 <key>_metrics.csv(id,<col1>,<col2>,...),每列建一个直方图。
// sample_count 全列一致(每条打乱对每个口径都贡献一次),故取行数。
async function aggregateMetrics(csvPath: string, cols: string[]): Promise<{ sampleCount: number; hists: Record<string, Hist> } | null> {
  if (!fs.existsSync(csvPath)) return null;
  const hists: Record<string, Hist> = {};
  for (const c of cols) hists[c] = { min: Infinity, max: -Infinity, counts: new Map() };
  const rl = readline.createInterface({ input: fs.createReadStream(csvPath, 'utf-8'), crlfDelay: Infinity });
  const idx: Record<string, number> = {};
  let sampleCount = 0;
  for await (const line of rl) {
    if (!line) continue;
    if (Object.keys(idx).length === 0) {
      const header = line.split(',');
      for (const c of cols) {
        const i = header.indexOf(c);
        if (i === -1) throw new Error(`missing column '${c}' in ${csvPath} header: ${line}`);
        idx[c] = i;
      }
      continue;
    }
    const parts = line.split(',');
    // 整行有效才计入:任一列缺/空/非数(如崩溃截断的尾行,Number('')===0 会造幻影 0 步桶)→ 整行跳过,
    // 防止半行给部分口径贡献计数(loadDoneIds 同款严格校验会让该 id 增量重算,坏行永久被忽略)。
    let ok = true;
    for (const c of cols) {
      const s = parts[idx[c]];
      if (!s || !Number.isFinite(Number(s))) { ok = false; break; }
    }
    if (!ok) continue;
    for (const c of cols) bump(hists[c], Number(parts[idx[c]]));
    sampleCount++;
  }
  return { sampleCount, hists };
}

// 覆盖率守卫:度量 CSV 行数必须≈语料行数(<99.5% 即视为没跑完 build_puzzle_metrics,如中断的回填),
// 硬失败防止静默发布半截样本的分布(子集 -Puzzles 调用 / 直跑本脚本时 step 2.9 可能没刷新它)。
async function assertMetricsCoverage(key: string, sampleCount: number, txtPath: string): Promise<void> {
  let corpus = 0;
  const rl = readline.createInterface({ input: fs.createReadStream(txtPath, 'utf-8'), crlfDelay: Infinity });
  for await (const line of rl) if (line && line.includes(',')) corpus++;
  if (sampleCount < corpus * 0.995) {
    throw new Error(`[${key}] metrics CSV covers ${sampleCount}/${corpus} corpus scrambles — run build_puzzle_metrics.mts first (update_puzzle_stats.ps1 step 2.9)`);
  }
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
      const slashCsv = spec.exactPrimary.slashCsv
        ? path.join(dataRoot, spec.key, spec.exactPrimary.slashCsv) : undefined;
      const ex = await aggregateExactSq1(exCsv, spec.exactPrimary.wcaCol, slashCsv);
      if (!ex) { console.warn(`  [skip] ${spec.key}: missing exact CSV ${exCsv} + 无完成块`); continue; }
      const slashSrc = slashCsv && fs.existsSync(slashCsv) ? 'slash 最优档' : 'opt 上界';
      console.log(`  [${spec.key}] exact ${ex.sampleCount} rows; wca ${ex.wcaHist.min}..${ex.wcaHist.max}, slashOpt ${ex.slashOptHist.min}..${ex.slashOptHist.max} (${slashSrc}), wcaOptSlash ${ex.wcaOptSlashHist.min}..${ex.wcaOptSlashHist.max}`);
      const entry: Record<string, unknown> = {
        event: spec.event, label: spec.label, label_zh: spec.label_zh,
        metric: spec.metric, sample_count: ex.sampleCount, dist: histToJson(ex.wcaHist),
      };
      // 2×2 交叉口径:dist=格1(WCA 最优解×WCA 步数,主) / alt.dist=格2(slash 最优解×slash 数,真最优) /
      //   wcaOptSlash=格3(WCA 最优解×slash 数,含量上界 ≥ 格2)。格4(slash 最优解×WCA 步数)≡ 格1
      //   (省算定理:slash 最优解总能取到 WCA 最优步数),前端直接复用 dist。
      if (ex.slashOptHist.counts.size > 0) {
        const alt: Record<string, unknown> = { metric: spec.exactPrimary.altMetric, dist: histToJson(ex.slashOptHist) };
        // slash 真最优进度:读 inject 写的 meta(provisional=仍有未判定怪物)。无 meta = 还没跑真最优 → 当上界。
        const metaPath = path.join(dataRoot, spec.key, 'sq1_slash_meta.json');
        if (fs.existsSync(metaPath)) {
          try {
            const m = JSON.parse(fs.readFileSync(metaPath, 'utf-8')) as { provisional?: boolean; ambiguous?: number; less?: number; eq?: number; fallback?: number };
            alt.provisional = !!m.provisional;
            if (typeof m.ambiguous === 'number') alt.ambiguous = m.ambiguous;
            if (typeof m.less === 'number') alt.improved = m.less;
            if (typeof m.eq === 'number') alt.resolved = m.eq;
            if (typeof m.fallback === 'number') alt.residual = m.fallback;
          } catch { alt.provisional = true; }
        } else {
          alt.provisional = true;
        }
        entry.alt = alt;
      }
      if (ex.wcaOptSlashHist.counts.size > 0) {
        entry.wcaOptSlash = histToJson(ex.wcaOptSlashHist);
      }
      // 复形(cubeshape):从原始打乱语料即时算「到 cube shape 最少 slash 数」(0..7),与 WCA/slash
      // 同一池但不依赖整解 solver(每条确定性查表)。前端「目标:完整魔方 / 复形」下拉切换。
      const txtPath = path.join(dataRoot, spec.key, 'scrambles.txt');
      if (fs.existsSync(txtPath)) {
        const cs = await aggregateCubeshape(txtPath);
        if (cs.hist.counts.size > 0) {
          entry.cubeshape = { metric: 'slash', sample_count: cs.sampleCount, dist: histToJson(cs.hist) };
          console.log(`  [${spec.key}] cubeshape ${cs.sampleCount} rows; ${cs.hist.min}..${cs.hist.max} slashes`);
        }
      }
      puzzlesOut[spec.key] = entry;
      keys.push(spec.key);
      continue;
    }
    // 「按步数」多口径(2×2 / 金字塔):整个 dist 从 <key>_metrics.csv 出,主口径 = spec.metricsCsv.default。
    if (spec.metricsCsv) {
      const mcsvPath = path.join(dataRoot, spec.key, spec.metricsCsv.file);
      const agg = await aggregateMetrics(mcsvPath, spec.metricsCsv.cols);
      if (!agg) { console.warn(`  [skip] ${spec.key}: missing metrics CSV ${mcsvPath}`); continue; }
      await assertMetricsCoverage(spec.key, agg.sampleCount, path.join(dataRoot, spec.key, 'scrambles.txt'));
      const def = spec.metricsCsv.default;
      const metrics: Record<string, unknown> = {};
      for (const c of spec.metricsCsv.cols) {
        metrics[c] = { sample_count: agg.sampleCount, dist: histToJson(agg.hists[c]) };
      }
      console.log(`  [${spec.key}] ${agg.sampleCount} rows; ${spec.metricsCsv.cols.map((c) => `${c} ${agg.hists[c].min}..${agg.hists[c].max}`).join(', ')}`);
      puzzlesOut[spec.key] = {
        event: spec.event, label: spec.label, label_zh: spec.label_zh,
        metric: def, sample_count: agg.sampleCount, dist: histToJson(agg.hists[def]),
        metrics, // 前端度量下拉 + 计时器「按步数」都读这个;key = step-metrics.ts 的 key
      };
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
