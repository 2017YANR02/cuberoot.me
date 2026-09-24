#!/usr/bin/env node
/** Manual SOR player-best fallback; the scheduled refresh is .github/workflows/sor.yml. */
import { spawn } from 'node:child_process';
import { createReadStream, createWriteStream, existsSync, mkdirSync, renameSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { availableParallelism } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { createInterface } from 'node:readline';
import { fileURLToPath } from 'node:url';

const repository = resolve(dirname(fileURLToPath(import.meta.url)), '../../../..');
const sorDir = resolve(process.env.SOR_DATA_DIR ?? join(repository, 'core/.tmp/sor'));
const exe = join(repository, 'core/sorcalc/target/release', `sorcalc${process.platform === 'win32' ? '.exe' : ''}`);
const copyTsv = join(sorDir, 'sor_player_best.copy.tsv');
const loadSql = join(sorDir, 'load_sor_pb.sql');
const remote = process.env.SOR_REMOTE ?? 'root@cuberoot';
const remoteDir = process.env.SOR_REMOTE_DIR ?? '/tmp';
const remotePgEnv = process.env.SOR_REMOTE_PG_ENV ?? '/root/core-api/.env';
if (!/^\/[A-Za-z0-9_./-]+$/.test(remoteDir) || !/^\/[A-Za-z0-9_./-]+$/.test(remotePgEnv)) {
  throw new Error('SOR_REMOTE_DIR and SOR_REMOTE_PG_ENV must be safe absolute paths');
}
const pgUser = process.env.SOR_PG_USER ?? 'recon_user';
const pgDb = process.env.SOR_PG_DB ?? 'cuberoot_db';
if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(pgUser) || !/^[A-Za-z_][A-Za-z0-9_]*$/.test(pgDb)) {
  throw new Error('SOR_PG_USER and SOR_PG_DB must be simple identifiers');
}
const variants = [
  { typ: 'single', nev: 17 }, { typ: 'single', nev: 21 },
  { typ: 'average', nev: 17 }, { typ: 'average', nev: 21 },
] as const;

function option(name: string, fallback: string): string {
  const i = process.argv.indexOf(name);
  if (i < 0) return fallback;
  const value = process.argv[i + 1];
  if (!value || value.startsWith('--')) throw new Error(`${name} requires a value`);
  return value;
}
if (process.argv.includes('--help')) {
  console.log('Usage: tsx core/apps/api/scripts/update_sor.mts [--skip-solve] [--no-publish] [--dry-run] [--threads N]');
  process.exit(0);
}
const threads = Number(option('--threads', String(availableParallelism())));
if (!Number.isSafeInteger(threads) || threads < 1) throw new Error('--threads must be a positive integer');
const skipSolve = process.argv.includes('--skip-solve');
const noPublish = process.argv.includes('--no-publish');
const dryRun = process.argv.includes('--dry-run');

async function countLines(path: string): Promise<number> {
  let count = 0;
  for await (const _ of createInterface({ input: createReadStream(path), crlfDelay: Infinity })) count++;
  return count;
}
async function run(command: string, args: string[], options: { cwd?: string; env?: NodeJS.ProcessEnv; stderrPath?: string } = {}): Promise<void> {
  await new Promise<void>((done, reject) => {
    const child = spawn(command, args, { cwd: options.cwd, env: options.env, stdio: ['inherit', 'inherit', 'pipe'] });
    const stderr = options.stderrPath ? createWriteStream(options.stderrPath) : undefined;
    child.stderr?.on('data', (chunk: Buffer) => { stderr?.write(chunk); process.stderr.write(chunk); });
    child.once('error', reject);
    child.once('close', (code) => {
      stderr?.end();
      code === 0 ? done() : reject(new Error(`${command} exited with code ${code}`));
    });
  });
}

if (dryRun) {
  console.log('[dry-run] Existing artifacts:');
  for (const { typ, nev } of variants) {
    const path = join(sorDir, `best_${typ}_${nev}.tsv`);
    console.log(existsSync(path) ? `  ${path}: ${await countLines(path)} rows; ${statSync(path).mtime.toISOString()}` : `  ${path}: missing`);
  }
  process.exit(0);
}
if (!skipSolve && !existsSync(exe)) throw new Error(`sorcalc not built: ${exe} (cargo build --release in core/sorcalc)`);
mkdirSync(sorDir, { recursive: true });
if (!skipSolve) {
  for (const { typ, nev } of variants) {
    console.log(`[${new Date().toISOString()}] precompute ${typ} nev=${nev}`);
    await run(exe, [typ, 'precompute', '21', String(nev)], {
      cwd: sorDir,
      env: { ...process.env, SOR_DATA_DIR: sorDir, SORCALC_THREADS: String(threads) },
      stderrPath: join(sorDir, `pc_${typ}_${nev}.err`),
    });
  }
}

