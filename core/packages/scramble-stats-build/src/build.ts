import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';
import { fileURLToPath } from 'node:url';
import YAML from 'yaml';

interface VariantSpec {
  key: string;
  file: string;
  id_col: string;
  stages: string[];
  // NOTE: angle → canonical color letter (Y/R/W/O/B/G)
  // std/eo/pseudo 用 z0..x3，pair 用 rotation 记号；两种 key 统一映射到颜色字母后脱离 angle 概念
  angleToColor: Record<string, ColorLetter>;
  colFor: (stage: string, angle: string) => string;
}

// NOTE: 颜色字母顺序（字母序）；subset key = sorted letters
const COLOR_LETTERS = ['B', 'G', 'O', 'R', 'W', 'Y'] as const;
type ColorLetter = typeof COLOR_LETTERS[number];

const ANGLE_COLOR_STD: Record<string, ColorLetter> = {
  z0: 'Y', z1: 'R', z2: 'W', z3: 'O', x1: 'B', x3: 'G',
};
const ANGLE_COLOR_PAIR: Record<string, ColorLetter> = {
  '': 'Y', z: 'R', z2: 'W', "z'": 'O', x: 'B', "x'": 'G',
};

const VARIANTS: VariantSpec[] = [
  {
    key: 'std',
    file: 'std.csv',
    id_col: 'id',
    stages: ['cross', 'xcross', 'xxcross', 'xxxcross', 'f2l'],
    angleToColor: ANGLE_COLOR_STD,
    colFor: (stage, angle) => `${stage}_${angle}`,
  },
  {
    key: 'eo',
    file: 'eo.csv',
    id_col: 'id',
    stages: ['eo_cross', 'eo_xcross', 'eo_xxcross', 'eo_xxxcross', 'eo_xxxxcross'],
    angleToColor: ANGLE_COLOR_STD,
    colFor: (stage, angle) => `${stage}_${angle}`,
  },
  {
    key: 'pair',
    file: 'pair.csv',
    id_col: 'scramble',
    stages: ['cross_pair', 'xcross_pair', 'xxcross_pair', 'xxxcross_pair'],
    angleToColor: ANGLE_COLOR_PAIR,
    colFor: (stage, angle) => `${stage}_${angle}`,
  },
  {
    key: 'pseudo',
    file: 'pseudo.csv',
    id_col: 'id',
    stages: ['pseudo_cross', 'pseudo_xcross', 'pseudo_xxcross', 'pseudo_xxxcross'],
    angleToColor: ANGLE_COLOR_STD,
    colFor: (stage, angle) => `${stage}_${angle}`,
  },
  {
    key: 'pseudo_pair',
    file: 'pseudo_pair.csv',
    id_col: 'id',
    stages: [
      'pseudo_cross_pseudo_pair',
      'pseudo_xcross_pseudo_pair',
      'pseudo_xxcross_pseudo_pair',
      'pseudo_xxxcross_pseudo_pair',
    ],
    angleToColor: ANGLE_COLOR_STD,
    colFor: (stage, angle) => `${stage}_${angle}`,
  },
];

interface Hist {
  min: number;
  max: number;
  counts: Map<number, number>;
}

function newHist(): Hist {
  return { min: Infinity, max: -Infinity, counts: new Map() };
}

function bump(h: Hist, v: number) {
  if (v < h.min) h.min = v;
  if (v > h.max) h.max = v;
  h.counts.set(v, (h.counts.get(v) ?? 0) + 1);
}

function histToJson(h: Hist) {
  if (h.counts.size === 0) return { min: 0, max: 0, counts: {} };
  const countsObj: Record<string, number> = {};
  const keys = Array.from(h.counts.keys()).sort((a, b) => a - b);
  for (const k of keys) countsObj[String(k)] = h.counts.get(k)!;
  return { min: h.min, max: h.max, counts: countsObj };
}

// NOTE: 极端 bin 的 scramble 示例
// 每条 = [id, scramble, bestColor]；id = 源 txt 文件的编号；bestColor = subset 里拿到 min 的颜色字母
// K_DOWNLOAD 用作 reservoir 上限（进下载 txt）；K_PREVIEW = 切到 examples.json 的预览条数
// seen > K_DOWNLOAD 时，reservoir 给出 K_DOWNLOAD 条均匀随机样本
const K_DOWNLOAD = 200;
const K_PREVIEW = 5;
type Sample = [string, string, string];
interface Reservoir { samples: Sample[]; seen: number }

function newRes(): Reservoir { return { samples: [], seen: 0 }; }

function reservoirAdd(r: Reservoir, s: Sample) {
  r.seen++;
  if (r.samples.length < K_DOWNLOAD) { r.samples.push(s); return; }
  const j = Math.floor(Math.random() * r.seen);
  if (j < K_DOWNLOAD) r.samples[j] = s;
}

