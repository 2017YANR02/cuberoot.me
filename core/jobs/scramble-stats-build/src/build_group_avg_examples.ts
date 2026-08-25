// 「组平均」示例:给 /scramble/stats 组平均视图的柱子点击提供「示例组」。
// 与 build_group_avg.ts(直方图)配套:那里出分布,这里出可点击后展示的真实比赛分组。
//
// 覆盖策略(2026-07 起,替代旧的「每项目 420 随机抽样」):**头尾极端 bin 完整,中间 bin 抽样**。
//   - 对每个 (variant,stage,subset,备打) 的**合并**直方图,按 bin 聚组;
//   - 若某 bin 的组数 ≤ max(FLOOR, PCT×该视图总组数)(相对该视图算「稀有」)→ 该 bin **全收**(完整);
//   - 否则(中间常见 bin)→ 只留 SAMPLE 个(确定性 mulberry32 洗牌取前 N,面板足够展示)。
//   合并完整 ⇒ 逐项目完整(逐项目只是按 event 过滤同一批组,组平均值与合并同口径),故无需单独覆盖逐项目。
//
// 产出:按 (variant,stage) 分片,点柱只加载当前视图那一片(自包含:骨架 + 该 stage 6 色步数 + comp meta)。
//   stats/scramble/examples_avg/<variant>__<stage>.json
// 每组成员 m = [scramble, num, extra, B,G,O,R,W,Y 六色该 stage 步数(-1=缺)]。客户端按所选 subset 取 min 重算组平均。
//
// 只读现成 stat CSV + split_mbf 元数据 + competitions.tsv,**不跑 solver**。
// Run: pnpm --filter @cuberoot/scramble-stats-build build:group-avg-examples

import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';
import { fileURLToPath } from 'node:url';
import YAML from 'yaml';
import { VARIANTS, SUBSET_KEYS, COLOR_LETTERS, buildStagePlans, type StagePlan } from './variants';
import { makeRng } from './prng';

const AVG_DENOM = 5;
const MIN_GROUP = 2;      // 与 build_group_avg.ts 一致:size-1 组不是平均
// 覆盖参数:稀有 bin(≤ 阈值)完整,否则留 SAMPLE 个。阈值 = max(FLOOR, PCT×该视图总组数)。
const COVER_FLOOR = 30;   // 每个视图里 ≤30 组的 bin 一律完整(保证极稀有头尾全收)
const COVER_PCT = 0.003;  // 且相对该视图 <0.3% 的 bin 也算稀有 → 完整(大池尾部如 5.8 也全收)
const COVER_SAMPLE = 20;  // 中间常见 bin 留这么多(面板展示足够)

interface RawConfig { csv_dir?: string; sets?: Array<{ key: string; label: string; csv_dir: string }>; }
function resolveCsvDir(config: RawConfig): string {
  if (config.sets && config.sets.length > 0) return (config.sets.find((s) => s.key === 'wca') ?? config.sets[0]).csv_dir;
  if (!config.csv_dir) throw new Error('config.yml must define `sets:` or `csv_dir:`');
  return config.csv_dir;
}

interface Member { id: string; num: number; extra: 0 | 1; scr: string; }
interface Group { comp: string; event: string; round: string; group: string; members: Member[]; }

// Pass 1:扫 split_mbf,按 (comp|event|round|group) 聚成组。
async function loadGroups(metaCsv: string): Promise<Group[]> {
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
    const gk = `${comp}|${event}|${round}|${group}`;
    let g = groups.get(gk);
    if (!g) { g = { comp, event, round, group, members: [] }; groups.set(gk, g); }
    g.members.push({ id, num: Number.isFinite(num) ? num : 0, extra, scr: c[1] ?? '' });
  }
  return [...groups.values()];
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
    const s = (start ?? '').slice(0, 10), e = (end ?? '').slice(0, 10);
    map.set(id, [name ?? id, s && e && s !== e ? `${s} ~ ${e}` : s]);
  }
  return map;
}

