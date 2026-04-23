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
    stages: ['crossp', 'xcp', 'xxcp', 'xxxcp'],
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

async function aggregateVariant(spec: VariantSpec, csvPath: string) {
  // NOTE: per stage → per subset key → Hist
  const byStage: Record<string, Record<string, Hist>> = {};
  for (const stage of spec.stages) {
    byStage[stage] = {};
    for (const key of SUBSET_KEYS) byStage[stage][key] = newHist();
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
        for (let i = 0; i < 6; i++) if (mask & (1 << i)) if (vals[i] < m) m = vals[i];
        bump(byStage[stage][key], m);
      }
    }
    sampleCount++;
    if (sampleCount % 200_000 === 0) {
      process.stdout.write(`  [${spec.key}] ${sampleCount} rows\r`);
    }
  }
  process.stdout.write(`  [${spec.key}] ${sampleCount} rows\n`);

  const data: Record<string, Record<string, ReturnType<typeof histToJson>>> = {};
  for (const stage of spec.stages) {
    data[stage] = {};
    for (const key of SUBSET_KEYS) data[stage][key] = histToJson(byStage[stage][key]);
  }

  return {
    sampleCount,
    json: {
      sample_count: sampleCount,
      stages: spec.stages,
      data,
    },
  };
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
  const config = YAML.parse(fs.readFileSync(configPath, 'utf-8')) as { csv_dir: string };
  const csvDir = config.csv_dir;

  const outDir = path.join(repoRoot, 'stats', 'data', 'scramble');
  fs.mkdirSync(outDir, { recursive: true });

  const variantsOut: Record<string, unknown> = {};
  let maxCount = 0;
  for (const spec of VARIANTS) {
    const csvPath = path.join(csvDir, spec.file);
    if (!fs.existsSync(csvPath)) {
      throw new Error(`Missing CSV: ${csvPath}`);
    }
    console.log(`Aggregating ${spec.key} from ${csvPath}`);
    const { sampleCount, json } = await aggregateVariant(spec, csvPath);
    variantsOut[spec.key] = json;
    if (sampleCount > maxCount) maxCount = sampleCount;
  }

  const out = {
    meta: {
      sample_count: maxCount,
      source: 'wca_scrambles_no_wide_move',
      generated_at: new Date().toISOString(),
      subset_keys: SUBSET_KEYS,
    },
    variants: variantsOut,
  };

  const outPath = path.join(outDir, 'distribution.json');
  fs.writeFileSync(outPath, JSON.stringify(out));
  const sizeKB = (fs.statSync(outPath).size / 1024).toFixed(1);
  console.log(`Wrote ${outPath} (${sizeKB} KB)`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
