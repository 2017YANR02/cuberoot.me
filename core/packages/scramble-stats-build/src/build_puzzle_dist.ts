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
  csv: string;        // 主口径精确档 CSV(sq1_wca_exact.csv)
  wcaCol: string;     // 主口径列名(wca_exact)
  altMetric: string;  // 备选口径 key(slash)
  slashCsv?: string;  // slash 最优档 CSV(sq1_slash_exact.csv,列 slash_exact)= 真 slash 最优(twist God 13);
                      // 缺则回退数 WCA-最优解里的 / 数(slash 最优紧上界 ≤13)
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
            const m = JSON.parse(fs.readFileSync(metaPath, 'utf-8')) as { provisional?: boolean; ambiguous?: number; less?: number };
            alt.provisional = !!m.provisional;
            if (typeof m.ambiguous === 'number') alt.ambiguous = m.ambiguous;
            if (typeof m.less === 'number') alt.improved = m.less;
          } catch { alt.provisional = true; }
        } else {
          alt.provisional = true;
        }
        entry.alt = alt;
      }
      if (ex.wcaOptSlashHist.counts.size > 0) {
        entry.wcaOptSlash = histToJson(ex.wcaOptSlashHist);
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
