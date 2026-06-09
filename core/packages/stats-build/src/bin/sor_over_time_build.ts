// NOTE: SOR (Sum of Ranks) over-time builder
// 读 historical_ranks_build.ts 落盘的 historical_ranks_snapshot.copy.tsv(年末累积快照),
// 按 单次/平均 × 世界/大洲/国家 × 年 计算 SOR 排行榜,产出:
//   - stats/sor_over_time.json                     ← 索引(persons / scopes / years)
//   - stats/sor_over_time/world.json               ← { single: YearFrame[], average: YearFrame[] }
//   - stats/sor_over_time/continent/{Cont}.json
//   - stats/sor_over_time/country/{ISO2}.json
//   - output/historical_ranks/sor_historical_best.copy.tsv  ← 每人历史最高 SOR 名次(world+continent+country),CI 灌 PG 供主榜徽标 + 选手页 Σ 行
//
// 口径严格对齐生产主榜 wca_stats_extra_build.ts:
//   - SOR = Σ_17现役项目 ( 有名次 ? rank : 缺项罚分 ),罚分 = 该 scope 该项参与人数 + 1
//   - average:333mbf 无平均 → 整项跳过(不罚分),平均 SOR 只 16 项
//   - 名次并列取 standard competition ranking(并列共享低位)
//
// 用法(CI,builder 之后):
//   npx tsx src/bin/sor_over_time_build.ts
// 本地:
//   SNAP_TSV=.tmp/sor-feature/sor_snap.tsv OUT_DIR=packages/stats-build/output/historical_ranks \
//     npx tsx src/bin/sor_over_time_build.ts

import { createReadStream, createWriteStream, mkdirSync, writeFileSync, readFileSync, statSync, appendFileSync, existsSync } from 'fs';
import { createInterface } from 'readline';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// 17 现役 SOR 项目(对齐 wca_stats_extra_build.ts 的 ACTIVE_EVENTS)
const EVENTS = [
  '333', '222', '444', '555', '666', '777',
  '333bf', '333fm', '333oh',
  'minx', 'pyram', 'clock', 'skewb', 'sq1',
  '444bf', '555bf', '333mbf',
] as const;
const EV_SET = new Set<string>(EVENTS);
const NO_AVG = new Set<string>(['333mbf']); // 无平均的现役项目(平均 SOR 跳过)

const STORE_K = 15;   // 每年每 scope 存的榜单长度(前端只展示 10,留 buffer 给入场动画)
const MIN_COUNTRY_CUBERS = 10; // 国家被纳入 NR race 的门槛(某年活跃人数曾 ≥ 此值)

const OUT_DIR = process.env.OUT_DIR || resolve(__dirname, '../../output/historical_ranks');
const SNAP = process.env.SNAP_TSV || resolve(OUT_DIR, 'historical_ranks_snapshot.copy.tsv');
const COUNTRIES_TSV = process.env.COUNTRIES_TSV || resolve(OUT_DIR, 'wca_countries.copy.tsv');
const PERSONS_TSV = process.env.PERSONS_TSV || resolve(OUT_DIR, 'wca_persons.copy.tsv');
const COMPS_TSV = process.env.COMPS_TSV || resolve(OUT_DIR, 'wca_competitions.copy.tsv');
const STATS_DIR = process.env.STATS_DIR || resolve(__dirname, '../../../../../stats');
const SOR_DIR = resolve(STATS_DIR, 'sor_over_time');

