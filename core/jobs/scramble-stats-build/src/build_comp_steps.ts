// 每个比赛一份预计算步数表,供 /scramble/gen 单场分布"秒出"(前端零解算)。
//
// 输出(每变体一个目录,key = WCA **原始打乱串** 规范化空格,值 = 各阶段 × 6 底色 BADGE 序 W Y R O B G):
//   stats/scramble/comp_steps/<compId>.json               std         = [30] cross/xc/xxc/xxxc/xxxxc
//   stats/scramble/comp_steps_eo/<compId>.json            eo          = [30] eo_cross..eo_xxxxcross
//   stats/scramble/comp_steps_pseudo/<compId>.json        pseudo      = [24] pseudo_cross..pseudo_xxxcross
//   stats/scramble/comp_steps_pseudo_pair/<compId>.json   pseudo_pair = [24] 同上(+pair)
//   stats/scramble/comp_steps_pair/<compId>.json          pair        = [24] cross_pair..xxxcross_pair
//   stats/scramble/comp_steps_f2leo/<compId>.json         f2leo       = [24] cross/xc/xxc/xxxc(无 xxxxc)
//   stats/scramble/comp_steps_pseudo_f2leo/<compId>.json  pseudo_f2leo= [24] 同上
//     - 333/oh/ft/fm:面转打乱,原始=去宽层串。fm 的 "R' U' F …" 包裹也照样匹配。
//     - bf(盲拧):原始带宽层定向,但值取变体 csv(对去宽层态算,十字与原始态一致)。
//   收 333 系列(333/333oh/333ft/333fm/333bf);跳过 333mbf(一把多方块,逐方块无法对应)。
//   WCA 变体 CSV 缺失、漏 ID 或无效值时停止，不把不完整统计生成成正式分片。
// 体积大(~100MB / 上万文件),gitignore + 只 scp 到 static;dev 本地直接读。
//
// Run: pnpm --filter @cuberoot/scramble-stats-build build:comp-steps

import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';
import { fileURLToPath } from 'node:url';
import YAML from 'yaml';
import { taskProgress } from './task_progress.js';

// 333 系列(跳过 333mbf)。
const FAMILY = new Set(['333', '333oh', '333ft', '333fm', '333bf']);
// 变体 csv 每阶段物理列序 = z0 z2 z3 z1 x3 x1 = Y W O R G B;重排到 BADGE_ORDER [W Y R O B G]。
const BADGE_FROM_STD = [1, 0, 3, 2, 5, 4];

// 变体 → (csv 文件名, 阶段数, 输出目录)。三者列布局一致(id + 阶段×6 角度),只差阶段数。
import { COMP_STEP_TARGETS as TARGETS } from './comp_step_targets.js';

// 与 client useCompSteps.normScramble 一致:trim + 多空格压单空格。
const normKey = (s: string): string => s.trim().replace(/\s+/g, ' ');

function rl(p: string) {
  return readline.createInterface({ input: fs.createReadStream(p, 'utf-8'), crlfDelay: Infinity });
}

// 一个变体 csv → 按 comp 分组写出。idComp/idKey 为 333 系列(由 split_mbf 预先建好,跨变体共享)。
export async function buildTarget(
  csvPath: string,
  stages: number,
  outDir: string,
  idComp: Map<string, string>,
  idKey: Map<string, string>,
) {
  console.log(`streaming ${path.basename(csvPath)} (${stages} 阶段)...`);
  const byComp = new Map<string, Record<string, number[]>>();
  let first = true;
  let rows = 0;
  const seen = new Set<string>();
  for await (const line of rl(csvPath)) {
    if (!line) continue;
    if (first) { first = false; continue; }
    const c = line.split(',');
    const comp = idComp.get(c[0]);
    if (!comp) continue;
    const key = idKey.get(c[0]);
    if (!key) continue;
    const vals: number[] = [];
    for (let s = 0; s < stages; s++) {
      const base = 1 + s * 6;
      for (const j of BADGE_FROM_STD) vals.push(Number(c[base + j]));
    }
    if (c.length !== 1 + stages * 6 || c.slice(1).some(value => !/^\d+$/.test(value))
      || vals.some(value => !Number.isInteger(value) || value < 0)
      || seen.has(c[0])) throw new Error(`Invalid/duplicate stage row: ${csvPath}: ${c[0]}`);
    seen.add(c[0]);
    let m = byComp.get(comp);
    if (!m) { m = {}; byComp.set(comp, m); }
    m[key] = vals;
    rows++;
  }
  if (seen.size !== idKey.size) throw new Error(`Incomplete stage results: ${csvPath}: ${seen.size}/${idKey.size} IDs`);
  fs.rmSync(outDir, { recursive: true, force: true });
  fs.mkdirSync(outDir, { recursive: true });
  let bytes = 0;
  for (const [comp, m] of byComp) {
    const json = JSON.stringify(m);
    fs.writeFileSync(path.join(outDir, `${comp}.json`), json);
    bytes += json.length;
  }
  console.log(`  ${rows} rows -> ${outDir} (${byComp.size} files, ${(bytes / 1e6).toFixed(1)} MB)`);
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
  const metaCsv = wca.meta_csv ?? path.join(dataRoot, 'input', 'wca_scrambles_split_mbf.csv');
  if (!fs.existsSync(metaCsv)) throw new Error(`missing split_mbf: ${metaCsv}`);

  // 1) split_mbf: 333 系列的 id -> comp + 原始打乱串(key)。跨变体共享。
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

  // 2) 全部变体必须存在；不能静默跳过后发布。
  for (const tgt of TARGETS) {
    if (!fs.existsSync(path.join(csvDir, tgt.csv))) throw new Error(`Missing stage CSV: ${tgt.csv}; backfill before building competition statistics`);
  }
  const report = taskProgress('比赛阶段表', TARGETS.length);
  report(0);
  let completedTargets = 0;
  for (const tgt of TARGETS) {
    const csvPath = path.join(csvDir, tgt.csv);
    const outDir = path.join(repoRoot, 'stats', 'scramble', tgt.outDir);
    await buildTarget(csvPath, tgt.stages, outDir, idComp, idKey);
    report(++completedTargets);
  }
  console.log('done');
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((e) => { console.error(e); process.exit(1); });
}
