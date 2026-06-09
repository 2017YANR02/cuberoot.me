// NOTE: 历史排名 snapshot builder
// 读本机 / CI runner 上的 MySQL WCA dump,按年/月累积每人最佳,输出 PG-format COPY TSV.
// 用法:
//   NODE_OPTIONS='--expose-gc --max-old-space-size=12288' npx tsx src/bin/historical_ranks_build.ts
// 输出:
//   output/historical_ranks/wca_continents.copy.tsv
//   output/historical_ranks/wca_countries.copy.tsv
//   output/historical_ranks/wca_persons.copy.tsv
//   output/historical_ranks/historical_ranks_snapshot.copy.tsv          ← 年级,emit 全量
//   output/historical_ranks/historical_ranks_monthly_snapshot.copy.tsv  ← 月级,smart-emit (只有更新的 cuber)
//   output/historical_ranks/load.sql                                    ← server 端 psql -f 灌进 PG
//
// 月级 smart-emit 策略(参考 cubing.pro 但收紧 emit 范围避免数据量爆炸):
//   - 月循环遇到该月有 result 才 emit
//   - emit 范围 = 该月本人有 result 的 cuber(不 emit 全量,跳过 rank decay)
//   - rank 仍是相对全量 cuber 算的,值正确
//
// server 端跑法(scp 上述文件到 /tmp/wca_import 后):
//   cd /tmp/wca_import && PGPASSWORD=... psql -U recon_user -h 127.0.0.1 -d cuberoot_db -f load.sql