// ── reference: country → {iso2, continent} + person → name ──
interface CountryInfo { iso2: string | null; continent: string; name: string }
function loadCountries(): Map<string, CountryInfo> {
  const m = new Map<string, CountryInfo>();
  for (const line of readFileSync(COUNTRIES_TSV, 'utf-8').split(/\r?\n/)) {
    if (!line) continue;
    const [id, iso2, name, contRaw] = line.split('\t');
    if (!id) continue;
    m.set(id, {
      iso2: iso2 && iso2 !== '\\N' ? iso2 : null,
      continent: (contRaw || '').replace(/^_/, ''), // "_Asia" → "Asia"
      name: name || id,
    });
  }
  return m;
}
function loadPersonNames(): Map<string, string> {
  const m = new Map<string, string>();
  for (const line of readFileSync(PERSONS_TSV, 'utf-8').split(/\r?\n/)) {
    if (!line) continue;
    const tab1 = line.indexOf('\t');
    if (tab1 < 0) continue;
    const wcaId = line.slice(0, tab1);
    const tab2 = line.indexOf('\t', tab1 + 1);
    const name = tab2 < 0 ? line.slice(tab1 + 1) : line.slice(tab1 + 1, tab2);
    m.set(wcaId, name);
  }
  return m;
}
// comp_id → 英文名(仅供 index.comps;缺失则前端回退显示 comp_id)
function loadCompNames(): Map<string, string> {
  const m = new Map<string, string>();
  if (!existsSync(COMPS_TSV)) {
    console.log(`[sor] WARN: ${COMPS_TSV} not found — comp names fall back to id`);
    return m;
  }
  for (const line of readFileSync(COMPS_TSV, 'utf-8').split(/\r?\n/)) {
    if (!line) continue;
    const tab = line.indexOf('\t');
    if (tab < 0) continue;
    m.set(line.slice(0, tab), line.slice(tab + 1));
  }
  return m;
}

// standard competition ranking(并列共享低位);入参须已按 sor asc + id asc 排好
interface Ranked { id: string; sor: number; rank: number }
function assignRanks(rows: Ranked[]): void {
  let prevSor = NaN, prevRank = 0;
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i]!;
    if (r.sor === prevSor) r.rank = prevRank;
    else { r.rank = i + 1; prevSor = r.sor; prevRank = r.rank; }
  }
}

interface FrameRow { p: string; v: number; r: number; c?: string }
interface YearFrame { y: number; rows: FrameRow[] }

async function streamLines(file: string, onLine: (cols: string[]) => void): Promise<void> {
  const rl = createInterface({ input: createReadStream(file, { encoding: 'utf-8' }), crlfDelay: Infinity });
  for await (const line of rl) {
    if (!line) continue;
    onLine(line.split('\t'));
  }
}

// 全局最高名次累积(跨两 metric):key = `${isAvg}\t${wcaId}` → {rank, year, total}
// total = 取得该最佳名次那一年的 SOR 名次总和(供主榜「历史最佳」列同时显示总和+排名)
const bestWorld = new Map<string, { rank: number; year: number; total: number }>();
const bestContinent = new Map<string, { rank: number; year: number; total: number }>();
const bestCountry = new Map<string, { rank: number; year: number; total: number }>();
function updateBest(map: Map<string, { rank: number; year: number; total: number }>, isAvg: boolean, id: string, rank: number, year: number, total: number) {
  const k = `${isAvg ? 1 : 0}\t${id}`;
  const cur = map.get(k);
  if (!cur || rank < cur.rank) map.set(k, { rank, year, total });
}

const personsInFrames = new Set<string>();        // 出现在任一榜单的人 → 进 index.persons
const personCountryInFrames = new Map<string, string>(); // wcaId → country_id(最后见)
const referencedComps = new Set<string>();        // 任一榜单行引用到的"最后贡献比赛" → 进 index.comps

// 输出:scope → { single: YearFrame[], average: YearFrame[] }
interface ScopeOut { single: YearFrame[]; average: YearFrame[] }
const worldOut: ScopeOut = { single: [], average: [] };
const continentOut = new Map<string, ScopeOut>(); // continent → out
const countryOut = new Map<string, ScopeOut>();    // iso2 → out
const countryMeta = new Map<string, { iso2: string; name: string }>(); // country_id → {iso2, name} (有数据的)
const continentSeen = new Set<string>();
const maxCountryCount = new Map<string, number>(); // country_id → 历年最大活跃人数

