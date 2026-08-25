import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';
import { fileURLToPath } from 'node:url';
import YAML from 'yaml';
import { makeRng } from './prng';
import { dateDisplay } from './comp_date';
import {
  COLOR_LETTERS,
  type ColorLetter,
  VARIANTS,
  type VariantSpec,
  SUBSET_KEYS,
  buildStagePlans,
  type StagePlan,
} from './variants';

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
// 国家占比条(scramble_country_dist.json)每 (变体,阶段,底色,步数) 只留计数最高的前 N 个国家:
// 前端条只显 top12 + 由直方图总数补的「其他」,存 15 给点余量(可后续调 bar 段数免重灌)。
const TOP_COUNTRIES_DIST = 15;
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

// per-event 预览 reservoir(cap=K_PREVIEW,独立 rng —— 不消耗全局 rng,保证合并池采样
// 与未分桶时逐字节一致)
function reservoirAddK(r: Reservoir, s: Sample, cap: number, rngf: () => number) {
  r.seen++;
  if (r.samples.length < cap) { r.samples.push(s); return; }
  const j = Math.floor(rngf() * r.seen);
  if (j < cap) r.samples[j] = s;
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

// comp_countries.json: compId → WCA country_id(= wca_competitions.country_id;与前端 loadFlagData 同源)。
async function loadCompCountries(jsonPath: string): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  if (!fs.existsSync(jsonPath)) return map;
  const raw = JSON.parse(fs.readFileSync(jsonPath, 'utf-8')) as Record<string, string>;
  for (const [ci, country] of Object.entries(raw)) if (country) map.set(ci, country);
  return map;
}

