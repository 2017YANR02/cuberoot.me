// 3x3 WR 历史数据生成器 → stats/prediction/wr333_history.json
//
// 4 张表(全部 running-min over WCA dump):
//   - singles: WR 单次 progression(每次降低都一行)
//   - ao5: WR Ao5 progression
//   - subMilestonesSingle: 首破 sub-X 单次的节点(15/10/8/7/6/5/4/3)
//   - subMilestonesAo5:     首破 sub-X Ao5 的节点(15/12/10/8/7/6/5/4)
//
// 手写注释(method/hardware/STM/TPS/feature)在
// `client/src/pages/prediction/data/wr333_history_annotations.ts`,运行时按 date 合并。
//
// 用法: pnpm --filter @cuberoot/stats-build exec tsx src/bin/wr333_history_build.ts

import mysql from 'mysql2/promise';
import { writeFileSync, mkdirSync, readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { parse as parseYaml } from 'yaml';

const __dirname = dirname(fileURLToPath(import.meta.url));

interface WrRow {
  date: string;
  time: number;
  holder: string;
  country: string;
  comp: string;
  comp_id: string;
}

interface SubMilestone {
  threshold: number;
  date: string;
  holder: string;
  country: string;
  comp: string;
  value: number;
}

async function main(): Promise<void> {
  const t0 = Date.now();

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
    charset: 'utf8mb4',
  });

  async function q<T = Record<string, unknown>>(sql: string): Promise<T[]> {
    const [rows] = await conn.query<mysql.RowDataPacket[]>(sql);
    return rows as T[];
  }

  // 公共 progression 查询 — kind ∈ {'best', 'average'}
  function progressionSQL(kind: 'best' | 'average', sinceDate: string): string {
    return `
WITH best_per_day AS (
  SELECT c.start_date AS d, MIN(r.${kind}) AS daily_min
  FROM results r JOIN competitions c ON c.id=r.competition_id
  WHERE r.event_id='333' AND r.${kind}>0 AND c.start_date>='${sinceDate}'
  GROUP BY c.start_date
),
running AS (
  SELECT d, daily_min,
    MIN(daily_min) OVER (ORDER BY d ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING) AS prev_best
  FROM best_per_day
),
drops AS (
  SELECT d, daily_min FROM running WHERE prev_best IS NULL OR daily_min < prev_best
)
SELECT
  d.d AS date,
  CAST(d.daily_min/100.0 AS DECIMAL(10,2)) AS time_s,
  MIN(r.person_name) AS holder,
  MIN(co.iso2) AS country,
  MIN(c.name) AS comp,
  MIN(c.id) AS comp_id
FROM drops d
JOIN competitions c ON c.start_date<=d.d AND c.end_date>=d.d
JOIN results r ON r.competition_id=c.id AND r.event_id='333' AND r.${kind}=d.daily_min
JOIN countries co ON co.id=r.country_id
GROUP BY d.d, d.daily_min
ORDER BY d.d`;
  }

  console.log('[query] singles progression');
  const singlesRaw = await q<{
    date: string; time_s: string; holder: string; country: string; comp: string; comp_id: string
  }>(progressionSQL('best', '2003-01-01'));
  const singles: WrRow[] = singlesRaw.map((r) => ({
    date: r.date,
    time: Number(r.time_s),
    holder: stripParen(r.holder),
    country: r.country,
    comp: r.comp,
    comp_id: r.comp_id,
  }));
  console.log(`  ${singles.length} rows`);

  console.log('[query] ao5 progression');
  const ao5Raw = await q<{
    date: string; time_s: string; holder: string; country: string; comp: string; comp_id: string
  }>(progressionSQL('average', '2007-01-01'));
  const ao5: WrRow[] = ao5Raw.map((r) => ({
    date: r.date,
    time: Number(r.time_s),
    holder: stripParen(r.holder),
    country: r.country,
    comp: r.comp,
    comp_id: r.comp_id,
  }));
  console.log(`  ${ao5.length} rows`);

  // 从 progression 中抽 sub-X 节点(首次跨越阈值)
  const SINGLE_THRESHOLDS = [15, 10, 8, 7, 6, 5, 4, 3];
  const AO5_THRESHOLDS = [15, 12, 10, 8, 7, 6, 5, 4];
  const subMilestonesSingle = pickFirstBelow(singles, SINGLE_THRESHOLDS);
  const subMilestonesAo5 = pickFirstBelow(ao5, AO5_THRESHOLDS);

  await conn.end();

  const outDir = resolve(__dirname, '../../../../..', 'stats/prediction');
  mkdirSync(outDir, { recursive: true });
  const out = {
    generated_at: new Date().toISOString(),
    notes: 'WR progression 自动生成于本地 WCA dump (running-min over daily best). 手写注释 (STM/TPS/method/hardware) 在 wr333_history_annotations.ts。',
    singles,
    ao5,
    subMilestonesSingle,
    subMilestonesAo5,
  };
  const outPath = resolve(outDir, 'wr333_history.json');
  writeFileSync(outPath, JSON.stringify(out, null, 2));
  console.log(`Wrote ${outPath} in ${((Date.now() - t0) / 1000).toFixed(1)}s`);
}

function stripParen(name: string): string {
  // "Yusheng Du (杜宇生)" → "Yusheng Du"
  return name.replace(/\s*\(.*?\)\s*$/, '').trim();
}

function pickFirstBelow(rows: WrRow[], thresholds: number[]): SubMilestone[] {
  const out: SubMilestone[] = [];
  for (const t of thresholds) {
    const first = rows.find((r) => r.time < t);
    if (first) {
      out.push({
        threshold: t,
        date: first.date,
        holder: first.holder,
        country: first.country,
        comp: first.comp,
        value: first.time,
      });
    }
  }
  return out;
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