async function main() {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const pkgRoot = path.resolve(here, '..');
  const repoRoot = path.resolve(pkgRoot, '..', '..', '..');
  const config = YAML.parse(fs.readFileSync(path.join(pkgRoot, 'config.yml'), 'utf-8')) as RawConfig;
  const csvDir = resolveCsvDir(config);
  const dataRoot = path.dirname(csvDir);
  const metaCsv = path.join(dataRoot, 'input', 'wca_scrambles_split_mbf.csv');
  const compTsv = path.join(dataRoot, 'competitions.tsv');
  if (!fs.existsSync(metaCsv)) { console.error(`split_mbf meta not found at ${metaCsv}`); process.exit(1); }

  const generatedAt = process.env.SCRAMBLE_STATS_STAMP || new Date().toISOString();

  console.log(`Loading groups from ${metaCsv}`);
  const allGroups = await loadGroups(metaCsv);
  const nGroups = allGroups.length;
  console.log(`  ${nGroups} groups, ${allGroups.reduce((n, g) => n + g.members.length, 0)} members`);

  const compNames = await loadCompNames(compTsv);

  // id → (gi, memberLocalIndex, extra),供两遍定位。
  const idPos = new Map<string, [number, number, 0 | 1]>();
  allGroups.forEach((g, gi) => g.members.forEach((m, mi) => idPos.set(m.id, [gi, mi, m.extra])));

  // 组稳定随机键(确定性),中间 bin 抽样用。
  const rng = makeRng(0x9e3779b1);
  const keys = new Float64Array(nGroups);
  for (let i = 0; i < nGroups; i++) keys[i] = rng();

  const outDir = path.join(repoRoot, 'stats', 'scramble', 'examples_avg');
  fs.rmSync(outDir, { recursive: true, force: true });
  fs.mkdirSync(outDir, { recursive: true });
  // 清理旧的单体文件(examples_avg.json + examples_avg_v_*.json)。
  const legacyDir = path.join(repoRoot, 'stats', 'scramble');
  for (const f of fs.readdirSync(legacyDir)) {
    if (f === 'examples_avg.json' || /^examples_avg_v_.+\.json$/.test(f)) fs.rmSync(path.join(legacyDir, f), { force: true });
  }

  const nSub = SUBSET_KEYS.length;
  const manifest: { generated_at: string; avg_denom: number; min_group: number; color_order: string; shards: Record<string, string[]> } = {
    generated_at: generatedAt, avg_denom: AVG_DENOM, min_group: MIN_GROUP, color_order: COLOR_LETTERS.join(''), shards: {},
  };
  let totalBytes = 0;

  for (const spec of VARIANTS) {
    const csvPath = path.join(csvDir, spec.file);
    if (!fs.existsSync(csvPath)) { console.warn(`  [skip] ${spec.key}: missing ${csvPath}`); continue; }
    const nStage = spec.stages.length;
    manifest.shards[spec.key] = spec.stages;

    // Pass A:聚合每 (stage,subset) 的组和/计数(ne/we),仅为定 bin。
    const slots = nStage * nSub;
    const sumNE: Float32Array[] = [], cntNE: Uint32Array[] = [], sumWE: Float32Array[] = [], cntWE: Uint32Array[] = [];
    for (let s = 0; s < slots; s++) { sumNE.push(new Float32Array(nGroups)); cntNE.push(new Uint32Array(nGroups)); sumWE.push(new Float32Array(nGroups)); cntWE.push(new Uint32Array(nGroups)); }
    let plans = new Map<string, StagePlan>();
    {
      let header: string[] | null = null;
      const rl = readline.createInterface({ input: fs.createReadStream(csvPath, 'utf-8'), crlfDelay: Infinity });
      for await (const line of rl) {
        if (!line) continue;
        if (!header) { header = line.split(','); plans = buildStagePlans(header, spec); continue; }
        const parts = line.split(',');
        const pos = idPos.get(parts[0]); if (!pos) continue;
        const gi = pos[0], extra = pos[2];
        for (let si = 0; si < nStage; si++) {
          const { colorIdx, subsetMasks } = plans.get(spec.stages[si])!;
          const vals = new Array<number>(6); let bad = false;
          for (let i = 0; i < 6; i++) { const v = Number(parts[colorIdx[i]]); if (!Number.isFinite(v)) { bad = true; break; } vals[i] = v; }
          if (bad) continue;
          for (let ki = 0; ki < nSub; ki++) {
            const mask = subsetMasks[ki].mask; let m = Infinity;
            for (let i = 0; i < 6; i++) if ((mask & (1 << i)) && vals[i] < m) m = vals[i];
            if (!Number.isFinite(m)) continue;
            const slot = si * nSub + ki;
            sumWE[slot][gi] += m; cntWE[slot][gi]++;
            if (!extra) { sumNE[slot][gi] += m; cntNE[slot][gi]++; }
          }
        }
      }
    }

    // 定每个 stage 的保留组集合:该 stage 任一 (subset,mode) 命中「稀有全收 / 中间抽样」都保。
    const keptStage: Set<number>[] = spec.stages.map(() => new Set<number>());
    for (let si = 0; si < nStage; si++) {
      const kept = keptStage[si];
      for (let ki = 0; ki < nSub; ki++) {
        const slot = si * nSub + ki;
        for (const mode of ['ne', 'we'] as const) {
          const sum = mode === 'ne' ? sumNE[slot] : sumWE[slot];
          const cnt = mode === 'ne' ? cntNE[slot] : cntWE[slot];
          const bins = new Map<number, number[]>();
          let total = 0;
          for (let gi = 0; gi < nGroups; gi++) {
            if (cnt[gi] < MIN_GROUP) continue;
            const bin = Math.round((sum[gi] / cnt[gi]) * AVG_DENOM);
            let a = bins.get(bin); if (!a) { a = []; bins.set(bin, a); } a.push(gi);
            total++;
          }
          const thr = Math.max(COVER_FLOOR, COVER_PCT * total);
          for (const arr of bins.values()) {
            if (arr.length <= thr) { for (const gi of arr) kept.add(gi); }
            else { arr.sort((a, b) => keys[a] - keys[b]); for (let i = 0; i < COVER_SAMPLE; i++) kept.add(arr[i]); }
          }
        }
      }
    }

    // Pass B:为保留组收集每 stage 的 6 色步数(-1=缺)。
    const stageVals: Array<Map<number, number[][]>> = spec.stages.map((_, si) => {
      const m = new Map<number, number[][]>();
      for (const gi of keptStage[si]) m.set(gi, allGroups[gi].members.map(() => new Array<number>(6).fill(-1)));
      return m;
    });
    {
      let header: string[] | null = null;
      const rl = readline.createInterface({ input: fs.createReadStream(csvPath, 'utf-8'), crlfDelay: Infinity });
      for await (const line of rl) {
        if (!line) continue;
        if (!header) { header = line.split(','); plans = buildStagePlans(header, spec); continue; }
        const parts = line.split(',');
        const pos = idPos.get(parts[0]); if (!pos) continue;
        const gi = pos[0], mi = pos[1];
        for (let si = 0; si < nStage; si++) {
          const gm = stageVals[si].get(gi); if (!gm) continue;
          const { colorIdx } = plans.get(spec.stages[si])!;
          const row = gm[mi];
          for (let i = 0; i < 6; i++) { const v = Number(parts[colorIdx[i]]); row[i] = Number.isFinite(v) ? v : -1; }
        }
      }
    }

    // 出分片。
    for (let si = 0; si < nStage; si++) {
      const stage = spec.stages[si];
      const giList = [...keptStage[si]].sort((a, b) => a - b);
      const comps: Record<string, [string, string]> = {};
      const groups = giList.map((gi) => {
        const g = allGroups[gi];
        if (!(g.comp in comps)) comps[g.comp] = compNames.get(g.comp) ?? [g.comp, ''];
        const vals = stageVals[si].get(gi)!;
        return { c: g.comp, e: g.event, r: g.round, g: g.group, m: g.members.map((m, mi) => [m.scr, m.num, m.extra, ...vals[mi]]) };
      });
      const shard = { meta: { generated_at: generatedAt, avg_denom: AVG_DENOM, min_group: MIN_GROUP, color_order: COLOR_LETTERS.join(''), variant: spec.key, stage }, comps, groups };
      const p = path.join(outDir, `${spec.key}__${stage}.json`);
      fs.writeFileSync(p, JSON.stringify(shard));
      const kb = fs.statSync(p).size; totalBytes += kb;
      console.log(`  ${spec.key}/${stage}: ${groups.length} groups → ${(kb / 1024 / 1024).toFixed(2)} MB`);
    }
  }

  fs.writeFileSync(path.join(outDir, 'manifest.json'), JSON.stringify(manifest));
  console.log(`\nWrote ${outDir} — total ${(totalBytes / 1024 / 1024).toFixed(1)} MB across shards`);
}

main().catch((err) => { console.error(err); process.exit(1); });