async function loadScrambleMap(txtPath: string): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  const stream = fs.createReadStream(txtPath, { encoding: 'utf-8' });
  const rl = readline.createInterface({ input: stream, crlfDelay: Infinity });
  for await (const line of rl) {
    if (!line) continue;
    const i = line.indexOf(',');
    if (i === -1) continue;
    map.set(line.slice(0, i), line.slice(i + 1));
  }
  return map;
}

// NOTE: 实际 UI 用到的 subset —— single (6), dual (3 对相反色), quad (3 种排除相反色对), cn (1)
// 共 6+3+3+1 = 13 个。dual/quad 只枚举 3 条相反色轴（WY / BG / OR）
const OPPOSITE_PAIRS: [ColorLetter, ColorLetter][] = [
  ['W', 'Y'],
  ['B', 'G'],
  ['O', 'R'],
];
function sortedKey(letters: ColorLetter[]): string {
  return [...letters].sort().join('');
}
const SUBSET_KEYS: string[] = (() => {
  const all: ColorLetter[] = [...COLOR_LETTERS];
  const keys: string[] = [];
  for (const c of COLOR_LETTERS) keys.push(c);                    // size 1
  for (const p of OPPOSITE_PAIRS) keys.push(sortedKey(p));        // size 2
  for (const p of OPPOSITE_PAIRS) {
    const excl = new Set(p);
    keys.push(sortedKey(all.filter((c) => !excl.has(c))));         // size 4
  }
  keys.push(sortedKey(all));                                       // size 6
  return keys;
})();

