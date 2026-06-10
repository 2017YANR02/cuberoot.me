import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';
import { fileURLToPath } from 'node:url';
import YAML from 'yaml';
import { makeRng } from './prng';
import { dateDisplay } from './comp_date';

interface VariantSpec {
  key: string;
  file: string;
  id_col: string;
  stages: string[];
  // NOTE: angle → canonical color letter (Y/R/W/O/B/G)
  // 全部变体表头后缀统一为 z0..x3(std 记号),映射到颜色字母后脱离 angle 概念
  angleToColor: Record<string, ColorLetter>;
  colFor: (stage: string, angle: string) => string;
}

// NOTE: 颜色字母顺序（字母序）；subset key = sorted letters
const COLOR_LETTERS = ['B', 'G', 'O', 'R', 'W', 'Y'] as const;
type ColorLetter = typeof COLOR_LETTERS[number];

const ANGLE_COLOR_STD: Record<string, ColorLetter> = {
  z0: 'Y', z1: 'R', z2: 'W', z3: 'O', x1: 'B', x3: 'G',
};

const VARIANTS: VariantSpec[] = [
  {
    key: 'std',
    file: 'std.csv',
    id_col: 'id',
    stages: ['cross', 'xcross', 'xxcross', 'xxxcross', 'xxxxcross'],
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
    id_col: 'id',
    stages: ['cross_pair', 'xcross_pair', 'xxcross_pair', 'xxxcross_pair'],
    angleToColor: ANGLE_COLOR_STD,
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
  {
    // F2LEO = cross 进度 + 自由 F2L 棱 EO 门控；4 阶段(无 xxxxcross,届时无自由棱)
    key: 'f2leo',
    file: 'f2leo.csv',
    id_col: 'id',
    stages: ['f2leo_cross', 'f2leo_xcross', 'f2leo_xxcross', 'f2leo_xxxcross'],
    angleToColor: ANGLE_COLOR_STD,
    colFor: (stage, angle) => `${stage}_${angle}`,
  },
  {
    // Pseudo F2LEO = F2LEO + 角/棱槽解耦(off-by-D);4 阶段
    key: 'pseudo_f2leo',
    file: 'pseudo_f2leo.csv',
    id_col: 'id',
    stages: [
      'pseudo_f2leo_cross',
      'pseudo_f2leo_xcross',
      'pseudo_f2leo_xxcross',
      'pseudo_f2leo_xxxcross',
    ],
    angleToColor: ANGLE_COLOR_STD,
    colFor: (stage, angle) => `${stage}_${angle}`,
  },
  {
    // 2x2x2 块(1 角 + 3 棱, cstimer 同语义);单阶段。每角度列 = 该底色 4 个贴底块的最小步数
    key: '222',
    file: '222.csv',
    id_col: 'id',
    stages: ['block222'],
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

// NOTE: 每条 example = [id, scramble, bestColor];id = 源 txt 文件的编号;
// bestColor = subset 里拿到 min 的颜色字母
// K_DOWNLOAD = 单 bin reservoir 上限(进下载 txt)
// K_PREVIEW = 切到 examples.json 的预览条数(每 bin)
// DOWNLOAD_BIN_MAX_COUNT = 该 bin 总样本数 ≤ 此值才生成下载 txt
//   (大 bin 没必要下载因为 200 条均匀抽样代表性差,且 UI 信息量不够)
const K_DOWNLOAD = 200;
const K_PREVIEW = 5;
const DOWNLOAD_BIN_MAX_COUNT = 1000;
type Sample = [string, string, string];
interface Reservoir { samples: Sample[]; seen: number }

function newRes(): Reservoir { return { samples: [], seen: 0 }; }

// 固定种子 PRNG (mulberry32, 见 prng.ts):reservoir 采样确定化 -> 输入不变则输出逐字节不变。
// rng 在每个变体入口按 variant key 重新 makeRng(见 aggregateVariant), 故增量只改一个变体时
// 只有该变体自身的 bin 产生 diff, 不污染其它变体/set 的示例样本(否则全局 RNG 会被带偏 churn)。
let rng = makeRng(0x9e3779b9);

function reservoirAdd(r: Reservoir, s: Sample) {
  r.seen++;
  if (r.samples.length < K_DOWNLOAD) { r.samples.push(s); return; }
  const j = Math.floor(rng() * r.seen);
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

// competitions.tsv: id\tname\tstart_date\tend_date  → compId → { name, 日期串 }
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

// 给一个 set 的示例补充"来自哪场比赛":收集被示例引用到的 id,流式扫 split_mbf 取
// comp/项目/打乱序号,再 join 比赛名。返回 { comps: ci→[名,日期], idMeta: id→[ci,项目,序号] }。
// 仅 WCA set 有 split_mbf;自造打乱 set(xcross)无 → 两者都空。idMeta 按 id 引用 comps 去重比赛名。
async function buildExampleCompMeta(
  examplesOut: Record<string, unknown>,
  metaCsv: string,
  compTsv: string,
): Promise<{ comps: Record<string, [string, string]>; idMeta: Record<string, [string, string, number, string, string, (0 | 1)]> }> {
  const ids = new Set<string>();
  for (const preview of Object.values(examplesOut)) {
    const byStage = preview as Record<string, Record<string, Record<string, Sample[]>>>;
    for (const stage of Object.values(byStage))
      for (const subset of Object.values(stage))
        for (const samples of Object.values(subset))
          for (const s of samples) ids.add(s[0]);
  }
  const comps: Record<string, [string, string]> = {};
  const idMeta: Record<string, [string, string, number, string, string, (0 | 1)]> = {};
  if (ids.size === 0) return { comps, idMeta };
  const compNames = await loadCompNames(compTsv);
  const rl = readline.createInterface({ input: fs.createReadStream(metaCsv, 'utf-8'), crlfDelay: Infinity });
  let first = true;
  for await (const line of rl) {
    if (!line) continue;
    if (first) { first = false; continue; }
    const i0 = line.indexOf(',');
    if (i0 === -1) continue;
    const id = line.slice(0, i0);
    if (!ids.has(id)) continue;
    const c = line.split(',');
    const ci = c[2];
    // [compId, 项目, 打乱序号, 轮次代号, 组别, 备打?] — 轮次/组别供示例卡片显示「初赛E组#4」;
    // 备打(is_extra, c[6])→ 卡片显示 E1/E2 而非 #1/#2
    idMeta[id] = [ci, c[3], Number(c[7]), c[4], c[5], c[6] === '1' ? 1 : 0];
    if (!(ci in comps)) comps[ci] = compNames.get(ci) ?? [ci, ''];
  }
  return { comps, idMeta };
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
  // 每个 (set,variant) 调用前把 RNG 重新 makeRng 到随 variant key 确定的种子: reservoir 采样只依赖本变体自身数据,
  // 不被上一个变体处理时的 rng() 次数带偏 -> 增量只改一个变体时, 其它变体/set 的示例样本不再 spurious churn。
  let seed = 0x9e3779b9 >>> 0;
  for (const ch of spec.key) seed = (Math.imul(seed, 31) + ch.charCodeAt(0)) >>> 0;
  rng = makeRng(seed);
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
    // NOTE: parts[0] 是 id（全部变体首列均为整数 id）
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

  // NOTE: previewExamples 覆盖 **所有 bin**（给 UI 预览,K_PREVIEW=5 条/bin）;
  // pickedReservoirs 只含"该 bin 总数 ≤ DOWNLOAD_BIN_MAX_COUNT(1000)"的 bin
  //   (这些 bin 写 per-bin txt 下载文件);
  // data[stage][subset].example_bins = 同样的 bin 集合,UI 用来决定哪些 bin 显示 ⬇ 下载链接
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
      // bin 入选下载条件:总样本数 ≤ DOWNLOAD_BIN_MAX_COUNT
      const downloadBins = bins.filter((b) => bucketMap.get(b)!.seen <= DOWNLOAD_BIN_MAX_COUNT);
      data[stage][key].example_bins = downloadBins;
      previewExamples[stage][key] = {};
      pickedReservoirs[stage][key] = {};
      // 所有 bin 都进 preview
      for (const b of bins) {
        const res = bucketMap.get(b)!;
        previewExamples[stage][key][String(b)] = res.samples.slice(0, K_PREVIEW);
      }
      // 只把 ≤1000 样本数的 bin 落到 reservoirs(写 txt)
      for (const b of downloadBins) {
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
  res: { samples: Sample[]; seen: number },
  generatedAt: string,
  source: string,
): string {
  const lines: string[] = [];
  lines.push(`# Scramble samples — ${variantKey} / ${stage} / ${subsetKey} / bin ${bin}`);
  lines.push(`# Population in this bin: ${res.seen}`);
  if (res.seen > res.samples.length) {
    lines.push(`# Samples listed: ${res.samples.length} (uniform reservoir sample; cap = ${K_DOWNLOAD})`);
  } else {
    lines.push(`# Samples listed: ${res.samples.length} (all entries in this bin)`);
  }
  lines.push(`# Source: ${source}`);
  lines.push(`# Generated: ${generatedAt}`);
  lines.push('# Columns: id,scramble,bottom_color');
  lines.push('');
  for (const [id, scr, color] of res.samples) {
    lines.push(`${id},${scr},${color}`);
  }
  return lines.join('\n') + '\n';
}

// NOTE: 配置支持两种格式:
//   旧格式 (单 set): { csv_dir, scrambles_txt? } —— 视为 sets 数组里的单一 'wca' 项
//   新格式 (多 set): { sets: [{ key, label, label_zh?, csv_dir, scrambles_txt }, ...] }
interface SetSpec {
  key: string;
  label: string;
  label_zh?: string;
  csv_dir: string;
  scrambles_txt: string;
}

interface RawConfig {
  csv_dir?: string;
  scrambles_txt?: string;
  sets?: Array<{
    key: string;
    label: string;
    label_zh?: string;
    csv_dir: string;
    scrambles_txt?: string;
  }>;
}

function resolveSets(config: RawConfig): SetSpec[] {
  if (config.sets && config.sets.length > 0) {
    return config.sets.map((s) => ({
      key: s.key,
      label: s.label,
      label_zh: s.label_zh,
      csv_dir: s.csv_dir,
      scrambles_txt: s.scrambles_txt
        ?? path.join(path.dirname(s.csv_dir), 'wca_scrambles_no_wide_move.txt'),
    }));
  }
  if (!config.csv_dir) {
    throw new Error('config.yml must define either `sets:` or `csv_dir:`');
  }
  return [{
    key: 'wca',
    label: 'WCA',
    csv_dir: config.csv_dir,
    scrambles_txt: config.scrambles_txt
      ?? path.join(path.dirname(config.csv_dir), 'wca_scrambles_no_wide_move.txt'),
  }];
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
  const config = YAML.parse(fs.readFileSync(configPath, 'utf-8')) as RawConfig;
  const sets = resolveSets(config);
  console.log(`Configured ${sets.length} set(s): ${sets.map((s) => s.key).join(', ')}`);

  const outDir = path.join(repoRoot, 'stats', 'scramble');
  fs.mkdirSync(outDir, { recursive: true });
  // NOTE: 先把旧 downloads/ 整个干掉，避免残留上次 build 的 subset/bin 组合
  const downloadsDir = path.join(outDir, 'downloads');
  if (fs.existsSync(downloadsDir)) fs.rmSync(downloadsDir, { recursive: true, force: true });
  fs.mkdirSync(downloadsDir, { recursive: true });

  // SCRAMBLE_STATS_STAMP (增量管道传 export_date): 数据不变则时间戳不变 -> 无 spurious diff
  const generatedAt = process.env.SCRAMBLE_STATS_STAMP || new Date().toISOString();
  const setsOut: Record<string, unknown> = {};
  const examplesSetsOut: Record<string, unknown> = {};
  let txtFilesWritten = 0;
  let txtTotalBytes = 0;

  for (const setSpec of sets) {
    console.log(`\n=== Set: ${setSpec.key} (${setSpec.label}) ===`);
    if (!fs.existsSync(setSpec.scrambles_txt)) {
      throw new Error(`Missing scrambles txt for set '${setSpec.key}': ${setSpec.scrambles_txt}`);
    }
    console.log(`Loading scramble map from ${setSpec.scrambles_txt}`);
    const scrambleMap = await loadScrambleMap(setSpec.scrambles_txt);
    console.log(`  loaded ${scrambleMap.size} scrambles`);

    const variantsOut: Record<string, unknown> = {};
    const examplesOut: Record<string, unknown> = {};
    let maxCount = 0;
    for (const spec of VARIANTS) {
      const csvPath = path.join(setSpec.csv_dir, spec.file);
      if (!fs.existsSync(csvPath)) {
        // 变体 CSV 尚未生成(如 f2leo / pseudo_f2leo 未 backfill)→ 跳过, 不进 distribution。
        // 前端 dropdown 数据驱动, 缺的变体自动不显示; 待 backfill 出 CSV 后重算即纳入。
        console.warn(`  [skip] ${spec.key}: missing CSV ${csvPath}`);
        continue;
      }
      console.log(`Aggregating ${spec.key} from ${csvPath}`);
      const { sampleCount, json, previewExamples, pickedReservoirs } = await aggregateVariant(spec, csvPath, scrambleMap);
      variantsOut[spec.key] = json;
      examplesOut[spec.key] = previewExamples;
      if (sampleCount > maxCount) maxCount = sampleCount;

      // 写每 bin 一个 txt;路径含 setKey 隔离不同 set
      const sourceLabel = path.basename(setSpec.scrambles_txt);
      for (const stage of Object.keys(pickedReservoirs)) {
        for (const subsetKey of Object.keys(pickedReservoirs[stage])) {
          const binMap = pickedReservoirs[stage][subsetKey];
          const binsSorted = Object.keys(binMap).map(Number).sort((a, b) => a - b);
          for (const bin of binsSorted) {
            const txt = buildBinTxt(spec.key, stage, subsetKey, bin, binMap[String(bin)], generatedAt, sourceLabel);
            const filePath = path.join(downloadsDir, setSpec.key, spec.key, stage, `${subsetKey}_${bin}.txt`);
            fs.mkdirSync(path.dirname(filePath), { recursive: true });
            fs.writeFileSync(filePath, txt);
            txtFilesWritten++;
            txtTotalBytes += txt.length;
          }
        }
      }
    }

    setsOut[setSpec.key] = {
      label: setSpec.label,
      label_zh: setSpec.label_zh ?? null,
      sample_count: maxCount,
      variants: variantsOut,
    };
    // 示例补"来自哪场比赛"(仅有 split_mbf 的 WCA set;自造打乱 set 无 → comps/idMeta 空)
    let comps: Record<string, [string, string]> = {};
    let idMeta: Record<string, [string, string, number, string, string, (0 | 1)]> = {};
    const dataRoot = path.dirname(setSpec.csv_dir);
    const metaCsv = path.join(dataRoot, 'input', 'wca_scrambles_split_mbf.csv');
    if (fs.existsSync(metaCsv)) {
      console.log('Joining competition meta for examples...');
      ({ comps, idMeta } = await buildExampleCompMeta(examplesOut, metaCsv, path.join(dataRoot, 'competitions.tsv')));
      console.log(`  [examples] ${Object.keys(idMeta).length} ids across ${Object.keys(comps).length} comps`);
    }
    examplesSetsOut[setSpec.key] = { variants: examplesOut, comps, idMeta };
  }

  const out = {
    meta: {
      generated_at: generatedAt,
      subset_keys: SUBSET_KEYS,
    },
    sets: setsOut,
  };
  const examplesFile = {
    meta: { generated_at: generatedAt },
    sets: examplesSetsOut,
  };

  const outPath = path.join(outDir, 'distribution.json');
  fs.writeFileSync(outPath, JSON.stringify(out));
  const sizeKB = (fs.statSync(outPath).size / 1024).toFixed(1);
  console.log(`\nWrote ${outPath} (${sizeKB} KB)`);

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