// id → WCA event_id (split_mbf 第 4 列;c[2]=competition_id)。值 intern 到共享字符串省内存(1.3M 条)。
// 传 compCountries 时同趟建 id → country_id(c[2]→国家名),供国家占比聚合;缺则 idCountry 为空。
async function loadIdEventMap(
  metaCsv: string,
  compCountries?: Map<string, string>,
): Promise<{ idEvent: Map<string, string>; idCountry: Map<string, string> }> {
  const idEvent = new Map<string, string>();
  const idCountry = new Map<string, string>();
  const intern = new Map<string, string>();
  const internC = new Map<string, string>();
  const rl = readline.createInterface({ input: fs.createReadStream(metaCsv, 'utf-8'), crlfDelay: Infinity });
  let first = true;
  for await (const line of rl) {
    if (!line) continue;
    if (first) { first = false; continue; }
    const c = line.split(',');
    const id: string = c[0] ?? '';
    const raw: string = c[3] ?? '';
    if (!id || !raw) continue;
    let ev = intern.get(raw);
    if (ev === undefined) { ev = raw; intern.set(raw, raw); }
    idEvent.set(id, ev ?? raw);
    if (compCountries) {
      const ci: string = c[2] ?? '';
      const country = ci ? compCountries.get(ci) : undefined;
      if (country) {
        let cc = internC.get(country);
        if (cc === undefined) { cc = country; internC.set(country, country); }
        idCountry.set(id, cc);
      }
    }
  }
  return { idEvent, idCountry };
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
  extraIds?: Set<string>,
): Promise<{ comps: Record<string, [string, string]>; idMeta: Record<string, [string, string, number, string, string, (0 | 1)]> }> {
  const ids = new Set<string>(extraIds);
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

// idEvent(可选,仅 WCA set):id → WCA event_id。提供时额外按项目分桶出 per-event 直方图
// (六个三阶项目共用同一打乱器,分布理论上同形 —— 分桶是给 UI 按项目查看用,样本量各自缩水)。
// per-event 桶不做 reservoir 采样(示例 / 下载走合并池,客户端按 idMeta 过滤)。
// idCountry(可选,仅合并 WCA 池):id → country_id。提供时额外按 (阶段,底色,步数) 聚合各国计数,
// 每格留 top TOP_COUNTRIES_DIST → countryDist,供前端复用 StackedBar 画国家占比条 + 按国筛选。
async function aggregateVariant(spec: VariantSpec, csvPath: string, scrambleMap: Map<string, string>, idEvent?: Map<string, string>, idCountry?: Map<string, string>) {
  // 每个 (set,variant) 调用前把 RNG 重新 makeRng 到随 variant key 确定的种子: reservoir 采样只依赖本变体自身数据,
  // 不被上一个变体处理时的 rng() 次数带偏 -> 增量只改一个变体时, 其它变体/set 的示例样本不再 spurious churn。
  let seed = 0x9e3779b9 >>> 0;
  for (const ch of spec.key) seed = (Math.imul(seed, 31) + ch.charCodeAt(0)) >>> 0;
  rng = makeRng(seed);
  // NOTE: per stage → per subset key → Hist
  const byStage: Record<string, Record<string, Hist>> = {};
  // NOTE: per stage → per subset key → Map<binValue, Reservoir>
  const resByStage: Record<string, Record<string, Map<number, Reservoir>>> = {};
  // per event → per stage → per subset key → Hist(惰性建,事件集从数据发现)
  const byEvent: Map<string, Record<string, Record<string, Hist>>> = new Map();
  // per event → per stage → per subset → Map<bin, Reservoir>(cap=K_PREVIEW,只做预览示例)
  const evResByEvent: Map<string, Record<string, Record<string, Map<number, Reservoir>>>> = new Map();
  const evRowCount: Map<string, number> = new Map();
  // 独立 rng:event 采样不消耗全局 rng,合并池 reservoir 保持确定性不变
  let evSeed = 0x55aa55aa >>> 0;
  for (const ch of spec.key) evSeed = (Math.imul(evSeed, 33) + ch.charCodeAt(0)) >>> 0;
  const evRng = makeRng(evSeed);
  // per stage → per subset key → Map<bin, Map<country_id, count>>(仅合并 WCA 池,idCountry 提供时才填)
  const countryByStage: Record<string, Record<string, Map<number, Map<string, number>>>> = {};
  for (const stage of spec.stages) {
    byStage[stage] = {};
    resByStage[stage] = {};
    countryByStage[stage] = {};
    for (const key of SUBSET_KEYS) {
      byStage[stage][key] = newHist();
      resByStage[stage][key] = new Map();
      countryByStage[stage][key] = new Map();
    }
  }
  const eventBucket = (ev: string): Record<string, Record<string, Hist>> => {
    let b = byEvent.get(ev);
    if (!b) {
      b = {};
      const r: Record<string, Record<string, Map<number, Reservoir>>> = {};
      for (const stage of spec.stages) {
        b[stage] = {};
        r[stage] = {};
        for (const key of SUBSET_KEYS) { b[stage][key] = newHist(); r[stage][key] = new Map(); }
      }
      byEvent.set(ev, b);
      evResByEvent.set(ev, r);
    }
    return b;
  };

  // NOTE: 每个 subset key 预先映射成它包含的 6 角度列下标中的哪几个（bitmask）
  // 行内遍历时先读 6 角度值，再按 bitmask 取 min(plan 由 buildStagePlans 从表头算)
  let plans = new Map<string, StagePlan>();

  const stream = fs.createReadStream(csvPath, { encoding: 'utf-8' });
  const rl = readline.createInterface({ input: stream, crlfDelay: Infinity });

  let header: string[] | null = null;
  let sampleCount = 0;

  for await (const line of rl) {
    if (!line) continue;
    if (!header) {
      const h = line.split(',');
      header = h;
      plans = buildStagePlans(h, spec);
      continue;
    }

    const parts = line.split(',');
    // NOTE: parts[0] 是 id（全部变体首列均为整数 id）
    const id = parts[0];
    const scramble = scrambleMap.get(id);
    const ev = idEvent?.get(id);
    const evHists = ev !== undefined ? eventBucket(ev) : undefined;
    const country = idCountry?.get(id);
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
        if (evHists) bump(evHists[stage][key], m);
        if (country !== undefined) {
          const cm = countryByStage[stage][key];
          let bm = cm.get(m);
          if (!bm) { bm = new Map(); cm.set(m, bm); }
          bm.set(country, (bm.get(country) ?? 0) + 1);
        }
        if (scramble !== undefined && argi >= 0) {
          const bucketMap = resByStage[stage][key];
          let res = bucketMap.get(m);
          if (!res) { res = newRes(); bucketMap.set(m, res); }
          reservoirAdd(res, [id, scramble, COLOR_LETTERS[argi]]);
          if (ev !== undefined) {
            const evBucketMap = evResByEvent.get(ev)![stage][key];
            let evRes = evBucketMap.get(m);
            if (!evRes) { evRes = newRes(); evBucketMap.set(m, evRes); }
            reservoirAddK(evRes, [id, scramble, COLOR_LETTERS[argi]], K_PREVIEW, evRng);
          }
        }
      }
    }
    if (ev !== undefined) evRowCount.set(ev, (evRowCount.get(ev) ?? 0) + 1);
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

  // per-event 变体 JSON(counts only,无 example_bins → 前端自动隐藏下载)
  // + per-event 预览示例(K_PREVIEW 条/bin,落独立分片文件)
  const eventJson: Record<string, { sample_count: number; stages: string[]; data: Record<string, Record<string, ReturnType<typeof histToJson>>> }> = {};
  const eventPreviews: Record<string, Record<string, Record<string, Record<string, Sample[]>>>> = {};
  for (const [ev, hists] of byEvent) {
    const evData: Record<string, Record<string, ReturnType<typeof histToJson>>> = {};
    const evPrev: Record<string, Record<string, Record<string, Sample[]>>> = {};
    const evRes = evResByEvent.get(ev)!;
    for (const stage of spec.stages) {
      evData[stage] = {};
      evPrev[stage] = {};
      for (const key of SUBSET_KEYS) {
        evData[stage][key] = histToJson(hists[stage][key]);
        const bucketMap = evRes[stage][key];
        if (bucketMap.size === 0) continue;
        evPrev[stage][key] = {};
        for (const b of [...bucketMap.keys()].sort((a, z) => a - z)) {
          evPrev[stage][key][String(b)] = bucketMap.get(b)!.samples.slice(0, K_PREVIEW);
        }
      }
    }
    eventJson[ev] = {
      sample_count: evRowCount.get(ev) ?? 0,
      stages: spec.stages,
      data: evData,
    };
    eventPreviews[ev] = evPrev;
  }

  // 国家占比:每 (阶段,底色,步数) 取 top TOP_COUNTRIES_DIST 个国家 → countryDist[stage][subset][bin]={country:n}。
  // 仅 idCountry 提供(合并 WCA 池)时非空;空阶段/底色/bin 省略,前端缺则不画条。
  let countryDist: Record<string, Record<string, Record<string, Record<string, number>>>> | undefined;
  if (idCountry) {
    countryDist = {};
    for (const stage of spec.stages) {
      const sd: Record<string, Record<string, Record<string, number>>> = {};
      for (const key of SUBSET_KEYS) {
        const cm = countryByStage[stage][key];
        if (cm.size === 0) continue;
        const binOut: Record<string, Record<string, number>> = {};
        for (const [bin, acc] of cm) {
          const top = [...acc.entries()].sort((a, b) => b[1] - a[1]).slice(0, TOP_COUNTRIES_DIST);
          binOut[String(bin)] = Object.fromEntries(top);
        }
        if (Object.keys(binOut).length) sd[key] = binOut;
      }
      if (Object.keys(sd).length) countryDist[stage] = sd;
    }
    if (Object.keys(countryDist).length === 0) countryDist = undefined;
  }

  return {
    sampleCount,
    json: {
      sample_count: sampleCount,
      stages: spec.stages,
      data,
    },
    eventJson,
    eventPreviews,
    previewExamples,
    pickedReservoirs,
    countryDist,
  };
}