async function aggregateVariant(spec: VariantSpec, csvPath: string, scrambleMap: Map<string, string>) {
  // NOTE: per stage → per subset key → Hist
  const byStage: Record<string, Record<string, Hist>> = {};
  // NOTE: per stage → per subset key → Map<binValue, Reservoir>
  const resByStage: Record<string, Record<string, Map<number, Reservoir>>> = {};
  for (const stage of spec.stages) {
    byStage[stage] = {};
    resByStage[stage] = {};
    for (const key of SUBSET_KEYS) {
      byStage[stage][key] = newHist();
      resByStage[stage][key] = new Map();
    }
  }

  // NOTE: 每个 subset key 预先映射成它包含的 6 角度列下标中的哪几个（bitmask）
  // 行内遍历时先读 6 角度值，再按 bitmask 取 min
  type StagePlan = {
    colorIdx: number[];  // [B,G,O,R,W,Y] 在 CSV 的列 idx，-1 表示缺失
    subsetMasks: { key: string; mask: number }[];
  };
  const plans = new Map<string, StagePlan>();

  const stream = fs.createReadStream(csvPath, { encoding: 'utf-8' });
  const rl = readline.createInterface({ input: stream, crlfDelay: Infinity });

  let header: string[] | null = null;
  let sampleCount = 0;

  for await (const line of rl) {
    if (!line) continue;
    if (!header) {
      header = line.split(',');
      const idxMap = new Map<string, number>();
      header.forEach((h, i) => idxMap.set(h, i));

      // 反向映射：每个 color letter → 该 variant 里对应的 angle 字符串
      const colorToAngle: Record<ColorLetter, string> = {} as Record<ColorLetter, string>;
      for (const [angle, color] of Object.entries(spec.angleToColor)) {
        colorToAngle[color] = angle;
      }

      for (const stage of spec.stages) {
        const colorIdx: number[] = new Array(6).fill(-1);
        for (let i = 0; i < 6; i++) {
          const color = COLOR_LETTERS[i];
          const angle = colorToAngle[color];
          if (angle === undefined) {
            throw new Error(`[${spec.key}] variant is missing color ${color}`);
          }
          const col = spec.colFor(stage, angle);
          const idx = idxMap.get(col);
          if (idx === undefined) {
            throw new Error(`[${spec.key}] missing column '${col}' in header`);
          }
          colorIdx[i] = idx;
        }
        const subsetMasks: { key: string; mask: number }[] = SUBSET_KEYS.map((key) => {
          let mask = 0;
          for (const ch of key) {
            const bit = COLOR_LETTERS.indexOf(ch as ColorLetter);
            mask |= 1 << bit;
          }
          return { key, mask };
        });
        plans.set(stage, { colorIdx, subsetMasks });
      }
      continue;
    }

    const parts = line.split(',');
    // NOTE: parts[0] 是 id（std/eo/pseudo/pseudo_pair 是整数；pair.csv 的 'scramble' 列其实也是整数 id）
    const id = parts[0];
    const scramble = scrambleMap.get(id);
    for (const stage of spec.stages) {
      const { colorIdx, subsetMasks } = plans.get(stage)!;
      const vals: number[] = new Array(6);
      let anyBad = false;
      for (let i = 0; i < 6; i++) {
        const v = Number(parts[colorIdx[i]]);
        if (!Number.isFinite(v)) { anyBad = true; break; }
        vals[i] = v;
      }
      if (anyBad) continue;
      for (const { key, mask } of subsetMasks) {
        let m = Infinity;
        let argi = -1;
        for (let i = 0; i < 6; i++) {
          if (mask & (1 << i)) {
            if (vals[i] < m) { m = vals[i]; argi = i; }
          }
        }
        bump(byStage[stage][key], m);
        if (scramble !== undefined && argi >= 0) {
          const bucketMap = resByStage[stage][key];
          let res = bucketMap.get(m);
          if (!res) { res = newRes(); bucketMap.set(m, res); }
          reservoirAdd(res, [id, scramble, COLOR_LETTERS[argi]]);
        }
      }
    }
    sampleCount++;
    if (sampleCount % 200_000 === 0) {
      process.stdout.write(`  [${spec.key}] ${sampleCount} rows\r`);
    }
  }
  process.stdout.write(`  [${spec.key}] ${sampleCount} rows\n`);

  // NOTE: previewExamples 覆盖 **所有 bin**（给 UI 预览）；
  // pickedReservoirs 只含 3 最少 + 1 最大这 4 个（写 per-bin txt 下载文件）；
  // data[stage][subset].example_bins 仍是这 4 个 picked bin（UI 用来决定哪些 bin 有 ⬇ 下载链接）
  const data: Record<string, Record<string, ReturnType<typeof histToJson> & { example_bins?: number[] }>> = {};
  const previewExamples: Record<string, Record<string, Record<string, Sample[]>>> = {};
  const pickedReservoirs: Record<string, Record<string, Record<string, { samples: Sample[]; seen: number }>>> = {};
  for (const stage of spec.stages) {
    data[stage] = {};
    previewExamples[stage] = {};
    pickedReservoirs[stage] = {};
    for (const key of SUBSET_KEYS) {
      data[stage][key] = histToJson(byStage[stage][key]);
      const bucketMap = resByStage[stage][key];
      const bins = [...bucketMap.keys()].sort((a, b) => a - b);
      if (bins.length === 0) continue;
      const picks = new Set<number>();
      for (let i = 0; i < Math.min(3, bins.length); i++) picks.add(bins[i]);
      picks.add(bins[bins.length - 1]);
      const pickedSorted = [...picks].sort((a, b) => a - b);
      data[stage][key].example_bins = pickedSorted;
      previewExamples[stage][key] = {};
      pickedReservoirs[stage][key] = {};
      // 所有 bin 都进 preview
      for (const b of bins) {
        const res = bucketMap.get(b)!;
        previewExamples[stage][key][String(b)] = res.samples.slice(0, K_PREVIEW);
      }
      // 只把 4 个 picked bin 存入 reservoirs，落 txt
      for (const b of pickedSorted) {
        const res = bucketMap.get(b)!;
        pickedReservoirs[stage][key][String(b)] = { samples: res.samples, seen: res.seen };
      }
    }
  }

  return {
    sampleCount,
    json: {
      sample_count: sampleCount,
      stages: spec.stages,
      data,
    },
    previewExamples,
    pickedReservoirs,
  };
}

// NOTE: 单个 bin 的 txt 下载文件；header 写明 variant/stage/subset/bin + 样本量；主体 CSV 风格 id,scramble,bottom_color
function buildBinTxt(
  variantKey: string,
  stage: string,
  subsetKey: string,
  bin: number,
  binRankLabel: string,  // 'min' / '2nd-smallest' / '3rd-smallest' / 'max'
  res: { samples: Sample[]; seen: number },
  generatedAt: string,
): string {
  const lines: string[] = [];
  lines.push(`# Scramble Extremes — ${variantKey} / ${stage} / ${subsetKey} / bin ${bin} (${binRankLabel})`);
  lines.push(`# Population in this bin: ${res.seen}`);
  if (res.seen > res.samples.length) {
    lines.push(`# Samples listed: ${res.samples.length} (uniform reservoir sample; cap = ${K_DOWNLOAD})`);
  } else {
    lines.push(`# Samples listed: ${res.samples.length} (all entries in this bin)`);
  }
  lines.push('# Source: wca_scrambles_no_wide_move.txt');
  lines.push(`# Generated: ${generatedAt}`);
  lines.push('# Columns: id,scramble,bottom_color');
  lines.push('');
  for (const [id, scr, color] of res.samples) {
    lines.push(`${id},${scr},${color}`);
  }
  return lines.join('\n') + '\n';
}

