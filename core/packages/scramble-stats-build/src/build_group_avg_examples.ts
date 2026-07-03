// 「组平均」示例:给 /scramble/stats 组平均视图的柱子点击提供「示例组」。
// 与 build_group_avg.ts(直方图)配套:那里出分布,这里出可点击后展示的真实比赛分组。
//
// 客户端一条柱子 = 一个量化的组平均值。点它要能看到「哪些比赛组的平均落在这」——
// 每组 = 该 (comp,event,round,group) 的成员打乱(每条带记号 / 魔方图 / 该阶段步数)+ 组平均。
// 数据量大(全变体 × 每成员 6 色 × N 组),故拆分:
//   examples_avg.json              —— 基底:抽样组骨架(comp meta + 每成员 scramble/序号/备打),一次加载。
//   examples_avg_v_<variant>.json  —— 每变体的成员 6 色步数(按 [B,G,O,R,W,Y] 序),点柱按需加载。
// 客户端用成员步数**重算**每组平均(与直方图同口径:ne 去备打 / we 含备打),故其 bin 必与直方图对齐;
// 大组(多盲一组数十条)存全部成员保证平均精确,展示时截断。抽样确定化(mulberry32,按项目 reseed)。
//
// 只读现成 stat CSV + split_mbf 元数据 + competitions.tsv,**不跑 solver**。
// Run: pnpm --filter @cuberoot/scramble-stats-build build:group-avg-examples

import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';
import { fileURLToPath } from 'node:url';
import YAML from 'yaml';
import { VARIANTS, COLOR_LETTERS, buildStagePlans, type StagePlan } from './variants';
import { makeRng } from './prng';

const AVG_DENOM = 5;
const MIN_GROUP = 2;                       // 与 build_group_avg.ts 一致:size-1 组不是平均
// 每项目抽样组数上限(确定性洗牌后取前 N)。多盲组极大(数十条/组),单独压低防爆。
const PER_EVENT_CAP: Record<string, number> = { '333mbf': 120 };
const DEFAULT_CAP = 420;

interface RawConfig {
  csv_dir?: string;
  sets?: Array<{ key: string; label: string; csv_dir: string }>;
}

function resolveCsvDir(config: RawConfig): string {
  if (config.sets && config.sets.length > 0) {
    const wca = config.sets.find((s) => s.key === 'wca') ?? config.sets[0];
    return wca.csv_dir;
  }
  if (!config.csv_dir) throw new Error('config.yml must define `sets:` or `csv_dir:`');
  return config.csv_dir;
}

// 抽样组的成员骨架(顺序 = split_mbf 出现序)。
interface Member { id: string; num: number; extra: 0 | 1; scr: string; }
interface Group { comp: string; event: string; round: string; group: string; members: Member[]; }

// Pass 1:扫 split_mbf,按 (comp|event|round|group) 聚成组,记每成员 id/序号/备打/记号。
async function loadGroups(metaCsv: string): Promise<Map<string, Group>> {
  const groups = new Map<string, Group>();
  const rl = readline.createInterface({ input: fs.createReadStream(metaCsv, 'utf-8'), crlfDelay: Infinity });
  let first = true;
  for await (const line of rl) {
    if (!line) continue;
    if (first) { first = false; continue; }
    const c = line.split(',');
    const id = c[0]; if (!id) continue;
    const comp = c[2] ?? '', event = c[3] ?? '', round = c[4] ?? '', group = c[5] ?? '';
    const extra: 0 | 1 = c[6] === '1' ? 1 : 0;
    const num = Number(c[7]);
    const scr = c[1] ?? '';
    const gk = `${comp}|${event}|${round}|${group}`;
    let g = groups.get(gk);
    if (!g) { g = { comp, event, round, group, members: [] }; groups.set(gk, g); }
    g.members.push({ id, num: Number.isFinite(num) ? num : 0, extra, scr });
  }
  return groups;
}

// competitions.tsv: id\tname\tstart\tend
async function loadCompNames(tsvPath: string): Promise<Map<string, [string, string]>> {
  const map = new Map<string, [string, string]>();
  if (!fs.existsSync(tsvPath)) return map;
  const rl = readline.createInterface({ input: fs.createReadStream(tsvPath, 'utf-8'), crlfDelay: Infinity });
  let first = true;
  for await (const line of rl) {
    if (!line) continue;
    if (first) { first = false; continue; }
    const [id, name, start, end] = line.split('\t');
    const s = (start ?? '').slice(0, 10);
    const e = (end ?? '').slice(0, 10);
    map.set(id, [name ?? id, s && e && s !== e ? `${s} ~ ${e}` : s]);
  }
  return map;
}

