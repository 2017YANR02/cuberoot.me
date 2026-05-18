// /wca/prediction 数据生成器:16 项目历史趋势 → stats/prediction/all_events.json
// port from .tmp/extract_all_events.mjs (mjs → ts, exec mysql CLI → mysql2/promise)
// CI 跑:在 update_database.ts 之后,输出会被 stats.yml 的 `git add -A stats/` 自动 commit
//
// 用法:npx tsx src/bin/prediction_build.ts
import mysql from 'mysql2/promise';
import { writeFileSync, mkdirSync, readFileSync, statSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { parse as parseYaml } from 'yaml';

const __dirname = dirname(fileURLToPath(import.meta.url));

interface EventCfg {
  id: string;
  scale: 'cs' | 'moves';
  subThresholds: number[];  // 时间单位 cs (1000=10s);步数项目单位 moves
}

const EVENTS: EventCfg[] = [
  { id: '222',   scale: 'cs', subThresholds: [1000, 500, 300, 200, 150, 100, 80] },
  { id: '333',   scale: 'cs', subThresholds: [1500, 1200, 1000, 800, 700, 600, 500, 400, 300] },
  { id: '444',   scale: 'cs', subThresholds: [6000, 4500, 3500, 3000, 2500, 2000, 1700, 1500] },
  { id: '555',   scale: 'cs', subThresholds: [12000, 9000, 7000, 6000, 5000, 4000, 3500, 3000] },
  { id: '666',   scale: 'cs', subThresholds: [25000, 18000, 12000, 10000, 8000, 7000, 6000] },
  { id: '777',   scale: 'cs', subThresholds: [40000, 30000, 20000, 15000, 12000, 10000, 9000] },
  { id: '333oh', scale: 'cs', subThresholds: [3000, 2000, 1500, 1200, 1000, 800, 700, 600] },
  { id: '333bf', scale: 'cs', subThresholds: [12000, 6000, 3000, 2000, 1500, 1200, 1000, 800] },
  { id: '444bf', scale: 'cs', subThresholds: [60000, 30000, 15000, 12000, 9000, 7000, 6000] },
  { id: '555bf', scale: 'cs', subThresholds: [200000, 100000, 50000, 30000, 20000, 15000, 12000] },
  { id: 'pyram', scale: 'cs', subThresholds: [500, 300, 250, 200, 150, 120, 100, 80] },
  { id: 'minx',  scale: 'cs', subThresholds: [10000, 6000, 4500, 3500, 3000, 2700, 2500, 2300] },
  { id: 'sq1',   scale: 'cs', subThresholds: [3000, 1500, 1000, 800, 600, 500, 400, 300] },
  { id: 'skewb', scale: 'cs', subThresholds: [800, 500, 300, 200, 150, 120, 100, 80] },
  { id: 'clock', scale: 'cs', subThresholds: [1500, 1000, 700, 500, 400, 300, 250, 200] },
  { id: '333fm', scale: 'moves', subThresholds: [40, 30, 25, 22, 20, 19, 18] },
];

async function main(): Promise<void> {
  const t0 = Date.now();

  // ── DB ── (与 wca_stats_extra_build.ts 同款 env-or-yml)
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

  const outDir = resolve(__dirname, '../../../../..', 'stats/prediction');
  mkdirSync(outDir, { recursive: true });
  console.log(`[out] ${outDir}`);

  async function q<T = Record<string, unknown>>(sql: string): Promise<T[]> {
    const [rows] = await conn.query<mysql.RowDataPacket[]>(sql);
    return rows as T[];
  }

  const out: { generated_at: string; notes: string; events: Record<string, unknown> } = {
    generated_at: new Date().toISOString(),
    notes: 'Centiseconds (cs): divide by 100 for seconds. Moves: integer.',
    events: {},
  };

  for (const ev of EVENTS) {
    const tEv = Date.now();
    console.log(`[event] ${ev.id}`);
    const eventData: Record<string, unknown[]> = {};

    eventData.wr_by_year = await q(`
      SELECT YEAR(c.start_date) AS year,
        MIN(CASE WHEN r.best > 0 THEN r.best END) AS wr_single,
        MIN(CASE WHEN r.average > 0 THEN r.average END) AS wr_avg,
        COUNT(*) AS solves
      FROM results r JOIN competitions c ON c.id=r.competition_id
      WHERE r.event_id='${ev.id}' AND c.start_date IS NOT NULL
      GROUP BY YEAR(c.start_date) ORDER BY year
    `);

    eventData.topN_single = await q(`
      WITH pby AS (
        SELECT YEAR(c.start_date) AS year, r.person_id, MIN(r.best) AS pb
        FROM results r JOIN competitions c ON c.id=r.competition_id
        WHERE r.event_id='${ev.id}' AND r.best>0 AND c.start_date IS NOT NULL
        GROUP BY YEAR(c.start_date), r.person_id
      ),
      ranked AS (SELECT year, pb, ROW_NUMBER() OVER (PARTITION BY year ORDER BY pb) rn FROM pby)
      SELECT year,
        MAX(CASE WHEN rn=1 THEN pb END) top1,
        MAX(CASE WHEN rn=10 THEN pb END) top10,
        MAX(CASE WHEN rn=100 THEN pb END) top100,
        MAX(CASE WHEN rn=1000 THEN pb END) top1000,
        MAX(CASE WHEN rn=10000 THEN pb END) top10000,
        COUNT(*) active_cubers
      FROM ranked GROUP BY year ORDER BY year
    `);

    eventData.topN_avg = await q(`
      WITH pba AS (
        SELECT YEAR(c.start_date) AS year, r.person_id, MIN(r.average) AS pba
        FROM results r JOIN competitions c ON c.id=r.competition_id
        WHERE r.event_id='${ev.id}' AND r.average>0 AND c.start_date IS NOT NULL
        GROUP BY YEAR(c.start_date), r.person_id
      ),
      ranked AS (SELECT year, pba, ROW_NUMBER() OVER (PARTITION BY year ORDER BY pba) rn FROM pba)
      SELECT year,
        MAX(CASE WHEN rn=1 THEN pba END) top1,
        MAX(CASE WHEN rn=10 THEN pba END) top10,
        MAX(CASE WHEN rn=100 THEN pba END) top100,
        MAX(CASE WHEN rn=1000 THEN pba END) top1000,
        MAX(CASE WHEN rn=10000 THEN pba END) top10000
      FROM ranked GROUP BY year ORDER BY year
    `);

    const subCases = ev.subThresholds
      .map((t, i) => `MIN(CASE WHEN r.best>0 AND r.best<=${t} THEN YEAR(c.start_date) END) AS s${i}`)
      .join(',\n      ');
    const subSums = ev.subThresholds
      .map((_, i) => `SUM(CASE WHEN s${i} IS NOT NULL AND s${i}<=y THEN 1 ELSE 0 END) AS sub_${ev.subThresholds[i]}`)
      .join(',\n      ');
    eventData.subX_single = await q(`
      WITH first_sub AS (
        SELECT r.person_id, ${subCases}
        FROM results r JOIN competitions c ON c.id=r.competition_id
        WHERE r.event_id='${ev.id}' AND c.start_date IS NOT NULL
        GROUP BY r.person_id
      ),
      years AS (SELECT DISTINCT YEAR(start_date) y FROM competitions WHERE start_date IS NOT NULL)
      SELECT y AS year, ${subSums}
      FROM first_sub CROSS JOIN years GROUP BY y ORDER BY year
    `);

    eventData.activity = await q(`
      SELECT YEAR(c.start_date) AS year, COUNT(DISTINCT r.person_id) AS cubers, COUNT(*) AS solves
      FROM results r JOIN competitions c ON c.id=r.competition_id
      WHERE r.event_id='${ev.id}' AND c.start_date IS NOT NULL
      GROUP BY YEAR(c.start_date) ORDER BY year
    `);

    eventData.wr_single_progression = await q(`
      WITH best_per_day AS (
        SELECT c.start_date AS d, MIN(r.best) AS daily_min
        FROM results r JOIN competitions c ON c.id=r.competition_id
        WHERE r.event_id='${ev.id}' AND r.best>0 AND c.start_date IS NOT NULL
        GROUP BY c.start_date
      ),
      running AS (
        SELECT d, daily_min,
          MIN(daily_min) OVER (ORDER BY d ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING) AS prev_best
        FROM best_per_day
      ),
      drops AS (
        SELECT d, daily_min FROM running
        WHERE prev_best IS NULL OR daily_min < prev_best
      )
      SELECT d.d AS date, d.daily_min AS value, MIN(r.person_id) AS person_id, MIN(r.person_name) AS person_name, MIN(c.country_id) AS country_id
      FROM drops d
      JOIN competitions c ON c.start_date=d.d
      JOIN results r ON r.competition_id=c.id AND r.event_id='${ev.id}' AND r.best=d.daily_min
      GROUP BY d.d, d.daily_min ORDER BY d.d
    `);

    eventData.country_share = await q(`
      WITH yearly AS (
        SELECT YEAR(c.start_date) AS year, c.country_id, COUNT(DISTINCT r.person_id) AS cubers
        FROM results r JOIN competitions c ON c.id=r.competition_id
        WHERE r.event_id='${ev.id}' AND c.start_date IS NOT NULL
        GROUP BY YEAR(c.start_date), c.country_id
      )
      SELECT year, country_id, cubers FROM yearly
      WHERE cubers >= 50 ORDER BY year, cubers DESC
    `);

    out.events[ev.id] = eventData;
    console.log(`  done in ${((Date.now() - tEv) / 1000).toFixed(1)}s`);
  }

  const outPath = resolve(outDir, 'all_events.json');
  writeFileSync(outPath, JSON.stringify(out, null, 2), 'utf8');
  const sizeMb = (statSync(outPath).size / 1024 / 1024).toFixed(2);
  console.log(`\nWrote ${outPath} (${sizeMb} MB, ${EVENTS.length} events) in ${((Date.now() - t0) / 1000).toFixed(1)}s`);

  await conn.end();
}

main().catch((err) => {
  console.error('FATAL:', err);
  process.exit(1);
});
