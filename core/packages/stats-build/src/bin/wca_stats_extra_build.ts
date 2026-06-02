// WCA stats extra builder — 一次性算 6 个 cubing.pro 风格 stats 的 PG TSV.
// 与 historical_ranks_build.ts 思路一致:逐 event 处理,保留必要的跨 event 聚合状态.
//
// 输入: MySQL `wca_developer_database` (CI runner / 本地)
// 输出: output/wca_stats_extra/*.copy.tsv + load.sql
//
// 用法:
//   NODE_OPTIONS='--expose-gc --max-old-space-size=12288' npx tsx src/bin/wca_stats_extra_build.ts

import mysql from 'mysql2/promise';
import { createWriteStream, mkdirSync, writeFileSync, readFileSync, statSync, existsSync, rmSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { parse as parseYaml } from 'yaml';

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
// wca_results_top 已无 cap(全量 ~11M),country_filter 列也已删
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
function assignRanks(
  list: Array<{ wcaId: string; val: number; country: string }>,
): Map<string, { wr: number; cr: number }> {
  const out = new Map<string, { wr: number; cr: number }>();
  let prevVal = -1, prevWr = 0;
  const ctry = new Map<string, { prev: number; rank: number; count: number }>();
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
    out.set(it.wcaId, { wr, cr });
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
  // 清旧产物:增量/全量两种模式的文件集不同(delta vs 全量 wca_results_top.copy.tsv),
  // 上传步骤 scp 整个目录,残留旧文件会被一起发上去污染 apply.
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
  // iso2 → country.id 反查(championships 用 iso2)
  const countryByIso2 = new Map<string, string>();
  for (const c of countries) {
    if (c['iso2']) countryByIso2.set((c['iso2'] as string).toUpperCase(), c['id'] as string);
  }

  const [persons] = await conn.query<mysql.RowDataPacket[]>(
    `SELECT wca_id, name, country_id FROM persons WHERE sub_id = 1`,
  );
  const personCountry = new Map<string, string>();
  for (const p of persons) personCountry.set(p['wca_id'] as string, p['country_id'] as string);
  console.log(`  countries=${countries.length} persons=${persons.length}`);

  // ── 2. wca_competitions: 元数据 ──
  console.log('[comp] loading competitions...');
  const [comps] = await conn.query<mysql.RowDataPacket[]>(
    `SELECT id, name, country_id, start_date, end_date FROM competitions`,
  );
  {
    const f = createWriteStream(resolve(outDir, 'wca_competitions.copy.tsv'));
    for (const c of comps) {
      f.write(
        `${pgEsc(c['id'] as string)}\t${pgEsc(c['name'] as string)}\t${pgEsc(c['country_id'] as string)}\t` +
        `${dateOrNull(c['start_date'] as string | Date | null)}\t${dateOrNull(c['end_date'] as string | Date | null)}\n`,
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

  // ── 2.5 per-comp 内容指纹 + 增量判定 ──
  // 指纹 = 成绩值聚合(只有真实成绩变动才让 hash 变,WCA 批量盖 updated_at 不影响).
  //   results 值 XOR result_attempts 每把 value;两表分别 GROUP BY 再 JS XOR 合并(避免 1:N join fan-out).
  // 增量:CI build 前 ssh 拉服务器现有 wca_comp_updated_at 落到 PREV_FINGERPRINTS,
  //   只重灌指纹变了的比赛的 wca_results_top 行,峰值从 6.8G 全表翻倍降到几 MB.
  //   缺旧指纹文件(首次/拉取失败)→ incremental=false,退回全量 DROP+CREATE(现行为).
  console.log('[fp] computing per-comp content fingerprint...');
  const [resHashRows] = await conn.query<mysql.RowDataPacket[]>(
    `SELECT competition_id AS comp_id,
            BIT_XOR(CRC32(CONCAT_WS('|', id, person_id, event_id, round_type_id, pos, best, average,
                                    regional_single_record, regional_average_record))) AS h
       FROM results GROUP BY competition_id`,
  );
  const [attHashRows] = await conn.query<mysql.RowDataPacket[]>(
    `SELECT r.competition_id AS comp_id,
            BIT_XOR(CRC32(CONCAT_WS('#', ra.result_id, ra.attempt_number, ra.value))) AS h
       FROM result_attempts ra JOIN results r ON r.id = ra.result_id
      GROUP BY r.competition_id`,
  );
  const compHash = new Map<string, bigint>();
  for (const r of resHashRows) compHash.set(r['comp_id'] as string, BigInt((r['h'] ?? 0) as string | number));
  for (const r of attHashRows) {
    const id = r['comp_id'] as string;
    compHash.set(id, (compHash.get(id) ?? 0n) ^ BigInt((r['h'] ?? 0) as string | number));
  }
  (resHashRows as unknown as { length: number }).length = 0;
  (attHashRows as unknown as { length: number }).length = 0;

  // 写新指纹 manifest(全量,dump_comps.yml 增量也要它)
  let compMaxCount = 0;
  {
    const f = createWriteStream(resolve(outDir, 'wca_comp_updated_at.copy.tsv'));
    for (const [comp, h] of compHash) { f.write(`${pgEsc(comp)}\t${h.toString()}\n`); compMaxCount++; }
    f.end();
  }

  // 读旧指纹 + 算 changed 集 + 旧指纹守卫值(count/sum,apply 前服务器侧再算一遍比对)
  const oldCompHash = new Map<string, bigint>();
  const prevFpPath = process.env.PREV_FINGERPRINTS;
  if (prevFpPath && existsSync(prevFpPath)) {
    for (const line of readFileSync(prevFpPath, 'utf-8').split('\n')) {
      if (!line) continue;
      const tab = line.indexOf('\t');
      if (tab < 0) continue;
      oldCompHash.set(line.slice(0, tab), BigInt(line.slice(tab + 1).trim()));
    }
  }
  const incremental = oldCompHash.size > 0;
  const changedComps = new Set<string>();
  if (incremental) {
    for (const [c, h] of compHash) if (oldCompHash.get(c) !== h) changedComps.add(c);
    for (const c of oldCompHash.keys()) if (!compHash.has(c)) changedComps.add(c); // 删除的比赛
  }
  let oldFpSum = 0n;
  for (const h of oldCompHash.values()) oldFpSum += h;
  console.log(`[fp] mode=${incremental ? 'incremental' : 'full'} old=${oldCompHash.size} new=${compHash.size} changed=${changedComps.size}`);

  // ── 3. championships: 用于 grand_slam ──
  console.log('[champ] loading championships...');
  const [championships] = await conn.query<mysql.RowDataPacket[]>(
    `SELECT championship_type, competition_id FROM championships`,
  );
  // World championship comp ids
  const worldChampComps = new Set<string>();
  // continental champ comp → continent_id
  const continentalChampComps = new Map<string, string>();
  // national champ comp → country_id (or "greater_china" → multi)
  const nationalChampComps = new Map<string, string>();
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
  // 多国 championship_type(greater_china 等)→ list of country_ids that this comp counts as their nat champ
  const multiCountryNatComps = new Map<string, Set<string>>();
  for (const ch of championships) {
    const t = ch['championship_type'] as string;
    const compId = ch['competition_id'] as string;
    if (t === 'world') {
      worldChampComps.add(compId);
    } else if (t.startsWith('_')) {
      // continental
      continentalChampComps.set(compId, t);
    } else if (/^[A-Z]{2}$/.test(t)) {
      // national: t is iso2
      const ctry = countryByIso2.get(t);
      if (ctry) nationalChampComps.set(compId, ctry);
    } else {
      // 'greater_china' 等多国. 用 eligibles 反查
      const isos = eligByType.get(t) ?? [];
      const ctrySet = new Set<string>();
      for (const iso of isos) {
        const ctry = countryByIso2.get(iso);
        if (ctry) ctrySet.add(ctry);
      }
      if (ctrySet.size > 0) multiCountryNatComps.set(compId, ctrySet);
    }
  }
  console.log(`  WC=${worldChampComps.size} cont=${continentalChampComps.size} nat=${nationalChampComps.size} multi=${multiCountryNatComps.size}`);

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
  const wrtFile = incremental ? 'wca_results_top_delta.tsv' : 'wca_results_top.copy.tsv';
  const allTopStream = createWriteStream(resolve(outDir, wrtFile));
  const cohortStream = createWriteStream(resolve(outDir, 'wca_cohort_ranks.copy.tsv'));
  const grandSlamStream = createWriteStream(resolve(outDir, 'wca_grand_slam.copy.tsv'));
  let allTopCount = 0, cohortCount = 0, gsCount = 0;
  let fullTopTotal = 0; // 完整表应有行数(增量模式下 != allTopCount=delta 写入数)

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

  // person 当前 PB(用于 grand_slam 行的 best/avg 字段;最后从 concise_*_results 取也行)
  // 这里直接在事件循环里维护

  // 累积 PB(per event, per person):
  // accByEvent[event][pid] = Acc — 用于 cohort_ranks(全期累积) 和 grand_slam best/avg fill
  const accByEvent = new Map<string, Map<string, Acc>>();

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
      WHERE r.event_id = ? AND c.start_date IS NOT NULL
      ORDER BY c.start_date ASC, r.id ASC
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

    // ── (b) success_rate counters (only for active events) ──
    const sr = isActive ? successAcc.get(eventId)! : null;

    // ── (c) grand_slam 的 finals 收集(只 active 项目) ──
    const gsForEvent = isActive ? gsAcc.get(eventId)! : null;

    // 主迭代
    for (const r of results) {
      // accumulate PB
      let a = acc.get(r.pid);
      if (!a) {
        a = { best: 0, avg: 0, country: r.countryId, bestCompId: '', avgCompId: '' };
        acc.set(r.pid, a);
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

      // all_results_top: 增量模式只写「指纹变了的比赛」的行(delta);全量模式写全部.
      // fullTopTotal 始终累计完整表应有行数,供 apply 后校验 wca_results_top count(*).
      // 末尾 3 列(round_type_id, format_id, record_tag)是为 /comp 页面准备的:
      // 同 (comp_id, event_id, round_type_id, wca_id) 下 is_avg=false/true 两行配对成一条完整成绩.
      const rt = pgEsc(r.roundTypeId);
      const fm = pgEsc(r.formatId);
      const wrtWrite = !incremental || changedComps.has(r.compId);
      if (r.best > 0) {
        fullTopTotal++;
        if (wrtWrite) {
          const tag = pgEsc(r.regSingleRecord ?? '');
          allTopStream.write(
            `${eventId}\t${bool(false)}\t${r.best}\t${pgEsc(r.pid)}\t${pgEsc(r.countryId)}\t${pgEsc(r.compId)}\t${r.compDate}\t${intArr(r.attempts)}\t${rt}\t${fm}\t${tag}\n`,
          );
          allTopCount++;
        }
      }
      if (r.average > 0) {
        fullTopTotal++;
        if (wrtWrite) {
          const tag = pgEsc(r.regAvgRecord ?? '');
          allTopStream.write(
            `${eventId}\t${bool(true)}\t${r.average}\t${pgEsc(r.pid)}\t${pgEsc(r.countryId)}\t${pgEsc(r.compId)}\t${r.compDate}\t${intArr(r.attempts)}\t${rt}\t${fm}\t${tag}\n`,
          );
          allTopCount++;
        }
      }

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

      // grand_slam: 只 finals + 领奖台(pos<=3)
      if (gsForEvent) {
        if (isFinal && r.pos > 0 && r.pos <= 3) {
          let g = gsForEvent.get(r.pid);
          if (!g) {
            g = { hasWrSingle: false, hasWrAvg: false };
            gsForEvent.set(r.pid, g);
          }
          // World
          if (worldChampComps.has(r.compId)) {
            if (g.worldChampPos == null || r.pos < g.worldChampPos) {
              g.worldChampComp = r.compId; g.worldChampPos = r.pos;
            }
          }
          // Continental(person 当前国籍 → continent;比较 comp 的 continent_type)
          const personCtry = personCountry.get(r.pid);
          const personCont = personCtry ? continentOf.get(personCtry) : undefined;
          const compCont = continentalChampComps.get(r.compId);
          if (compCont && personCont && compCont === personCont) {
            if (g.contChampPos == null || r.pos < g.contChampPos) {
              g.contChampComp = r.compId; g.contChampPos = r.pos;
            }
          }
          // National(comp 的 nat country = 选手当前国籍)
          const natCtry = nationalChampComps.get(r.compId);
          const multiNat = multiCountryNatComps.get(r.compId);
          let natMatch = false;
          if (natCtry && personCtry && natCtry === personCtry) natMatch = true;
          if (!natMatch && multiNat && personCtry && multiNat.has(personCtry)) natMatch = true;
          if (natMatch) {
            if (g.natChampPos == null || r.pos < g.natChampPos) {
              g.natChampComp = r.compId; g.natChampPos = r.pos;
            }
          }
        }
        // hasWr — any time(不限 finals).从 acc 取/建 entry,与 podium 的 entry 合并
        if (r.regSingleRecord === 'WR' || r.regAvgRecord === 'WR') {
          let g2 = gsForEvent.get(r.pid);
          if (!g2) { g2 = { hasWrSingle: false, hasWrAvg: false }; gsForEvent.set(r.pid, g2); }
          if (r.regSingleRecord === 'WR') g2.hasWrSingle = true;
          if (r.regAvgRecord === 'WR') g2.hasWrAvg = true;
        }
      }
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
  const eventRanks: { single: Map<string, { wr: number; cr: number; val: number }>; avg: Map<string, { wr: number; cr: number; val: number }> }[] = [];
  // 也记录每个 event 的参赛人数(用作缺项默认 rank).world 总和用全球计数,
  // country 总和必须用"该国该项"计数(缺项 = 比该国倒数第一再差一名),否则国家榜罚分被全球量级放大.
  const eventParticipantsSingle: number[] = [];
  const eventParticipantsAvg: number[] = [];
  const eventParticipantsCountrySingle: Map<string, number>[] = [];
  const eventParticipantsCountryAvg: Map<string, number>[] = [];
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
    const sRanks = assignRanks(sList);
    const aRanks = assignRanks(aList);
    const sMap = new Map<string, { wr: number; cr: number; val: number }>();
    const aMap = new Map<string, { wr: number; cr: number; val: number }>();
    for (const it of sList) sMap.set(it.wcaId, { ...sRanks.get(it.wcaId)!, val: it.val });
    for (const it of aList) aMap.set(it.wcaId, { ...aRanks.get(it.wcaId)!, val: it.val });
    eventRanks.push({ single: sMap, avg: aMap });
    eventParticipantsSingle.push(sList.length);
    eventParticipantsAvg.push(aList.length);
    const csMap = new Map<string, number>();
    for (const it of sList) csMap.set(it.country, (csMap.get(it.country) ?? 0) + 1);
    eventParticipantsCountrySingle.push(csMap);
    const caMap = new Map<string, number>();
    for (const it of aList) caMap.set(it.country, (caMap.get(it.country) ?? 0) + 1);
    eventParticipantsCountryAvg.push(caMap);
  }

  const prStream = createWriteStream(resolve(outDir, 'wca_person_ranks.copy.tsv'));
  let prCount = 0;
  // 收集所有人(任何 active event 出现过的)
  const allActivePids = new Set<string>();
  for (const ev of ACTIVE_EVENTS) {
    const acc = accByEvent.get(ev);
    if (acc) for (const pid of acc.keys()) allActivePids.add(pid);
  }
  for (const pid of allActivePids) {
    const country = personCountry.get(pid) ?? '';
    const bfp = bestFinalPos.get(pid) ?? 0;
    // single
    {
      const ranksW: number[] = new Array(RANK_EVENTS.length).fill(0);
      const ranksC: number[] = new Array(RANK_EVENTS.length).fill(0);
      let totalW = 0, totalC = 0, doneN = 0;
      for (let i = 0; i < ACTIVE_EVENTS.length; i++) {
        const r = eventRanks[i]!.single.get(pid);
        if (r) {
          ranksW[i] = r.wr;
          ranksC[i] = r.cr;
          totalW += r.wr;
          totalC += r.cr;
          doneN++;
        } else {
          // 缺项默认: participants+1 (world 用全球计数, country 用该国该项计数)
          totalW += eventParticipantsSingle[i]! + 1;
          totalC += (eventParticipantsCountrySingle[i]!.get(country) ?? 0) + 1;
        }
      }
      // 废止项:只填数组,不计入 total/doneN
      for (let i = ACTIVE_EVENTS.length; i < RANK_EVENTS.length; i++) {
        const r = eventRanks[i]!.single.get(pid);
        if (r) { ranksW[i] = r.wr; ranksC[i] = r.cr; }
      }
      prStream.write(
        `${pgEsc(pid)}\t${bool(false)}\t${pgEsc(country)}\t${doneN}\t${totalW}\t${totalC}\t${bfp}\t${intArr(ranksW)}\t${intArr(ranksC)}\n`,
      );
      prCount++;
    }
    // average
    {
      const ranksW: number[] = new Array(RANK_EVENTS.length).fill(0);
      const ranksC: number[] = new Array(RANK_EVENTS.length).fill(0);
      let totalW = 0, totalC = 0, doneN = 0;
      for (let i = 0; i < ACTIVE_EVENTS.length; i++) {
        // 333mbf 没有 average — 跳过(填 0)
        if (ACTIVE_EVENTS[i] === '333mbf') {
          continue;  // 计入 totalW 时也跳过
        }
        const r = eventRanks[i]!.avg.get(pid);
        if (r) {
          ranksW[i] = r.wr;
          ranksC[i] = r.cr;
          totalW += r.wr;
          totalC += r.cr;
          doneN++;
        } else {
          totalW += eventParticipantsAvg[i]! + 1;
          totalC += (eventParticipantsCountryAvg[i]!.get(country) ?? 0) + 1;
        }
      }
      // 废止项 avg:只填数组(333mbo 无 average → map 空 → 留 0),不计入 total/doneN
      for (let i = ACTIVE_EVENTS.length; i < RANK_EVENTS.length; i++) {
        const r = eventRanks[i]!.avg.get(pid);
        if (r) { ranksW[i] = r.wr; ranksC[i] = r.cr; }
      }
      prStream.write(
        `${pgEsc(pid)}\t${bool(true)}\t${pgEsc(country)}\t${doneN}\t${totalW}\t${totalC}\t${bfp}\t${intArr(ranksW)}\t${intArr(ranksC)}\n`,
      );
      prCount++;
    }
  }
  prStream.end();

  // (per-comp 内容指纹 manifest 已在前面 §2.5 算好并写出 wca_comp_updated_at.copy.tsv)

  // ── flush 还在 buffer 的 stream ──
  await Promise.all([
    new Promise<void>(res => allTopStream.end(() => res())),
    new Promise<void>(res => cohortStream.end(() => res())),
    new Promise<void>(res => grandSlamStream.end(() => res())),
  ]);
  await conn.end();

  // ── 10. del-list (增量) + load.sql ──
  const wrtCols = 'event_id, is_avg, value, wca_id, person_country_id, comp_id, comp_date, attempts, round_type_id, format_id, record_tag';

  // 6 张全局聚合小表 + 指纹 manifest:两模式都全量 TRUNCATE+重灌(任一成绩变这些排名都会动,无法增量;
  // 但它们小,翻倍无所谓).边 COPY 边删源 TSV(同分区白占空间;\\copy 读完即删,\\! 不受事务影响).
  const smallTables = `TRUNCATE wca_competitions       CASCADE;
TRUNCATE wca_grand_slam;
TRUNCATE wca_cohort_ranks;
TRUNCATE wca_success_rate;
TRUNCATE wca_all_events_done;
TRUNCATE wca_person_ranks;

\\copy wca_competitions (id, name, country_id, start_date, end_date) FROM 'wca_competitions.copy.tsv';
\\! rm -f wca_competitions.copy.tsv
\\copy wca_grand_slam (wca_id, event_id, best_value, avg_value, country_id, has_wr, is_only_first, world_champ_comp_id, world_champ_pos, continental_champ_comp_id, continental_champ_pos, national_champ_comp_id, national_champ_pos) FROM 'wca_grand_slam.copy.tsv';
\\! rm -f wca_grand_slam.copy.tsv
\\copy wca_cohort_ranks (cohort_year, event_id, is_avg, wca_id, value, country_id, world_rank, country_rank) FROM 'wca_cohort_ranks.copy.tsv';
\\! rm -f wca_cohort_ranks.copy.tsv
\\copy wca_success_rate (event_id, wca_id, country_id, solved, attempted, pct_x10000) FROM 'wca_success_rate.copy.tsv';
\\! rm -f wca_success_rate.copy.tsv
\\copy wca_all_events_done (wca_id, country_id, done_count, is_done, first_comp_id, first_comp_date, achievement_comp_id, achievement_comp_date, days_to_complete, total_comp_count) FROM 'wca_all_events_done.copy.tsv';
\\! rm -f wca_all_events_done.copy.tsv
\\copy wca_person_ranks (wca_id, is_avg, country_id, events_done, total_world_rank, total_country_rank, best_final_pos, ranks_world, ranks_country) FROM 'wca_person_ranks.copy.tsv';
\\! rm -f wca_person_ranks.copy.tsv`;

  // VACUUM (ANALYZE):wca_results_top 走 Index Only Scan 跑深分页,必须更新 visibility map.
  // 增量同样需要:DELETE 的 dead tuple 页 + delta 新页都要进 vmap,否则 IOS 退化 heap fetch.
  const vacuumAnalyze = `VACUUM (ANALYZE) wca_results_top;
ANALYZE wca_competitions;
ANALYZE wca_grand_slam;
ANALYZE wca_cohort_ranks;
ANALYZE wca_success_rate;
ANALYZE wca_all_events_done;
ANALYZE wca_person_ranks;
ANALYZE wca_comp_updated_at;`;

  let loadSql: string;
  if (incremental) {
    // 增量:写变动比赛 del-list(temp 表 COPY 用),只删+重插指纹变动的比赛行.
    let delTxt = '';
    for (const c of changedComps) delTxt += pgEsc(c) + '\n';
    writeFileSync(resolve(outDir, 'wca_results_top_del.txt'), delTxt);

    loadSql = `-- 由 wca_stats_extra_build.ts 生成(增量:只重灌指纹变动比赛的 wca_results_top 行).
-- changed=${changedComps.size} 场, delta=${allTopCount} 行 / 全表应有 ${fullTopTotal} 行.峰值仅几 MB.

BEGIN;

-- 守卫:服务器现有 wca_comp_updated_at 指纹必须 == builder diff 所用的旧指纹(count + sum),
-- 否则说明 build 拉取指纹后服务器又被改过 → delta 与真实状态失配 → abort 回滚,绝不写脏 wca_results_top.
DO $$
DECLARE c bigint; s numeric;
BEGIN
  SELECT count(*), COALESCE(sum(content_hash), 0) INTO c, s FROM wca_comp_updated_at;
  IF c <> ${oldCompHash.size} OR s <> ${oldFpSum.toString()} THEN
    RAISE EXCEPTION 'wca_stats_extra guard: server fp (count=%, sum=%) != builder old (count=${oldCompHash.size}, sum=${oldFpSum.toString()}); aborting incremental apply', c, s;
  END IF;
END $$;

-- 增量替换 wca_results_top:删变动比赛旧行 + COPY 变动比赛新行.索引不重建,随 DML 增量维护.
CREATE TEMP TABLE _wrt_del (comp_id VARCHAR(50)) ON COMMIT DROP;
\\copy _wrt_del FROM 'wca_results_top_del.txt';
\\! rm -f wca_results_top_del.txt
DELETE FROM wca_results_top WHERE comp_id IN (SELECT comp_id FROM _wrt_del);
\\copy wca_results_top (${wrtCols}) FROM '${wrtFile}';
\\! rm -f ${wrtFile}

-- 指纹 manifest 全量替换为新指纹(下次 build 的 old = 这次的 new);守卫已在上面读过旧值.
TRUNCATE wca_comp_updated_at;
\\copy wca_comp_updated_at (comp_id, content_hash) FROM 'wca_comp_updated_at.copy.tsv';
\\! rm -f wca_comp_updated_at.copy.tsv

${smallTables}

-- 校验:增量后 wca_results_top 总行数必须 == 全表应有行数,对不上说明 delta 算漏/算重 → abort.
DO $$
DECLARE n bigint;
BEGIN
  SELECT count(*) INTO n FROM wca_results_top;
  IF n <> ${fullTopTotal} THEN
    RAISE EXCEPTION 'wca_results_top count % != expected ${fullTopTotal} after incremental apply; aborting', n;
  END IF;
END $$;

INSERT INTO meta_historical (key, value, updated_at) VALUES ('wca_stats_extra_imported_at', NOW()::TEXT, NOW())
  ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW();

COMMIT;

${vacuumAnalyze}
`;
  } else {
    // 全量:缺旧指纹(首次 / FORCE_FULL / CI 拉取失败)→ DROP+CREATE 重建.峰值 ~2×表,靠 TSV 边删压余量.
    loadSql = `-- 由 wca_stats_extra_build.ts 生成(全量:DROP+CREATE 重建 wca_results_top).
-- 缺旧指纹时走此路.apply.sh 不调 schema 文件,DROP+CREATE 在此自包含建表/迁移.

BEGIN;

DROP TABLE IF EXISTS wca_results_top CASCADE;
-- id BIGSERIAL: PG 深分页 late-join(内子查询走 wrt_main INCLUDE,外层 PK 回表 enrich 100 行).
CREATE TABLE wca_results_top (
  id                 BIGSERIAL PRIMARY KEY,
  event_id           VARCHAR(20) NOT NULL,
  is_avg             BOOLEAN NOT NULL,
  value              INTEGER NOT NULL,
  wca_id             VARCHAR(20) NOT NULL,
  person_country_id  VARCHAR(50) NOT NULL,
  comp_id            VARCHAR(50) NOT NULL,
  comp_date          DATE NOT NULL,
  attempts           INTEGER[],
  round_type_id      VARCHAR(2)  NOT NULL DEFAULT '',
  format_id          VARCHAR(2)  NOT NULL DEFAULT '',
  record_tag         VARCHAR(3)  NOT NULL DEFAULT '',
  comp_year          SMALLINT GENERATED ALWAYS AS (EXTRACT(YEAR FROM comp_date)::SMALLINT) STORED
);
CREATE INDEX wrt_main         ON wca_results_top (event_id, is_avg, value, wca_id) INCLUDE (id);
CREATE INDEX wrt_country      ON wca_results_top (event_id, is_avg, person_country_id, value);
CREATE INDEX wrt_wca_id       ON wca_results_top (event_id, is_avg, wca_id, value);
CREATE INDEX wrt_comp_id      ON wca_results_top (event_id, is_avg, comp_id, value);
CREATE INDEX wrt_year         ON wca_results_top (event_id, is_avg, comp_year, value, wca_id) INCLUDE (id);
CREATE INDEX wrt_country_year ON wca_results_top (event_id, is_avg, person_country_id, comp_year, value) INCLUDE (id);
CREATE INDEX wrt_comp_lookup  ON wca_results_top (comp_id);
CREATE INDEX wrt_prior_pr     ON wca_results_top (wca_id, event_id, is_avg, comp_date) INCLUDE (value);

DROP TABLE IF EXISTS wca_comp_updated_at;
CREATE TABLE wca_comp_updated_at (
  comp_id      VARCHAR(50)  PRIMARY KEY,
  content_hash BIGINT       NOT NULL
);

-- results_top.copy.tsv(1.1G)删在尾部小表之前,腾出曾致 person_ranks ENOSPC 的那段空间.
\\copy wca_results_top (${wrtCols}) FROM '${wrtFile}';
\\! rm -f ${wrtFile}
\\copy wca_comp_updated_at (comp_id, content_hash) FROM 'wca_comp_updated_at.copy.tsv';
\\! rm -f wca_comp_updated_at.copy.tsv

${smallTables}

INSERT INTO meta_historical (key, value, updated_at) VALUES ('wca_stats_extra_imported_at', NOW()::TEXT, NOW())
  ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW();

COMMIT;

${vacuumAnalyze}
`;
  }
  writeFileSync(resolve(outDir, 'load.sql'), loadSql);

  // ── summary ──
  const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
  function sizeMb(name: string): string {
    try { return (statSync(resolve(outDir, name)).size / 1024 / 1024).toFixed(1); } catch { return '?'; }
  }
  console.log(`\n=== Done in ${elapsed}s (mode=${incremental ? `incremental, ${changedComps.size} changed comps` : 'full'}) ===`);
  console.log(`  competitions      : ${comps.length.toLocaleString()} rows, ${sizeMb('wca_competitions.copy.tsv')} MB`);
  console.log(`  grand_slam        : ${gsCount.toLocaleString()} rows, ${sizeMb('wca_grand_slam.copy.tsv')} MB`);
  console.log(`  results_top       : ${allTopCount.toLocaleString()}${incremental ? `/${fullTopTotal.toLocaleString()}` : ''} rows, ${sizeMb(wrtFile)} MB`);
  console.log(`  cohort_ranks      : ${cohortCount.toLocaleString()} rows, ${sizeMb('wca_cohort_ranks.copy.tsv')} MB`);
  console.log(`  success_rate      : ${srCount.toLocaleString()} rows, ${sizeMb('wca_success_rate.copy.tsv')} MB`);
  console.log(`  all_events_done   : ${aedCount.toLocaleString()} rows, ${sizeMb('wca_all_events_done.copy.tsv')} MB`);
  console.log(`  person_ranks      : ${prCount.toLocaleString()} rows, ${sizeMb('wca_person_ranks.copy.tsv')} MB`);
  console.log(`  comp_updated_at   : ${compMaxCount.toLocaleString()} rows, ${sizeMb('wca_comp_updated_at.copy.tsv')} MB`);
}

main().catch(e => { console.error(e); process.exit(1); });