// 轮次代号 → 英文短名(对齐 client lib/comp-schedule.ts ROUND_TYPE_SHORT_EN;txt 是语言中立文件)
const ROUND_SHORT: Record<string, string> = {
  '0': 'Q', '1': 'R1', '2': 'R2', '3': 'R3',
  'b': 'BF', 'c': 'Final', 'd': 'R1', 'e': 'R2', 'f': 'Final', 'g': 'R3', 'h': 'Q',
};

// NOTE: 单个 bin 的 txt 下载文件；header 写明 variant/stage/subset/bin + 样本量;
// 主体 CSV 风格 id,scramble,bottom_color;WCA set 另带 competition,round 两列(meta 可得时)
function buildBinTxt(
  variantKey: string,
  stage: string,
  subsetKey: string,
  bin: number,
  res: { samples: Sample[]; seen: number },
  generatedAt: string,
  source: string,
  comps?: Record<string, [string, string]>,
  idMeta?: Record<string, [string, string, number, string, string, (0 | 1)]>,
): string {
  const withMeta = !!idMeta && Object.keys(idMeta).length > 0;
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
  lines.push(withMeta ? '# Columns: id,scramble,bottom_color,competition,round' : '# Columns: id,scramble,bottom_color');
  lines.push('');
  for (const [id, scr, color] of res.samples) {
    const m = idMeta?.[id];
    if (m) {
      const comp = comps?.[m[0]];
      const compDisp = comp ? `${comp[0]}${comp[1] ? ` (${comp[1]})` : ''}` : m[0];
      const round = ROUND_SHORT[m[3]] ?? m[3];
      const grp = m[4] ? ` ${m[4]}` : '';
      const tag = m[5] ? `E${m[2]}` : `#${m[2]}`;
      lines.push(`${id},${scr},${color},${compDisp},${m[1]} ${round}${grp} ${tag}`);
    } else {
      lines.push(`${id},${scr},${color}`);
    }
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
  // comp → country_id(前端 flag 用的同一份 stats/comp_countries.json);国家占比条聚合用,缺则不产。
  const compCountries = await loadCompCountries(path.join(repoRoot, 'stats', 'comp_countries.json'));
  console.log(`Loaded comp→country for ${compCountries.size} comps`);
  const setsOut: Record<string, unknown> = {};
  const examplesSetsOut: Record<string, unknown> = {};
  // 各国占比:setKey → variantKey → stage → subset → bin → {country:n}(仅有 comp meta 的合并 WCA 池非空)。
  const countryDistSets: Record<string, Record<string, unknown>> = {};
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

    // WCA set:加载 id→项目映射做 per-event 分桶(自造打乱 set 无 meta → 不分桶)
    const dataRoot = path.dirname(setSpec.csv_dir);
    const metaCsv = path.join(dataRoot, 'input', 'wca_scrambles_split_mbf.csv');
    let idEvent: Map<string, string> | undefined;
    let idCountry: Map<string, string> | undefined;
    if (fs.existsSync(metaCsv)) {
      console.log(`Loading id→event${compCountries.size ? '/country' : ''} map from ${metaCsv}`);
      ({ idEvent, idCountry } = await loadIdEventMap(metaCsv, compCountries.size ? compCountries : undefined));
      console.log(`  loaded ${idEvent.size} ids (${idCountry.size} with country)`);
    }

    const variantsOut: Record<string, unknown> = {};
    // variantKey → countryDist(该变体各 (阶段,底色,步数) 的 top 国家计数);仅合并 WCA 池非空。
    const countryVariantsOut: Record<string, unknown> = {};
    // per event → variantKey → 变体 JSON / 预览示例
    const eventVariantsOut: Map<string, Record<string, unknown>> = new Map();
    const eventExamplesOut: Map<string, Record<string, unknown>> = new Map();
    const eventMaxCount: Map<string, number> = new Map();
    const examplesOut: Record<string, unknown> = {};
    let maxCount = 0;
    // 下载 txt 延后到比赛 meta join 之后再写(行内带 competition/round 两列);此处只攒任务。
    const pendingTxts: Array<{
      variantKey: string; stage: string; subsetKey: string; bin: number;
      res: { samples: Sample[]; seen: number };
    }> = [];
    const downloadIds = new Set<string>();
    for (const spec of VARIANTS) {
      const csvPath = path.join(setSpec.csv_dir, spec.file);
      if (!fs.existsSync(csvPath)) {
        // 变体 CSV 尚未生成(如 f2leo / pseudo_f2leo 未 backfill)→ 跳过, 不进 distribution。
        // 前端 dropdown 数据驱动, 缺的变体自动不显示; 待 backfill 出 CSV 后重算即纳入。
        console.warn(`  [skip] ${spec.key}: missing CSV ${csvPath}`);
        continue;
      }
      console.log(`Aggregating ${spec.key} from ${csvPath}`);
      const { sampleCount, json, eventJson, eventPreviews, previewExamples, pickedReservoirs, countryDist } = await aggregateVariant(spec, csvPath, scrambleMap, idEvent, idCountry);
      variantsOut[spec.key] = json;
      examplesOut[spec.key] = previewExamples;
      if (countryDist) countryVariantsOut[spec.key] = countryDist;
      if (sampleCount > maxCount) maxCount = sampleCount;
      for (const [ev, evJson] of Object.entries(eventJson)) {
        let bucket = eventVariantsOut.get(ev);
        if (!bucket) { bucket = {}; eventVariantsOut.set(ev, bucket); }
        bucket[spec.key] = evJson;
        if (evJson.sample_count > (eventMaxCount.get(ev) ?? 0)) eventMaxCount.set(ev, evJson.sample_count);
        let exBucket = eventExamplesOut.get(ev);
        if (!exBucket) { exBucket = {}; eventExamplesOut.set(ev, exBucket); }
        exBucket[spec.key] = eventPreviews[ev];
      }

      for (const stage of Object.keys(pickedReservoirs)) {
        for (const subsetKey of Object.keys(pickedReservoirs[stage])) {
          const binMap = pickedReservoirs[stage][subsetKey];
          const binsSorted = Object.keys(binMap).map(Number).sort((a, b) => a - b);
          for (const bin of binsSorted) {
            const res = binMap[String(bin)];
            for (const s of res.samples) downloadIds.add(s[0]);
            pendingTxts.push({ variantKey: spec.key, stage, subsetKey, bin, res });
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
    if (Object.keys(countryVariantsOut).length) countryDistSets[setSpec.key] = countryVariantsOut;
    // per-event 子集:key = `${setKey}_${eventId}`,带 event 字段供前端区分
    // (前端数据集下拉只列无 event 字段的顶级 set;per-event set 由项目选择器路由)。
    // 无 examples / downloads —— 示例走合并池按 idMeta 项目过滤。
    const evKeys = [...eventVariantsOut.keys()].sort();
    for (const ev of evKeys) {
      setsOut[`${setSpec.key}_${ev}`] = {
        label: `${setSpec.label} ${ev}`,
        label_zh: setSpec.label_zh ? `${setSpec.label_zh} ${ev}` : null,
        event: ev,
        sample_count: eventMaxCount.get(ev) ?? 0,
        variants: eventVariantsOut.get(ev)!,
      };
    }
    if (evKeys.length > 0) {
      console.log(`  per-event sets: ${evKeys.map((e) => `${e}(${eventMaxCount.get(e)})`).join(', ')}`);
    }
    // 比赛 meta join(仅有 split_mbf 的 WCA set;自造打乱 set 无 → comps/idMeta 空):
    // 覆盖 示例预览 id + 全部下载样本 id,供 examples.json 与下载 txt 共用。
    let comps: Record<string, [string, string]> = {};
    let idMeta: Record<string, [string, string, number, string, string, (0 | 1)]> = {};
    if (fs.existsSync(metaCsv)) {
      console.log('Joining competition meta for examples + downloads...');
      ({ comps, idMeta } = await buildExampleCompMeta(examplesOut, metaCsv, path.join(dataRoot, 'competitions.tsv'), downloadIds));
      console.log(`  [examples] ${Object.keys(idMeta).length} ids across ${Object.keys(comps).length} comps`);
    }
    examplesSetsOut[setSpec.key] = { variants: examplesOut, comps, idMeta };

    // per-event 示例分片:examples_<setKey>_<event>.json,选了项目才懒加载。
    // 每片自带 comps/idMeta(只覆盖本片引用到的 id),shape 对齐 examples.json 的单个 set。
    for (const [ev, exVariants] of eventExamplesOut) {
      let shardComps: Record<string, [string, string]> = {};
      let shardIdMeta: Record<string, [string, string, number, string, string, (0 | 1)]> = {};
      if (fs.existsSync(metaCsv)) {
        ({ comps: shardComps, idMeta: shardIdMeta } = await buildExampleCompMeta(
          exVariants as Record<string, unknown>, metaCsv, path.join(dataRoot, 'competitions.tsv'),
        ));
      }
      const shardPath = path.join(outDir, `examples_${setSpec.key}_${ev}.json`);
      fs.writeFileSync(shardPath, JSON.stringify({
        meta: { generated_at: generatedAt },
        variants: exVariants,
        comps: shardComps,
        idMeta: shardIdMeta,
      }));
      console.log(`  [examples shard] ${path.basename(shardPath)} (${(fs.statSync(shardPath).size / 1024).toFixed(1)} KB, ${Object.keys(shardIdMeta).length} ids)`);
    }

    // 写每 bin 一个 txt;路径含 setKey 隔离不同 set
    const sourceLabel = path.basename(setSpec.scrambles_txt);
    for (const p of pendingTxts) {
      const txt = buildBinTxt(p.variantKey, p.stage, p.subsetKey, p.bin, p.res, generatedAt, sourceLabel, comps, idMeta);
      const filePath = path.join(downloadsDir, setSpec.key, p.variantKey, p.stage, `${p.subsetKey}_${p.bin}.txt`);
      fs.mkdirSync(path.dirname(filePath), { recursive: true });
      fs.writeFileSync(filePath, txt);
      txtFilesWritten++;
      txtTotalBytes += txt.length;
    }
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

  // 国家占比条数据(懒加载,点柱才拉;仅含有 comp meta 的合并 WCA 池)。缺 comp_countries → 不产,前端优雅降级。
  const cdPath = path.join(outDir, 'scramble_country_dist.json');
  if (Object.keys(countryDistSets).length) {
    fs.writeFileSync(cdPath, JSON.stringify({ meta: { generated_at: generatedAt }, sets: countryDistSets }));
    const cdSizeKB = (fs.statSync(cdPath).size / 1024).toFixed(1);
    console.log(`Wrote ${cdPath} (${cdSizeKB} KB)`);
  } else if (fs.existsSync(cdPath)) {
    fs.rmSync(cdPath);
  }

  console.log(`Wrote ${txtFilesWritten} per-bin txt files under ${downloadsDir} (${(txtTotalBytes / 1024).toFixed(1)} KB total)`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
