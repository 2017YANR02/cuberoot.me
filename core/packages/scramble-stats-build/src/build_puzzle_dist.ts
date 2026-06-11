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
// client-next/lib/puzzle-distribution.ts(改 shape 必须两处同步 + bump fetch v= 参数)。
//
// 输入:update_puzzle_stats.ps1 产出的 <puzzle_data_dir>/<key>/<key>.csv(两列 id,<key>,
// 值 = 该打乱整解最优步数)。缺 CSV 的 puzzle 跳过并打警告(对齐 build.ts 变体语义)。

interface PuzzleSpec {
  key: string;       // puzzle 名 = JSON key = analyzer CSV 值列名 = 数据子目录名
  event: string;     // WCA event_id(语料过滤口径,meta 用)
  label: string;
  label_zh: string;
  metric: string;    // 步数度量(2x2x2 = htm)
}

// 新 puzzle 注册处:加一行 + update_puzzle_stats.ps1 的 $PUZZLE 表加对应 analyzer 即可。
const PUZZLES: PuzzleSpec[] = [
  { key: 'pocket', event: '222', label: '2x2x2', label_zh: '二阶', metric: 'htm' },
  { key: 'pyraminx', event: 'pyram', label: 'Pyraminx', label_zh: '金字塔', metric: 'htm' }, // 总 HTM 含 tips
  { key: 'skewb', event: 'skewb', label: 'Skewb', label_zh: '斜转', metric: 'htm' },
];

interface Hist { min: number; max: number; counts: Map<number, number> }

function histToJson(h: Hist) {
  const countsObj: Record<string, number> = {};
  for (const k of [...h.counts.keys()].sort((a, b) => a - b)) countsObj[String(k)] = h.counts.get(k)!;
  return { min: h.counts.size ? h.min : 0, max: h.counts.size ? h.max : 0, counts: countsObj };
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
    const csvPath = path.join(dataRoot, spec.key, `${spec.key}.csv`);
    if (!fs.existsSync(csvPath)) {
      console.warn(`  [skip] ${spec.key}: missing CSV ${csvPath}`);
      continue;
    }
    const { sampleCount, hist } = await aggregate(csvPath, spec.key);
    console.log(`  [${spec.key}] ${sampleCount} rows, dist ${hist.min}..${hist.max}`);
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