const part = `${copyTsv}.part-${process.pid}`;
const output = createWriteStream(part, { encoding: 'utf8' });
let rows = 0;
try {
  for (const { typ, nev } of variants) {
    const src = join(sorDir, `best_${typ}_${nev}.tsv`);
    if (!existsSync(src)) throw new Error(`missing ${src} (all four variants are needed)`);
    const prefix = `\t${typ === 'average' ? 't' : 'f'}\tworld\t${nev === 21 ? 't' : 'f'}\t`;
    for await (const line of createInterface({ input: createReadStream(src), crlfDelay: Infinity })) {
      if (!line) continue;
      const tab = line.indexOf('\t');
      if (tab < 0) continue;
      if (!output.write(`${line.slice(0, tab)}${prefix}${line.slice(tab + 1)}\n`)) {
        await new Promise<void>((done) => output.once('drain', done));
      }
      rows++;
    }
  }
  await new Promise<void>((done, reject) => output.end((error?: Error) => error ? reject(error) : done()));
  renameSync(part, copyTsv);
} catch (error) {
  output.destroy();
  if (!output.closed) await new Promise<void>((done) => output.once('close', done));
  rmSync(part, { force: true });
  throw error;
}
console.log(`[${new Date().toISOString()}] built ${copyTsv}: ${rows} rows`);
if (noPublish) {
  console.log('[no-publish] local copy.tsv is ready');
  process.exit(0);
}

const sql = `\\set ON_ERROR_STOP 1
CREATE TABLE IF NOT EXISTS sor_player_best (
  wca_id VARCHAR(20) NOT NULL, is_avg BOOLEAN NOT NULL, scope VARCHAR(8) NOT NULL DEFAULT 'world',
  incl_cancelled BOOLEAN NOT NULL DEFAULT true, best_rank INTEGER NOT NULL,
  combo_count INTEGER NOT NULL DEFAULT 1, best_events TEXT NOT NULL,
  PRIMARY KEY (wca_id, is_avg, scope, incl_cancelled)
);
ALTER TABLE sor_player_best ADD COLUMN IF NOT EXISTS combo_count INTEGER NOT NULL DEFAULT 1;
ALTER TABLE sor_player_best ADD COLUMN IF NOT EXISTS incl_cancelled BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE sor_player_best DROP CONSTRAINT IF EXISTS sor_player_best_pkey;
ALTER TABLE sor_player_best ADD PRIMARY KEY (wca_id, is_avg, scope, incl_cancelled);
TRUNCATE sor_player_best;
\\copy sor_player_best (wca_id, is_avg, scope, incl_cancelled, best_rank, combo_count, best_events) FROM '${remoteDir}/sor_player_best.copy.tsv';
ANALYZE sor_player_best;
SELECT incl_cancelled, is_avg, count(*) FROM sor_player_best GROUP BY 1,2 ORDER BY 1,2;
`;
writeFileSync(loadSql, sql, 'utf8');
console.log(`[${new Date().toISOString()}] scp -> ${remote}:${remoteDir}/`);
await run('scp', [copyTsv, loadSql, `${remote}:${remoteDir}/`]);
console.log(`[${new Date().toISOString()}] load prod (${pgDb})`);
// The password stays on the server; it is never placed in a local process argument or log.
await run('ssh', [remote, `pw=$(sed -n 's/^DB_PASS=//p' ${remotePgEnv} | head -n 1); PGPASSWORD="$pw" psql -U ${pgUser} -h 127.0.0.1 -d ${pgDb} -v ON_ERROR_STOP=1 -f ${remoteDir}/load_sor_pb.sql`]);
await run('ssh', [remote, 'grep -rl "sum-of-ranks/player-" /var/cache/nginx/api/ 2>/dev/null | xargs -r rm -f; true']);
console.log(`[${new Date().toISOString()}] done`);
