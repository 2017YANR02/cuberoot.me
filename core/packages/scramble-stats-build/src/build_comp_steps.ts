// 每个比赛一份预计算步数表,供 /scramble/gen 单场分布"秒出"(前端零解算)。
//
// 输出 stats/scramble/comp_steps/<compId>.json = { "<scramble>": [30 ints] }
//   30 = cross/xc/xxc/xxxc/xxxxc 五阶段 × 6 底色(BADGE_ORDER = W Y R O B G)。
//   key = WCA **原始打乱串**(来自 split_mbf,规范化空格);gen 页拿到的就是这个,直接对上。
//     - 333/oh/ft/fm:面转打乱,原始=去宽层串。fm 的 "R' U' F …" 包裹也照样匹配。
//     - bf(盲拧):原始带宽层定向,但值取 std.csv(对去宽层态算,十字与原始态一致)。
//   收 333 系列(333/333oh/333ft/333fm/333bf);跳过 333mbf(一把多方块,逐方块无法对应)。
// 体积大(~100MB / 上万文件),gitignore + 只 scp 到 static;dev 本地直接读。
//
// Run: pnpm --filter @cuberoot/scramble-stats-build build:comp-steps

import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';
import { fileURLToPath } from 'node:url';
import YAML from 'yaml';

// 333 系列(跳过 333mbf)。
const FAMILY = new Set(['333', '333oh', '333ft', '333fm', '333bf']);
// std.csv 每阶段物理列序 = z0 z2 z3 z1 x3 x1 = Y W O R G B;重排到 BADGE_ORDER [W Y R O B G]。
const BADGE_FROM_STD = [1, 0, 3, 2, 5, 4];
const STAGES = 5;

// 与 client useCompSteps.normScramble 一致:trim + 多空格压单空格。
const normKey = (s: string): string => s.trim().replace(/\s+/g, ' ');

function rl(p: string) {
  return readline.createInterface({ input: fs.createReadStream(p, 'utf-8'), crlfDelay: Infinity });
}

async function main() {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const pkgRoot = path.resolve(here, '..');
  const repoRoot = path.resolve(pkgRoot, '..', '..', '..');
  const config = YAML.parse(fs.readFileSync(path.join(pkgRoot, 'config.yml'), 'utf-8'));
  const wca = (config.sets || []).find((s: { key: string }) => s.key === 'wca') ?? config.sets?.[0];
  if (!wca) throw new Error('no wca set in config.yml');

  const csvDir: string = wca.csv_dir;
  const dataRoot = path.dirname(csvDir);
  const stdCsv = path.join(csvDir, 'std.csv');
  const metaCsv = wca.meta_csv ?? path.join(dataRoot, 'input', 'wca_scrambles_split_mbf.csv');
  for (const [l, p] of [['std.csv', stdCsv], ['split_mbf', metaCsv]] as const) {
    if (!fs.existsSync(p)) throw new Error(`missing ${l}: ${p}`);
  }

  // 1) split_mbf: 333 系列的 id -> comp + 原始打乱串(key)
  console.log('streaming split_mbf (333 系列)...');
  const idComp = new Map<string, string>();
  const idKey = new Map<string, string>();
  {
    let first = true;
    for await (const line of rl(metaCsv)) {
      if (!line) continue;
      if (first) { first = false; continue; }
      // id,scramble,competition_id,event_id,...  (333 系列 scramble 无逗号)
      const c = line.split(',');
      if (!FAMILY.has(c[3])) continue;
      idComp.set(c[0], c[2]);
      idKey.set(c[0], normKey(c[1]));
    }
  }
  console.log(`  ${idComp.size} 个 333 系列打乱`);

  // 2) std.csv: id -> [30] BADGE,按 comp 分组,key = 原始打乱串
  console.log('streaming std.csv...');
  const byComp = new Map<string, Record<string, number[]>>();
  let first = true;
  let rows = 0;
  for await (const line of rl(stdCsv)) {
    if (!line) continue;
    if (first) { first = false; continue; }
    const c = line.split(',');
    const comp = idComp.get(c[0]);
    if (!comp) continue;
    const key = idKey.get(c[0]);
    if (!key) continue;
    const vals: number[] = [];
    for (let s = 0; s < STAGES; s++) {
      const base = 1 + s * 6;
      for (const j of BADGE_FROM_STD) vals.push(Number(c[base + j]));
    }
    let m = byComp.get(comp);
    if (!m) { m = {}; byComp.set(comp, m); }
    m[key] = vals;
    if (++rows % 200000 === 0) process.stdout.write(`  ${rows} rows\r`);
  }
  console.log(`  ${rows} rows -> ${byComp.size} comps`);

  const outDir = path.join(repoRoot, 'stats', 'scramble', 'comp_steps');
  fs.rmSync(outDir, { recursive: true, force: true });
  fs.mkdirSync(outDir, { recursive: true });
  let bytes = 0;
  for (const [comp, m] of byComp) {
    const json = JSON.stringify(m);
    fs.writeFileSync(path.join(outDir, `${comp}.json`), json);
    bytes += json.length;
  }
  console.log(`done -> ${outDir} (${byComp.size} files, ${(bytes / 1e6).toFixed(1)} MB)`);
}

main().catch((e) => { console.error(e); process.exit(1); });