// 每 metric 处理(single 然后 average),逐 metric 重新流式读文件
async function processMetric(isAvg: boolean, countries: Map<string, CountryInfo>): Promise<void> {
  const metricKey = isAvg ? 'average' : 'single';
  // 该 metric 用的 rank 列下标
  const W = isAvg ? 9 : 6;   // *_world_rank
  const N = isAvg ? 10 : 7;  // *_country_rank
  const K = isAvg ? 11 : 8;  // *_continent_rank
  const CD = isAvg ? 15 : 12; // best_*_comp_id
  const DD = isAvg ? 16 : 13; // best_*_date(YYYY-MM-DD,取最晚的那场作"最后贡献比赛")

  // ── Pass A: 各 scope 各 (event, year) 参与人数(rank>0 计数) ──
  // fW: `${ev}|${yr}` → count;fK: `${ev}|${yr}|${cont}`;fN: `${ev}|${yr}|${ctry}`
  const fW = new Map<string, number>();
  const fK = new Map<string, number>();
  const fN = new Map<string, number>();
  const years = new Set<number>();
  await streamLines(SNAP, (c) => {
    const ev = c[0]!;
    if (!EV_SET.has(ev)) return;
    if (isAvg && NO_AVG.has(ev)) return;
    const wr = +c[W]!;
    if (!wr) return; // 该 metric 无成绩 → 不计入参与
    const yr = +c[1]!;
    years.add(yr);
    const ctry = c[5]!;
    const cont = countries.get(ctry)?.continent || '?';
    fW.set(`${ev}|${yr}`, (fW.get(`${ev}|${yr}`) || 0) + 1);
    fK.set(`${ev}|${yr}|${cont}`, (fK.get(`${ev}|${yr}|${cont}`) || 0) + 1);
    fN.set(`${ev}|${yr}|${ctry}`, (fN.get(`${ev}|${yr}|${ctry}`) || 0) + 1);
  });

  // totpen per scope/year = Σ_event (fieldcount + 1)
  const sortedYears = [...years].sort((a, b) => a - b);
  const totpenW = new Map<number, number>();
  const totpenK = new Map<string, number>(); // `${yr}|${cont}`
  const totpenN = new Map<string, number>(); // `${yr}|${ctry}`
  for (const yr of sortedYears) {
    let tw = 0;
    for (const ev of EVENTS) {
      if (isAvg && NO_AVG.has(ev)) continue;
      tw += (fW.get(`${ev}|${yr}`) || 0) + 1;
    }
    totpenW.set(yr, tw);
  }
  // continent / country totpen:对出现过的 (yr,group) 求 Σ_event(count+1)
  const groupContSeen = new Set<string>(); // `${yr}|${cont}`
  const groupCtrySeen = new Set<string>(); // `${yr}|${ctry}`
  for (const key of fK.keys()) { const [ev, yr, cont] = key.split('|'); groupContSeen.add(`${yr}|${cont}`); void ev; }
  for (const key of fN.keys()) { const [ev, yr, ctry] = key.split('|'); groupCtrySeen.add(`${yr}|${ctry}`); void ev; }
  for (const g of groupContSeen) {
    const [yrS, cont] = g.split('|'); const yr = +yrS!;
    let t = 0;
    for (const ev of EVENTS) { if (isAvg && NO_AVG.has(ev)) continue; t += (fK.get(`${ev}|${yr}|${cont}`) || 0) + 1; }
    totpenK.set(g, t);
  }
  for (const g of groupCtrySeen) {
    const [yrS, ctry] = g.split('|'); const yr = +yrS!;
    let t = 0;
    for (const ev of EVENTS) { if (isAvg && NO_AVG.has(ev)) continue; t += (fN.get(`${ev}|${yr}|${ctry}`) || 0) + 1; }
    totpenN.set(g, t);
  }

  // ── Pass B: 逐 (year, person) 累积 ──
  // 关键:per-row country/continent 可能不一致(选手当年换国籍 / 早期成绩挂旧国,
  // 如 2004JIAQ01 2006 的 333 挂 USA、其余挂 China)。必须按 country/continent 分桶累积,
  // 否则 nPen(逐行国的参与数)与 totpenN(主桶国的参与数)口径错配 → SOR 出负数。
  interface CtrySub { sum: number; pen: number; n: number }   // Σcr, Σ(fN+1), 命中项数
  interface ContSub { sum: number; pen: number }              // Σkr, Σ(fK+1)
  interface Acc {
    wSum: number; wPen: number;
    ctry: Map<string, CtrySub>; cont: Map<string, ContSub>;
    domCtry: string; domCont: string;
    lastDate: string; lastComp: string;
  }
  // byYear: Map<year, Map<wcaId, Acc>>
  const byYear = new Map<number, Map<string, Acc>>();
  for (const yr of sortedYears) byYear.set(yr, new Map());
  await streamLines(SNAP, (c) => {
    const ev = c[0]!;
    if (!EV_SET.has(ev)) return;
    if (isAvg && NO_AVG.has(ev)) return;
    const wr = +c[W]!;
    if (!wr) return;
    const yr = +c[1]!;
    const id = c[2]!;
    const ctry = c[5]!;
    const cont = countries.get(ctry)?.continent || '?';
    const cr = +c[N]!; // country rank
    const kr = +c[K]!; // continent rank
    const ym = byYear.get(yr)!;
    let a = ym.get(id);
    if (!a) { a = { wSum: 0, wPen: 0, ctry: new Map(), cont: new Map(), domCtry: '', domCont: '', lastDate: '', lastComp: '' }; ym.set(id, a); }
    a.wSum += wr; a.wPen += (fW.get(`${ev}|${yr}`) || 0) + 1;
    let cs = a.ctry.get(ctry); if (!cs) { cs = { sum: 0, pen: 0, n: 0 }; a.ctry.set(ctry, cs); }
    cs.sum += cr; cs.pen += (fN.get(`${ev}|${yr}|${ctry}`) || 0) + 1; cs.n++;
    let ks = a.cont.get(cont); if (!ks) { ks = { sum: 0, pen: 0 }; a.cont.set(cont, ks); }
    ks.sum += kr; ks.pen += (fK.get(`${ev}|${yr}|${cont}`) || 0) + 1;
    // "最后贡献 SOR 的那场":本 metric 计入项目里 PB 日期最晚的那场
    const date = c[DD];
    if (date && date !== '\\N' && date > a.lastDate) {
      a.lastDate = date;
      const comp = c[CD];
      a.lastComp = (comp && comp !== '\\N') ? comp : '';
    }
  });

  // ── 逐年排名 + emit ──
  for (const yr of sortedYears) {
    const ym = byYear.get(yr)!;
    // 每人定主国籍 = 当年命中项最多的 country(并列取 id 小);主大洲随主国籍走
    for (const a of ym.values()) {
      let dom = '', domN = -1;
      for (const [c, cs] of a.ctry) { if (cs.n > domN || (cs.n === domN && c < dom)) { domN = cs.n; dom = c; } }
      a.domCtry = dom;
      a.domCont = countries.get(dom)?.continent || '?';
    }
    // world
    {
      const rows: Ranked[] = [];
      for (const [id, a] of ym) rows.push({ id, sor: a.wSum + totpenW.get(yr)! - a.wPen, rank: 0 });
      rows.sort((x, y) => x.sor - y.sor || (x.id < y.id ? -1 : 1));
      assignRanks(rows);
      for (const r of rows) updateBest(bestWorld, isAvg, r.id, r.rank, yr, r.sor);
      pushFrame(worldOut[metricKey], yr, rows, ym);
    }
    // continent buckets(按主大洲;sub 只含该洲命中项 → 跨洲项自动落缺项罚分)
    {
      const buckets = new Map<string, Ranked[]>();
      for (const [id, a] of ym) {
        const cont = a.domCont;
        if (cont === '?' || cont === 'Multiple Continents') continue;
        const sub = a.cont.get(cont)!;
        const sor = sub.sum + totpenK.get(`${yr}|${cont}`)! - sub.pen;
        (buckets.get(cont) || buckets.set(cont, []).get(cont)!).push({ id, sor, rank: 0 });
      }
      for (const [cont, rows] of buckets) {
        rows.sort((x, y) => x.sor - y.sor || (x.id < y.id ? -1 : 1));
        assignRanks(rows);
        for (const r of rows) updateBest(bestContinent, isAvg, r.id, r.rank, yr, r.sor);
        continentSeen.add(cont);
        let out = continentOut.get(cont);
        if (!out) { out = { single: [], average: [] }; continentOut.set(cont, out); }
        pushFrame(out[metricKey], yr, rows, ym);
      }
    }
    // country buckets(按主国籍;sub 只含该国命中项 → 跨国项自动落缺项罚分)
    {
      const buckets = new Map<string, Ranked[]>();
      for (const [id, a] of ym) {
        const ctry = a.domCtry;
        if (!countries.get(ctry)?.iso2) continue; // 无 iso2(特殊地区)跳过
        const sub = a.ctry.get(ctry)!;
        const sor = sub.sum + totpenN.get(`${yr}|${ctry}`)! - sub.pen;
        (buckets.get(ctry) || buckets.set(ctry, []).get(ctry)!).push({ id, sor, rank: 0 });
      }
      for (const [ctry, rows] of buckets) {
        const info = countries.get(ctry)!;
        const iso2 = info.iso2!;
        maxCountryCount.set(ctry, Math.max(maxCountryCount.get(ctry) || 0, rows.length));
        rows.sort((x, y) => x.sor - y.sor || (x.id < y.id ? -1 : 1));
        assignRanks(rows);
        for (const r of rows) updateBest(bestCountry, isAvg, r.id, r.rank, yr, r.sor);
        countryMeta.set(ctry, { iso2, name: info.name });
        let out = countryOut.get(iso2);
        if (!out) { out = { single: [], average: [] }; countryOut.set(iso2, out); }
        pushFrame(out[metricKey], yr, rows, ym);
      }
    }
    byYear.set(yr, new Map()); // 释放该年
  }
  void STORE_K;
}

