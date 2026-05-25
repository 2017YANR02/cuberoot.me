/**
 * 一次性脚本:用本地 MySQL 当前的 per-comp MAX(updated_at) 预填 server PG 的
 * comp_dump_state 表,避免首次 dump_comps.yml 触发 17000 场全 redump(OOM 风险)。
 *
 * 前提:
 *   - migration 0015_comp_dump_state.sql 已 apply(server PG 有 comp_dump_state)
 *   - 本地 MySQL wca_developer_database 是 bootstrap 时用的同一份 dump
 *   - ssh root@cuberoot 免密
 *
 * 跑法:
 *   cd core/packages/stats-build
 *   npx tsx src/bin/seed_comp_dump_state.ts
 *
 * 之后首次 dump_comps 跑只会 redump "本地 bootstrap 后 WCA 改过" 的比赛(小数量)。
 */
import mysql from 'mysql2/promise';
import { writeFileSync, statSync, readFileSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse as parseYaml } from 'yaml';

const __dirname = dirname(fileURLToPath(import.meta.url));

interface DbCfg { host: string; username: string; password: string; database: string }

function loadMysqlCfg(): DbCfg {
  if (process.env.MYSQL_HOST) {
    return {
      host: process.env.MYSQL_HOST,
      username: process.env.MYSQL_USER ?? 'root',
      password: process.env.MYSQL_PASS ?? '',
      database: process.env.MYSQL_DB ?? 'wca_developer_database',
    };
  }
  const yml = resolve(__dirname, '../../database.yml');
  return parseYaml(readFileSync(yml, 'utf-8'));
}

async function main() {
  const t0 = Date.now();
  const cfg = loadMysqlCfg();
  console.log(`[seed] MySQL: ${cfg.host}/${cfg.database}`);
  const conn = await mysql.createConnection({
    host: cfg.host, user: cfg.username, password: cfg.password, database: cfg.database,
    dateStrings: true,
  });

  console.log('[seed] querying SELECT competition_id, MAX(updated_at) FROM results GROUP BY ...');
  const [rows] = await conn.query<mysql.RowDataPacket[]>(
    `SELECT competition_id, MAX(updated_at) AS src_max FROM results GROUP BY competition_id`,
  );
  await conn.end();
  console.log(`[seed] rows: ${rows.length}`);

  const tsvLocal = join(tmpdir(), 'comp_dump_state_seed.tsv');
  let count = 0;
  let lines = '';
  for (const r of rows) {
    const id = r['competition_id'] as string;
    const ts = r['src_max'];
    if (!ts) continue;
    const tsStr = ts instanceof Date ? ts.toISOString().slice(0, 19).replace('T', ' ') : String(ts);
    lines += `${id}\t${tsStr}\n`;
    count++;
  }
  writeFileSync(tsvLocal, lines);
  const bytes = statSync(tsvLocal).size;
  console.log(`[seed] wrote ${tsvLocal} (${count} rows, ${(bytes / 1024).toFixed(1)} KB)`);

  // 同事务:CREATE TEMP TABLE → \copy → INSERT ON CONFLICT DO NOTHING → 已存在的不覆盖.
  const sqlLocal = join(tmpdir(), 'comp_dump_state_seed.sql');
  writeFileSync(sqlLocal, `\\set ON_ERROR_STOP on
BEGIN;
CREATE TEMP TABLE _seed (comp_id VARCHAR(50), src_max_updated_at TIMESTAMP);
\\copy _seed (comp_id, src_max_updated_at) FROM '/tmp/comp_dump_state_seed.tsv';
SELECT COUNT(*) AS seed_loaded FROM _seed;
INSERT INTO comp_dump_state (comp_id, dumped_max_updated_at, dumped_at)
  SELECT comp_id, src_max_updated_at, NOW() FROM _seed
  ON CONFLICT (comp_id) DO NOTHING;
SELECT COUNT(*) AS state_after FROM comp_dump_state;
COMMIT;
`);

  console.log('[seed] scp tsv + sql → server:/tmp/');
  // 一次 scp 两个文件;Windows / Unix 通用,不依赖 shell heredoc
  execSync(`scp "${tsvLocal}" "${sqlLocal}" root@cuberoot:/tmp/`, { stdio: 'inherit' });

  console.log('[seed] applying on server PG');
  execSync(
    `ssh root@cuberoot "PGPASSWORD=314159 psql -U recon_user -h 127.0.0.1 -d cuberoot_db -f /tmp/comp_dump_state_seed.sql && rm -f /tmp/comp_dump_state_seed.tsv /tmp/comp_dump_state_seed.sql"`,
    { stdio: 'inherit' },
  );
  console.log(`\n[seed] DONE in ${((Date.now() - t0) / 1000).toFixed(1)}s`);
}

main().catch(e => { console.error(e); process.exit(1); });
