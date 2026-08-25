// 打乱难度「首次出现」时间线数据生成。
//
// 对每个 (set, variant, stage, subset, bin=步数) 找出**最早**出现该步数的那条打乱:
//   排序键 = (比赛开始日期 升序, 打乱 final_id 升序)。
//   日期相同则按 final_id —— 同场比赛内 id 连续递增 ≈ 打乱编号顺序,跨场同日则较早导入的 id 较小。
//   无日期的比赛(极少, 多为未来/取消)排在最后。
//
// 输出 stats/scramble/difficulty_first_appearance.json (顶层 set) + 每项目分片
//   difficulty_first_appearance_<set>_<event>.json。
// 每条 = [id, scramble, color](与 examples.json 的 Sample 同形),配 comps / idMeta,
//   前端 TimelineView 直接复用 examples 的渲染(Flag / 比赛名 / 轮次 / 2D 图)。
//
// 仅对有 split_mbf(WCA 来源)的 set 生成;合成打乱 set(xcross_*)无比赛来源 → 不产出。
import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';
import { fileURLToPath } from 'node:url';
import YAML from 'yaml';
import { dateDisplay } from './comp_date';
import {
  COLOR_LETTERS,
  VARIANTS,
  type VariantSpec,
  SUBSET_KEYS,
  buildStagePlans,
  type StagePlan,
} from './variants';

type Sample = [string, string, string]; // [id, scramble, color]
// 排序用:dateInt = YYYYMMDD (无日期 → Infinity);idNum = Number(final_id)
interface FirstEntry { dateInt: number; idNum: number; sample: Sample }

interface CompInfo { name: string; display: string; startInt: number }

// competitions.tsv: id\tname\tstart_date\tend_date → compId → { name, 日期展示串, 排序整数 }
async function loadCompInfo(tsvPath: string): Promise<Map<string, CompInfo>> {
  const map = new Map<string, CompInfo>();
  if (!fs.existsSync(tsvPath)) return map;
  const rl = readline.createInterface({ input: fs.createReadStream(tsvPath, 'utf-8'), crlfDelay: Infinity });
  let first = true;
  for await (const line of rl) {
    if (!line) continue;
    if (first) { first = false; continue; }
    const [id, name, start, end] = line.split('\t');
    const startInt = start && start !== 'NULL' ? Number(start.replaceAll('-', '')) : Infinity;
    map.set(id, { name, display: dateDisplay(start, end), startInt: Number.isFinite(startInt) ? startInt : Infinity });
  }
  return map;
}

async function loadScrambleMap(txtPath: string): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  const rl = readline.createInterface({ input: fs.createReadStream(txtPath, 'utf-8'), crlfDelay: Infinity });
  for await (const line of rl) {
    if (!line) continue;
    const i = line.indexOf(',');
    if (i === -1) continue;
    map.set(line.slice(0, i), line.slice(i + 1));
  }
  return map;
}

// split_mbf 流式 → id→排序日期整数 + id→项目。值 intern 省内存(1.3M 行)。
async function loadIdDateEvent(
  metaCsv: string,
  compInfo: Map<string, CompInfo>,
): Promise<{ idDate: Map<string, number>; idEvent: Map<string, string> }> {
  const idDate = new Map<string, number>();
  const idEvent = new Map<string, string>();
  const intern = new Map<string, string>();
  const rl = readline.createInterface({ input: fs.createReadStream(metaCsv, 'utf-8'), crlfDelay: Infinity });
  let first = true;
  for await (const line of rl) {
    if (!line) continue;
    if (first) { first = false; continue; }
    const c = line.split(',');
    const id = c[0] ?? '';
    if (!id) continue;
    const compId = c[2] ?? '';
    const ev = c[3] ?? '';
    idDate.set(id, compInfo.get(compId)?.startInt ?? Infinity);
    if (ev) {
      let iv = intern.get(ev);
      if (iv === undefined) { iv = ev; intern.set(ev, ev); }
      idEvent.set(id, iv);
    }
  }
  return { idDate, idEvent };
}

// 给定一组 winner id,流式扫 split_mbf 拿 comp/项目/轮次/组/序号/备打 → idMeta + comps
async function buildMeta(
  ids: Set<string>,
  metaCsv: string,
  compInfo: Map<string, CompInfo>,
): Promise<{ comps: Record<string, [string, string]>; idMeta: Record<string, [string, string, number, string, string, (0 | 1)]> }> {
  const comps: Record<string, [string, string]> = {};
  const idMeta: Record<string, [string, string, number, string, string, (0 | 1)]> = {};
  if (ids.size === 0) return { comps, idMeta };
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
    idMeta[id] = [ci, c[3], Number(c[7]), c[4], c[5], c[6] === '1' ? 1 : 0];
    if (!(ci in comps)) {
      const info = compInfo.get(ci);
      comps[ci] = info ? [info.name, info.display] : [ci, ''];
    }
  }
  return { comps, idMeta };
}

