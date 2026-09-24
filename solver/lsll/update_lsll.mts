#!/usr/bin/env node
/** Export LSLL cases and load only changed rows into local or production PG. */
import { spawn } from 'node:child_process';
import { createReadStream, existsSync, mkdirSync, mkdtempSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { createInterface } from 'node:readline';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const repo = resolve(here, '../..');
const incremental = join(here, 'incremental');
const csv = join(here, 'lsll_cases.csv');
const local = process.argv.includes('--local');
const exportOnly = process.argv.includes('--export-only');
const solve = process.argv.includes('--solve');
const manifest = join(incremental, local ? 'pg_lsll_manifest_local.tsv' : 'pg_lsll_manifest.tsv');
const nextManifest = `${manifest}.new`;
const diffTool = join(repo, 'core/jobs/scramble-stats-build/pg_incremental_diff.mjs');
const remoteHost = process.env.LSLL_REMOTE_HOST ?? 'cuberoot';
const remoteDir = process.env.LSLL_REMOTE_DIR ?? '/root';
const remotePgEnv = process.env.LSLL_REMOTE_PG_ENV ?? '/root/core-api/.env';
if (!/^\/[A-Za-z0-9_./-]+$/.test(remoteDir) || !/^\/[A-Za-z0-9_./-]+$/.test(remotePgEnv)) {
  throw new Error('LSLL_REMOTE_DIR and LSLL_REMOTE_PG_ENV must be safe absolute paths');
}
if (process.argv.includes('--help')) {
  console.log('Usage: tsx solver/lsll/update_lsll.mts [--solve] [--local] [--export-only]');
  process.exit(0);
}

async function run(command: string, args: string[], cwd = here): Promise<string> {
  return new Promise<string>((done, reject) => {
    const child = spawn(command, args, { cwd, stdio: ['inherit', 'pipe', 'inherit'] });
    let output = '';
    child.stdout?.on('data', (chunk: Buffer) => { output += chunk.toString(); process.stdout.write(chunk); });
    child.once('error', reject);
    child.once('close', (code) => code === 0 ? done(output) : reject(new Error(`${command} exited with code ${code}`)));
  });
}
async function countLines(path: string): Promise<number> {
  let n = 0;
  for await (const _ of createInterface({ input: createReadStream(path), crlfDelay: Infinity })) n++;
  return n;
}
function step(label: string): void { console.log(`\n=== ${label} ===`); }

mkdirSync(incremental, { recursive: true });
if (solve) {
  if (!existsSync(join(here, 'corpus.txt'))) throw new Error('corpus.txt 不存在；先从 core 运行 LSLL corpus 生成器');
  step('求解 corpus.txt（按 key 续跑）');
  await run(process.execPath, [join(here, 'solve_loop.mjs')]);
}
step('导出 CSV');
await run(process.execPath, [join(here, 'export_cases.mjs'), '--out', csv]);
if (exportOnly) { console.log('--export-only: CSV 已生成，未连接数据库。'); process.exit(0); }

const temp = mkdtempSync(join(tmpdir(), 'lsll-incremental-'));
try {
  step('计算增量');
  const manifestExisted = existsSync(manifest);
  const delta = join(temp, 'lsll_delta.csv');
  const deleted = join(temp, 'lsll_deleted.txt');
  const output = await run(process.execPath, [diffTool, '--csv', csv, '--manifest', manifest, '--key-cols', '1', '--header',
    '--out-delta', delta, '--out-deleted', deleted, '--out-manifest', nextManifest]);
  const stats = JSON.parse(output.trim().split(/\r?\n/).at(-1) ?? '{}') as { deltaRows: number; deleted: number };
  const rows = (await countLines(csv)) - 1;
  if (manifestExisted && stats.deltaRows === 0 && stats.deleted === 0) {
    console.log(`无变化，跳过灌库（manifest 命中 ${rows} 行）`);
    renameSync(nextManifest, manifest);
    process.exit(0);
  }
  const src = manifestExisted ? delta : csv;
  const what = manifestExisted ? `增量 UPSERT ${stats.deltaRows} 行 + DELETE ${stats.deleted} 键` : `基线全量 UPSERT ${rows} 行`;
  const remoteSrc = `${remoteDir}/_lsll_src.csv`;
  const remoteDel = `${remoteDir}/_lsll_del.csv`;
  const remoteSql = `${remoteDir}/_lsll.sql`;
  const sqlBody = `\\set ON_ERROR_STOP on
BEGIN;
CREATE TEMP TABLE _lsll_stage (LIKE lsll_cases) ON COMMIT DROP;
ALTER TABLE _lsll_stage DROP COLUMN stm, DROP COLUMN mcc_order, DROP COLUMN updated_at;
\\copy _lsll_stage (canonical_key,htm,qtm,exhaustive,optimal_algs) FROM '__SRC__' WITH (FORMAT csv, HEADER true)
INSERT INTO lsll_cases AS t (canonical_key,htm,qtm,exhaustive,optimal_algs)
  SELECT canonical_key,htm,qtm,exhaustive,optimal_algs FROM _lsll_stage
  ON CONFLICT (canonical_key) DO UPDATE
    SET htm=EXCLUDED.htm, qtm=EXCLUDED.qtm, exhaustive=EXCLUDED.exhaustive,
        optimal_algs=EXCLUDED.optimal_algs, updated_at=now();
__DELETE__
COMMIT;
SELECT count(*) AS lsll_cases_total, count(*) FILTER (WHERE exhaustive) AS exhaustive_rows FROM lsll_cases;
`;
  if (local) {
    step(`灌本地 pg13 · ${what}`);
    const localDel = manifestExisted && stats.deleted > 0 ? `CREATE TEMP TABLE _lsll_del (canonical_key varchar(12)) ON COMMIT DROP;
\\copy _lsll_del FROM '/tmp/lsll_del.csv' WITH (FORMAT csv)
DELETE FROM lsll_cases t USING _lsll_del d WHERE t.canonical_key = d.canonical_key;
` : '';
    const sql = sqlBody.replace('__SRC__', '/tmp/lsll_src.csv').replace('__DELETE__', localDel);
    const sqlPath = join(temp, 'lsll_load_local.sql');
    writeFileSync(sqlPath, sql, 'utf8');
    await run('docker', ['cp', join(repo, 'core/apps/api/migrations/0094_lsll_cases.sql'), 'pg13:/tmp/0094.sql']);
    await run('docker', ['exec', 'pg13', 'psql', '-U', 'postgres', '-d', 'cuberoot_db', '-v', 'ON_ERROR_STOP=1', '-q', '-f', '/tmp/0094.sql']);
    await run('docker', ['cp', src, 'pg13:/tmp/lsll_src.csv']);
    if (localDel) await run('docker', ['cp', deleted, 'pg13:/tmp/lsll_del.csv']);
    await run('docker', ['cp', sqlPath, 'pg13:/tmp/lsll_load.sql']);
    await run('docker', ['exec', 'pg13', 'psql', '-U', 'postgres', '-d', 'cuberoot_db', '-v', 'ON_ERROR_STOP=1', '-f', '/tmp/lsll_load.sql']);
    await run('docker', ['exec', 'pg13', 'rm', '-f', '/tmp/lsll_src.csv', '/tmp/lsll_del.csv', '/tmp/lsll_load.sql', '/tmp/0094.sql']);
  } else {
    step(`灌线上 PG · ${what}`);
    const delSql = manifestExisted && stats.deleted > 0 ? `CREATE TEMP TABLE _lsll_del (canonical_key varchar(12)) ON COMMIT DROP;
\\copy _lsll_del FROM '${remoteDel}' WITH (FORMAT csv)
DELETE FROM lsll_cases t USING _lsll_del d WHERE t.canonical_key = d.canonical_key;
` : '';
    const sql = sqlBody.replace('__SRC__', remoteSrc).replace('__DELETE__', delSql);
    const sqlPath = join(temp, 'lsll_load.sql');
    writeFileSync(sqlPath, sql, 'utf8');
    await run('scp', [src, `${remoteHost}:${remoteSrc}`]);
    if (delSql) await run('scp', [deleted, `${remoteHost}:${remoteDel}`]);
    await run('scp', [sqlPath, `${remoteHost}:${remoteSql}`]);
    // The password is read only on the server and never appears in local argv/logs.
    const cleanup = [remoteSrc, remoteSql, ...(delSql ? [remoteDel] : [])].join(' ');
    const remoteCommand = `pw=$(sed -n 's/^DB_PASS=//p' ${remotePgEnv} | head -n 1); PGPASSWORD="$pw" psql -U recon_user -h 127.0.0.1 -d cuberoot_db -v ON_ERROR_STOP=1 -f ${remoteSql}; rc=$?; rm -f ${cleanup}; exit $rc`;
    await run('ssh', [remoteHost, remoteCommand]);
  }
  renameSync(nextManifest, manifest);
  console.log(`完成；manifest 已更新，全量 ${rows} 行。`);
} finally {
  rmSync(temp, { recursive: true, force: true });
}
