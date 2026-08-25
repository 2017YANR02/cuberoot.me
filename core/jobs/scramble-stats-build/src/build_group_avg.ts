// 「组平均」难度分布:把每场比赛每轮每组的一组打乱(三阶 ao5=5 条、bo3=3 条、多盲一组不定)
// 的各阶段步数取**平均**(moX / 不去尾),再对这些「组平均」做直方图 —— 与 build.ts 的
// 「单条打乱」直方图并列,由 /scramble/stats 的「单个 / 组平均」PillToggle 切换。
//
// 只重读现成的 stat CSV(D:/cube/scramble/<set>/stat/*.csv,步数已算好)+ 分组元数据
// (input/wca_scrambles_split_mbf.csv 的 comp/event/round/group/is_extra),**不跑 solver**。
// 产出 stats/scramble/distribution_avg.json:
//   sets.wca            —— 全部六个三阶项目的组平均混合池(对齐 distribution.json 的合并池)
//   sets.wca_<event>    —— 逐项目组平均(split 模式按项目查看)
// 每个 stage/subset 叶子 = { ne: 不含备打, we: 含备打 } 两个直方图(备打开关由前端切)。
// 直方图键 = round(平均 × AVG_DENOM) 的整数(0.2 网格,对主力 5 条组精确);前端显示时 ÷ AVG_DENOM。
//
// Run: pnpm --filter @cuberoot/scramble-stats-build build:group-avg

import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';
import { fileURLToPath } from 'node:url';
import YAML from 'yaml';
import { VARIANTS, SUBSET_KEYS, buildStagePlans, type StagePlan } from './variants';

// 组平均量化网格:round(avg × 5) → 整数键。5 条一组(三阶 / 单手 ao5)时 avg×5 = 步数和,精确无损;
// 其余组大小(bo3=3、多盲不定)按 0.2 网格量化。前端 formatBin 显示 v/5。
const AVG_DENOM = 5;

// 组平均至少要 2 条打乱才有意义:size-1「组」(主要是 333fm 单次成绩 bo1 决赛)只是单条原始值,
// 不是平均,还会在低端造出「六色十字平均 1.0」这种不可能的整数尾巴(单条 CN 十字=1 极罕见但真实)。
// 单条值本就在「单个」视图里能看,组平均视图只收 ≥2 条的真实分组。
const MIN_GROUP = 2;

interface RawConfig {
  csv_dir?: string;
  sets?: Array<{ key: string; label: string; label_zh?: string; csv_dir: string; scrambles_txt?: string }>;
}

interface SetSpec { key: string; label: string; label_zh?: string; csv_dir: string; }

function resolveSets(config: RawConfig): SetSpec[] {
  if (config.sets && config.sets.length > 0) {
    return config.sets.map((s) => ({ key: s.key, label: s.label, label_zh: s.label_zh, csv_dir: s.csv_dir }));
  }
  if (!config.csv_dir) throw new Error('config.yml must define either `sets:` or `csv_dir:`');
  return [{ key: 'wca', label: 'WCA', csv_dir: config.csv_dir }];
}

// 分组元数据:id → 组下标(密集整数,按 comp|event|round|group 去重)+ 备打位;组下标 → 项目。
// split_mbf 列:id,scramble,competition_id,event_id,round_type_id,group_id,is_extra,scramble_num
interface GroupMeta {
  idGroup: Map<string, number>; // id → groupIdx*2 + (is_extra?1:0)
  groupEvent: string[];         // groupIdx → event_id
  numGroups: number;
}

async function loadGroupMeta(metaCsv: string): Promise<GroupMeta> {
  const groupIndex = new Map<string, number>();
  const groupEvent: string[] = [];
  const idGroup = new Map<string, number>();
  const evIntern = new Map<string, string>();
  const rl = readline.createInterface({ input: fs.createReadStream(metaCsv, 'utf-8'), crlfDelay: Infinity });
  let first = true;
  for await (const line of rl) {
    if (!line) continue;
    if (first) { first = false; continue; }
    const c = line.split(',');
    const id = c[0];
    if (!id) continue;
    const comp = c[2] ?? '', evRaw = c[3] ?? '', round = c[4] ?? '', group = c[5] ?? '';
    let ev = evIntern.get(evRaw);
    if (ev === undefined) { ev = evRaw; evIntern.set(evRaw, evRaw); }
    const evName = ev; // 已确保为 string
    const gk = `${comp}|${evName}|${round}|${group}`;
    let gi = groupIndex.get(gk);
    if (gi === undefined) { gi = groupEvent.length; groupIndex.set(gk, gi); groupEvent.push(evName); }
    const extra = c[6] === '1' ? 1 : 0;
    idGroup.set(id, gi * 2 + extra);
  }
  return { idGroup, groupEvent, numGroups: groupEvent.length };
}