function binRankLabel(bins: number[], idx: number): string {
  if (idx === bins.length - 1 && bins.length > 1) return 'max';
  if (idx === 0) return 'min';
  if (idx === 1) return '2nd-smallest';
  if (idx === 2) return '3rd-smallest';
  return `#${idx}`;
}

async function main() {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const pkgRoot = path.resolve(here, '..');
  const repoRoot = path.resolve(pkgRoot, '..', '..', '..');

  const configPath = path.join(pkgRoot, 'config.yml');
  if (!fs.existsSync(configPath)) {
    console.error(`config.yml not found at ${configPath}. Copy config.yml.example and edit.`);
    process.exit(1);
  }
  const config = YAML.parse(fs.readFileSync(configPath, 'utf-8')) as { csv_dir: string; scrambles_txt?: string };
  const csvDir = config.csv_dir;
  // NOTE: 默认从 csv_dir 父目录找 wca_scrambles_no_wide_move.txt；也可在 config.yml 里显式覆盖
  const scramblesTxt = config.scrambles_txt ?? path.join(path.dirname(csvDir), 'wca_scrambles_no_wide_move.txt');
  if (!fs.existsSync(scramblesTxt)) {
    throw new Error(`Missing scrambles txt: ${scramblesTxt}`);
  }
  console.log(`Loading scramble map from ${scramblesTxt}`);
  const scrambleMap = await loadScrambleMap(scramblesTxt);
  console.log(`  loaded ${scrambleMap.size} scrambles`);

  const outDir = path.join(repoRoot, 'stats', 'data', 'scramble');
  fs.mkdirSync(outDir, { recursive: true });
  // NOTE: 先把旧 downloads/ 整个干掉，避免残留上次 build 的 subset/bin 组合
  const downloadsDir = path.join(outDir, 'downloads');
  if (fs.existsSync(downloadsDir)) fs.rmSync(downloadsDir, { recursive: true, force: true });
  fs.mkdirSync(downloadsDir, { recursive: true });

  const variantsOut: Record<string, unknown> = {};
  const examplesOut: Record<string, unknown> = {};
  const generatedAt = new Date().toISOString();
  let maxCount = 0;
  let txtFilesWritten = 0;
  let txtTotalBytes = 0;
  for (const spec of VARIANTS) {
    const csvPath = path.join(csvDir, spec.file);
    if (!fs.existsSync(csvPath)) {
      throw new Error(`Missing CSV: ${csvPath}`);
    }
    console.log(`Aggregating ${spec.key} from ${csvPath}`);
    const { sampleCount, json, previewExamples, pickedReservoirs } = await aggregateVariant(spec, csvPath, scrambleMap);
    variantsOut[spec.key] = json;
    examplesOut[spec.key] = previewExamples;
    if (sampleCount > maxCount) maxCount = sampleCount;

    // 写每 bin 一个 txt
    for (const stage of Object.keys(pickedReservoirs)) {
      for (const subsetKey of Object.keys(pickedReservoirs[stage])) {
        const binMap = pickedReservoirs[stage][subsetKey];
        const binsSorted = Object.keys(binMap).map(Number).sort((a, b) => a - b);
        binsSorted.forEach((bin, idx) => {
          const rank = binRankLabel(binsSorted, idx);
          const txt = buildBinTxt(spec.key, stage, subsetKey, bin, rank, binMap[String(bin)], generatedAt);
          const filePath = path.join(downloadsDir, spec.key, stage, `${subsetKey}_${bin}.txt`);
          fs.mkdirSync(path.dirname(filePath), { recursive: true });
          fs.writeFileSync(filePath, txt);
          txtFilesWritten++;
          txtTotalBytes += txt.length;
        });
      }
    }
  }

  const out = {
    meta: {
      sample_count: maxCount,
      source: 'wca_scrambles_no_wide_move',
      generated_at: generatedAt,
      subset_keys: SUBSET_KEYS,
    },
    variants: variantsOut,
  };
  const examplesFile = {
    meta: { generated_at: generatedAt },
    variants: examplesOut,
  };

  const outPath = path.join(outDir, 'distribution.json');
  fs.writeFileSync(outPath, JSON.stringify(out));
  const sizeKB = (fs.statSync(outPath).size / 1024).toFixed(1);
  console.log(`Wrote ${outPath} (${sizeKB} KB)`);

  const exPath = path.join(outDir, 'examples.json');
  fs.writeFileSync(exPath, JSON.stringify(examplesFile));
  const exSizeKB = (fs.statSync(exPath).size / 1024).toFixed(1);
  console.log(`Wrote ${exPath} (${exSizeKB} KB)`);

  console.log(`Wrote ${txtFilesWritten} per-bin txt files under ${downloadsDir} (${(txtTotalBytes / 1024).toFixed(1)} KB total)`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