function better(a: FirstEntry, dateInt: number, idNum: number): boolean {
  // 当前候选 (dateInt, idNum) 是否比已记录的 a 更早
  return dateInt < a.dateInt || (dateInt === a.dateInt && idNum < a.idNum);
}

type StageData = Record<string, Record<string, Record<string, Sample>>>; // stage→subset→bin→sample
interface VariantOut { stages: string[]; data: StageData }

// 单变体单 set 聚合:返回合并池 + per-event 的 first-appearance
async function aggregateVariant(
  spec: VariantSpec,
  csvPath: string,
  scrambleMap: Map<string, string>,
  idDate: Map<string, number>,
  idEvent: Map<string, string>,
) {
  // stage→subset→bin→FirstEntry
  const best: Record<string, Record<string, Map<number, FirstEntry>>> = {};
  const byEvent = new Map<string, Record<string, Record<string, Map<number, FirstEntry>>>>();
  for (const stage of spec.stages) {
    best[stage] = {};
    for (const key of SUBSET_KEYS) best[stage][key] = new Map();
  }
  const evBucket = (ev: string) => {
    let b = byEvent.get(ev);
    if (!b) {
      b = {};
      for (const stage of spec.stages) { b[stage] = {}; for (const key of SUBSET_KEYS) b[stage][key] = new Map(); }
      byEvent.set(ev, b);
    }
    return b;
  };

  let plans = new Map<string, StagePlan>(); // 表头到达后由 buildStagePlans 填充
  const rl = readline.createInterface({ input: fs.createReadStream(csvPath, 'utf-8'), crlfDelay: Infinity });
  let header: string[] | null = null;
  let rows = 0;
  for await (const line of rl) {
    if (!line) continue;
    if (!header) { const h = line.split(','); header = h; plans = buildStagePlans(h, spec); continue; }
    const parts = line.split(',');
    const id = parts[0];
    const scramble = scrambleMap.get(id);
    if (scramble === undefined) continue;
    const dateInt = idDate.get(id) ?? Infinity;
    const idNum = Number(id);
    const ev = idEvent.get(id);
    const evBest = ev !== undefined ? evBucket(ev) : undefined;
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
          if (mask & (1 << i)) { if (vals[i] < m) { m = vals[i]; argi = i; } }
        }
        if (argi < 0) continue;
        const sample: Sample = [id, scramble, COLOR_LETTERS[argi]];
        const bm = best[stage][key];
        const cur = bm.get(m);
        if (!cur || better(cur, dateInt, idNum)) bm.set(m, { dateInt, idNum, sample });
        if (evBest) {
          const ebm = evBest[stage][key];
          const ecur = ebm.get(m);
          if (!ecur || better(ecur, dateInt, idNum)) ebm.set(m, { dateInt, idNum, sample });
        }
      }
    }
    rows++;
    if (rows % 200_000 === 0) process.stdout.write(`  [${spec.key}] ${rows} rows\r`);
  }
  process.stdout.write(`  [${spec.key}] ${rows} rows\n`);

  const toData = (b: Record<string, Record<string, Map<number, FirstEntry>>>): StageData => {
    const out: StageData = {};
    for (const stage of spec.stages) {
      out[stage] = {};
      for (const key of SUBSET_KEYS) {
        const bm = b[stage][key];
        if (bm.size === 0) continue;
        const obj: Record<string, Sample> = {};
        for (const bin of [...bm.keys()].sort((x, y) => x - y)) obj[String(bin)] = bm.get(bin)!.sample;
        out[stage][key] = obj;
      }
    }
    return out;
  };

  const eventData = new Map<string, StageData>();
  for (const [ev, b] of byEvent) eventData.set(ev, toData(b));
  return { merged: toData(best), eventData };
}

interface SetSpec { key: string; label: string; label_zh?: string; csv_dir: string; scrambles_txt: string }

function resolveSets(config: { sets?: Array<{ key: string; label: string; label_zh?: string; csv_dir: string; scrambles_txt?: string }>; csv_dir?: string; scrambles_txt?: string }): SetSpec[] {
  if (config.sets && config.sets.length > 0) {
    return config.sets.map((s) => ({
      key: s.key, label: s.label, label_zh: s.label_zh, csv_dir: s.csv_dir,
      scrambles_txt: s.scrambles_txt ?? path.join(path.dirname(s.csv_dir), 'wca_scrambles_no_wide_move.txt'),
    }));
  }
  if (!config.csv_dir) throw new Error('config.yml must define either `sets:` or `csv_dir:`');
  return [{ key: 'wca', label: 'WCA', csv_dir: config.csv_dir, scrambles_txt: config.scrambles_txt ?? path.join(path.dirname(config.csv_dir), 'wca_scrambles_no_wide_move.txt') }];
}

// 把一组变体输出里引用到的 id 全收集
function collectIds(variants: Record<string, VariantOut>, into: Set<string>) {
  for (const v of Object.values(variants))
    for (const stage of Object.values(v.data))
      for (const subset of Object.values(stage))
        for (const s of Object.values(subset)) into.add(s[0]);
}