function histToJson(counts: Map<number, number>) {
  if (counts.size === 0) return { min: 0, max: 0, counts: {} as Record<string, number> };
  const keys = [...counts.keys()].sort((a, b) => a - b);
  const obj: Record<string, number> = {};
  for (const k of keys) obj[String(k)] = counts.get(k)!;
  return { min: keys[0], max: keys[keys.length - 1], counts: obj };
}

// 一个 (stage,subset) 的组平均直方图累加器:ne = 只算正式解,we = 含备打。
interface SubHist { ne: Map<number, number>; we: Map<number, number>; }
function newSubHist(): SubHist { return { ne: new Map(), we: new Map() }; }
function bumpHist(m: Map<number, number>, key: number) { m.set(key, (m.get(key) ?? 0) + 1); }

// 输出树:setKey → variant → { stages, data: stage → subset → {ne,we} }
type VariantAvg = { stages: string[]; data: Record<string, Record<string, SubHist>> };

function ensureVariant(store: Record<string, VariantAvg>, variant: string, stages: string[]): VariantAvg {
  let v = store[variant];
  if (!v) {
    v = { stages, data: {} };
    for (const st of stages) { v.data[st] = {}; for (const key of SUBSET_KEYS) v.data[st][key] = newSubHist(); }
    store[variant] = v;
  }
  return v;
}

async function processSet(setSpec: SetSpec, metaCsv: string, outSets: Record<string, unknown>) {
  console.log(`\n=== Set: ${setSpec.key} (${setSpec.label}) ===`);
  console.log(`Loading group meta from ${metaCsv}`);
  const { idGroup, groupEvent, numGroups } = await loadGroupMeta(metaCsv);
  console.log(`  ${idGroup.size} ids across ${numGroups} groups`);

  // 合并池 + 逐项目输出树(variant 树各自惰性建 stage/subset)。
  const mergedVariants: Record<string, VariantAvg> = {};
  const eventVariants = new Map<string, Record<string, VariantAvg>>();
  // 组计数(去重后):合并池 = numGroups 有数据者;逐项目按 event。用于 sample_count。
  const mergedGroupsSeen = new Set<number>();
  const eventGroupsSeen = new Map<string, Set<number>>();

  for (const spec of VARIANTS) {
    const csvPath = path.join(setSpec.csv_dir, spec.file);
    if (!fs.existsSync(csvPath)) { console.warn(`  [skip] ${spec.key}: missing CSV ${csvPath}`); continue; }
    console.log(`Aggregating ${spec.key} from ${csvPath}`);

    const nStage = spec.stages.length;
    const nSub = SUBSET_KEYS.length;
    // 每 (stage,subset) 一组按组下标的累加器。索引 = (stageIdx*nSub + subIdx)。
    const slots = nStage * nSub;
    const sumNE: Float32Array[] = [], cntNE: Uint32Array[] = [], sumWE: Float32Array[] = [], cntWE: Uint32Array[] = [];
    for (let s = 0; s < slots; s++) {
      sumNE.push(new Float32Array(numGroups)); cntNE.push(new Uint32Array(numGroups));
      sumWE.push(new Float32Array(numGroups)); cntWE.push(new Uint32Array(numGroups));
    }

    let plans = new Map<string, StagePlan>();
    const rl = readline.createInterface({ input: fs.createReadStream(csvPath, 'utf-8'), crlfDelay: Infinity });
    let header: string[] | null = null;
    let rows = 0;
    for await (const line of rl) {
      if (!line) continue;
      if (!header) { const h = line.split(','); header = h; plans = buildStagePlans(h, spec); continue; }
      const parts = line.split(',');
      const id = parts[0];
      const gm = idGroup.get(id);
      if (gm === undefined) continue; // 该 id 无分组元数据(理论上不该发生)
      const gi = gm >> 1;
      const extra = gm & 1;
      for (let si = 0; si < nStage; si++) {
        const stage = spec.stages[si];
        const { colorIdx, subsetMasks } = plans.get(stage)!;
        const vals = new Array<number>(6);
        let bad = false;
        for (let i = 0; i < 6; i++) {
          const v = Number(parts[colorIdx[i]]);
          if (!Number.isFinite(v)) { bad = true; break; }
          vals[i] = v;
        }
        if (bad) continue;
        for (let ki = 0; ki < nSub; ki++) {
          const mask = subsetMasks[ki].mask;
          let m = Infinity;
          for (let i = 0; i < 6; i++) if ((mask & (1 << i)) && vals[i] < m) m = vals[i];
          if (!Number.isFinite(m)) continue;
          const slot = si * nSub + ki;
          sumWE[slot][gi] += m; cntWE[slot][gi]++;
          if (!extra) { sumNE[slot][gi] += m; cntNE[slot][gi]++; }
        }
      }
      rows++;
      if (rows % 200_000 === 0) process.stdout.write(`  [${spec.key}] ${rows} rows\r`);
    }
    process.stdout.write(`  [${spec.key}] ${rows} rows\n`);

    // 把每组的和/计数收敛成平均 → 量化 → 灌进合并池 + 逐项目直方图。
    const mv = ensureVariant(mergedVariants, spec.key, spec.stages);
    for (let si = 0; si < nStage; si++) {
      const stage = spec.stages[si];
      for (let ki = 0; ki < nSub; ki++) {
        const subKey = SUBSET_KEYS[ki];
        const slot = si * nSub + ki;
        const sNE = sumNE[slot], cNE = cntNE[slot], sWE = sumWE[slot], cWE = cntWE[slot];
        const mergedSub = mv.data[stage][subKey];
        for (let gi = 0; gi < numGroups; gi++) {
          const ev = groupEvent[gi];
          if (cWE[gi] >= MIN_GROUP) {
            const key = Math.round((sWE[gi] / cWE[gi]) * AVG_DENOM);
            bumpHist(mergedSub.we, key);
            let evStore = eventVariants.get(ev); if (!evStore) { evStore = {}; eventVariants.set(ev, evStore); }
            bumpHist(ensureVariant(evStore, spec.key, spec.stages).data[stage][subKey].we, key);
            mergedGroupsSeen.add(gi);
            let egs = eventGroupsSeen.get(ev); if (!egs) { egs = new Set(); eventGroupsSeen.set(ev, egs); } egs.add(gi);
          }
          if (cNE[gi] >= MIN_GROUP) {
            const key = Math.round((sNE[gi] / cNE[gi]) * AVG_DENOM);
            bumpHist(mergedSub.ne, key);
            const evStore = eventVariants.get(ev)!;
            bumpHist(ensureVariant(evStore, spec.key, spec.stages).data[stage][subKey].ne, key);
          }
        }
      }
    }
  }

  const serializeVariants = (store: Record<string, VariantAvg>) => {
    const out: Record<string, unknown> = {};
    for (const [vk, v] of Object.entries(store)) {
      const data: Record<string, Record<string, { ne: ReturnType<typeof histToJson>; we: ReturnType<typeof histToJson> }>> = {};
      for (const st of v.stages) {
        data[st] = {};
        for (const key of SUBSET_KEYS) {
          const sh = v.data[st][key];
          data[st][key] = { ne: histToJson(sh.ne), we: histToJson(sh.we) };
        }
      }
      out[vk] = { stages: v.stages, data };
    }
    return out;
  };

  outSets[setSpec.key] = {
    label: setSpec.label,
    label_zh: setSpec.label_zh ?? null,
    sample_count: mergedGroupsSeen.size,
    variants: serializeVariants(mergedVariants),
  };

  const evKeys = [...eventVariants.keys()].sort();
  for (const ev of evKeys) {
    outSets[`${setSpec.key}_${ev}`] = {
      label: `${setSpec.label} ${ev}`,
      label_zh: setSpec.label_zh ? `${setSpec.label_zh} ${ev}` : null,
      event: ev,
      sample_count: eventGroupsSeen.get(ev)?.size ?? 0,
      variants: serializeVariants(eventVariants.get(ev)!),
    };
  }
  console.log(`  per-event avg sets: ${evKeys.map((e) => `${e}(${eventGroupsSeen.get(e)?.size ?? 0})`).join(', ')}`);
}

