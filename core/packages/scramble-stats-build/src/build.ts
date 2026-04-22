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
  angles: string[];
  colFor: (stage: string, angle: string) => string;
  // NOTE: 黄+白底色在 angles 里的 key，用于算 min_wy（白黄双色 CN）
  yellow_angle: string;
  white_angle: string;
}

const VARIANTS: VariantSpec[] = [
  {
    key: 'std',
    file: 'std.csv',
    id_col: 'id',
    stages: ['cross', 'xcross', 'xxcross', 'xxxcross', 'f2l'],
    angles: ['z0', 'z1', 'z2', 'z3', 'x1', 'x3'],
    colFor: (stage, angle) => `${stage}_${angle}`,
    yellow_angle: 'z0',
    white_angle: 'z2',
  },
  {
    key: 'eo',
    file: 'eo.csv',
    id_col: 'id',
    stages: ['eo_cross', 'eo_xcross', 'eo_xxcross', 'eo_xxxcross', 'eo_xxxxcross'],
    angles: ['z0', 'z1', 'z2', 'z3', 'x1', 'x3'],
    colFor: (stage, angle) => `${stage}_${angle}`,
    yellow_angle: 'z0',
    white_angle: 'z2',
  },
  {
    key: 'pair',
    file: 'pair.csv',
    id_col: 'scramble',
    stages: ['crossp', 'xcp', 'xxcp', 'xxxcp'],
    angles: ['', 'z2', "z'", 'z', "x'", 'x'],
    colFor: (stage, angle) => `${stage}_${angle}`,
    yellow_angle: '',
    white_angle: 'z2',
  },
  {
    key: 'pseudo',
    file: 'pseudo.csv',
    id_col: 'id',
    stages: ['pseudo_cross', 'pseudo_xcross', 'pseudo_xxcross', 'pseudo_xxxcross'],
    angles: ['z0', 'z1', 'z2', 'z3', 'x1', 'x3'],
    colFor: (stage, angle) => `${stage}_${angle}`,
    yellow_angle: 'z0',
    white_angle: 'z2',
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
    angles: ['z0', 'z1', 'z2', 'z3', 'x1', 'x3'],
    colFor: (stage, angle) => `${stage}_${angle}`,
    yellow_angle: 'z0',
    white_angle: 'z2',
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

async function aggregateVariant(spec: VariantSpec, csvPath: string) {
  // NOTE: per stage → per angle (+ __min_across + __min_wy) → Hist
  const byStage: Record<string, Record<string, Hist>> = {};
  for (const stage of spec.stages) {
    byStage[stage] = {};
    for (const angle of spec.angles) byStage[stage][angle] = newHist();
    byStage[stage].__min_across = newHist();
    byStage[stage].__min_wy = newHist();
  }

  const stream = fs.createReadStream(csvPath, { encoding: 'utf-8' });
  const rl = readline.createInterface({ input: stream, crlfDelay: Infinity });

  let header: string[] | null = null;
  const stageAngleIdx: { stage: string; angle: string; idx: number }[] = [];
  const stageIdxs = new Map<string, number[]>();  // NOTE: stage → [6 col indices] for min calc
  const stageWyIdxs = new Map<string, [number, number]>();  // NOTE: stage → [yellow, white] for min_wy
  let sampleCount = 0;
  let lineNo = 0;

  for await (const line of rl) {
    lineNo++;
    if (!line) continue;
    if (!header) {
      header = line.split(',');
      const idxMap = new Map<string, number>();
      header.forEach((h, i) => idxMap.set(h, i));
      for (const stage of spec.stages) {
        const anglesIdx: number[] = [];
        for (const angle of spec.angles) {
          const col = spec.colFor(stage, angle);
          const idx = idxMap.get(col);
          if (idx === undefined) {
            throw new Error(`[${spec.key}] missing column '${col}' in header`);
          }
          stageAngleIdx.push({ stage, angle, idx });
          anglesIdx.push(idx);
        }
        stageIdxs.set(stage, anglesIdx);
        const yIdx = idxMap.get(spec.colFor(stage, spec.yellow_angle))!;
        const wIdx = idxMap.get(spec.colFor(stage, spec.white_angle))!;
        stageWyIdxs.set(stage, [yIdx, wIdx]);
      }
      continue;
    }
    const parts = line.split(',');
    for (const { stage, angle, idx } of stageAngleIdx) {
      const v = Number(parts[idx]);
      if (!Number.isFinite(v)) continue;
      bump(byStage[stage][angle], v);
    }
    for (const stage of spec.stages) {
      const idxs = stageIdxs.get(stage)!;
      let m = Infinity;
      for (const i of idxs) {
        const v = Number(parts[i]);
        if (Number.isFinite(v) && v < m) m = v;
      }
      if (Number.isFinite(m)) bump(byStage[stage].__min_across, m);
      const [yi, wi] = stageWyIdxs.get(stage)!;
      const yv = Number(parts[yi]);
      const wv = Number(parts[wi]);
      if (Number.isFinite(yv) && Number.isFinite(wv)) {
        bump(byStage[stage].__min_wy, Math.min(yv, wv));
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
    for (const angle of spec.angles) data[stage][angle] = histToJson(byStage[stage][angle]);
    data[stage].min_across = histToJson(byStage[stage].__min_across);
    data[stage].min_wy = histToJson(byStage[stage].__min_wy);
  }

  return {
    sampleCount,
    json: {
      sample_count: sampleCount,
      stages: spec.stages,
      angles: spec.angles,
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
