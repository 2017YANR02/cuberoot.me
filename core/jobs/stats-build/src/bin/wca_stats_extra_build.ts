// WCA stats extra builder — 一次性算 6 个 cubing.pro 风格 stats 的 PG TSV.
// 与 historical_ranks_build.ts 思路一致:逐 event 处理,保留必要的跨 event 聚合状态.
//
// 输入: MySQL `wca_developer_database` (CI runner / 本地)
// 输出: output/wca_stats_extra/*.copy.tsv + load.sql
//
// 用法:
//   NODE_OPTIONS='--expose-gc --max-old-space-size=12288' npx tsx src/bin/wca_stats_extra_build.ts

import mysql from 'mysql2/promise';
import { once } from 'node:events';
import { createWriteStream, mkdirSync, writeFileSync, readFileSync, statSync, readdirSync, rmSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { parse as parseYaml } from 'yaml';
import { computeMbfMo3 } from '../core/mbf_average.js';
import { computeChampionshipPodiums } from '../core/championship_podiums.js';
import {
  KINCH_EVENTS,
  averageKinchScoreX100,
  calculateKinchEvent,
} from '@cuberoot/shared/kinch';
import { calculateCompetitionStreak } from '@cuberoot/shared/pr-streak';
import { importTransactionStart, refreshTable } from '../pg-refresh.js';
import { mutationCapacityGuard, stagedCapacityGuard, deltaUploadPreflightSql } from '../pg-import-capacity.js';
import { digestFile, extractDelta, parseFingerprintSnapshot, planIncremental, FLAT_COLUMNS, PERSON_COLUMNS } from '../competition-fingerprints.js';
import { addCountryBest, rankCountryBests, type CountryBest } from '../core/result_country.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

// ── 当前 17 个官方项目(events.rank<900),固定顺序作为 ranks 数组下标 ──
const ACTIVE_EVENTS = [
  '333','222','444','555','666','777',
  '333bf','333fm','333oh',
  'minx','pyram','clock','skewb','sq1',
  '444bf','555bf','333mbf',
] as const;
type ActiveEvent = typeof ACTIVE_EVENTS[number];
const EVENT_INDEX = new Map<string, number>(ACTIVE_EVENTS.map((e, i) => [e, i]));
// 已废止但仍可查询的项目.person_ranks 数组在 ACTIVE_EVENTS 后追加这 4 项 → RANK_EVENTS(21).
// sum-of-ranks 选择器可勾选,但 total/events_done 只算 ACTIVE_EVENTS(默认榜单口径不变).
const CANCELLED_EVENTS = ['333ft', 'magic', 'mmagic', '333mbo'] as const;
const RANK_EVENTS = [...ACTIVE_EVENTS, ...CANCELLED_EVENTS] as const;

const CURRENT_YEAR = new Date().getUTCFullYear();
const YEAR_RANGE_START = 2003;

// caps —— 控制 TSV 大小
// wca_results_flat 已无 cap(全量 ~11M),country_filter 列也已删
const YEAR_RESULTS_WW_CAP = 200;
const YEAR_RESULTS_PER_COUNTRY_CAP = 30;
const SUCCESS_RATE_MIN_ATTEMPTED = 3;

// PG COPY TEXT 编码
function pgEsc(v: string | null | undefined): string {
  if (v == null) return '\\N';
  return String(v)
    .replace(/\\/g, '\\\\')
    .replace(/\t/g, '\\t')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\r');
}
function num(v: number | null | undefined): string {
  if (v == null) return '\\N';
  return String(v);
}
function bool(v: boolean): string { return v ? 't' : 'f'; }
function intArr(arr: (number | null)[]): string {
  // PG COPY 数组字面量 e.g. {1,2,NULL,4}
  return '{' + arr.map(x => x == null ? 'NULL' : String(x)).join(',') + '}';
}
function dateOrNull(v: Date | string | null | undefined): string {
  if (!v) return '\\N';
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  return String(v).slice(0, 10);
}

// 给排序好的列表分配 world/country/continent rank,并列同名次
// 一次遍历同时出 world / country / continent 三档名次(standard competition ranking,并列共享最低名次).
// continentOf(国→洲映射)可选:省略时 kr 退化为单桶(调用方忽略即可),向后兼容旧调用.
function assignRanks(
  list: Array<{ wcaId: string; val: number; country: string }>,
  continentOf?: Map<string, string>,
): Map<string, { wr: number; cr: number; kr: number }> {
  const out = new Map<string, { wr: number; cr: number; kr: number }>();
  let prevVal = -1, prevWr = 0;
  const ctry = new Map<string, { prev: number; rank: number; count: number }>();
  const cont = new Map<string, { prev: number; rank: number; count: number }>();
  list.forEach((it, i) => {
    let wr: number;
    if (it.val === prevVal) wr = prevWr;
    else { wr = i + 1; prevVal = it.val; prevWr = wr; }
    let cs = ctry.get(it.country);
    if (!cs) { cs = { prev: -1, rank: 0, count: 0 }; ctry.set(it.country, cs); }
    let cr: number;
    if (it.val === cs.prev) cr = cs.rank;
    else { cr = cs.count + 1; cs.prev = it.val; cs.rank = cr; }
    cs.count++;
    const ck = continentOf?.get(it.country) ?? '';
    let ks = cont.get(ck);
    if (!ks) { ks = { prev: -1, rank: 0, count: 0 }; cont.set(ck, ks); }
    let kr: number;
    if (it.val === ks.prev) kr = ks.rank;
    else { kr = ks.count + 1; ks.prev = it.val; ks.rank = kr; }
    ks.count++;
    out.set(it.wcaId, { wr, cr, kr });
  });
  return out;
}

// ── 类型 ──
interface Acc {
  best: number;        // 0 = 无
  avg: number;
  country: string;
  bestCompId: string;  // 最近一次刷出 best 时的 comp(同分用最早)
  avgCompId: string;
}
interface ResultRow {
  id: number;           // results.id
  pid: string;          // person_id
  best: number;
  average: number;
  countryId: string;    // 比赛时国籍(per result)
  compId: string;
  compDate: string;     // YYYY-MM-DD
  regSingleRecord: string | null;
  regAvgRecord: string | null;
  roundTypeId: string;
  formatId: string;
  pos: number;
  attempts: (number | null)[];  // 5 attempts inline(主 SQL 走 result_attempts GROUP_CONCAT 子查询)
}

// 维护 top-K 候选(简单全量收集后 sort 截断;K 小;比 heap 简单)
class TopK {
  private buf: ResultRow[] = [];
  constructor(private cap: number, private byAvg: boolean) {}
  add(r: ResultRow) {
    const v = this.byAvg ? r.average : r.best;
    if (v <= 0) return;
    this.buf.push(r);
  }
  finalize(): ResultRow[] {
    const v = (r: ResultRow) => this.byAvg ? r.average : r.best;
    this.buf.sort((a, b) => v(a) - v(b));
    if (this.buf.length > this.cap) this.buf.length = this.cap;
    return this.buf;
  }
}

async function main() {
  const t0 = Date.now();

  // ── DB ──
  let dbConfig: { host: string; username: string; password: string; database: string };
  if (process.env.MYSQL_HOST) {
    dbConfig = {
      host: process.env.MYSQL_HOST,
      username: process.env.MYSQL_USER ?? 'root',
      password: process.env.MYSQL_PASS ?? '',
      database: process.env.MYSQL_DB ?? 'wca_developer_database',
    };
  } else {
    dbConfig = parseYaml(readFileSync(resolve(__dirname, '../../database.yml'), 'utf-8'));
  }
  const conn = await mysql.createConnection({
    host: dbConfig.host,
    user: dbConfig.username,
    password: dbConfig.password,
    database: dbConfig.database,
    dateStrings: true,
  });

  const outDir = process.env.OUT_DIR || resolve(__dirname, '../../output/wca_stats_extra');
  // Remove stale outputs before generating the daily delta.
  rmSync(outDir, { recursive: true, force: true });
  mkdirSync(outDir, { recursive: true });
  console.log(`[out] ${outDir}`);

  // ── 1. Reference: continents/countries/persons/championships/comps ──
  console.log('[ref] loading reference data...');
  const [countries] = await conn.query<mysql.RowDataPacket[]>(
    `SELECT id, iso2, name, continent_id FROM countries`,
  );
  const continentOf = new Map<string, string>();
  const iso2Of = new Map<string, string>();
  for (const c of countries) {
    continentOf.set(c['id'] as string, c['continent_id'] as string);
    if (c['iso2']) iso2Of.set(c['id'] as string, (c['iso2'] as string).toUpperCase());
  }
  const [persons] = await conn.query<mysql.RowDataPacket[]>(
    `SELECT wca_id, name, country_id FROM persons WHERE sub_id = 1`,
  );
  const personCountry = new Map<string, string>();
  for (const p of persons) personCountry.set(p['wca_id'] as string, p['country_id'] as string);
  console.log(`  countries=${countries.length} persons=${persons.length}`);

  // ── 2. wca_competitions: 元数据 ──
  console.log('[comp] loading competitions...');
  // city_name / iso2:选手页「点亮城市」「去过的省份」要城市串,国旗要 iso2 —— 都从这张表出,
  // 免得前端再拉一份 comp JSON(选手页刻意不加载大表,见 PersonDetailClient 的 loadFlagData 注释).
  const [comps] = await conn.query<mysql.RowDataPacket[]>(
    `SELECT id, name, country_id, city_name, start_date, end_date FROM competitions`,
  );
  {
    const f = createWriteStream(resolve(outDir, 'wca_competitions.copy.tsv'));
    for (const c of comps) {
      f.write(
        `${pgEsc(c['id'] as string)}\t${pgEsc(c['name'] as string)}\t${pgEsc(c['country_id'] as string)}\t` +
        `${dateOrNull(c['start_date'] as string | Date | null)}\t${dateOrNull(c['end_date'] as string | Date | null)}\t` +
        `${pgEsc((c['city_name'] as string | null) ?? '')}\t${pgEsc(iso2Of.get(c['country_id'] as string) ?? '')}\n`,
      );
    }
    f.end();
  }
  // 比赛 → date / country / month (后续用)
  const compInfo = new Map<string, { country: string; startDate: string; year: number; month: number }>();
  for (const c of comps) {
    const sd = (c['start_date'] as string | null) ?? '';
    if (!sd) continue;
    const year = parseInt(sd.slice(0, 4), 10);
    const month = parseInt(sd.slice(5, 7), 10);
    compInfo.set(c['id'] as string, {
      country: c['country_id'] as string,
      startDate: sd,
      year,
      month,
    });
  }
  console.log(`  competitions=${comps.length}`);

  // Compare actual stored rows with generated rows, identically for every competition.
  const prevFpPath = process.env.PREV_FINGERPRINTS;
  if (!prevFpPath) throw new Error('PREV_FINGERPRINTS is required; automatic full imports are disabled');
  const previous = parseFingerprintSnapshot(readFileSync(prevFpPath, 'utf8'));
  const oldCompHash = new Map([...previous].filter(([, row]) => row.hash != null).map(([id, row]) => [id, row.hash!]));
  let oldFpSum = 0n;
  for (const h of oldCompHash.values()) oldFpSum += h;

  // ── 3. championships: 用于 grand_slam ──
  console.log('[champ] loading championships...');
  const [championships] = await conn.query<mysql.RowDataPacket[]>(
    `SELECT championship_type, competition_id FROM championships`,
  );
  // championship eligibility(多国共享 championship: greater_china 等);schema: (championship_type, eligible_country_iso2)
  const [eligibles] = await conn.query<mysql.RowDataPacket[]>(
    `SELECT championship_type, eligible_country_iso2 FROM eligible_country_iso2s_for_championship`,
  );
  // championship_type → list of eligible iso2
  const eligByType = new Map<string, string[]>();
  for (const e of eligibles) {
    const t = e['championship_type'] as string;
    const arr = eligByType.get(t) ?? [];
    arr.push((e['eligible_country_iso2'] as string).toUpperCase());
    eligByType.set(t, arr);
  }
  console.log(`  championships=${championships.length} eligibleTypes=${eligByType.size}`);

  // ── 3b. championship podiums: 选手页「锦标赛领奖台」(资格内重排名次,见 core/championship_podiums) ──
  console.log('[champ-podium] computing championship podiums...');
  const champPodiums = await computeChampionshipPodiums(
    conn,
    championships.map((ch) => ({
      championship_type: ch['championship_type'] as string,
      competition_id: ch['competition_id'] as string,
    })),
    continentOf, iso2Of, eligByType,
  );
  let champPodiumCount = 0;
  {
    const f = createWriteStream(resolve(outDir, 'wca_championship_podiums.copy.tsv'));
    for (const p of champPodiums) {
      f.write(
        `${pgEsc(p.wcaId)}\t${pgEsc(p.compId)}\t${pgEsc(p.eventId)}\t${pgEsc(p.level)}\t` +
        `${p.place}\t${p.best}\t${p.average}\t${intArr(p.attempts)}\t${pgEsc(p.singleRecord)}\t${pgEsc(p.averageRecord)}\n`,
      );
      champPodiumCount++;
    }
    f.end();
  }
  console.log(`  championship_podiums=${champPodiumCount}`);

  // ── 4. cohort: 每人首参赛年 + 首比赛 id/date ──
  console.log('[cohort] computing first-comp per person...');
  // ORDER BY date,迭代取首记录(MySQL 大数据排序 OK,~25M 行 按 (start_date, id) 索引 + 流式读)
  const firstComp = new Map<string, { compId: string; date: string; year: number }>();
  // 需要 ResultStream 流式 + 每人最早记录
  const [firstCompRows] = await conn.query<mysql.RowDataPacket[]>(`
    SELECT person_id, MIN(c.start_date) AS first_date
    FROM results r JOIN competitions c ON c.id = r.competition_id
    WHERE c.start_date IS NOT NULL
    GROUP BY person_id
  `);
  const personFirstDate = new Map<string, string>();
  for (const r of firstCompRows) {
    personFirstDate.set(r['person_id'] as string, r['first_date'] as string);
  }
  // 拿对应 comp_id:再 query 一次 join(或 in app filter)
  // 简单做法:per person 取 (start_date, id) 升序第一行 — group by + min 不带 comp_id
  // 用 subquery
  const [firstCompIdRows] = await conn.query<mysql.RowDataPacket[]>(`
    SELECT r.person_id, r.competition_id, c.start_date
    FROM results r JOIN competitions c ON c.id = r.competition_id
    WHERE c.start_date IS NOT NULL
    ORDER BY c.start_date ASC, r.competition_id ASC
  `);
  for (const r of firstCompIdRows) {
    const pid = r['person_id'] as string;
    if (firstComp.has(pid)) continue;
    const sd = r['start_date'] as string;
    firstComp.set(pid, {
      compId: r['competition_id'] as string,
      date: sd,
      year: parseInt(sd.slice(0, 4), 10),
    });
  }
  // 释放
  (firstCompRows as unknown as { length: number }).length = 0;
  (firstCompIdRows as unknown as { length: number }).length = 0;
  if (global.gc) global.gc();
  console.log(`  cohort persons=${firstComp.size}`);

  // ── 5. 主循环:每个 ACTIVE event 处理 results ──
  // 同时为每人 17 项跟踪 first_done_date(算 all_events_done)
  // personEventFirstDone[pid] = array of 17 dates (or '')
  const personEventFirstDone = new Map<string, string[]>();
  // total_comp_count per person(算 all_events_done 用)
  const personCompSet = new Map<string, Set<string>>();

  // success_rate accumulator: per (event, person)
  // event index → Map<pid, [solved, attempted]>
  // 全部 17 项还有非 ACTIVE_EVENTS 也要算成功率吗?用户截图显示有"三盲"(333bf),都是 ACTIVE.故只算 ACTIVE.
  const successAcc = new Map<string, Map<string, [number, number]>>();
  for (const ev of ACTIVE_EVENTS) successAcc.set(ev, new Map());

  // 输出 stream
  // 增量模式 delta 文件名故意不带 .copy.tsv 后缀:apply_load.sh 预检拒空 *.copy.tsv,
  // 而「无变动比赛」时 delta 合法为空(如同数据被重触发),不能让它触发预检 abort.
  const wrfFile = 'wca_results_flat_delta.tsv';
  const wrfSource = resolve(outDir, 'flat-source.tmp');
  const allTopStream = createWriteStream(wrfSource);
  const cohortStream = createWriteStream(resolve(outDir, 'wca_cohort_ranks.copy.tsv'));
  const grandSlamStream = createWriteStream(resolve(outDir, 'wca_grand_slam.copy.tsv'));
  let allTopCount = 0, cohortCount = 0, gsCount = 0;
  let fullTopTotal = 0; // 完整表应有行数(增量模式下 != allTopCount=delta 写入数)

  // wca_person_results:选手页专用「一条成绩一行」表(见循环内写入处的注释).
  // Generate source rows only on CI, then keep actual changed competitions.
  const wprFile = 'wca_person_results_delta.tsv';
  const wprSource = resolve(outDir, 'person-source.tmp');
  const personResultsStream = createWriteStream(wprSource);
  let wprCount = 0;
  let fullWprTotal = 0; // 完整表应有行数(delta 模式下 != wprCount)

  // 每人在所有 WCA 比赛 final round(roundTypeId='f'/'c')里取得过的最佳名次 (MIN pos>0).
  // 跨所有 event 累积. 0 = 从未在任何 final 拿过有效成绩.
  // wca_person_ranks.best_final_pos 用它,支撑"无牌"过滤 (>3) 和"殿军之王"(=4).
  const bestFinalPos = new Map<string, number>();

  // grand slam 累积 (per event):collect from finals at championship comps
  // 结构: gsAcc[(event, person)] = { worldChampComp, worldChampPos, contChampComp, contChampPos, natChampComp, natChampPos, hasWr }
  // 因为有的人可能多次出现,我们取 BEST(pos 最小)的那次.
  type GsEntry = {
    worldChampComp?: string; worldChampPos?: number;
    contChampComp?: string; contChampPos?: number;
    natChampComp?: string; natChampPos?: number;
    hasWrSingle: boolean; hasWrAvg: boolean;
  };

  // 每个 event 用一个 map
  // 跨 event 也保存(因为最后一次性输出)
  const gsAcc = new Map<string, Map<string, GsEntry>>(); // event -> pid -> entry
  for (const ev of ACTIVE_EVENTS) gsAcc.set(ev, new Map());

  // 三条腿取 championship podiums(3b,资格内重排名次)——与选手页「锦标赛领奖台」tab 同口径。
  // 决赛原始 pos≤3 会漏掉「外籍选手挤占原始前三」的本洲/本国选手(如 OC2022 三阶 Zemdegs 原始第 4、
  // 大洋洲资格内第 2),还会把 DNF 上台(best≤0)误计为领奖台。取 place 最小,平手取最早的比赛。
  {
    const legDate = (compId: string) => compInfo.get(compId)?.startDate ?? '9999-12-31';
    const better = (place: number, comp: string, curPos?: number, curComp?: string) =>
      curPos == null || place < curPos || (place === curPos && legDate(comp) < legDate(curComp!));
    for (const p of champPodiums) {
      const m = gsAcc.get(p.eventId);
      if (!m) continue; // 只 active 项目
      let g = m.get(p.wcaId);
      if (!g) { g = { hasWrSingle: false, hasWrAvg: false }; m.set(p.wcaId, g); }
      if (p.level === 'world') {
        if (better(p.place, p.compId, g.worldChampPos, g.worldChampComp)) { g.worldChampComp = p.compId; g.worldChampPos = p.place; }
      } else if (p.level.startsWith('_')) {
        if (better(p.place, p.compId, g.contChampPos, g.contChampComp)) { g.contChampComp = p.compId; g.contChampPos = p.place; }
      } else {
        // iso2 国家赛,或 greater_china 等多国 championship
        if (better(p.place, p.compId, g.natChampPos, g.natChampComp)) { g.natChampComp = p.compId; g.natChampPos = p.place; }
      }
    }
  }

  // person 当前 PB(用于 grand_slam 行的 best/avg 字段;最后从 concise_*_results 取也行)
  // 这里直接在事件循环里维护

  // 累积 PB(per event, per person):
  // accByEvent[event][pid] = Acc — 用于 cohort_ranks(全期累积) 和 grand_slam best/avg fill
  const accByEvent = new Map<string, Map<string, Acc>>();
  const countryBests = new Map<string, { single: Map<string, CountryBest>; avg: Map<string, CountryBest> }>();

  // ════════════ fun-stats 累加器 (port of cubingchina /results/statistics → wca_fs_*) ════════════
  // Derived statistics accumulate across all generated rows, independently of result deltas.
  // solve = value>0;attempt = value>-2 && value!=0(DNF=-1 算 attempt,DNS=-2/0/null 不算).
  const solveAttempt = (attempts: (number | null)[]): [number, number] => {
    let s = 0, a = 0;
    for (const v of attempts) { if (v == null) continue; if (v > 0) { s++; a++; } else if (v === -1) a++; }
    return [s, a];
  };
  // B 奖牌(pid\x1fcountry → event → [g,s,b]) + 名次(pid\x1fcountry → event → [pos2,pos4]).跨 event 聚合 → 顶层.
  const medalByPidEvent = new Map<string, Map<string, [number, number, number]>>();
  const placeAcc = new Map<string, Map<string, [number, number]>>();
  // D 纪录:per (pid\x1fcountry) 与 per comp → [wr,cr,nr].无 event 过滤(废止项也有纪录).
  const recPerson = new Map<string, [number, number, number]>();
  const recComp = new Map<string, [number, number, number]>();
  const recBump = (m: Map<string, [number, number, number]>, key: string, slot: number) => {
    let t = m.get(key); if (!t) { t = [0, 0, 0]; m.set(key, t); } t[slot]++;
  };
  const recTally = (marker: string | null, pid: string, country: string, compId: string) => {
    if (!marker) return;                                   // '' / null = 无纪录
    const slot = marker === 'WR' ? 0 : marker === 'NR' ? 2 : 1;  // 其余非空 = 洲纪录(AsR/ER/...)
    recBump(recPerson, pid + '\x1f' + country, slot);
    recBump(recComp, compId, slot);
  };
  // E 参赛 & 复原次数(无 event 过滤,所有 21 项都算).
  // E1/E2(选手比赛次数 / 赛事选手人数)不另存 Set,直接从 personCompSA 的 key 去重派生(省 ~1GB).
  const personCompSA = new Map<string, [number, number, string]>();  // pid\x1fcomp → [s,a,参赛时国家]
  const personYearSA = new Map<string, [number, number]>();  // pid\x1fcountry\x1fyear → [s,a] (E6)
  const prCompsByPerson = new Map<string, Set<string>>();     // 至少取得一项新 PB / 并列 PB 的比赛
  // 循环内逐 event 写出的 stream(misser per-event;best podiums per-event).
  const misserStream = createWriteStream(resolve(outDir, 'wca_fs_misser.copy.tsv'));
  const bestPodiumsStream = createWriteStream(resolve(outDir, 'wca_fs_best_podiums.copy.tsv'));
  let misserCount = 0, bestPodiumsCount = 0;

  // wca_competition_id 列表(已在 wca_competitions 写过)

  // 21 events including non-active(为 cohort_ranks / 全成绩排行 / person_ranks 废止项列也需要历史项)
  const ALL_KNOWN_EVENTS = RANK_EVENTS;

  for (const eventId of ALL_KNOWN_EVENTS) {
    const tev = Date.now();
    console.log(`[${eventId}] loading results...`);

    // attempts 通过 result_attempts 子查询(GROUP_CONCAT 拼一个 csv);
    // update_database.ts 已建 idx_ra_covering(result_id, attempt_number, value),per-row 走索引 seek.
    const [rows] = await conn.query<mysql.RowDataPacket[]>(`
      SELECT r.id, r.person_id, r.best, r.average, r.country_id, r.competition_id,
             r.regional_single_record, r.regional_average_record,
             r.round_type_id, r.format_id, r.pos,
             c.start_date AS sd,
             (SELECT GROUP_CONCAT(ra.value ORDER BY ra.attempt_number)
              FROM result_attempts ra WHERE ra.result_id = r.id) AS attempts_csv
      FROM results r
      JOIN competitions c ON c.id = r.competition_id
      JOIN round_types rt_order ON rt_order.id = r.round_type_id
      WHERE r.event_id = ? AND c.start_date IS NOT NULL
      ORDER BY c.start_date ASC, c.id ASC, rt_order.rank ASC, r.id ASC
    `, [eventId]);
    console.log(`  ${rows.length.toLocaleString()} results loaded (${Date.now() - tev}ms)`);

    // 转成精简 ResultRow(attempts inline,无需后续 lazy-fetch)
    const results: ResultRow[] = rows.map(r => {
      const csv = r['attempts_csv'] as string | null;
      const attempts: (number | null)[] = csv
        ? csv.split(',').map(s => s === '' ? null : parseInt(s, 10))
        : [];
      return {
        id: r['id'] as number,
        pid: r['person_id'] as string,
        best: r['best'] as number,
        average: r['average'] as number,
        countryId: r['country_id'] as string,
        compId: r['competition_id'] as string,
        compDate: (r['sd'] as string).slice(0, 10),
        regSingleRecord: r['regional_single_record'] as string | null,
        regAvgRecord: r['regional_average_record'] as string | null,
        roundTypeId: r['round_type_id'] as string,
        formatId: r['format_id'] as string,
        pos: r['pos'] as number,
        attempts,
      };
    });
    // 释放原始 rows
    (rows as unknown as { length: number }).length = 0;

    const isActive = EVENT_INDEX.has(eventId);
    const eventIdx = EVENT_INDEX.get(eventId);

    // ── (a) 累积 PB per person ──
    const acc = new Map<string, Acc>();
    const representedBests = { single: new Map<string, CountryBest>(), avg: new Map<string, CountryBest>() };
    countryBests.set(eventId, representedBests);

    // fun-stats per-event 累加器(每 event 重置;写出后丢弃):
    //   C misser: key=`${pid}\x1f${country}`(比赛时国籍);D2/podium: key=compId.
    const misserAcc = new Map<string, { best: number; avg: number; everFirst: boolean; everPodium: boolean; everRecS: boolean; everRecA: boolean }>();
    const podiumByComp = new Map<string, Array<{ pid: string; value: number; pos: number }>>();

    // ── (b) success_rate counters (only for active events) ──
    const sr = isActive ? successAcc.get(eventId)! : null;

    // ── (c) grand_slam 的 hasWr 收集(只 active 项目;三条腿来自 championship podiums) ──
    const gsForEvent = isActive ? gsAcc.get(eventId)! : null;

    // 主迭代
    for (const r of results) {
      const provenance = { wcaId: r.pid, country: r.countryId, compId: r.compId, date: r.compDate };
      addCountryBest(representedBests.single, { ...provenance, val: r.best });
      addCountryBest(representedBests.avg, { ...provenance, val: r.average });
      // accumulate PB
      let a = acc.get(r.pid);
      if (!a) {
        a = { best: 0, avg: 0, country: r.countryId, bestCompId: '', avgCompId: '' };
        acc.set(r.pid, a);
      }
      if ((r.best > 0 && (a.best === 0 || r.best <= a.best))
        || (r.average > 0 && (a.avg === 0 || r.average <= a.avg))) {
        let prComps = prCompsByPerson.get(r.pid);
        if (!prComps) { prComps = new Set(); prCompsByPerson.set(r.pid, prComps); }
        prComps.add(r.compId);
      }
      if (r.best > 0 && (a.best === 0 || r.best < a.best)) { a.best = r.best; a.bestCompId = r.compId; }
      if (r.average > 0 && (a.avg === 0 || r.average < a.avg)) { a.avg = r.average; a.avgCompId = r.compId; }
      a.country = r.countryId;

      // success_rate(只统计 best != 0,即 DNF/valid 都算 attempted,DNS=best=0 不算)
      if (sr) {
        if (r.best !== 0) {
          const cnt = sr.get(r.pid) ?? [0, 0];
          if (r.best > 0) cnt[0]++;
          cnt[1]++;
          sr.set(r.pid, cnt);
        }
      }

      // all_events_done: track first valid (best>0) date per person×event
      if (isActive && r.best > 0 && eventIdx != null) {
        let firstDones = personEventFirstDone.get(r.pid);
        if (!firstDones) {
          firstDones = new Array(ACTIVE_EVENTS.length).fill('');
          personEventFirstDone.set(r.pid, firstDones);
        }
        if (firstDones[eventIdx] === '' || r.compDate < firstDones[eventIdx]!) {
          firstDones[eventIdx] = r.compDate;
        }
      }
      // total_comp_count
      if (isActive) {
        let s = personCompSet.get(r.pid);
        if (!s) { s = new Set(); personCompSet.set(r.pid, s); }
        s.add(r.compId);
      }

      // All rows participate in the same content comparison. Only actual changed
      // competitions are retained in the upload; fullTopTotal validates the result.
      const rt = pgEsc(r.roundTypeId);
      const fm = pgEsc(r.formatId);
      if (r.best > 0) {
        fullTopTotal++;
        const tag = pgEsc(r.regSingleRecord ?? '');
        allTopStream.write(
          `${eventId}\t${bool(false)}\t${r.best}\t${pgEsc(r.pid)}\t${pgEsc(r.countryId)}\t${pgEsc(r.compId)}\t${r.compDate}\t${intArr(r.attempts)}\t${rt}\t${fm}\t${tag}\n`,
        );
        allTopCount++;
      }
      if (r.average > 0) {
        fullTopTotal++;
        const tag = pgEsc(r.regAvgRecord ?? '');
        allTopStream.write(
          `${eventId}\t${bool(true)}\t${r.average}\t${pgEsc(r.pid)}\t${pgEsc(r.countryId)}\t${pgEsc(r.compId)}\t${r.compDate}\t${intArr(r.attempts)}\t${rt}\t${fm}\t${tag}\n`,
        );
        allTopCount++;
      }
      // 333mbf / 333mbo 无官方平均:补一行 is_avg=true(value=非官方 Mo3),供 all-results 单项平均排名。
      // 仅 3 次全成功才有效;tag 留空(无官方纪录)。名次和走 sor 表,不取此行。
      // Generated row changes are detected by the same content comparison for every competition.
      if (eventId === '333mbf' || eventId === '333mbo') {
        const mo3 = computeMbfMo3(r.attempts.map(v => v ?? 0));
        if (mo3 > 0) {
          fullTopTotal++;
          allTopStream.write(
            `${eventId}\t${bool(true)}\t${mo3}\t${pgEsc(r.pid)}\t${pgEsc(r.countryId)}\t${pgEsc(r.compId)}\t${r.compDate}\t${intArr(r.attempts)}\t${rt}\t${fm}\t\n`,
          );
          allTopCount++;
        }
      }

      // ── wca_person_results:选手页专用,一条官方成绩一行(不拆单次/平均) ──
      // 与 wca_results_flat 的分工:那张表是排行榜口径 —— 只留 value>0、单次/平均拆两行、无 pos.
      // 选手页要的恰好是它扔掉的那部分:整轮 DNF 的轮次(此人 736 条里有 7 条)和轮次名次 pos
      // (里程碑首金/首银、成绩表名次列都要它).负值成绩绝不能混进 flat —— 全站排行榜都是
      // ORDER BY value ASC,-1 会排到世界第一 —— 所以另开一张,flat 一个字节不动.
      fullWprTotal++;
      {
        personResultsStream.write(
          `${pgEsc(r.pid)}\t${pgEsc(r.compId)}\t${r.compDate}\t${eventId}\t${rt}\t${fm}\t` +
          `${r.pos}\t${r.best}\t${r.average}\t${intArr(r.attempts)}\t` +
          `${pgEsc(r.regSingleRecord ?? '')}\t${pgEsc(r.regAvgRecord ?? '')}\n`,
        );
        wprCount++;
      }

      // Source rows are streamed on CI; never buffer a whole event's output.
      if (allTopStream.writableNeedDrain) await once(allTopStream, 'drain');
      if (personResultsStream.writableNeedDrain) await once(personResultsStream, 'drain');

      // best_final_pos: 跨 event 累积每人 final round 最佳名次.
      // 按那一轮的 format 决定排名值是否有效:
      //   format 'a'/'m' (avg of 5 / mean of 3) — 必须 average > 0,否则就算 single 有效也没真发牌
      //   format '1'/'2'/'3' (bo1/bo2/bo3) — 必须 best > 0
      // 小场决赛 DNF 也会拿到 pos<=3 兜底,这层判定把它们过滤掉.
      const isFinal = r.roundTypeId === 'c' || r.roundTypeId === 'f';
      const rankByAvg = r.formatId === 'a' || r.formatId === 'm';
      const validForMedal = rankByAvg ? r.average > 0 : r.best > 0;
      if (isFinal && r.pos > 0 && validForMedal) {
        const cur = bestFinalPos.get(r.pid);
        if (cur == null || r.pos < cur) bestFinalPos.set(r.pid, r.pos);
      }

      // grand_slam: 三条腿已在主循环前由 championship podiums 灌入(资格内重排),这里只补 hasWr。
      // hasWr — any time(不限 finals).从 acc 取/建 entry,与 podium 的 entry 合并
      if (gsForEvent && (r.regSingleRecord === 'WR' || r.regAvgRecord === 'WR')) {
        let g2 = gsForEvent.get(r.pid);
        if (!g2) { g2 = { hasWrSingle: false, hasWrAvg: false }; gsForEvent.set(r.pid, g2); }
        if (r.regSingleRecord === 'WR') g2.hasWrSingle = true;
        if (r.regAvgRecord === 'WR') g2.hasWrAvg = true;
      }

      // ════════════ fun-stats per-row 累加 ════════════
      // B 奖牌(finals + pos1-3 + best>0);单项榜限活跃 17,__all__ 含废止项 (对齐 cubingchina type=all).
      if (r.best > 0 && isFinal && r.pos >= 1 && r.pos <= 3) {
        const key = r.pid + '\x1f' + r.countryId;
        let em = medalByPidEvent.get(key);
        if (!em) { em = new Map(); medalByPidEvent.set(key, em); }
        let t = em.get(eventId); if (!t) { t = [0, 0, 0]; em.set(eventId, t); }
        t[r.pos - 1]!++;
      }
      // B 名次次数(全 round + best>0;pos 2/4;per-result 国籍).单项榜限活跃 17,__all__ 含废止项.
      if (r.best > 0 && (r.pos === 2 || r.pos === 4)) {
        const key = r.pid + '\x1f' + r.countryId;
        let em = placeAcc.get(key); if (!em) { em = new Map(); placeAcc.set(key, em); }
        let t = em.get(eventId); if (!t) { t = [0, 0]; em.set(eventId, t); }
        if (r.pos === 2) t[0]++; else t[1]++;
      }
      // B7 领奖台成绩(active + finals + pos1-3 + metric>0;per comp).333fm/盲拧/mbf 用 best,余用 average.
      if (isActive && isFinal && r.pos >= 1 && r.pos <= 3) {
        const bestType = (eventId === '333fm' || eventId === '333bf' || eventId === '444bf' || eventId === '555bf' || eventId === '333mbf');
        let metric: number;
        if (eventId === '333fm') {
          const cy = compInfo.get(r.compId)?.year ?? 9999;
          metric = (cy < 2014) ? r.best * 100 : (r.average === 0 ? r.best * 100 : r.average);
        } else metric = bestType ? r.best : r.average;
        if (metric > 0) {
          let arr = podiumByComp.get(r.compId);
          if (!arr) { arr = []; podiumByComp.set(r.compId, arr); }
          arr.push({ pid: r.pid, value: metric, pos: r.pos });
        }
      }
      // C misser(active;per-result 国籍;OR-in 三种排除 flag;best/avg = 该国籍下 MIN).
      if (isActive) {
        const key = r.pid + '\x1f' + r.countryId;
        let m = misserAcc.get(key);
        if (!m) { m = { best: 0, avg: 0, everFirst: false, everPodium: false, everRecS: false, everRecA: false }; misserAcc.set(key, m); }
        if (r.best > 0 && (m.best === 0 || r.best < m.best)) m.best = r.best;
        if (r.average > 0 && (m.avg === 0 || r.average < m.avg)) m.avg = r.average;
        if (isFinal && r.pos > 0 && r.best > 0) { if (r.pos === 1) m.everFirst = true; if (r.pos <= 3) m.everPodium = true; }
        if (r.regSingleRecord) m.everRecS = true;
        if (r.regAvgRecord) m.everRecA = true;
      }
      // D 纪录(无 event 过滤;per-result 国籍 + per comp).
      recTally(r.regSingleRecord, r.pid, r.countryId, r.compId);
      recTally(r.regAvgRecord, r.pid, r.countryId, r.compId);
      // E 参赛 & 复原(无 event 过滤;每行都计).
      {
        const [sR, aR] = solveAttempt(r.attempts);
        { const k = r.pid + '\x1f' + r.compId; let t = personCompSA.get(k); if (!t) { t = [0, 0, r.countryId]; personCompSA.set(k, t); } t[0] += sR; t[1] += aR; }
        { const yr = compInfo.get(r.compId)?.year; if (yr) { const k = r.pid + '\x1f' + r.countryId + '\x1f' + yr; let t = personYearSA.get(k); if (!t) { t = [0, 0]; personYearSA.set(k, t); } t[0] += sR; t[1] += aR; } }
      }
    }

    // ── fun-stats per-event 写出:C misser(每 (pid,country) 单次/平均各一行)──
    for (const [key, m] of misserAcc) {
      const sep = key.indexOf('\x1f');
      const pid = key.slice(0, sep), country = key.slice(sep + 1);
      if (m.best > 0) { misserStream.write(`${eventId}\t${bool(false)}\t${m.best}\t${pgEsc(pid)}\t${pgEsc(country)}\t${bool(m.everFirst)}\t${bool(m.everPodium)}\t${bool(m.everRecS)}\n`); misserCount++; }
      if (m.avg > 0)  { misserStream.write(`${eventId}\t${bool(true)}\t${m.avg}\t${pgEsc(pid)}\t${pgEsc(country)}\t${bool(m.everFirst)}\t${bool(m.everPodium)}\t${bool(m.everRecA)}\n`); misserCount++; }
      // H: 该国籍无有效平均却拿过 first/podium(如只比单次的轮夺冠) → 写 value=-1 哨兵行,
      //    让 world/continent 平均榜的 bool_or 排除对改国籍者仍生效;端点按 value>0 把哨兵剔出排名.
      else if (m.everFirst || m.everPodium) { misserStream.write(`${eventId}\t${bool(true)}\t-1\t${pgEsc(pid)}\t${pgEsc(country)}\t${bool(m.everFirst)}\t${bool(m.everPodium)}\t${bool(m.everRecA)}\n`); misserCount++; }
    }
    // ── B7 best podiums(每 comp,完整领奖台 count(pos)>=3;并列时 sum DISTINCT)──
    for (const [compId, arr] of podiumByComp) {
      if (arr.length < 3) continue;
      const tie = arr.length > 3;
      const sumValue = tie
        ? [...new Set(arr.map(e => e.value))].reduce((s, v) => s + v, 0)
        : arr.reduce((s, e) => s + e.value, 0);
      const slot = (pos: number) => arr.find(e => e.pos === pos);
      const p1 = slot(1), p2 = slot(2), p3 = slot(3);
      bestPodiumsStream.write(
        `${pgEsc(compId)}\t${eventId}\t${sumValue}\t` +
        `${pgEsc(p1?.pid ?? '')}\t${num(p1?.value ?? 0)}\t` +
        `${pgEsc(p2?.pid ?? '')}\t${num(p2?.value ?? 0)}\t` +
        `${pgEsc(p3?.pid ?? '')}\t${num(p3?.value ?? 0)}\t${bool(tie)}\n`,
      );
      bestPodiumsCount++;
    }

    // ── 写 wca_cohort_ranks(per cohort_year × event × is_avg) ──
    // 把 acc(每人当前累积 PB)按 cohort_year 分组,组内排名
    if (acc.size > 0) {
      const byCohort = new Map<number, Array<{ pid: string; best: number; avg: number; country: string }>>();
      for (const [pid, a] of acc) {
        const fc = firstComp.get(pid);
        if (!fc) continue;
        const cy = fc.year;
        let arr = byCohort.get(cy);
        if (!arr) { arr = []; byCohort.set(cy, arr); }
        arr.push({ pid, best: a.best, avg: a.avg, country: a.country });
      }
      for (const [cohortYear, arr] of byCohort) {
        // single
        const sList = arr.filter(x => x.best > 0).map(x => ({ wcaId: x.pid, val: x.best, country: x.country }));
        sList.sort((a, b) => a.val - b.val);
        const sRanks = assignRanks(sList);
        for (const it of sList) {
          const r = sRanks.get(it.wcaId)!;
          cohortStream.write(
            `${cohortYear}\t${eventId}\t${bool(false)}\t${pgEsc(it.wcaId)}\t${it.val}\t` +
            `${pgEsc(it.country)}\t${r.wr}\t${r.cr}\n`,
          );
          cohortCount++;
        }
        // average
        const aList = arr.filter(x => x.avg > 0).map(x => ({ wcaId: x.pid, val: x.avg, country: x.country }));
        aList.sort((a, b) => a.val - b.val);
        const aRanks = assignRanks(aList);
        for (const it of aList) {
          const r = aRanks.get(it.wcaId)!;
          cohortStream.write(
            `${cohortYear}\t${eventId}\t${bool(true)}\t${pgEsc(it.wcaId)}\t${it.val}\t` +
            `${pgEsc(it.country)}\t${r.wr}\t${r.cr}\n`,
          );
          cohortCount++;
        }
      }
    }

    // 保存 acc 给 grand_slam(后期填 best/avg)
    accByEvent.set(eventId, acc);

    console.log(`  ${eventId} done. acc=${acc.size} allTopCount=${allTopCount} (${Date.now() - tev}ms)`);
    if (global.gc) global.gc();
  }

  // ── 6. wca_grand_slam: 输出 ──
  console.log('[gs] writing grand_slam...');
  for (const ev of ACTIVE_EVENTS) {
    const m = gsAcc.get(ev)!;
    const acc = accByEvent.get(ev);
    for (const [pid, g] of m) {
      // 必须三场都 podium
      if (g.worldChampPos == null || g.contChampPos == null || g.natChampPos == null) continue;
      if (!(g.hasWrSingle || g.hasWrAvg)) continue;  // 至少一个 WR
      const a = acc?.get(pid);
      const country = personCountry.get(pid) ?? a?.country ?? '';
      const isOnlyFirst = g.worldChampPos === 1 && g.contChampPos === 1 && g.natChampPos === 1;
      grandSlamStream.write(
        `${pgEsc(pid)}\t${ev}\t${num(a?.best && a.best > 0 ? a.best : null)}\t${num(a?.avg && a.avg > 0 ? a.avg : null)}\t` +
        `${pgEsc(country)}\t${bool(g.hasWrSingle || g.hasWrAvg)}\t${bool(isOnlyFirst)}\t` +
        `${pgEsc(g.worldChampComp ?? null)}\t${num(g.worldChampPos)}\t` +
        `${pgEsc(g.contChampComp ?? null)}\t${num(g.contChampPos)}\t` +
        `${pgEsc(g.natChampComp ?? null)}\t${num(g.natChampPos)}\n`,
      );
      gsCount++;
    }
  }

  // ── 7. wca_success_rate: 写 ──
  console.log('[sr] writing success_rate...');
  const srStream = createWriteStream(resolve(outDir, 'wca_success_rate.copy.tsv'));
  let srCount = 0;
  for (const [eventId, m] of successAcc) {
    for (const [pid, [solved, attempted]] of m) {
      if (attempted < SUCCESS_RATE_MIN_ATTEMPTED) continue;
      const pctX = Math.round((solved / attempted) * 10000);
      const country = personCountry.get(pid) ?? '';
      srStream.write(
        `${eventId}\t${pgEsc(pid)}\t${pgEsc(country)}\t${solved}\t${attempted}\t${pctX}\n`,
      );
      srCount++;
    }
  }
  srStream.end();

  // ── 8. wca_all_events_done: 写 ──
  console.log('[aed] writing all_events_done...');
  const aedStream = createWriteStream(resolve(outDir, 'wca_all_events_done.copy.tsv'));
  let aedCount = 0;
  for (const [pid, firstDones] of personEventFirstDone) {
    const fc = firstComp.get(pid);
    if (!fc) continue;
    let doneCount = 0;
    let maxDate = '';
    for (const d of firstDones) {
      if (d) { doneCount++; if (d > maxDate) maxDate = d; }
    }
    const isDone = doneCount === ACTIVE_EVENTS.length;
    let achievementCompId = '';
    let daysToComplete: number | null = null;
    if (isDone && maxDate) {
      // 找哪场比赛是 maxDate 的(任一)
      // 用 personCompSet 的成员中 startDate=maxDate 的
      const compSet = personCompSet.get(pid);
      if (compSet) {
        for (const cid of compSet) {
          const ci = compInfo.get(cid);
          if (ci && ci.startDate === maxDate) { achievementCompId = cid; break; }
        }
      }
      const t1 = new Date(maxDate).getTime();
      const t0 = new Date(fc.date).getTime();
      daysToComplete = Math.floor((t1 - t0) / 86400000);
    }
    const country = personCountry.get(pid) ?? '';
    const totalComps = personCompSet.get(pid)?.size ?? 0;
    aedStream.write(
      `${pgEsc(pid)}\t${pgEsc(country)}\t${doneCount}\t${bool(isDone)}\t` +
      `${pgEsc(fc.compId)}\t${dateOrNull(fc.date)}\t` +
      `${pgEsc(achievementCompId || null)}\t${dateOrNull(isDone ? maxDate : null)}\t${num(daysToComplete)}\t${totalComps}\n`,
    );
    aedCount++;
  }
  aedStream.end();

  // ── 9. wca_person_ranks: 全项目排行 ──
  // 使用 accByEvent(per event PB)+ assignRanks 全球排名 → 每人 21 项(RANK_EVENTS)的 wr/cr 数组.
  // total_*/events_done 只算前 17 项(ACTIVE_EVENTS,默认榜单口径);后 4 项废止项只填数组,
  // 供 sum-of-ranks 子集 API 显式勾选时按需求和(见 server wca_stats_extra.ts).
  console.log('[pr] writing person_ranks...');
  // 先算每个 event(含废止项)的全球+国家 ranks(对所有人)
  const eventRanks: { single: Map<string, { wr: number; cr: number; kr: number; val: number }>; avg: Map<string, { wr: number; cr: number; kr: number; val: number }> }[] = [];
  // 也记录每个 event 的参赛人数(用作缺项默认 rank).world 总和用全球计数,
  // country 总和必须用"该国该项"计数(缺项 = 比该国倒数第一再差一名),否则国家榜罚分被全球量级放大.
  // continent 同理用"该洲该项"计数.
  const eventParticipantsSingle: number[] = [];
  const eventParticipantsAvg: number[] = [];
  const eventParticipantsCountrySingle: Map<string, number>[] = [];
  const eventParticipantsCountryAvg: Map<string, number>[] = [];
  const eventParticipantsContinentSingle: Map<string, number>[] = [];
  const eventParticipantsContinentAvg: Map<string, number>[] = [];
  for (let i = 0; i < RANK_EVENTS.length; i++) {
    const ev = RANK_EVENTS[i]!;
    const acc = accByEvent.get(ev) ?? new Map<string, Acc>();
    const sList: Array<{ wcaId: string; val: number; country: string }> = [];
    const aList: Array<{ wcaId: string; val: number; country: string }> = [];
    for (const [pid, a] of acc) {
      if (a.best > 0) sList.push({ wcaId: pid, val: a.best, country: a.country });
      if (a.avg > 0) aList.push({ wcaId: pid, val: a.avg, country: a.country });
    }
    sList.sort((x, y) => x.val - y.val);
    aList.sort((x, y) => x.val - y.val);
    const sRanks = assignRanks(sList, continentOf);
    const aRanks = assignRanks(aList, continentOf);
    const sMap = new Map<string, { wr: number; cr: number; kr: number; val: number }>();
    const aMap = new Map<string, { wr: number; cr: number; kr: number; val: number }>();
    for (const it of sList) sMap.set(it.wcaId, { ...sRanks.get(it.wcaId)!, val: it.val });
    for (const it of aList) aMap.set(it.wcaId, { ...aRanks.get(it.wcaId)!, val: it.val });
    eventRanks.push({ single: sMap, avg: aMap });
    eventParticipantsSingle.push(sList.length);
    eventParticipantsAvg.push(aList.length);
    const csMap = new Map<string, number>();
    const ksMap = new Map<string, number>();
    for (const it of sList) {
      csMap.set(it.country, (csMap.get(it.country) ?? 0) + 1);
      const ck = continentOf.get(it.country) ?? '';
      ksMap.set(ck, (ksMap.get(ck) ?? 0) + 1);
    }
    eventParticipantsCountrySingle.push(csMap);
    eventParticipantsContinentSingle.push(ksMap);
    const caMap = new Map<string, number>();
    const kaMap = new Map<string, number>();
    for (const it of aList) {
      caMap.set(it.country, (caMap.get(it.country) ?? 0) + 1);
      const ck = continentOf.get(it.country) ?? '';
      kaMap.set(ck, (kaMap.get(ck) ?? 0) + 1);
    }
    eventParticipantsCountryAvg.push(caMap);
    eventParticipantsContinentAvg.push(kaMap);
  }

  // ════════════ A 各地综合排行 (wca_fs_country_ranks + _meta) ════════════
  // 每 active event 取参赛时代表该国的最佳成绩对应的世界名次;缺项罚分为世界参赛人数+1.
  // sum = Σ_event ( 有成绩 ? min_world_rank : penalty ).avg 项 333mbf 不参与(无 average).
  let cscCount = 0;
  console.log('[fs-A] country sum-of-ranks...');
  {
    const csMinSingle: Map<string, number>[] = []; const csMinAvg: Map<string, number>[] = [];
    const csPenaltySingle: number[] = []; const csPenaltyAvg: number[] = [];
    const csPresentSingle: boolean[] = []; const csPresentAvg: boolean[] = [];
    for (const ev of ACTIVE_EVENTS) {
      for (const isAvg of [false, true]) {
        const ranked = rankCountryBests(countryBests.get(ev)![isAvg ? 'avg' : 'single'].values(), continentOf);
        const minima = new Map<string, number>();
        for (const [country, persons] of ranked.countries) {
          const record = persons.values().next().value!;
          minima.set(country, ranked.ranks(record).wr);
        }
        // A missing country must rank below every country's best, including a former representative's slower PB.
        const penalty = ranked.world.size + 1;
        const present = ranked.world.size > 0 && !(isAvg && ev === '333mbf');
        (isAvg ? csMinAvg : csMinSingle).push(present ? minima : new Map());
        (isAvg ? csPenaltyAvg : csPenaltySingle).push(present ? penalty : 0);
        (isAvg ? csPresentAvg : csPresentSingle).push(present);
      }
    }
    const cscStream = createWriteStream(resolve(outDir, 'wca_fs_country_ranks.copy.tsv'));
    const csPenaltyVec: { single: number[]; average: number[] } = { single: [], average: [] };
    const csAllPenalties: { single: number; average: number } = { single: 0, average: 0 };
    const emitCountrySor = (isAvg: boolean) => {
      const minByEv = isAvg ? csMinAvg : csMinSingle, penByEv = isAvg ? csPenaltyAvg : csPenaltySingle, presentByEv = isAvg ? csPresentAvg : csPresentSingle;
      const evIdxs: number[] = []; for (let i = 0; i < ACTIVE_EVENTS.length; i++) if (presentByEv[i]) evIdxs.push(i);
      const allPenalties = evIdxs.reduce((s, i) => s + penByEv[i]!, 0);
      const penVec: number[] = []; for (let i = 0; i < ACTIVE_EVENTS.length; i++) penVec.push(presentByEv[i] ? penByEv[i]! : 0);
      if (isAvg) { csPenaltyVec.average = penVec; csAllPenalties.average = allPenalties; } else { csPenaltyVec.single = penVec; csAllPenalties.single = allPenalties; }
      const countries = new Set<string>(); for (const i of evIdxs) for (const ctry of minByEv[i]!.keys()) countries.add(ctry);
      for (const ctry of countries) {
        let sum = allPenalties; const perEv: number[] = []; let eventsPresent = 0;
        for (let i = 0; i < ACTIVE_EVENTS.length; i++) {
          if (!presentByEv[i]) { perEv.push(0); continue; }
          const wr = minByEv[i]!.get(ctry);
          if (wr != null) { sum += wr - penByEv[i]!; perEv.push(wr); eventsPresent++; } else perEv.push(penByEv[i]!);
        }
        cscStream.write(`${bool(isAvg)}\t${pgEsc(ctry)}\t${sum}\t${eventsPresent}\t${intArr(perEv)}\n`); cscCount++;
      }
    };
    emitCountrySor(false); emitCountrySor(true);
    await new Promise<void>(res => cscStream.end(() => res()));
    const cscMetaStream = createWriteStream(resolve(outDir, 'wca_fs_country_ranks_meta.copy.tsv'));
    cscMetaStream.write(`${bool(false)}\t${intArr(csPenaltyVec.single)}\t${csAllPenalties.single}\n`);
    cscMetaStream.write(`${bool(true)}\t${intArr(csPenaltyVec.average)}\t${csAllPenalties.average}\n`);
    await new Promise<void>(res => cscMetaStream.end(() => res()));
    console.log(`  country_ranks=${cscCount} rows`);
  }

  // ════════════ D3 纪录现保持时间 (wca_fs_current_records) ════════════
  // 每 active event × is_avg 按成绩产生时的代表国独立取 world/各洲/各国 #1。
  // 国家、比赛和日期必须来自同一条成绩；不能将生涯 PB 套到当前国籍。
  let currCount = 0;
  console.log('[fs-D3] current records standing...');
  {
    const currStream = createWriteStream(resolve(outDir, 'wca_fs_current_records.copy.tsv'));
    for (const ev of ACTIVE_EVENTS) {
      for (const isAvg of [false, true]) {
        if (isAvg && ev === '333mbf') continue;
        const ranked = rankCountryBests(countryBests.get(ev)![isAvg ? 'avg' : 'single'].values(), continentOf);
        const emit = (scopeKind: string, scopeId: string, item: CountryBest | undefined) => {
          if (!item) return;
          const rk = ranked.ranks(item);
          currStream.write(
            `${ev}\t${bool(isAvg)}\t${scopeKind}\t${pgEsc(scopeId)}\t${pgEsc(item.wcaId)}\t${pgEsc(item.country)}\t${item.val}\t` +
            `${pgEsc(item.compId)}\t${dateOrNull(item.date)}\t${rk.wr}\t${rk.kr}\t${rk.cr}\n`,
          );
          currCount++;
        };
        emit('W', '', ranked.world.values().next().value);
        for (const [id, persons] of ranked.continents) emit('K', id, persons.values().next().value);
        for (const [id, persons] of ranked.countries) emit('N', id, persons.values().next().value);
      }
    }
    await new Promise<void>(res => currStream.end(() => res()));
    console.log(`  current_records=${currCount} rows`);
  }

  const prStream = createWriteStream(resolve(outDir, 'wca_person_ranks.copy.tsv'));
  let prCount = 0;
  // 收集所有人(任何 active event 出现过的)
  const allActivePids = new Set<string>();
  for (const ev of ACTIVE_EVENTS) {
    const acc = accByEvent.get(ev);
    if (acc) for (const pid of acc.keys()) allActivePids.add(pid);
  }

  // ── 9a. wca_kinch: Kinch 全能分(世界 / 大洲 / 国家三种纪录基准) ──
  // 只存三档总分供榜单分页。选手明细复用 wca_person_results + wca_fs_current_records
  // 在 API 中现算逐项分，避免把 9 组 17 项数组重复灌进 PG。
  if (KINCH_EVENTS.some((eventId, index) => eventId !== ACTIVE_EVENTS[index])) {
    throw new Error('KINCH_EVENTS must match ACTIVE_EVENTS order');
  }
  type KinchReference = {
    world: number;
    countries: Map<string, number>;
    continents: Map<string, number>;
  };
  const makeReferences = (bests: Map<string, CountryBest>): KinchReference => {
    const ranked = rankCountryBests(bests.values(), continentOf);
    return {
      world: ranked.world.values().next().value?.val ?? 0,
      countries: new Map([...ranked.countries].map(([id, persons]) => [id, persons.values().next().value!.val])),
      continents: new Map([...ranked.continents].map(([id, persons]) => [id, persons.values().next().value!.val])),
    };
  };
  const kinchReferences = ACTIVE_EVENTS.map(ev => ({
    single: makeReferences(countryBests.get(ev)!.single),
    average: makeReferences(countryBests.get(ev)!.avg),
  }));
  const kinchStream = createWriteStream(resolve(outDir, 'wca_kinch.copy.tsv'));
  let kinchCount = 0;
  for (const pid of allActivePids) {
    const country = personCountry.get(pid) ?? '';
    const continent = continentOf.get(country) ?? '';
    const scoreFor = (scope: 'world' | 'continent' | 'country') => {
      const scores = KINCH_EVENTS.map((eventId, index) => {
        const personal = accByEvent.get(eventId)?.get(pid);
        const refs = kinchReferences[index]!;
        const recordSingle = scope === 'world'
          ? refs.single.world
          : scope === 'continent'
            ? (refs.single.continents.get(continent) ?? 0)
            : (refs.single.countries.get(country) ?? 0);
        const recordAverage = scope === 'world'
          ? refs.average.world
          : scope === 'continent'
            ? (refs.average.continents.get(continent) ?? 0)
            : (refs.average.countries.get(country) ?? 0);
        return calculateKinchEvent({
          eventId,
          single: personal?.best ?? 0,
          average: personal?.avg ?? 0,
          recordSingle,
          recordAverage,
        });
      });
      return averageKinchScoreX100(scores);
    };
    kinchStream.write(
      `${pgEsc(pid)}\t${pgEsc(country)}\t${pgEsc(continent)}\t` +
      `${scoreFor('world')}\t${scoreFor('continent')}\t${scoreFor('country')}\n`,
    );
    kinchCount++;
  }
  await new Promise<void>(resolveEnd => kinchStream.end(() => resolveEnd()));

  for (const pid of allActivePids) {
    const country = personCountry.get(pid) ?? '';
    const continent = continentOf.get(country) ?? '';
    const bfp = bestFinalPos.get(pid) ?? 0;
    // single
    {
      const ranksW: number[] = new Array(RANK_EVENTS.length).fill(0);
      const ranksC: number[] = new Array(RANK_EVENTS.length).fill(0);
      const ranksK: number[] = new Array(RANK_EVENTS.length).fill(0);
      let totalW = 0, totalC = 0, totalK = 0, doneN = 0;
      for (let i = 0; i < ACTIVE_EVENTS.length; i++) {
        const r = eventRanks[i]!.single.get(pid);
        if (r) {
          ranksW[i] = r.wr;
          ranksC[i] = r.cr;
          ranksK[i] = r.kr;
          totalW += r.wr;
          totalC += r.cr;
          totalK += r.kr;
          doneN++;
        } else {
          // 缺项默认: participants+1 (world 用全球计数, country/continent 用该国/该洲该项计数)
          totalW += eventParticipantsSingle[i]! + 1;
          totalC += (eventParticipantsCountrySingle[i]!.get(country) ?? 0) + 1;
          totalK += (eventParticipantsContinentSingle[i]!.get(continent) ?? 0) + 1;
        }
      }
      // 废止项:只填数组,不计入 total/doneN
      for (let i = ACTIVE_EVENTS.length; i < RANK_EVENTS.length; i++) {
        const r = eventRanks[i]!.single.get(pid);
        if (r) { ranksW[i] = r.wr; ranksC[i] = r.cr; ranksK[i] = r.kr; }
      }
      // 21 项口径(含废止)名次和:独立按「有 rank 取 rank,否则该 scope 参赛人数+1」逐项累加,
      // 与 server 子集求和的 SQL CASE 表达式逐字节一致(不沿用 17 口径的 333mbf 跳过特例).
      let totalW21 = 0, totalC21 = 0, totalK21 = 0;
      for (let i = 0; i < RANK_EVENTS.length; i++) {
        const r = eventRanks[i]!.single.get(pid);
        if (r) { totalW21 += r.wr; totalC21 += r.cr; totalK21 += r.kr; }
        else {
          totalW21 += eventParticipantsSingle[i]! + 1;
          totalC21 += (eventParticipantsCountrySingle[i]!.get(country) ?? 0) + 1;
          totalK21 += (eventParticipantsContinentSingle[i]!.get(continent) ?? 0) + 1;
        }
      }
      prStream.write(
        `${pgEsc(pid)}\t${bool(false)}\t${pgEsc(country)}\t${doneN}\t${totalW}\t${totalC}\t${bfp}\t${intArr(ranksW)}\t${intArr(ranksC)}\t${pgEsc(continent)}\t${totalK}\t${totalW21}\t${totalC21}\t${totalK21}\t${intArr(ranksK)}\n`,
      );
      prCount++;
    }
    // average
    {
      const ranksW: number[] = new Array(RANK_EVENTS.length).fill(0);
      const ranksC: number[] = new Array(RANK_EVENTS.length).fill(0);
      const ranksK: number[] = new Array(RANK_EVENTS.length).fill(0);
      let totalW = 0, totalC = 0, totalK = 0, doneN = 0;
      for (let i = 0; i < ACTIVE_EVENTS.length; i++) {
        // 333mbf 没有 average — 跳过(填 0)
        if (ACTIVE_EVENTS[i] === '333mbf') {
          continue;  // 计入 totalW 时也跳过
        }
        const r = eventRanks[i]!.avg.get(pid);
        if (r) {
          ranksW[i] = r.wr;
          ranksC[i] = r.cr;
          ranksK[i] = r.kr;
          totalW += r.wr;
          totalC += r.cr;
          totalK += r.kr;
          doneN++;
        } else {
          totalW += eventParticipantsAvg[i]! + 1;
          totalC += (eventParticipantsCountryAvg[i]!.get(country) ?? 0) + 1;
          totalK += (eventParticipantsContinentAvg[i]!.get(continent) ?? 0) + 1;
        }
      }
      // 废止项 avg:只填数组(333mbo 无 average → map 空 → 留 0),不计入 total/doneN
      for (let i = ACTIVE_EVENTS.length; i < RANK_EVENTS.length; i++) {
        const r = eventRanks[i]!.avg.get(pid);
        if (r) { ranksW[i] = r.wr; ranksC[i] = r.cr; ranksK[i] = r.kr; }
      }
      // 21 项口径(含废止):同 single,统一「有 rank 取 rank,否则参赛人数+1」.
      // 无 average 的 333mbf/333mbo 此处按罚分 0+1 计入(全员同加,排名不变),与子集 SQL 一致;
      // 17 口径 total 的「跳过 333mbf」特例不带入 21 口径.
      let totalW21 = 0, totalC21 = 0, totalK21 = 0;
      for (let i = 0; i < RANK_EVENTS.length; i++) {
        const r = eventRanks[i]!.avg.get(pid);
        if (r) { totalW21 += r.wr; totalC21 += r.cr; totalK21 += r.kr; }
        else {
          totalW21 += eventParticipantsAvg[i]! + 1;
          totalC21 += (eventParticipantsCountryAvg[i]!.get(country) ?? 0) + 1;
          totalK21 += (eventParticipantsContinentAvg[i]!.get(continent) ?? 0) + 1;
        }
      }
      prStream.write(
        `${pgEsc(pid)}\t${bool(true)}\t${pgEsc(country)}\t${doneN}\t${totalW}\t${totalC}\t${bfp}\t${intArr(ranksW)}\t${intArr(ranksC)}\t${pgEsc(continent)}\t${totalK}\t${totalW21}\t${totalC21}\t${totalK21}\t${intArr(ranksK)}\n`,
      );
      prCount++;
    }
  }
  prStream.end();

  // ════════════ fun-stats 后处理写出器 (B 奖牌/名次, D1/D2 纪录, E 参赛&复原) ════════════
  console.log('[fs-BDE] writing medals/placements/records/solves...');
  const endStream = (s: ReturnType<typeof createWriteStream>) => new Promise<void>(res => s.end(() => res()));

  // B 奖牌(per pid×参赛时国家: 每 event 一行 + __all__ 汇总)
  const medalsStream = createWriteStream(resolve(outDir, 'wca_fs_medals.copy.tsv'));
  let medalsCount = 0;
  for (const [key, em] of medalByPidEvent) {
    const [pid, country] = key.split('\x1f') as [string, string];
    let ag = 0, asv = 0, ab = 0;
    for (const [ev, [g, s, b]] of em) {
      if (EVENT_INDEX.has(ev)) { medalsStream.write(`${pgEsc(pid)}\t${pgEsc(country)}\t${ev}\t${g}\t${s}\t${b}\n`); medalsCount++; }  // 单项榜仅活跃 17
      ag += g; asv += s; ab += b;  // __all__ 汇总含废止项
    }
    if (ag + asv + ab > 0) { medalsStream.write(`${pgEsc(pid)}\t${pgEsc(country)}\t__all__\t${ag}\t${asv}\t${ab}\n`); medalsCount++; }
  }
  await endStream(medalsStream);

  // B 名次次数(per pid\x1fcountry: 每 event×pos 一行 + __all__;per-result 国籍)
  const placeStream = createWriteStream(resolve(outDir, 'wca_fs_placements.copy.tsv'));
  let placeCount = 0;
  for (const [key, em] of placeAcc) {
    const sep = key.indexOf('\x1f'); const pid = key.slice(0, sep), country = key.slice(sep + 1);
    let all2 = 0, all4 = 0;
    for (const [ev, [p2, p4]] of em) {
      if (EVENT_INDEX.has(ev)) {  // 单项榜仅活跃 17
        if (p2 > 0) { placeStream.write(`${pgEsc(pid)}\t${pgEsc(country)}\t${ev}\t2\t${p2}\n`); placeCount++; }
        if (p4 > 0) { placeStream.write(`${pgEsc(pid)}\t${pgEsc(country)}\t${ev}\t4\t${p4}\n`); placeCount++; }
      }
      all2 += p2; all4 += p4;  // __all__ 汇总含废止项
    }
    if (all2 > 0) { placeStream.write(`${pgEsc(pid)}\t${pgEsc(country)}\t__all__\t2\t${all2}\n`); placeCount++; }
    if (all4 > 0) { placeStream.write(`${pgEsc(pid)}\t${pgEsc(country)}\t__all__\t4\t${all4}\n`); placeCount++; }
  }
  await endStream(placeStream);

  // D1 选手创纪录数(per pid\x1fcountry);D2 赛事创纪录数(per comp)
  const recPersonStream = createWriteStream(resolve(outDir, 'wca_fs_records_person.copy.tsv'));
  let recPersonCount = 0;
  for (const [key, [wr, cr, nr]] of recPerson) {
    const sep = key.indexOf('\x1f'); const pid = key.slice(0, sep), country = key.slice(sep + 1);
    recPersonStream.write(`${pgEsc(pid)}\t${pgEsc(country)}\t${wr}\t${cr}\t${nr}\t${wr * 10 + cr * 5 + nr}\n`); recPersonCount++;
  }
  await endStream(recPersonStream);
  const recCompStream = createWriteStream(resolve(outDir, 'wca_fs_records_comp.copy.tsv'));
  let recCompCount = 0;
  for (const [compId, [wr, cr, nr]] of recComp) {
    recCompStream.write(`${pgEsc(compId)}\t${pgEsc(compInfo.get(compId)?.country ?? '')}\t${wr}\t${cr}\t${nr}\t${wr * 10 + cr * 5 + nr}\n`); recCompCount++;
  }
  await endStream(recCompStream);

  // E3 个人单场复原(all person×comp);单趟遍历 personCompSA 同时折出
  //   E1 选手比赛次数(distinct comp / person)、E2 赛事选手人数(distinct person / comp)、
  //   E4 赛事总复原、E5 个人累积复原 —— 全派生,不另存 Set.
  const pcsStream = createWriteStream(resolve(outDir, 'wca_fs_person_comp_solves.copy.tsv'));
  let pcsCount = 0;
  const compSA = new Map<string, [number, number]>();         // E4: comp → [s,a]
  const personSA = new Map<string, [number, number]>();       // E5: pid×参赛时国家 → [s,a]
  const personCompCount = new Map<string, number>();          // E1: pid×参赛时国家 → distinct comp 数
  const compPersonCount = new Map<string, number>();          // E2: comp → distinct person 数
  const compsByPerson = new Map<string, string[]>();          // PR 连续场次:pid → 全部比赛
  for (const [key, [s, a, country]] of personCompSA) {
    const sep = key.indexOf('\x1f'); const pid = key.slice(0, sep), compId = key.slice(sep + 1);
    const representedPerson = pid + '\x1f' + country;
    pcsStream.write(`${pgEsc(pid)}\t${pgEsc(country)}\t${pgEsc(compId)}\t${s}\t${a}\n`); pcsCount++;
    { let t = compSA.get(compId); if (!t) { t = [0, 0]; compSA.set(compId, t); } t[0] += s; t[1] += a; }
    { let t = personSA.get(representedPerson); if (!t) { t = [0, 0]; personSA.set(representedPerson, t); } t[0] += s; t[1] += a; }
    personCompCount.set(representedPerson, (personCompCount.get(representedPerson) ?? 0) + 1);
    compPersonCount.set(compId, (compPersonCount.get(compId) ?? 0) + 1);
    const personComps = compsByPerson.get(pid);
    if (personComps) personComps.push(compId); else compsByPerson.set(pid, [compId]);
  }
  await endStream(pcsStream);
  // E1 选手比赛次数
  const pcStream = createWriteStream(resolve(outDir, 'wca_fs_person_comps.copy.tsv'));
  let pcCount = 0;
  for (const [key, n] of personCompCount) { const [pid, country] = key.split('\x1f'); pcStream.write(`${pgEsc(pid)}\t${pgEsc(country)}\t${n}\n`); pcCount++; }
  await endStream(pcStream);
  // E2 赛事选手人数
  const cpStream = createWriteStream(resolve(outDir, 'wca_fs_comp_persons.copy.tsv'));
  let cpCount = 0;
  for (const [compId, n] of compPersonCount) { cpStream.write(`${pgEsc(compId)}\t${pgEsc(compInfo.get(compId)?.country ?? '')}\t${n}\n`); cpCount++; }
  await endStream(cpStream);
  // E4 赛事总复原
  const csolvStream = createWriteStream(resolve(outDir, 'wca_fs_comp_solves.copy.tsv'));
  let csolvCount = 0;
  for (const [compId, [s, a]] of compSA) { csolvStream.write(`${pgEsc(compId)}\t${pgEsc(compInfo.get(compId)?.country ?? '')}\t${s}\t${a}\n`); csolvCount++; }
  await endStream(csolvStream);
  // E5 个人累积复原
  const psolvStream = createWriteStream(resolve(outDir, 'wca_fs_person_solves.copy.tsv'));
  let psolvCount = 0;
  for (const [key, [s, a]] of personSA) { const [pid, country] = key.split('\x1f'); psolvStream.write(`${pgEsc(pid)}\t${pgEsc(country)}\t${s}\t${a}\n`); psolvCount++; }
  await endStream(psolvStream);

  // E6 个人年度复原
  const pysStream = createWriteStream(resolve(outDir, 'wca_fs_person_year_solves.copy.tsv'));
  let pysCount = 0;
  for (const [key, [s, a]] of personYearSA) {
    const [pid, country, year] = key.split('\x1f');
    pysStream.write(`${pgEsc(pid)}\t${pgEsc(country)}\t${year}\t${s}\t${a}\n`); pysCount++;
  }
  await endStream(pysStream);

  const prStreakStream = createWriteStream(resolve(outDir, 'wca_pr_streaks.copy.tsv'));
  let prStreakCount = 0;
  for (const [pid, personComps] of compsByPerson) {
    personComps.sort((a, b) => {
      const dateOrder = (compInfo.get(a)?.startDate ?? '').localeCompare(compInfo.get(b)?.startDate ?? '');
      return dateOrder || a.localeCompare(b);
    });
    const { longest } = calculateCompetitionStreak(personComps, prCompsByPerson.get(pid) ?? new Set<string>());
    const country = personCountry.get(pid) ?? '';
    prStreakStream.write(`${pgEsc(pid)}\t${pgEsc(country)}\t${pgEsc(continentOf.get(country) ?? '')}\t${longest.length}\t${pgEsc(longest[0])}\t${pgEsc(longest.at(-1))}\n`);
    prStreakCount++;
  }
  await endStream(prStreakStream);
  console.log(`  fs: medals=${medalsCount} placements=${placeCount} recPerson=${recPersonCount} recComp=${recCompCount} ` +
    `personComps=${pcCount} compPersons=${cpCount} personCompSolves=${pcsCount} compSolves=${csolvCount} personSolves=${psolvCount} personYearSolves=${pysCount} ` +
    `misser=${misserCount} bestPodiums=${bestPodiumsCount}`);

  // ── flush 还在 buffer 的 stream ──
  await Promise.all([
    new Promise<void>(res => allTopStream.end(() => res())),
    new Promise<void>(res => personResultsStream.end(() => res())),
    new Promise<void>(res => cohortStream.end(() => res())),
    new Promise<void>(res => grandSlamStream.end(() => res())),
    new Promise<void>(res => misserStream.end(() => res())),
    new Promise<void>(res => bestPodiumsStream.end(() => res())),
  ]);
  await conn.end();

  const flatDigests = await digestFile(wrfSource, 5);
  const personDigests = await digestFile(wprSource, 1);
  const { changed: changedComps, hashes: compHash } = planIncremental(previous, flatDigests, personDigests);
  const compMaxCount = compHash.size;
  writeFileSync(resolve(outDir, 'wca_comp_updated_at.copy.tsv'), [...compHash].map(([id, hash]) => id + '\t' + hash + '\n').join(''));
  allTopCount = await extractDelta(wrfSource, resolve(outDir, wrfFile), 5, changedComps);
  wprCount = await extractDelta(wprSource, resolve(outDir, wprFile), 1, changedComps);
  console.log('[fp] actual-row comparison: old=' + previous.size + ' new=' + compHash.size + ' changed=' + changedComps.size);

  // ── 10. del-list (增量) + load.sql ──
  const wrfCols = FLAT_COLUMNS;
  const wprCols = PERSON_COLUMNS;

  // 防呆:15 张 wca_fs_* 表正常由 migration 0028 建,但若 deploy_core(apply_migrations)尚未跑到、
  // 而 stats.yml 先跑,缺表会在 ON_ERROR_STOP 下使整个 wca_stats_extra 刷新回滚.
  // 幂等 DDL 独立短事务先完成,不把任何 schema 锁带入后续长数据事务;
  // 索引仍由 0028 建(正常路径必跑;缺索引只是临时慢,不致命).表定义须与 0028 / schema_wca_stats_extra.pg.sql 同步.
  const ensureFsTables = `CREATE TABLE IF NOT EXISTS wca_fs_country_ranks (is_avg BOOLEAN NOT NULL, country_id VARCHAR(50) NOT NULL, sum INTEGER NOT NULL, events_present SMALLINT NOT NULL, per_event_rank INTEGER[] NOT NULL, PRIMARY KEY (is_avg, country_id));
CREATE TABLE IF NOT EXISTS wca_fs_country_ranks_meta (is_avg BOOLEAN PRIMARY KEY, penalties INTEGER[] NOT NULL, all_penalties INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS wca_fs_medals (wca_id VARCHAR(20) NOT NULL, country_id VARCHAR(50) NOT NULL, event_id VARCHAR(20) NOT NULL, gold INTEGER NOT NULL, silver INTEGER NOT NULL, bronze INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS wca_fs_placements (wca_id VARCHAR(20) NOT NULL, country_id VARCHAR(50) NOT NULL, event_id VARCHAR(20) NOT NULL, pos SMALLINT NOT NULL, count INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS wca_fs_best_podiums (comp_id VARCHAR(50) NOT NULL, event_id VARCHAR(20) NOT NULL, sum_value BIGINT NOT NULL, pos1_wca_id VARCHAR(20) NOT NULL, pos1_value BIGINT NOT NULL, pos2_wca_id VARCHAR(20) NOT NULL, pos2_value BIGINT NOT NULL, pos3_wca_id VARCHAR(20) NOT NULL, pos3_value BIGINT NOT NULL, tie BOOLEAN NOT NULL DEFAULT FALSE);
CREATE TABLE IF NOT EXISTS wca_fs_misser (event_id VARCHAR(20) NOT NULL, is_avg BOOLEAN NOT NULL, value INTEGER NOT NULL, wca_id VARCHAR(20) NOT NULL, country_id VARCHAR(50) NOT NULL, ever_first BOOLEAN NOT NULL, ever_podium BOOLEAN NOT NULL, ever_record BOOLEAN NOT NULL);
CREATE TABLE IF NOT EXISTS wca_fs_records_person (wca_id VARCHAR(20) NOT NULL, country_id VARCHAR(50) NOT NULL, wr INTEGER NOT NULL DEFAULT 0, cr INTEGER NOT NULL DEFAULT 0, nr INTEGER NOT NULL DEFAULT 0, score INTEGER NOT NULL DEFAULT 0, PRIMARY KEY (wca_id, country_id));
CREATE TABLE IF NOT EXISTS wca_fs_records_comp (comp_id VARCHAR(50) NOT NULL, comp_country_id VARCHAR(50) NOT NULL, wr INTEGER NOT NULL DEFAULT 0, cr INTEGER NOT NULL DEFAULT 0, nr INTEGER NOT NULL DEFAULT 0, score INTEGER NOT NULL DEFAULT 0, PRIMARY KEY (comp_id));
CREATE TABLE IF NOT EXISTS wca_fs_current_records (event_id VARCHAR(20) NOT NULL, is_avg BOOLEAN NOT NULL, scope_kind CHAR(1) NOT NULL, scope_id VARCHAR(50) NOT NULL DEFAULT '', wca_id VARCHAR(20) NOT NULL, country_id VARCHAR(50) NOT NULL, value INTEGER NOT NULL, set_comp_id VARCHAR(50) NOT NULL DEFAULT '', set_date DATE, world_rank INTEGER, continent_rank INTEGER, country_rank INTEGER, PRIMARY KEY (event_id, is_avg, scope_kind, scope_id));
CREATE TABLE IF NOT EXISTS wca_fs_person_comps (wca_id VARCHAR(20) NOT NULL, country_id VARCHAR(50) NOT NULL, comp_count INTEGER NOT NULL, PRIMARY KEY (wca_id, country_id));
CREATE TABLE IF NOT EXISTS wca_fs_comp_persons (comp_id VARCHAR(50) PRIMARY KEY, comp_country_id VARCHAR(50) NOT NULL, person_count INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS wca_fs_person_comp_solves (wca_id VARCHAR(20) NOT NULL, country_id VARCHAR(50) NOT NULL, comp_id VARCHAR(50) NOT NULL, solve INTEGER NOT NULL, attempt INTEGER NOT NULL, PRIMARY KEY (wca_id, comp_id));
CREATE TABLE IF NOT EXISTS wca_fs_comp_solves (comp_id VARCHAR(50) PRIMARY KEY, comp_country_id VARCHAR(50) NOT NULL, solve INTEGER NOT NULL, attempt INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS wca_fs_person_solves (wca_id VARCHAR(20) NOT NULL, country_id VARCHAR(50) NOT NULL, solve INTEGER NOT NULL, attempt INTEGER NOT NULL, PRIMARY KEY (wca_id, country_id));
CREATE TABLE IF NOT EXISTS wca_fs_person_year_solves (wca_id VARCHAR(20) NOT NULL, country_id VARCHAR(50) NOT NULL, year SMALLINT NOT NULL, solve INTEGER NOT NULL, attempt INTEGER NOT NULL, PRIMARY KEY (wca_id, country_id, year));
CREATE TABLE IF NOT EXISTS wca_championship_podiums (wca_id VARCHAR(20) NOT NULL, comp_id VARCHAR(50) NOT NULL, event_id VARCHAR(20) NOT NULL, level VARCHAR(30) NOT NULL, place SMALLINT NOT NULL, best INTEGER NOT NULL, average INTEGER NOT NULL DEFAULT 0, attempts INTEGER[], single_record VARCHAR(3) NOT NULL DEFAULT '', average_record VARCHAR(3) NOT NULL DEFAULT '', PRIMARY KEY (wca_id, comp_id, event_id, level));
CREATE INDEX IF NOT EXISTS wcp_wca ON wca_championship_podiums (wca_id);
-- 选手页专用全量成绩表(migration 0098 建;这里同样内联幂等 DDL,理由同上).
CREATE TABLE IF NOT EXISTS wca_person_results (wca_id VARCHAR(20) NOT NULL, comp_id VARCHAR(50) NOT NULL, comp_date DATE NOT NULL, event_id VARCHAR(20) NOT NULL, round_type_id VARCHAR(2) NOT NULL DEFAULT '', format_id VARCHAR(2) NOT NULL DEFAULT '', pos SMALLINT NOT NULL DEFAULT 0, best INTEGER NOT NULL, average INTEGER NOT NULL DEFAULT 0, attempts INTEGER[], single_record VARCHAR(3) NOT NULL DEFAULT '', average_record VARCHAR(3) NOT NULL DEFAULT '');
CREATE INDEX IF NOT EXISTS wpr_person ON wca_person_results (wca_id);
CREATE INDEX IF NOT EXISTS wpr_comp ON wca_person_results (comp_id);
CREATE TABLE IF NOT EXISTS wca_kinch (wca_id VARCHAR(20) PRIMARY KEY, country_id VARCHAR(50) NOT NULL, continent_id VARCHAR(50) NOT NULL, world_score_x100 SMALLINT NOT NULL, continent_score_x100 SMALLINT NOT NULL, country_score_x100 SMALLINT NOT NULL);
CREATE INDEX IF NOT EXISTS kinch_world_score ON wca_kinch (world_score_x100 DESC, wca_id);
CREATE INDEX IF NOT EXISTS kinch_continent_score ON wca_kinch (continent_id, continent_score_x100 DESC, wca_id);
CREATE INDEX IF NOT EXISTS kinch_country_score ON wca_kinch (country_id, country_score_x100 DESC, wca_id);
CREATE TABLE IF NOT EXISTS wca_pr_streaks (wca_id VARCHAR(20) PRIMARY KEY, country_id VARCHAR(50) NOT NULL, continent_id VARCHAR(50) NOT NULL, streak INTEGER NOT NULL, start_comp_id VARCHAR(50), end_comp_id VARCHAR(50));
CREATE INDEX IF NOT EXISTS pr_streak_world ON wca_pr_streaks (streak DESC, wca_id);
CREATE INDEX IF NOT EXISTS pr_streak_continent ON wca_pr_streaks (continent_id, streak DESC, wca_id);
CREATE INDEX IF NOT EXISTS pr_streak_country ON wca_pr_streaks (country_id, streak DESC, wca_id);
-- 已有列不执行 ALTER,避免日常导入也请求 ACCESS EXCLUSIVE 锁。
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_attribute WHERE attrelid = 'wca_competitions'::regclass AND attname = 'city' AND NOT attisdropped) THEN
    ALTER TABLE wca_competitions ADD COLUMN city VARCHAR(120) NOT NULL DEFAULT '';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_attribute WHERE attrelid = 'wca_competitions'::regclass AND attname = 'country_iso2' AND NOT attisdropped) THEN
    ALTER TABLE wca_competitions ADD COLUMN country_iso2 VARCHAR(2) NOT NULL DEFAULT '';
  END IF;
END $$;`;

  // 有主键的聚合表先 COPY 到暂存表,仅更新变化行;无主键的表保留其重复行语义。
  // DELETE/INSERT 的 MVCC 让读请求在提交前继续看到完整旧数据。
  const smallTables = `${refreshTable({
    table: 'wca_competitions',
    columns: ['id', 'name', 'country_id', 'start_date', 'end_date', 'city', 'country_iso2'],
    keyColumns: ['id'], file: 'wca_competitions.copy.tsv', expectedRows: comps.length,
  })}
\\! rm -f wca_competitions.copy.tsv
${refreshTable({
    table: 'wca_grand_slam',
    columns: ['wca_id', 'event_id', 'best_value', 'avg_value', 'country_id', 'has_wr', 'is_only_first', 'world_champ_comp_id', 'world_champ_pos', 'continental_champ_comp_id', 'continental_champ_pos', 'national_champ_comp_id', 'national_champ_pos'],
    keyColumns: ['wca_id', 'event_id'], file: 'wca_grand_slam.copy.tsv', expectedRows: gsCount,
  })}
\\! rm -f wca_grand_slam.copy.tsv
${refreshTable({
    table: 'wca_cohort_ranks',
    columns: ['cohort_year', 'event_id', 'is_avg', 'wca_id', 'value', 'country_id', 'world_rank', 'country_rank'],
    keyColumns: ['cohort_year', 'event_id', 'is_avg', 'wca_id'], file: 'wca_cohort_ranks.copy.tsv', expectedRows: cohortCount,
  })}
\\! rm -f wca_cohort_ranks.copy.tsv
${refreshTable({
    table: 'wca_success_rate',
    columns: ['event_id', 'wca_id', 'country_id', 'solved', 'attempted', 'pct_x10000'],
    keyColumns: ['event_id', 'wca_id'], file: 'wca_success_rate.copy.tsv', expectedRows: srCount,
  })}
\\! rm -f wca_success_rate.copy.tsv
${refreshTable({
    table: 'wca_all_events_done',
    columns: ['wca_id', 'country_id', 'done_count', 'is_done', 'first_comp_id', 'first_comp_date', 'achievement_comp_id', 'achievement_comp_date', 'days_to_complete', 'total_comp_count'],
    keyColumns: ['wca_id'], file: 'wca_all_events_done.copy.tsv', expectedRows: aedCount,
  })}
\\! rm -f wca_all_events_done.copy.tsv
${refreshTable({
    table: 'wca_person_ranks',
    columns: ['wca_id', 'is_avg', 'country_id', 'events_done', 'total_world_rank', 'total_country_rank', 'best_final_pos', 'ranks_world', 'ranks_country', 'continent_id', 'total_continent_rank', 'total_world_rank_21', 'total_country_rank_21', 'total_continent_rank_21', 'ranks_continent'],
    keyColumns: ['wca_id', 'is_avg'], file: 'wca_person_ranks.copy.tsv', expectedRows: prCount,
  })}
\\! rm -f wca_person_ranks.copy.tsv
${refreshTable({
    table: 'wca_kinch',
    columns: ['wca_id', 'country_id', 'continent_id', 'world_score_x100', 'continent_score_x100', 'country_score_x100'],
    keyColumns: ['wca_id'], file: 'wca_kinch.copy.tsv', expectedRows: kinchCount,
  })}
\\! rm -f wca_kinch.copy.tsv
${refreshTable({
    table: 'wca_pr_streaks',
    columns: ['wca_id', 'country_id', 'continent_id', 'streak', 'start_comp_id', 'end_comp_id'],
    keyColumns: ['wca_id'], file: 'wca_pr_streaks.copy.tsv', expectedRows: prStreakCount,
  })}
\\! rm -f wca_pr_streaks.copy.tsv
${refreshTable({
    table: 'wca_fs_country_ranks',
    columns: ['is_avg', 'country_id', 'sum', 'events_present', 'per_event_rank'],
    keyColumns: ['is_avg', 'country_id'], file: 'wca_fs_country_ranks.copy.tsv', expectedRows: cscCount,
  })}
\\! rm -f wca_fs_country_ranks.copy.tsv
${refreshTable({
    table: 'wca_fs_country_ranks_meta',
    columns: ['is_avg', 'penalties', 'all_penalties'],
    keyColumns: ['is_avg'], file: 'wca_fs_country_ranks_meta.copy.tsv', expectedRows: 2,
  })}
\\! rm -f wca_fs_country_ranks_meta.copy.tsv
${mutationCapacityGuard({ table: 'wca_fs_medals', file: 'wca_fs_medals.copy.tsv' })}
DELETE FROM wca_fs_medals;
\\copy wca_fs_medals (wca_id, country_id, event_id, gold, silver, bronze) FROM 'wca_fs_medals.copy.tsv';
\\! rm -f wca_fs_medals.copy.tsv
${mutationCapacityGuard({ table: 'wca_fs_placements', file: 'wca_fs_placements.copy.tsv' })}
DELETE FROM wca_fs_placements;
\\copy wca_fs_placements (wca_id, country_id, event_id, pos, count) FROM 'wca_fs_placements.copy.tsv';
\\! rm -f wca_fs_placements.copy.tsv
${mutationCapacityGuard({ table: 'wca_fs_best_podiums', file: 'wca_fs_best_podiums.copy.tsv' })}
DELETE FROM wca_fs_best_podiums;
\\copy wca_fs_best_podiums (comp_id, event_id, sum_value, pos1_wca_id, pos1_value, pos2_wca_id, pos2_value, pos3_wca_id, pos3_value, tie) FROM 'wca_fs_best_podiums.copy.tsv';
\\! rm -f wca_fs_best_podiums.copy.tsv
${mutationCapacityGuard({ table: 'wca_fs_misser', file: 'wca_fs_misser.copy.tsv' })}
DELETE FROM wca_fs_misser;
\\copy wca_fs_misser (event_id, is_avg, value, wca_id, country_id, ever_first, ever_podium, ever_record) FROM 'wca_fs_misser.copy.tsv';
\\! rm -f wca_fs_misser.copy.tsv
${refreshTable({
    table: 'wca_fs_records_person',
    columns: ['wca_id', 'country_id', 'wr', 'cr', 'nr', 'score'],
    keyColumns: ['wca_id', 'country_id'], file: 'wca_fs_records_person.copy.tsv', expectedRows: recPersonCount,
  })}
\\! rm -f wca_fs_records_person.copy.tsv
${refreshTable({
    table: 'wca_fs_records_comp',
    columns: ['comp_id', 'comp_country_id', 'wr', 'cr', 'nr', 'score'],
    keyColumns: ['comp_id'], file: 'wca_fs_records_comp.copy.tsv', expectedRows: recCompCount,
  })}
\\! rm -f wca_fs_records_comp.copy.tsv
${refreshTable({
    table: 'wca_fs_current_records',
    columns: ['event_id', 'is_avg', 'scope_kind', 'scope_id', 'wca_id', 'country_id', 'value', 'set_comp_id', 'set_date', 'world_rank', 'continent_rank', 'country_rank'],
    keyColumns: ['event_id', 'is_avg', 'scope_kind', 'scope_id'], file: 'wca_fs_current_records.copy.tsv', expectedRows: currCount,
  })}
\\! rm -f wca_fs_current_records.copy.tsv
${refreshTable({
    table: 'wca_fs_person_comps',
    columns: ['wca_id', 'country_id', 'comp_count'],
    keyColumns: ['wca_id', 'country_id'], file: 'wca_fs_person_comps.copy.tsv', expectedRows: pcCount,
  })}
\\! rm -f wca_fs_person_comps.copy.tsv
${refreshTable({
    table: 'wca_fs_comp_persons',
    columns: ['comp_id', 'comp_country_id', 'person_count'],
    keyColumns: ['comp_id'], file: 'wca_fs_comp_persons.copy.tsv', expectedRows: cpCount,
  })}
\\! rm -f wca_fs_comp_persons.copy.tsv
${refreshTable({
    table: 'wca_fs_person_comp_solves',
    columns: ['wca_id', 'country_id', 'comp_id', 'solve', 'attempt'],
    keyColumns: ['wca_id', 'comp_id'], file: 'wca_fs_person_comp_solves.copy.tsv', expectedRows: pcsCount,
  })}
\\! rm -f wca_fs_person_comp_solves.copy.tsv
${refreshTable({
    table: 'wca_fs_comp_solves',
    columns: ['comp_id', 'comp_country_id', 'solve', 'attempt'],
    keyColumns: ['comp_id'], file: 'wca_fs_comp_solves.copy.tsv', expectedRows: csolvCount,
  })}
\\! rm -f wca_fs_comp_solves.copy.tsv
${refreshTable({
    table: 'wca_fs_person_solves',
    columns: ['wca_id', 'country_id', 'solve', 'attempt'],
    keyColumns: ['wca_id', 'country_id'], file: 'wca_fs_person_solves.copy.tsv', expectedRows: psolvCount,
  })}
\\! rm -f wca_fs_person_solves.copy.tsv
${refreshTable({
    table: 'wca_fs_person_year_solves',
    columns: ['wca_id', 'country_id', 'year', 'solve', 'attempt'],
    keyColumns: ['wca_id', 'country_id', 'year'], file: 'wca_fs_person_year_solves.copy.tsv', expectedRows: pysCount,
  })}
\\! rm -f wca_fs_person_year_solves.copy.tsv
${refreshTable({
    table: 'wca_championship_podiums',
    columns: ['wca_id', 'comp_id', 'event_id', 'level', 'place', 'best', 'average', 'attempts', 'single_record', 'average_record'],
    keyColumns: ['wca_id', 'comp_id', 'event_id', 'level'], file: 'wca_championship_podiums.copy.tsv', expectedRows: champPodiumCount,
  })}
\\! rm -f wca_championship_podiums.copy.tsv`;

  // Both result tables use the same changed-competition set and transaction.
  const personResultsSql = `-- wca_person_results:增量(与 wca_results_flat 同一份 del-list:_wrf_del).
${stagedCapacityGuard('_wpr_delta', wprFile)}
CREATE TEMP TABLE _wpr_delta (LIKE wca_person_results) ON COMMIT DROP;
\\copy _wpr_delta (${wprCols}) FROM '${wprFile}';
${mutationCapacityGuard({ table: 'wca_person_results', file: wprFile, mode: 'delta' })}
\\! rm -f ${wprFile}
DO $$
DECLARE pre bigint; n bigint;
BEGIN
  SELECT count(*) INTO pre FROM wca_person_results;
  IF pre = 0 THEN
    RAISE EXCEPTION 'wca_person_results is empty; refusing an implicit bootstrap';
  END IF;
  DELETE FROM wca_person_results WHERE comp_id IN (SELECT comp_id FROM _wrf_del);
  INSERT INTO wca_person_results SELECT * FROM _wpr_delta;
  SELECT count(*) INTO n FROM wca_person_results;
  IF n <> ${fullWprTotal} THEN
    RAISE EXCEPTION 'wca_person_results count % != expected ${fullWprTotal} after incremental apply; aborting', n;
  END IF;
END $$;`;

  // VACUUM (ANALYZE):wca_results_flat 走 Index Only Scan 跑深分页,必须更新 visibility map.
  // 增量同样需要:DELETE 的 dead tuple 页 + delta 新页都要进 vmap,否则 IOS 退化 heap fetch.
  const vacuumAnalyze = `VACUUM (ANALYZE) wca_results_flat;
VACUUM (ANALYZE) wca_competitions;
VACUUM (ANALYZE) wca_grand_slam;
VACUUM (ANALYZE) wca_cohort_ranks;
VACUUM (ANALYZE) wca_success_rate;
VACUUM (ANALYZE) wca_all_events_done;
VACUUM (ANALYZE) wca_person_ranks;
VACUUM (ANALYZE) wca_kinch;
VACUUM (ANALYZE) wca_pr_streaks;
VACUUM (ANALYZE) wca_comp_updated_at;
VACUUM (ANALYZE) wca_fs_country_ranks;
VACUUM (ANALYZE) wca_fs_country_ranks_meta;
VACUUM (ANALYZE) wca_fs_medals;
VACUUM (ANALYZE) wca_fs_placements;
VACUUM (ANALYZE) wca_fs_best_podiums;
VACUUM (ANALYZE) wca_fs_misser;
VACUUM (ANALYZE) wca_fs_records_person;
VACUUM (ANALYZE) wca_fs_records_comp;
VACUUM (ANALYZE) wca_fs_current_records;
VACUUM (ANALYZE) wca_fs_person_comps;
VACUUM (ANALYZE) wca_fs_comp_persons;
VACUUM (ANALYZE) wca_fs_person_comp_solves;
VACUUM (ANALYZE) wca_fs_comp_solves;
VACUUM (ANALYZE) wca_fs_person_solves;
VACUUM (ANALYZE) wca_fs_person_year_solves;
VACUUM (ANALYZE) wca_championship_podiums;
VACUUM (ANALYZE) wca_person_results;`;

  const schemaSql = `${importTransactionStart('wca_stats_extra_schema')}
${ensureFsTables}
COMMIT;`;
  const manifestSql = refreshTable({
    table: 'wca_comp_updated_at', columns: ['comp_id', 'content_hash'],
    keyColumns: ['comp_id'], file: 'wca_comp_updated_at.copy.tsv', expectedRows: compMaxCount,
  });

  // Keep both result tables on the same changed-competition set.
  let delTxt = '';
  for (const c of changedComps) delTxt += pgEsc(c) + '\n';
  writeFileSync(resolve(outDir, 'wca_results_flat_del.txt'), delTxt);

  const loadSql = `-- 由 wca_stats_extra_build.ts 生成(增量:只重灌指纹变动比赛的 wca_results_flat 行).
-- changed=${changedComps.size} 场, delta=${allTopCount} 行 / 全表应有 ${fullTopTotal} 行.容量由实际 delta 大小检查.

${schemaSql}

${importTransactionStart('wca_stats_extra')}

-- 守卫:服务器现有 wca_comp_updated_at 指纹必须 == builder diff 所用的旧指纹(count + sum),
-- 否则说明 build 拉取指纹后服务器又被改过 → delta 与真实状态失配 → abort 回滚,绝不写脏 wca_results_flat.
DO $$
DECLARE c bigint; s numeric;
BEGIN
  SELECT count(*), COALESCE(sum(content_hash), 0) INTO c, s FROM wca_comp_updated_at;
  IF c <> ${oldCompHash.size} OR s <> ${oldFpSum.toString()} THEN
    RAISE EXCEPTION 'wca_stats_extra guard: server fp (count=%, sum=%) != builder old (count=${oldCompHash.size}, sum=${oldFpSum.toString()}); aborting incremental apply', c, s;
  END IF;
END $$;

-- 增量替换 wca_results_flat:删变动比赛旧行 + COPY 变动比赛新行.索引不重建,随 DML 增量维护.
CREATE TEMP TABLE _wrf_del (comp_id VARCHAR(50)) ON COMMIT DROP;
\\copy _wrf_del FROM 'wca_results_flat_del.txt';
\\! rm -f wca_results_flat_del.txt
${mutationCapacityGuard({ table: 'wca_results_flat', file: wrfFile, mode: 'delta' })}
DELETE FROM wca_results_flat WHERE comp_id IN (SELECT comp_id FROM _wrf_del);
\\copy wca_results_flat (${wrfCols}) FROM '${wrfFile}';
\\! rm -f ${wrfFile}

-- Preserve labels for unchanged contents; only actual changes invalidate snapshots.
${manifestSql}
\\! rm -f wca_comp_updated_at.copy.tsv

${smallTables}

${personResultsSql}

-- 校验:增量后 wca_results_flat 总行数必须 == 全表应有行数,对不上说明 delta 算漏/算重 → abort.
DO $$
DECLARE n bigint;
BEGIN
  SELECT count(*) INTO n FROM wca_results_flat;
  IF n <> ${fullTopTotal} THEN
    RAISE EXCEPTION 'wca_results_flat count % != expected ${fullTopTotal} after incremental apply; aborting', n;
  END IF;
END $$;

INSERT INTO meta_historical (key, value, updated_at) VALUES ('wca_stats_extra_imported_at', NOW()::TEXT, NOW())
  ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW();

COMMIT;

${vacuumAnalyze}
`;
  writeFileSync(resolve(outDir, 'load.sql'), loadSql);
  const uploadBytes = readdirSync(outDir).reduce((total, file) => total + statSync(resolve(outDir, file)).size, 0);
  const smallStageBytes = Math.max(...readdirSync(outDir).filter(file => file.endsWith('.copy.tsv')).map(file => statSync(resolve(outDir, file)).size), 0);
  const flatBytes = statSync(resolve(outDir, wrfFile)).size;
  const personBytes = statSync(resolve(outDir, wprFile)).size;
  // Reserve upload space, the largest small-table stage, both delta mutations,
  // the person-results stage and 2 GiB headroom. Import-time checks remain active.
  writeFileSync(resolve(outDir, 'preflight.sql'), deltaUploadPreflightSql({ uploadBytes, smallStageBytes, flatBytes, personBytes }));


  // ── summary ──
  const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
  function sizeMb(name: string): string {
    try { return (statSync(resolve(outDir, name)).size / 1024 / 1024).toFixed(1); } catch { return '?'; }
  }
  console.log(`\n=== Done in ${elapsed}s (mode=incremental, ${changedComps.size} changed comps) ===`);
  console.log(`  competitions      : ${comps.length.toLocaleString()} rows, ${sizeMb('wca_competitions.copy.tsv')} MB`);
  console.log(`  grand_slam        : ${gsCount.toLocaleString()} rows, ${sizeMb('wca_grand_slam.copy.tsv')} MB`);
  console.log(`  results_top       : ${allTopCount.toLocaleString()}/${fullTopTotal.toLocaleString()} rows, ${sizeMb(wrfFile)} MB`);
  console.log(`  person_results    : ${wprCount.toLocaleString()}/${fullWprTotal.toLocaleString()} rows, ${sizeMb(wprFile)} MB (delta)`);
  console.log(`  cohort_ranks      : ${cohortCount.toLocaleString()} rows, ${sizeMb('wca_cohort_ranks.copy.tsv')} MB`);
  console.log(`  success_rate      : ${srCount.toLocaleString()} rows, ${sizeMb('wca_success_rate.copy.tsv')} MB`);
  console.log(`  all_events_done   : ${aedCount.toLocaleString()} rows, ${sizeMb('wca_all_events_done.copy.tsv')} MB`);
  console.log(`  person_ranks      : ${prCount.toLocaleString()} rows, ${sizeMb('wca_person_ranks.copy.tsv')} MB`);
  console.log(`  kinch             : ${kinchCount.toLocaleString()} rows, ${sizeMb('wca_kinch.copy.tsv')} MB`);
  console.log(`  pr_streaks        : ${prStreakCount.toLocaleString()} rows, ${sizeMb('wca_pr_streaks.copy.tsv')} MB`);
  console.log(`  comp_updated_at   : ${compMaxCount.toLocaleString()} rows, ${sizeMb('wca_comp_updated_at.copy.tsv')} MB`);
}

main().catch(e => { console.error(e); process.exit(1); });