async function main() {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const pkgRoot = path.resolve(here, '..');
  const repoRoot = path.resolve(pkgRoot, '..', '..', '..');
  const configPath = path.join(pkgRoot, 'config.yml');
  if (!fs.existsSync(configPath)) { console.error(`config.yml not found at ${configPath}`); process.exit(1); }
  const config = YAML.parse(fs.readFileSync(configPath, 'utf-8')) as RawConfig;
  const csvDir = resolveCsvDir(config);
  const dataRoot = path.dirname(csvDir);
  const metaCsv = path.join(dataRoot, 'input', 'wca_scrambles_split_mbf.csv');
  const compTsv = path.join(dataRoot, 'competitions.tsv');
  if (!fs.existsSync(metaCsv)) { console.error(`split_mbf meta not found at ${metaCsv}`); process.exit(1); }

  const generatedAt = process.env.SCRAMBLE_STATS_STAMP || new Date().toISOString();

  console.log(`Loading groups from ${metaCsv}`);
  const allGroups = await loadGroups(metaCsv);
  console.log(`  ${allGroups.size} groups total`);

  // 每项目内确定性洗牌(mulberry32,种子随项目)取前 cap;只收 ne(去备打)≥2 的真实组。
  const byEvent = new Map<string, Group[]>();
  for (const g of allGroups.values()) {
    const ne = g.members.reduce((n, m) => n + (m.extra ? 0 : 1), 0);
    if (ne < MIN_GROUP) continue;
    let arr = byEvent.get(g.event); if (!arr) { arr = []; byEvent.set(g.event, arr); }
    arr.push(g);
  }
  const sampled: Group[] = [];
  for (const [ev, arr] of [...byEvent.entries()].sort()) {
    // 洗牌:给每组一个确定随机键(种子随项目 + 组标识哈希)再排序,取前 cap。
    let seed = 0x811c9dc5;
    for (const ch of ev) seed = (Math.imul(seed ^ ch.charCodeAt(0), 0x01000193)) >>> 0;
    const rng = makeRng(seed);
    const keyed = arr.map((g) => ({ g, k: rng() }));
    keyed.sort((a, b) => a.k - b.k);
    const cap = PER_EVENT_CAP[ev] ?? DEFAULT_CAP;
    for (const { g } of keyed.slice(0, cap)) sampled.push(g);
    console.log(`  ${ev}: ${Math.min(cap, arr.length)}/${arr.length} sampled`);
  }
  console.log(`  ${sampled.length} groups sampled, ${sampled.reduce((n, g) => n + g.members.length, 0)} members`);

  // 抽样成员 id → (gi, mi) 定位,供 Pass 2 回填值。
  const idLoc = new Map<string, [number, number]>();
  sampled.forEach((g, gi) => g.members.forEach((m, mi) => idLoc.set(m.id, [gi, mi])));

  // Pass 2:每变体扫 stat CSV,抽样成员的每 stage 6 色步数([B,G,O,R,W,Y] 序) → vals[variant][gi][mi] = flat。
  const varStages: Record<string, string[]> = {};
  const varVals: Record<string, number[][][]> = {}; // variant → gi → mi → flat(nStages*6)
  for (const spec of VARIANTS) {
    const csvPath = path.join(csvDir, spec.file);
    if (!fs.existsSync(csvPath)) { console.warn(`  [skip] ${spec.key}: missing CSV ${csvPath}`); continue; }
    const nStage = spec.stages.length;
    varStages[spec.key] = spec.stages;
    // 预分配:每抽样组每成员一条 flat(默认 -1 = 缺)。
    const vv: number[][][] = sampled.map((g) => g.members.map(() => new Array<number>(nStage * 6).fill(-1)));
    varVals[spec.key] = vv;

    let plans = new Map<string, StagePlan>();
    let header: string[] | null = null;
    let rows = 0, hit = 0;
    const rl = readline.createInterface({ input: fs.createReadStream(csvPath, 'utf-8'), crlfDelay: Infinity });
    for await (const line of rl) {
      if (!line) continue;
      if (!header) { const h = line.split(','); header = h; plans = buildStagePlans(h, spec); continue; }
      const parts = line.split(',');
      const loc = idLoc.get(parts[0]);
      if (!loc) continue;
      const [gi, mi] = loc;
      const flat = vv[gi][mi];
      for (let si = 0; si < nStage; si++) {
        const { colorIdx } = plans.get(spec.stages[si])!;
        for (let ci = 0; ci < 6; ci++) {
          const v = Number(parts[colorIdx[ci]]);
          flat[si * 6 + ci] = Number.isFinite(v) ? v : -1;
        }
      }
      hit++;
      if (++rows % 300_000 === 0) process.stdout.write(`  [${spec.key}] ${rows} rows\r`);
    }
    process.stdout.write(`  [${spec.key}] ${rows} rows, ${hit} sampled hits\n`);
  }

  // comp meta(仅抽样组引用到的 comp)。
  const compNames = await loadCompNames(compTsv);
  const comps: Record<string, [string, string]> = {};
  for (const g of sampled) if (!(g.comp in comps)) comps[g.comp] = compNames.get(g.comp) ?? [g.comp, ''];

  const outDir = path.join(repoRoot, 'stats', 'scramble');
  fs.mkdirSync(outDir, { recursive: true });

  // 基底:组骨架 + 成员(scramble/序号/备打)+ comp meta + 变体→stages 布局。
  const base = {
    meta: {
      generated_at: generatedAt, avg_denom: AVG_DENOM, min_group: MIN_GROUP,
      color_order: COLOR_LETTERS.join(''),
      variants: varStages,                         // variant → stages(值 flat 的 stage 顺序)
    },
    comps,
    groups: sampled.map((g) => ({
      c: g.comp, e: g.event, r: g.round, g: g.group,
      m: g.members.map((m) => [m.scr, m.num, m.extra] as [string, number, 0 | 1]),
    })),
  };
  const basePath = path.join(outDir, 'examples_avg.json');
  fs.writeFileSync(basePath, JSON.stringify(base));
  console.log(`\nWrote ${basePath} (${(fs.statSync(basePath).size / 1024).toFixed(1)} KB)`);

  // 每变体值文件。
  for (const spec of VARIANTS) {
    const vv = varVals[spec.key];
    if (!vv) continue;
    const out = { variant: spec.key, stages: spec.stages, vals: vv };
    const p = path.join(outDir, `examples_avg_v_${spec.key}.json`);
    fs.writeFileSync(p, JSON.stringify(out));
    console.log(`Wrote ${p} (${(fs.statSync(p).size / 1024).toFixed(1)} KB)`);
  }
}

main().catch((err) => { console.error(err); process.exit(1); });