async function main() {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const pkgRoot = path.resolve(here, '..');
  const repoRoot = path.resolve(pkgRoot, '..', '..', '..');
  const configPath = path.join(pkgRoot, 'config.yml');
  if (!fs.existsSync(configPath)) { console.error(`config.yml not found at ${configPath}`); process.exit(1); }
  const config = YAML.parse(fs.readFileSync(configPath, 'utf-8'));
  const sets = resolveSets(config);
  const outDir = path.join(repoRoot, 'stats', 'scramble');
  fs.mkdirSync(outDir, { recursive: true });
  const generatedAt = process.env.SCRAMBLE_STATS_STAMP || new Date().toISOString();

  const setsOut: Record<string, unknown> = {};
  const allComps: Record<string, [string, string]> = {};
  const allIdMeta: Record<string, [string, string, number, string, string, (0 | 1)]> = {};
  let shardsWritten = 0;

  for (const setSpec of sets) {
    const dataRoot = path.dirname(setSpec.csv_dir);
    const metaCsv = path.join(dataRoot, 'input', 'wca_scrambles_split_mbf.csv');
    if (!fs.existsSync(metaCsv)) {
      console.log(`=== Set ${setSpec.key}: no split_mbf → 无比赛来源, 跳过首次出现 ===`);
      continue;
    }
    console.log(`\n=== Set: ${setSpec.key} (${setSpec.label}) ===`);
    if (!fs.existsSync(setSpec.scrambles_txt)) throw new Error(`Missing scrambles txt: ${setSpec.scrambles_txt}`);

    console.log(`Loading competitions...`);
    const compInfo = await loadCompInfo(path.join(dataRoot, 'competitions.tsv'));
    const dated = [...compInfo.values()].filter((c) => Number.isFinite(c.startInt)).length;
    console.log(`  ${compInfo.size} comps (${dated} dated)`);
    console.log(`Loading scramble map...`);
    const scrambleMap = await loadScrambleMap(setSpec.scrambles_txt);
    console.log(`  ${scrambleMap.size} scrambles`);
    console.log(`Loading id→date/event...`);
    const { idDate, idEvent } = await loadIdDateEvent(metaCsv, compInfo);
    console.log(`  ${idDate.size} ids`);

    const mergedVariants: Record<string, VariantOut> = {};
    const eventVariants = new Map<string, Record<string, VariantOut>>();
    for (const spec of VARIANTS) {
      const csvPath = path.join(setSpec.csv_dir, spec.file);
      if (!fs.existsSync(csvPath)) { console.warn(`  [skip] ${spec.key}: missing ${spec.file}`); continue; }
      console.log(`Aggregating ${spec.key}...`);
      const { merged, eventData } = await aggregateVariant(spec, csvPath, scrambleMap, idDate, idEvent);
      mergedVariants[spec.key] = { stages: spec.stages, data: merged };
      for (const [ev, data] of eventData) {
        let bucket = eventVariants.get(ev);
        if (!bucket) { bucket = {}; eventVariants.set(ev, bucket); }
        bucket[spec.key] = { stages: spec.stages, data };
      }
    }

    // 顶层 set(合并池):进主文件
    const mergedIds = new Set<string>();
    collectIds(mergedVariants, mergedIds);
    const { comps, idMeta } = await buildMeta(mergedIds, metaCsv, compInfo);
    Object.assign(allComps, comps);
    Object.assign(allIdMeta, idMeta);
    setsOut[setSpec.key] = {
      label: setSpec.label,
      label_zh: setSpec.label_zh ?? null,
      event: null,
      variants: mergedVariants,
    };

    // per-event:各自分片(选了项目才懒加载)
    for (const [ev, variants] of [...eventVariants].sort((a, b) => a[0].localeCompare(b[0]))) {
      const ids = new Set<string>();
      collectIds(variants, ids);
      const meta = await buildMeta(ids, metaCsv, compInfo);
      const shardPath = path.join(outDir, `difficulty_first_appearance_${setSpec.key}_${ev}.json`);
      fs.writeFileSync(shardPath, JSON.stringify({
        meta: { generated_at: generatedAt },
        set: {
          label: `${setSpec.label} ${ev}`,
          label_zh: setSpec.label_zh ? `${setSpec.label_zh} ${ev}` : null,
          event: ev,
          variants,
        },
        comps: meta.comps,
        idMeta: meta.idMeta,
      }));
      shardsWritten++;
    }
    if (eventVariants.size > 0) console.log(`  ${eventVariants.size} per-event shards`);
  }

  const outPath = path.join(outDir, 'difficulty_first_appearance.json');
  fs.writeFileSync(outPath, JSON.stringify({
    meta: { generated_at: generatedAt },
    sets: setsOut,
    comps: allComps,
    idMeta: allIdMeta,
  }));
  console.log(`\nWrote ${outPath} (${(fs.statSync(outPath).size / 1024).toFixed(1)} KB)`);
  console.log(`Wrote ${shardsWritten} per-event shard(s)`);
}

main().catch((err) => { console.error(err); process.exit(1); });