import mysql from 'mysql2/promise';
import { createWriteStream, mkdirSync, writeFileSync, readFileSync, statSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { parse as parseYaml } from 'yaml';

const __dirname = dirname(fileURLToPath(import.meta.url));

// 与 stats-build 一致的 21 项 WCA 项目列表(含 4 个停办项目,历史排名仍要展示)
const EVENTS = [
  '333','222','444','555','666','777',
  '333bf','333fm','333oh',
  'minx','pyram','clock','skewb','sq1',
  '444bf','555bf','333mbf',
  '333ft','magic','mmagic','333mbo',
] as const;

const START_YEAR = 2003;
const CURRENT_YEAR = new Date().getUTCFullYear();

// PG COPY TEXT 格式转义
function pgEsc(v: string | null | undefined): string {
  if (v == null) return '\\N';
  // backslash 必须先,再 tab/newline/CR
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

// PG INTEGER[] in COPY TEXT format: {v1,v2,v3,v4,v5}
// 跳过 0/null(WCA value=0 表示 "未做" 该把,前端不渲染).
// 全 0 → \N(NULL 列),不要写 "{}" 否则前端 attempts.length 显空字符串而非"无数据"语义.
function intArr(arr: Array<number | null | undefined>): string {
  const vals = arr.filter(v => v != null && v !== 0) as number[];
  if (vals.length === 0) return '\\N';
  return `{${vals.join(',')}}`;
}

// ── historical_best_ranks 用:Fenwick(树状数组)做增量 order-statistics ──
// 维护一组"当前 PB"的计数,countLess(idx) = 压缩值索引严格小于 idx 的人数 → 名次 = +1.
class Fen {
  private t: Int32Array;
  constructor(n: number) { this.t = new Int32Array(n + 2); }
  add(i: number, v: number) { for (i++; i < this.t.length; i += i & -i) this.t[i] += v; }
  private sumLE(i: number) { let s = 0; for (i++; i > 0; i -= i & -i) s += this.t[i]; return s; }
  countLess(idx: number) { return idx > 0 ? this.sumLE(idx - 1) : 0; }
}

type BestCell = { rank: number; value: number; year: number } | null;
interface BestRow { sW: BestCell; sC: BestCell; sK: BestCell; aW: BestCell; aC: BestCell; aK: BestCell }

// 逐场重放算"历史最佳名次"(精确口径,对齐选手在排名站看到的值):
//   名次 = "该场比赛结束、当前所有已结束比赛重排时"选手的位置;每档独立取生涯最小,并记下成绩值+年份.
//   同 end_date 的多场作为一波一起灌完再查 → 同日对手都计入(避免幽灵峰值).
function computeBestRanks(rows: mysql.RowDataPacket[], continentOf: Map<string, string>): Map<string, BestRow> {
  const sorted = rows.slice().sort((a, b) => {
    const ae = a['comp_end'] as string, be = b['comp_end'] as string;
    return ae < be ? -1 : ae > be ? 1 : 0;
  });
  // 坐标压缩:single / average 各一套(值域 = 该项目出现过的不同成绩值)
  const compress = (key: 'best' | 'average') => {
    const set = new Set<number>();
    for (const r of sorted) { const v = r[key] as number; if (v > 0) set.add(v); }
    const arr = Array.from(set).sort((x, y) => x - y);
    const idx = new Map<number, number>(); arr.forEach((v, i) => idx.set(v, i));
    return { size: arr.length, idx };
  };
  const sCmp = compress('best'), aCmp = compress('average');

  interface P { s: number; sVal: number; a: number; aVal: number; country: string }
  const pb = new Map<string, P>();
  const wS = new Fen(sCmp.size), wA = new Fen(aCmp.size);
  const kS = new Map<string, Fen>(), kA = new Map<string, Fen>();
  const cS = new Map<string, Fen>(), cA = new Map<string, Fen>();
  const getF = (m: Map<string, Fen>, key: string, size: number) => { let f = m.get(key); if (!f) { f = new Fen(size); m.set(key, f); } return f; };

  const out = new Map<string, BestRow>();
  const upd = (cur: BestCell, rank: number, value: number, year: number): BestCell =>
    (!cur || rank < cur.rank) ? { rank, value, year } : cur;

  let i = 0;
  while (i < sorted.length) {
    const end = sorted[i]['comp_end'] as string;
    const year = +end.slice(0, 4);
    const improved = new Map<string, { s: boolean; a: boolean }>();
    const mark = (pid: string, k: 's' | 'a') => {
      let f = improved.get(pid); if (!f) { f = { s: false, a: false }; improved.set(pid, f); } f[k] = true;
    };
    // 灌入同 end_date 的整波
    while (i < sorted.length && (sorted[i]['comp_end'] as string) === end) {
      const r = sorted[i]; i++;
      const pid = r['person_id'] as string, cid = r['country_id'] as string;
      const best = r['best'] as number, avg = r['average'] as number;
      let p = pb.get(pid);
      if (!p) { p = { s: -1, sVal: 0, a: -1, aVal: 0, country: cid }; pb.set(pid, p); }
      // 国籍变更:把已有条目从旧国家/洲树搬走再加到新的
      if (cid !== p.country) {
        const oco = continentOf.get(p.country) ?? '_World';
        if (p.s >= 0) { getF(kS, p.country, sCmp.size).add(p.s, -1); getF(cS, oco, sCmp.size).add(p.s, -1); }
        if (p.a >= 0) { getF(kA, p.country, aCmp.size).add(p.a, -1); getF(cA, oco, aCmp.size).add(p.a, -1); }
        p.country = cid;
        const nco = continentOf.get(cid) ?? '_World';
        if (p.s >= 0) { getF(kS, cid, sCmp.size).add(p.s, 1); getF(cS, nco, sCmp.size).add(p.s, 1); }
        if (p.a >= 0) { getF(kA, cid, aCmp.size).add(p.a, 1); getF(cA, nco, aCmp.size).add(p.a, 1); }
      }
      const co = p.country, coo = continentOf.get(co) ?? '_World';
      if (best > 0) {
        const ni = sCmp.idx.get(best)!;
        if (p.s < 0 || ni < p.s) {
          if (p.s >= 0) { wS.add(p.s, -1); getF(kS, co, sCmp.size).add(p.s, -1); getF(cS, coo, sCmp.size).add(p.s, -1); }
          wS.add(ni, 1); getF(kS, co, sCmp.size).add(ni, 1); getF(cS, coo, sCmp.size).add(ni, 1);
          p.s = ni; p.sVal = best; mark(pid, 's');
        }
      }
      if (avg > 0) {
        const ni = aCmp.idx.get(avg)!;
        if (p.a < 0 || ni < p.a) {
          if (p.a >= 0) { wA.add(p.a, -1); getF(kA, co, aCmp.size).add(p.a, -1); getF(cA, coo, aCmp.size).add(p.a, -1); }
          wA.add(ni, 1); getF(kA, co, aCmp.size).add(ni, 1); getF(cA, coo, aCmp.size).add(ni, 1);
          p.a = ni; p.aVal = avg; mark(pid, 'a');
        }
      }
    }
    // 整波灌完 → 查每个刷新者当前名次,取生涯最小
    for (const [pid, fl] of improved) {
      const p = pb.get(pid)!;
      const co = p.country, coo = continentOf.get(co) ?? '_World';
      let row = out.get(pid);
      if (!row) { row = { sW: null, sC: null, sK: null, aW: null, aC: null, aK: null }; out.set(pid, row); }
      if (fl.s && p.s >= 0) {
        row.sW = upd(row.sW, wS.countLess(p.s) + 1, p.sVal, year);
        row.sC = upd(row.sC, getF(cS, coo, sCmp.size).countLess(p.s) + 1, p.sVal, year);
        row.sK = upd(row.sK, getF(kS, co, sCmp.size).countLess(p.s) + 1, p.sVal, year);
      }
      if (fl.a && p.a >= 0) {
        row.aW = upd(row.aW, wA.countLess(p.a) + 1, p.aVal, year);
        row.aC = upd(row.aC, getF(cA, coo, aCmp.size).countLess(p.a) + 1, p.aVal, year);
        row.aK = upd(row.aK, getF(kA, co, aCmp.size).countLess(p.a) + 1, p.aVal, year);
      }
    }
  }
  return out;
}

interface Acc {
  best: number;       // 0 = 无单次成绩
  avg: number;        // 0 = 无平均成绩
  country: string;    // 最近一次比赛的国籍
  // PB 上下文:single / average 各自来自的 result 行(comp + date + 5 把).
  bestSingleCompId: string;
  bestSingleDate: string;
  bestSingleAttempts: number[];
  bestAvgCompId: string;
  bestAvgDate: string;
  bestAvgAttempts: number[];
}

interface RankInfo { wr: number; cr: number; cor: number }

// 给一组 (wcaId, value, country, continent) 分配 world/country/continent rank,带并列处理
function assignRanks(
  list: Array<{ wcaId: string; val: number; country: string; continent: string }>,
): Map<string, RankInfo> {
  const out = new Map<string, RankInfo>();
  let prevVal = -1;
  let prevRank = 0;
  const ctryState = new Map<string, { prev: number; rank: number; count: number }>();
  const contState = new Map<string, { prev: number; rank: number; count: number }>();

  list.forEach((item, i) => {
    let wr: number;
    if (item.val === prevVal) {
      wr = prevRank;
    } else {
      wr = i + 1;
      prevVal = item.val;
      prevRank = wr;
    }

    let cs = ctryState.get(item.country);
    if (!cs) { cs = { prev: -1, rank: 0, count: 0 }; ctryState.set(item.country, cs); }
    let cr: number;
    if (item.val === cs.prev) {
      cr = cs.rank;
    } else {
      cr = cs.count + 1;
      cs.prev = item.val;
      cs.rank = cr;
    }
    cs.count++;

    let ks = contState.get(item.continent);
    if (!ks) { ks = { prev: -1, rank: 0, count: 0 }; contState.set(item.continent, ks); }
    let cor: number;
    if (item.val === ks.prev) {
      cor = ks.rank;
    } else {
      cor = ks.count + 1;
      ks.prev = item.val;
      ks.rank = cor;
    }
    ks.count++;

    out.set(item.wcaId, { wr, cr, cor });
  });
  return out;
}

async function main() {
  const startTime = Date.now();
  // 配置:database.yml 走本地;CI 上走 env
  const dbHost = process.env.MYSQL_HOST;
  let dbConfig: { host: string; username: string; password: string; database: string };
  if (dbHost) {
    dbConfig = {
      host: dbHost,
      username: process.env.MYSQL_USER ?? 'root',
      password: process.env.MYSQL_PASS ?? '',
      database: process.env.MYSQL_DB ?? 'wca_developer_database',
    };
  } else {
    const yamlPath = resolve(__dirname, '../../database.yml');
    dbConfig = parseYaml(readFileSync(yamlPath, 'utf-8'));
  }

  const outDir = process.env.OUT_DIR || resolve(__dirname, '../../output/historical_ranks');
  mkdirSync(outDir, { recursive: true });
  console.log(`Output: ${outDir}`);

  const conn = await mysql.createConnection({
    host: dbConfig.host,
    user: dbConfig.username,
    password: dbConfig.password,
    database: dbConfig.database,
    // 大表流式读(后面用 query stream 而非 query)
  });

  // ── 1. 连续 reference 数据(小表,直接拉全)
  console.log('[ref] continents/countries/persons/ranks');
  const [continents] = await conn.query<mysql.RowDataPacket[]>(
    `SELECT id, name FROM continents`,
  );
  const [countries] = await conn.query<mysql.RowDataPacket[]>(
    `SELECT id, iso2, name, continent_id FROM countries`,
  );
  const [persons] = await conn.query<mysql.RowDataPacket[]>(
    `SELECT wca_id, name, country_id FROM persons WHERE sub_id = 1`,
  );
  // 比赛 id→name reference(仅供 sor_over_time_build 解析"最后贡献 SOR 的那场比赛"名;不灌 PG)
  const [competitions] = await conn.query<mysql.RowDataPacket[]>(
    `SELECT id, name FROM competitions`,
  );

  // 国家 → 大洲映射(snapshot 计算需要)
  const continentOf = new Map<string, string>();
  for (const c of countries) continentOf.set(c['id'] as string, c['continent_id'] as string);

  // 写 reference TSV
  {
    const f = createWriteStream(resolve(outDir, 'wca_continents.copy.tsv'));
    for (const c of continents) {
      f.write(`${pgEsc(c['id'] as string)}\t${pgEsc(c['name'] as string)}\n`);
    }
    f.end();
  }
  {
    const f = createWriteStream(resolve(outDir, 'wca_countries.copy.tsv'));
    for (const c of countries) {
      f.write(`${pgEsc(c['id'] as string)}\t${pgEsc(c['iso2'] as string | null)}\t${pgEsc(c['name'] as string)}\t${pgEsc(c['continent_id'] as string)}\n`);
    }
    f.end();
  }
  {
    const f = createWriteStream(resolve(outDir, 'wca_persons.copy.tsv'));
    for (const p of persons) {
      f.write(`${pgEsc(p['wca_id'] as string)}\t${pgEsc(p['name'] as string)}\t${pgEsc(p['country_id'] as string)}\n`);
    }
    f.end();
  }
  {
    const f = createWriteStream(resolve(outDir, 'wca_competitions.copy.tsv'));
    for (const c of competitions) {
      f.write(`${pgEsc(c['id'] as string)}\t${pgEsc(c['name'] as string)}\n`);
    }
    f.end();
  }
  console.log(`  continents=${continents.length} countries=${countries.length} persons=${persons.length} competitions=${competitions.length}`);

  // NOTE: 不输出 wca_ranks_single / wca_ranks_average ── historical_ranks_snapshot 当年快照
  // 自带完整 world/country/continent rank,API 直接查它即可,无需额外维护当前 rank 表.

  // 释放 reference 内存
  if (global.gc) global.gc();

  // ── 2. 主任务:逐个项目算每年/每月快照 + 历史最佳名次
  const snapPath = resolve(outDir, 'historical_ranks_snapshot.copy.tsv');
  const monthSnapPath = resolve(outDir, 'historical_ranks_monthly_snapshot.copy.tsv');
  const bestPath = resolve(outDir, 'historical_best_ranks.copy.tsv');
  const snapStream = createWriteStream(snapPath);
  const monthSnapStream = createWriteStream(monthSnapPath);
  const bestStream = createWriteStream(bestPath);
  let totalYearRows = 0;
  let totalMonthRows = 0;
  let totalBestRows = 0;

  // 本地调试可设 ONLY_EVENTS=333bf,333 只跑部分项目;CI 不设 → 全 21 项
  const onlyEvents = (process.env.ONLY_EVENTS ?? '').split(',').map(s => s.trim()).filter(Boolean);

  // 计算 rank 的辅助函数(给定 acc 算 single + avg 三档 rank)
  const computeRanks = (acc: Map<string, Acc>) => {
    const singles: Array<{ wcaId: string; val: number; country: string; continent: string }> = [];
    const averages: Array<{ wcaId: string; val: number; country: string; continent: string }> = [];
    for (const [wcaId, v] of acc) {
      const continent = continentOf.get(v.country) ?? '_World';
      if (v.best > 0) singles.push({ wcaId, val: v.best, country: v.country, continent });
      if (v.avg > 0) averages.push({ wcaId, val: v.avg, country: v.country, continent });
    }
    singles.sort((a, b) => a.val - b.val);
    averages.sort((a, b) => a.val - b.val);
    return { singleRanks: assignRanks(singles), avgRanks: assignRanks(averages) };
  };

  for (const eventId of EVENTS) {
    if (onlyEvents.length && !onlyEvents.includes(eventId)) continue;
    const t0 = Date.now();
    console.log(`[${eventId}] loading results...`);

    // 拉本项目所有 result(只取需要的列),按比赛日期升序
    const [rows] = await conn.query<mysql.RowDataPacket[]>(`
      SELECT r.person_id, r.best, r.average, r.country_id,
             r.competition_id     AS comp_id,
             YEAR(c.start_date)   AS comp_year,
             MONTH(c.start_date)  AS comp_month,
             DATE_FORMAT(c.start_date, '%Y-%m-%d') AS comp_date,
             DATE_FORMAT(COALESCE(c.end_date, c.start_date), '%Y-%m-%d') AS comp_end,
             (SELECT GROUP_CONCAT(ra.value ORDER BY ra.attempt_number)
              FROM result_attempts ra WHERE ra.result_id = r.id) AS atts
      FROM results r
      JOIN competitions c ON c.id = r.competition_id
      WHERE r.event_id = ? AND c.start_date IS NOT NULL
      ORDER BY c.start_date
    `, [eventId]);

    console.log(`  ${rows.length.toLocaleString()} results loaded (${Date.now() - t0}ms)`);

    if (rows.length === 0) continue;

    // 累积每人最佳
    const acc = new Map<string, Acc>();
    let idx = 0;
    let monthEmits = 0;

    for (let year = START_YEAR; year <= CURRENT_YEAR; year++) {
      for (let month = 1; month <= 12; month++) {
        // 跳过未来月份
        const now = new Date();
        if (year > now.getUTCFullYear() ||
            (year === now.getUTCFullYear() && month > now.getUTCMonth() + 1)) {
          break;
        }

        // 消费本月所有 result
        const updatedThisMonth = new Set<string>();
        while (idx < rows.length) {
          const r = rows[idx]!;
          const ry = r['comp_year'] as number;
          const rm = r['comp_month'] as number;
          if (ry > year || (ry === year && rm > month)) break;
          const pid = r['person_id'] as string;
          const best = r['best'] as number;
          const avg = r['average'] as number;
          const country = r['country_id'] as string;
          const compId = r['comp_id'] as string;
          const compDate = r['comp_date'] as string;
          const attsStr = r['atts'] as string | null;
          const attempts: number[] = attsStr
            ? attsStr.split(',').map(s => Number(s))
            : [];
          while (attempts.length < 5) attempts.push(0);
          let cur = acc.get(pid);
          if (!cur) {
            cur = {
              best: 0, avg: 0, country,
              bestSingleCompId: '', bestSingleDate: '', bestSingleAttempts: [],
              bestAvgCompId: '', bestAvgDate: '', bestAvgAttempts: [],
            };
            acc.set(pid, cur);
          }
          if (best > 0 && (cur.best === 0 || best < cur.best)) {
            cur.best = best;
            cur.bestSingleCompId = compId;
            cur.bestSingleDate = compDate;
            cur.bestSingleAttempts = attempts;
          }
          if (avg > 0 && (cur.avg === 0 || avg < cur.avg)) {
            cur.avg = avg;
            cur.bestAvgCompId = compId;
            cur.bestAvgDate = compDate;
            cur.bestAvgAttempts = attempts;
          }
          cur.country = country;
          // 即使本人最佳没刷新,只要本月有 result 就算"参加" → 月级 emit
          // (跟 cubing.pro 行为对齐:每场比赛后该月都要有快照点)
          updatedThisMonth.add(pid);
          idx++;
        }

        if (updatedThisMonth.size === 0) continue;

        // smart-emit 月级:rank 全量算,但只 emit 本月活跃的 cuber
        const { singleRanks, avgRanks } = computeRanks(acc);
        for (const wcaId of updatedThisMonth) {
          const v = acc.get(wcaId)!;
          const sr = singleRanks.get(wcaId);
          const ar = avgRanks.get(wcaId);
          const single = v.best > 0 ? v.best : null;
          const average = v.avg > 0 ? v.avg : null;
          monthSnapStream.write(
            `${eventId}\t${year}\t${month}\t${wcaId}\t${num(single)}\t${num(average)}\t${pgEsc(v.country)}\t` +
            `${sr?.wr ?? 0}\t${sr?.cr ?? 0}\t${sr?.cor ?? 0}\t` +
            `${ar?.wr ?? 0}\t${ar?.cr ?? 0}\t${ar?.cor ?? 0}\n`,
          );
          totalMonthRows++;
        }
        monthEmits++;
      }

      // 年级 emit:年末全量(沿用旧行为,选手页 PR 历史最佳还在用这张表)
      // 额外列(2026-05 加):PB 上下文 best_single_*/best_average_*
      // — 用于 /wca/all-results?show=persons 渲染 Date/Competition/Solves 列.
      if (acc.size > 0) {
        const { singleRanks, avgRanks } = computeRanks(acc);
        for (const [wcaId, v] of acc) {
          const sr = singleRanks.get(wcaId);
          const ar = avgRanks.get(wcaId);
          const single = v.best > 0 ? v.best : null;
          const average = v.avg > 0 ? v.avg : null;
          snapStream.write(
            `${eventId}\t${year}\t${wcaId}\t${num(single)}\t${num(average)}\t${pgEsc(v.country)}\t` +
            `${sr?.wr ?? 0}\t${sr?.cr ?? 0}\t${sr?.cor ?? 0}\t` +
            `${ar?.wr ?? 0}\t${ar?.cr ?? 0}\t${ar?.cor ?? 0}\t` +
            `${v.best > 0 ? pgEsc(v.bestSingleCompId) : '\\N'}\t${v.best > 0 ? pgEsc(v.bestSingleDate) : '\\N'}\t${v.best > 0 ? intArr(v.bestSingleAttempts) : '\\N'}\t` +
            `${v.avg > 0 ? pgEsc(v.bestAvgCompId) : '\\N'}\t${v.avg > 0 ? pgEsc(v.bestAvgDate) : '\\N'}\t${v.avg > 0 ? intArr(v.bestAvgAttempts) : '\\N'}\n`,
          );
          totalYearRows++;
        }
      }
    }

    // ── 历史最佳名次:逐场重放(精确口径)→ 每选手一行 ──
    const tb = Date.now();
    const best = computeBestRanks(rows, continentOf);
    const cell = (c: BestCell) => c
      ? `${c.rank}\t${num(c.value)}\t${c.year}`
      : `\\N\t\\N\t\\N`;
    for (const [wcaId, r] of best) {
      bestStream.write(
        `${wcaId}\t${eventId}\t` +
        `${cell(r.sW)}\t${cell(r.sC)}\t${cell(r.sK)}\t` +
        `${cell(r.aW)}\t${cell(r.aC)}\t${cell(r.aK)}\n`,
      );
      totalBestRows++;
    }
    console.log(`  ${eventId} done. acc=${acc.size} monthEmits=${monthEmits} year=${totalYearRows.toLocaleString()} month=${totalMonthRows.toLocaleString()} best=${best.size.toLocaleString()} (${Date.now() - tb}ms)`);

    // 显式释放,准备下一个项目
    acc.clear();
    if (global.gc) global.gc();
  }

  await new Promise<void>((res, rej) => snapStream.end((err: unknown) => err ? rej(err) : res()));
  await new Promise<void>((res, rej) => monthSnapStream.end((err: unknown) => err ? rej(err) : res()));
  await new Promise<void>((res, rej) => bestStream.end((err: unknown) => err ? rej(err) : res()));

  await conn.end();

  // ── 3. 写 load.sql:在 server 端原子替换
  const loadSql = `-- 由 historical_ranks_build.ts 生成,跑在服务器 PG 上
-- 使用方式: cd <此 SQL 所在目录> && psql -U recon_user -h 127.0.0.1 -d cuberoot_db -f load.sql

-- historical_best_ranks 可能比 migration 0018 先被本管道触达 → CREATE IF NOT EXISTS 自足
CREATE TABLE IF NOT EXISTS historical_best_ranks (
  wca_id VARCHAR(20) NOT NULL, event_id VARCHAR(20) NOT NULL,
  s_world_rank INTEGER, s_world_value INTEGER, s_world_year SMALLINT,
  s_cont_rank INTEGER, s_cont_value INTEGER, s_cont_year SMALLINT,
  s_country_rank INTEGER, s_country_value INTEGER, s_country_year SMALLINT,
  a_world_rank INTEGER, a_world_value INTEGER, a_world_year SMALLINT,
  a_cont_rank INTEGER, a_cont_value INTEGER, a_cont_year SMALLINT,
  a_country_rank INTEGER, a_country_value INTEGER, a_country_year SMALLINT,
  PRIMARY KEY (wca_id, event_id)
);

BEGIN;

-- 同事务里清空再灌,失败回滚
TRUNCATE wca_continents CASCADE;
TRUNCATE wca_countries  CASCADE;
TRUNCATE wca_persons    CASCADE;
TRUNCATE historical_ranks_snapshot;
TRUNCATE historical_ranks_monthly_snapshot;
TRUNCATE historical_best_ranks;

\\copy wca_continents (id, name) FROM 'wca_continents.copy.tsv';
\\copy wca_countries (id, iso2, name, continent_id) FROM 'wca_countries.copy.tsv';
\\copy wca_persons (wca_id, name, country_id) FROM 'wca_persons.copy.tsv';
\\copy historical_ranks_snapshot (event_id, year, wca_id, single, average, country_id, single_world_rank, single_country_rank, single_continent_rank, avg_world_rank, avg_country_rank, avg_continent_rank, best_single_comp_id, best_single_date, best_single_attempts, best_average_comp_id, best_average_date, best_average_attempts) FROM 'historical_ranks_snapshot.copy.tsv';
\\copy historical_ranks_monthly_snapshot (event_id, year, month, wca_id, single, average, country_id, single_world_rank, single_country_rank, single_continent_rank, avg_world_rank, avg_country_rank, avg_continent_rank) FROM 'historical_ranks_monthly_snapshot.copy.tsv';
\\copy historical_best_ranks (wca_id, event_id, s_world_rank, s_world_value, s_world_year, s_cont_rank, s_cont_value, s_cont_year, s_country_rank, s_country_value, s_country_year, a_world_rank, a_world_value, a_world_year, a_cont_rank, a_cont_value, a_cont_year, a_country_rank, a_country_value, a_country_year) FROM 'historical_best_ranks.copy.tsv';

INSERT INTO meta_historical (key, value, updated_at) VALUES ('last_imported_at', NOW()::TEXT, NOW())
  ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW();

COMMIT;

ANALYZE wca_persons;
ANALYZE historical_ranks_snapshot;
ANALYZE historical_ranks_monthly_snapshot;
ANALYZE historical_best_ranks;
`;
  writeFileSync(resolve(outDir, 'load.sql'), loadSql);

  // ── 4. 总结
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  const snapMb = (statSync(snapPath).size / 1024 / 1024).toFixed(1);
  const monthMb = (statSync(monthSnapPath).size / 1024 / 1024).toFixed(1);
  const bestMb = (statSync(bestPath).size / 1024 / 1024).toFixed(1);
  console.log(`\n=== Done in ${elapsed}s ===`);
  console.log(`Year snapshot rows:  ${totalYearRows.toLocaleString()}  (${snapMb} MB)`);
  console.log(`Month snapshot rows: ${totalMonthRows.toLocaleString()}  (${monthMb} MB)`);
  console.log(`Best-rank rows:      ${totalBestRows.toLocaleString()}  (${bestMb} MB)`);
  console.log(`Output dir: ${outDir}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