async function main() {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const pkgRoot = path.resolve(here, '..');
  const repoRoot = path.resolve(pkgRoot, '..', '..', '..');
  const configPath = path.join(pkgRoot, 'config.yml');
  if (!fs.existsSync(configPath)) { console.error(`config.yml not found at ${configPath}`); process.exit(1); }
  const config = YAML.parse(fs.readFileSync(configPath, 'utf-8')) as RawConfig;
  const sets = resolveSets(config);

  const generatedAt = process.env.SCRAMBLE_STATS_STAMP || new Date().toISOString();
  const outSets: Record<string, unknown> = {};
  for (const setSpec of sets) {
    // 组平均只对有比赛分组元数据(split_mbf)的 WCA set 有意义;合成打乱集(xcross)跳过。
    const metaCsv = path.join(path.dirname(setSpec.csv_dir), 'input', 'wca_scrambles_split_mbf.csv');
    if (!fs.existsSync(metaCsv)) { console.log(`\n[skip] set '${setSpec.key}': no split_mbf meta (synthetic set, no comp grouping)`); continue; }
    await processSet(setSpec, metaCsv, outSets);
  }

  const outDir = path.join(repoRoot, 'stats', 'scramble');
  fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, 'distribution_avg.json');
  fs.writeFileSync(outPath, JSON.stringify({ meta: { generated_at: generatedAt, avg_denom: AVG_DENOM, subset_keys: SUBSET_KEYS }, sets: outSets }));
  console.log(`\nWrote ${outPath} (${(fs.statSync(outPath).size / 1024).toFixed(1)} KB)`);
}

main().catch((err) => { console.error(err); process.exit(1); });
