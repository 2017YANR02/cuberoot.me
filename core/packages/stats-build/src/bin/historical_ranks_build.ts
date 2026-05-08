// NOTE: 历史排名 snapshot builder
// 读本机 / CI runner 上的 MySQL WCA dump,按年累积每人最佳,输出 PG-format COPY TSV.
// 用法:
//   NODE_OPTIONS='--expose-gc --max-old-space-size=12288' npx tsx src/bin/historical_ranks_build.ts
// 输出:
//   output/historical_ranks/wca_continents.copy.tsv
//   output/historical_ranks/wca_countries.copy.tsv
//   output/historical_ranks/wca_persons.copy.tsv
//   output/historical_ranks/wca_ranks_single.copy.tsv
//   output/historical_ranks/wca_ranks_average.copy.tsv
//   output/historical_ranks/historical_ranks_snapshot.copy.tsv
//   output/historical_ranks/load.sql           ← server 端 psql -f 灌进 PG
//
// server 端跑法(scp 上述文件到 /tmp/wca_import 后):
//   cd /tmp/wca_import && PGPASSWORD=... psql -U recon_user -h 127.0.0.1 -d recon_db -f load.sql

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

interface Acc {
  best: number;       // 0 = 无单次成绩
  avg: number;        // 0 = 无平均成绩
  country: string;    // 最近一次比赛的国籍
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
      database: process.env.MYSQL_DB ?? 'wca_statistics',
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
  console.log(`  continents=${continents.length} countries=${countries.length} persons=${persons.length}`);

  // NOTE: 不输出 wca_ranks_single / wca_ranks_average ── historical_ranks_snapshot 当年快照
  // 自带完整 world/country/continent rank,API 直接查它即可,无需额外维护当前 rank 表.

  // 释放 reference 内存
  if (global.gc) global.gc();

  // ── 2. 主任务:逐个项目算每年快照
  const snapPath = resolve(outDir, 'historical_ranks_snapshot.copy.tsv');
  const snapStream = createWriteStream(snapPath);
  let totalRows = 0;

  for (const eventId of EVENTS) {
    const t0 = Date.now();
    console.log(`[${eventId}] loading results...`);

    // 拉本项目所有 result(只取需要的列),按比赛日期升序
    const [rows] = await conn.query<mysql.RowDataPacket[]>(`
      SELECT r.person_id, r.best, r.average, r.country_id,
             YEAR(c.start_date) AS comp_year,
             c.start_date AS sd
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

    for (let year = START_YEAR; year <= CURRENT_YEAR; year++) {
      while (idx < rows.length && (rows[idx]!['comp_year'] as number) <= year) {
        const r = rows[idx++]!;
        const pid = r['person_id'] as string;
        const best = r['best'] as number;
        const avg = r['average'] as number;
        const country = r['country_id'] as string;
        let cur = acc.get(pid);
        if (!cur) {
          cur = { best: 0, avg: 0, country };
          acc.set(pid, cur);
        }
        if (best > 0 && (cur.best === 0 || best < cur.best)) cur.best = best;
        if (avg > 0 && (cur.avg === 0 || avg < cur.avg)) cur.avg = avg;
        cur.country = country; // 跟新到最近一次比赛国籍
      }

      if (acc.size === 0) continue;

      // 收集 single 排序输入
      const singles: Array<{ wcaId: string; val: number; country: string; continent: string }> = [];
      const averages: Array<{ wcaId: string; val: number; country: string; continent: string }> = [];
      for (const [wcaId, v] of acc) {
        const continent = continentOf.get(v.country) ?? '_World';
        if (v.best > 0) singles.push({ wcaId, val: v.best, country: v.country, continent });
        if (v.avg > 0) averages.push({ wcaId, val: v.avg, country: v.country, continent });
      }
      singles.sort((a, b) => a.val - b.val);
      averages.sort((a, b) => a.val - b.val);
      const singleRanks = assignRanks(singles);
      const avgRanks = assignRanks(averages);

      // 输出该 (event, year) 所有人的快照行
      for (const [wcaId, v] of acc) {
        const sr = singleRanks.get(wcaId);
        const ar = avgRanks.get(wcaId);
        const single = v.best > 0 ? v.best : null;
        const average = v.avg > 0 ? v.avg : null;
        snapStream.write(
          `${eventId}\t${year}\t${wcaId}\t${num(single)}\t${num(average)}\t${pgEsc(v.country)}\t` +
          `${sr?.wr ?? 0}\t${sr?.cr ?? 0}\t${sr?.cor ?? 0}\t` +
          `${ar?.wr ?? 0}\t${ar?.cr ?? 0}\t${ar?.cor ?? 0}\n`,
        );
        totalRows++;
      }
    }

    console.log(`  ${eventId} done. acc.size=${acc.size}, total snapshot rows so far: ${totalRows.toLocaleString()}`);

    // 显式释放,准备下一个项目
    acc.clear();
    if (global.gc) global.gc();
  }

  await new Promise<void>((res, rej) => snapStream.end((err: unknown) => err ? rej(err) : res()));

  await conn.end();

  // ── 3. 写 load.sql:在 server 端原子替换
  const loadSql = `-- 由 historical_ranks_build.ts 生成,跑在服务器 PG 上
-- 使用方式: cd <此 SQL 所在目录> && psql -U recon_user -h 127.0.0.1 -d recon_db -f load.sql

BEGIN;

-- 同事务里清空再灌,失败回滚
TRUNCATE wca_continents CASCADE;
TRUNCATE wca_countries  CASCADE;
TRUNCATE wca_persons    CASCADE;
TRUNCATE historical_ranks_snapshot;

\\copy wca_continents (id, name) FROM 'wca_continents.copy.tsv';
\\copy wca_countries (id, iso2, name, continent_id) FROM 'wca_countries.copy.tsv';
\\copy wca_persons (wca_id, name, country_id) FROM 'wca_persons.copy.tsv';
\\copy historical_ranks_snapshot (event_id, year, wca_id, single, average, country_id, single_world_rank, single_country_rank, single_continent_rank, avg_world_rank, avg_country_rank, avg_continent_rank) FROM 'historical_ranks_snapshot.copy.tsv';

INSERT INTO meta_historical (key, value, updated_at) VALUES ('last_imported_at', NOW()::TEXT, NOW())
  ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW();

COMMIT;

ANALYZE wca_persons;
ANALYZE historical_ranks_snapshot;
`;
  writeFileSync(resolve(outDir, 'load.sql'), loadSql);

  // ── 4. 总结
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  const snapMb = (statSync(snapPath).size / 1024 / 1024).toFixed(1);
  console.log(`\n=== Done in ${elapsed}s ===`);
  console.log(`Total snapshot rows: ${totalRows.toLocaleString()}`);
  console.log(`Snapshot file size: ${snapMb} MB`);
  console.log(`Output dir: ${outDir}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