function pushFrame(arr: YearFrame[], yr: number, ranked: Ranked[], ym: Map<string, { domCtry: string; lastComp?: string }>): void {
  const rows: FrameRow[] = [];
  for (let i = 0; i < ranked.length && i < STORE_K; i++) {
    const r = ranked[i]!;
    const a = ym.get(r.id);
    const comp = a?.lastComp || undefined;
    rows.push({ p: r.id, v: r.sor, r: r.rank, c: comp });
    personsInFrames.add(r.id);
    if (a) personCountryInFrames.set(r.id, a.domCtry);
    if (comp) referencedComps.add(comp);
  }
  arr.push({ y: yr, rows });
}

async function main() {
  const t0 = Date.now();
  mkdirSync(SOR_DIR, { recursive: true });
  mkdirSync(resolve(SOR_DIR, 'continent'), { recursive: true });
  mkdirSync(resolve(SOR_DIR, 'country'), { recursive: true });

  const countries = loadCountries();
  const personNames = loadPersonNames();
  const compNames = loadCompNames();
  console.log(`[sor] countries=${countries.size} persons=${personNames.size} comps=${compNames.size}`);

  console.log('[sor] single...');
  await processMetric(false, countries);
  console.log('[sor] average...');
  await processMetric(true, countries);

  // ── 写 scope 文件 ──
  writeFileSync(resolve(SOR_DIR, 'world.json'), JSON.stringify(worldOut));
  for (const [cont, out] of continentOut) {
    writeFileSync(resolve(SOR_DIR, 'continent', `${cont.replace(/\s+/g, '_')}.json`), JSON.stringify(out));
  }
  let countryFiles = 0, countryDropped = 0;
  const countryList: Array<{ iso2: string; id: string; name: string }> = [];
  for (const [iso2, out] of countryOut) {
    // 找回 country_id(以 iso2 反查 meta)
    let meta: { iso2: string; name: string } | undefined;
    let cid = '';
    for (const [id, m] of countryMeta) if (m.iso2 === iso2) { meta = m; cid = id; break; }
    if (!meta) continue;
    if ((maxCountryCount.get(cid) || 0) < MIN_COUNTRY_CUBERS) { countryDropped++; continue; }
    writeFileSync(resolve(SOR_DIR, 'country', `${iso2}.json`), JSON.stringify(out));
    countryList.push({ iso2, id: cid, name: meta.name });
    countryFiles++;
  }

  // ── index ──
  const persons: Record<string, { name: string; country: string; iso2: string | null }> = {};
  for (const id of personsInFrames) {
    const ctry = personCountryInFrames.get(id) || '';
    persons[id] = {
      name: personNames.get(id) || id,
      country: ctry,
      iso2: countries.get(ctry)?.iso2 || null,
    };
  }
  const continentList = [...continentSeen].sort();
  countryList.sort((a, b) => a.name.localeCompare(b.name));
  // 被引用到的"最后贡献比赛" → id→name(缺名的省略,前端回退 id)
  const comps: Record<string, string> = {};
  let compMiss = 0;
  for (const id of referencedComps) {
    const n = compNames.get(id);
    if (n) comps[id] = n; else compMiss++;
  }
  const allYears = new Set<number>();
  for (const f of worldOut.single) allYears.add(f.y);
  const index = {
    id: 'sor_over_time',
    years: [...allYears].sort((a, b) => a - b),
    storeK: STORE_K,
    showN: 10,
    scopes: { world: true, continents: continentList, countries: countryList },
    comps,
    persons,
  };
  writeFileSync(resolve(STATS_DIR, 'sor_over_time.json'), JSON.stringify(index));
  console.log(`[sor] comps referenced=${referencedComps.size} named=${Object.keys(comps).length} missing=${compMiss}`);

  // ── best-rank TSV(world + continent + country)→ PG ──
  // 列:wca_id, is_avg, scope('world'|'continent'|'country'), best_rank, best_year, best_total
  const bestPath = resolve(OUT_DIR, 'sor_historical_best.copy.tsv');
  const bs = createWriteStream(bestPath);
  let bestRows = 0;
  for (const [k, v] of bestWorld) {
    const [isAvg, id] = k.split('\t');
    bs.write(`${id}\t${isAvg === '1'}\tworld\t${v.rank}\t${v.year}\t${v.total}\n`); bestRows++;
  }
  for (const [k, v] of bestContinent) {
    const [isAvg, id] = k.split('\t');
    bs.write(`${id}\t${isAvg === '1'}\tcontinent\t${v.rank}\t${v.year}\t${v.total}\n`); bestRows++;
  }
  for (const [k, v] of bestCountry) {
    const [isAvg, id] = k.split('\t');
    bs.write(`${id}\t${isAvg === '1'}\tcountry\t${v.rank}\t${v.year}\t${v.total}\n`); bestRows++;
  }
  await new Promise<void>((res) => bs.end(() => res()));

  // 追加 load 块到 historical_ranks 的 load.sql(builder 先写,这里追加)→ 同一 apply_load 通道灌库.
  // 表未灌前 server LEFT JOIN 返回 NULL;CREATE IF NOT EXISTS 自足(migration 0033 也建,双保险).
  const loadSqlPath = resolve(OUT_DIR, 'load.sql');
  if (existsSync(loadSqlPath)) {
    appendFileSync(loadSqlPath,
      `\n-- ── sor_historical_best(由 sor_over_time_build.ts 追加)──\n` +
      `CREATE TABLE IF NOT EXISTS sor_historical_best (\n` +
      `  wca_id VARCHAR(20) NOT NULL, is_avg BOOLEAN NOT NULL, scope VARCHAR(10) NOT NULL,\n` +
      `  best_rank INTEGER NOT NULL, best_year SMALLINT NOT NULL, best_total INTEGER,\n` +
      `  PRIMARY KEY (wca_id, is_avg, scope)\n);\n` +
      `ALTER TABLE sor_historical_best ADD COLUMN IF NOT EXISTS best_total INTEGER;\n` + // 旧表补列(CREATE IF NOT EXISTS 不会加列)
      `BEGIN;\nTRUNCATE sor_historical_best;\n` +
      `\\copy sor_historical_best (wca_id, is_avg, scope, best_rank, best_year, best_total) FROM 'sor_historical_best.copy.tsv';\n` +
      `COMMIT;\nANALYZE sor_historical_best;\n`,
    );
    console.log('[sor] appended sor_historical_best load block to load.sql');
  } else {
    console.log('[sor] WARN: load.sql not found in OUT_DIR — run historical_ranks_build first (best-rank not loaded)');
  }

  const idxMb = (statSync(resolve(STATS_DIR, 'sor_over_time.json')).size / 1024 / 1024).toFixed(2);
  console.log(`\n=== Done in ${((Date.now() - t0) / 1000).toFixed(1)}s ===`);
  console.log(`world + ${continentOut.size} continents + ${countryFiles} countries (dropped ${countryDropped} < ${MIN_COUNTRY_CUBERS} cubers)`);
  console.log(`index persons=${personsInFrames.size}  index=${idxMb}MB`);
  console.log(`best-rank rows=${bestRows.toLocaleString()}  → ${bestPath}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
