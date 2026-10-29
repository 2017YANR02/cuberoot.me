/** Start only the dedicated local capture database and API. Never starts Next. */
import { spawn, spawnSync, type ChildProcess } from 'node:child_process';
import { randomBytes, createHash } from 'node:crypto';
import { createConnection } from 'node:net';
import { promises as fs } from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseEnv } from 'node:util';

const core = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const base = resolve(core, '.local-data/recon-capture');
const data = join(base, 'postgres');
const envFile = resolve(core, '.env.recon-intake.local');
const markerFile = join(base, 'postgres-owner.json');
const runtimeFile = join(base, 'runtime.json');
const lockFile = join(base, '.launcher.lock');
const database = 'recon_intake_local';
const digest = (text: string) => createHash('sha256').update(text).digest('hex');
let helper: ChildProcess | undefined;
let stopping = false;
let apiKey = '';
let dbPassword = '';

type Config = { DB_HOST: string; DB_PORT: string; DB_NAME: string; DB_USER: string; DB_PASS: string; ADMIN_API_KEY: string; PORT: string; DRIVE_STORAGE_DIR: string };
interface Owner {
  version: 1; core: string; data: string; port: number; user: string; database: string;
  connectionHash: string; major: string; configHash: string | null;
}
interface Runtime { version: 1; core: string; apiPort: number; helperPid: number | null; postgresPid: number | null; managedPostgres: boolean }

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
const cleanError = (text: string) => [apiKey, dbPassword].filter(Boolean).reduce((result, secret) => result.replaceAll(secret, '[redacted]'), text);
const alive = (pid: number) => {
  try { process.kill(pid, 0); return true; } catch (error) { return (error as NodeJS.ErrnoException).code !== 'ESRCH'; }
};
const port = (value: string, name: string) => {
  const number = Number(value);
  if (!Number.isInteger(number) || number < 1024 || number > 65535) throw new Error(`${name} must be an unprivileged TCP port`);
  return number;
};

async function info(path: string) {
  return fs.lstat(path).catch((error: NodeJS.ErrnoException) => { if (error.code === 'ENOENT') return null; throw error; });
}
async function safeDirectory(path: string) {
  await fs.mkdir(path, { recursive: true, mode: 0o700 });
  const stat = await fs.lstat(path);
  if (!stat.isDirectory() || stat.isSymbolicLink() || (process.getuid && stat.uid !== process.getuid()))
    throw new Error(`Local data path must be a directory owned by this user: ${path}`);
}
async function json<T>(path: string): Promise<T | null> {
  const stat = await info(path);
  if (!stat) return null;
  if (!stat.isFile() || stat.isSymbolicLink() || stat.size > 64 * 1024) throw new Error(`Invalid local state: ${basename(path)}`);
  return JSON.parse(await fs.readFile(path, 'utf8')) as T;
}
async function save(path: string, value: unknown) {
  const temporary = path + `.${process.pid}.tmp`;
  await fs.writeFile(temporary, JSON.stringify(value, null, 2) + '\n', { flag: 'wx', mode: 0o600 });
  try { await fs.rename(temporary, path); } finally { await fs.unlink(temporary).catch(() => {}); }
}
async function listening(host: string, number: number): Promise<boolean> {
  return new Promise(resolve => {
    const socket = createConnection({ host, port: number });
    const finish = (value: boolean) => { socket.destroy(); resolve(value); };
    socket.once('connect', () => finish(true));
    socket.once('error', () => finish(false));
    socket.setTimeout(750, () => finish(false));
  });
}

function run(file: string, args: string[], config?: Config, timeout = 30_000): string {
  const result = spawnSync(file, args, { cwd: core, encoding: 'utf8', timeout, maxBuffer: 2 * 1024 * 1024,
    env: { ...process.env, ...(config ? { PGPASSWORD: config.DB_PASS, PGCONNECT_TIMEOUT: '5' } : {}) } });
  if (result.error || result.status !== 0)
    throw new Error(cleanError(`${basename(file)} failed: ${result.error?.message ?? result.stderr.trim() ?? 'nonzero exit'}`).slice(0, 2000));
  return result.stdout.trim();
}
async function postgresBin() {
  let candidate = process.env.RECON_CAPTURE_PG_BIN;
  if (!candidate) {
    const result = spawnSync('pg_config', ['--bindir'], { encoding: 'utf8', timeout: 5000 });
    if (result.status === 0) candidate = result.stdout.trim();
  }
  if (!candidate) candidate = '/opt/homebrew/opt/postgresql@16/bin';
  const bin = resolve(candidate);
  for (const name of ['initdb', 'postgres', 'pg_ctl', 'psql', 'createdb'])
    await fs.access(join(bin, name)).catch(() => { throw new Error('PostgreSQL binaries are unavailable; set RECON_CAPTURE_PG_BIN to the installed bin directory'); });
  return bin;
}
const connectionArgs = (config: Config) => ['--host', config.DB_HOST, '--port', config.DB_PORT, '--username', config.DB_USER, '--no-password'];
function psql(bin: string, config: Config, name: string, statement: string) {
  return run(join(bin, 'psql'), [...connectionArgs(config), '--no-psqlrc', '--tuples-only', '--no-align', '--set', 'ON_ERROR_STOP=1', '--dbname', name, '--command', statement], config);
}

async function configuration(): Promise<{ config: Config; newConfig: boolean }> {
  const stat = await info(envFile);
  if (stat && (!stat.isFile() || stat.isSymbolicLink())) throw new Error('Local environment file must be a regular file');
  const original = stat ? await fs.readFile(envFile, 'utf8') : '';
  const existing = parseEnv(original);
  const config: Config = {
    DB_HOST: existing.DB_HOST ?? '127.0.0.1', DB_PORT: existing.DB_PORT ?? '5433', DB_NAME: existing.DB_NAME ?? database,
    DB_USER: existing.DB_USER ?? 'recon_capture', DB_PASS: existing.DB_PASS ?? randomBytes(32).toString('base64url'),
    ADMIN_API_KEY: existing.ADMIN_API_KEY ?? randomBytes(32).toString('base64url'), PORT: existing.PORT ?? '3011',
    DRIVE_STORAGE_DIR: existing.DRIVE_STORAGE_DIR ?? join(base, 'drive'),
  };
  apiKey = config.ADMIN_API_KEY; dbPassword = config.DB_PASS;
  if (!['127.0.0.1', 'localhost', '::1'].includes(config.DB_HOST) || config.DB_NAME !== database)
    throw new Error('Only loopback PostgreSQL and the dedicated recon_intake_local database are allowed');
  if (!/^[a-z_][a-z0-9_]{0,62}$/i.test(config.DB_USER) || !config.DB_PASS || !config.ADMIN_API_KEY)
    throw new Error('Configure a local database user, password and administrator key');
  port(config.DB_PORT, 'DB_PORT'); port(config.PORT, 'PORT');
  config.DRIVE_STORAGE_DIR = resolve(config.DRIVE_STORAGE_DIR);
  for (const name of ['RECON_CAPTURE_API_URL', 'RECON_INTAKE_API_URL']) {
    if (existing[name] === undefined) continue;
    const url = new URL(existing[name]);
    if (url.protocol !== 'http:' || !['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname)
      || Number(url.port || '80') !== Number(config.PORT) || url.pathname !== '/' || url.username || url.password || url.search || url.hash)
      throw new Error(`${name} must point to this local API before using the local starter`);
  }
  const additions: Record<string, string> = { ...config,
    ...(!stat ? { RECON_CAPTURE_MANAGED_POSTGRES: '1' } : {}),
    RECON_CAPTURE_API_URL: `http://127.0.0.1:${config.PORT}`, RECON_INTAKE_API_URL: `http://127.0.0.1:${config.PORT}` };
  const lines: string[] = [];
  for (const [name, value] of Object.entries(additions)) {
    if (existing[name] !== undefined) continue;
    if (/[\r\n'\0]/.test(value)) throw new Error(`Unsupported characters in ${name}`);
    lines.push(`${name}='${value}'`);
  }
  if (lines.length) {
    const text = original + (original && !original.endsWith('\n') ? '\n' : '') + lines.join('\n') + '\n';
    if (stat) await fs.appendFile(envFile, text.slice(original.length), { mode: 0o600 });
    else await fs.writeFile(envFile, text, { flag: 'wx', mode: 0o600 });
  }
  await fs.chmod(envFile, 0o600);
  return { config, newConfig: !stat || existing.RECON_CAPTURE_MANAGED_POSTGRES === '1' };
}

async function ensureDatabase(config: Config, newConfig: boolean, bin: string) {
  const dbPort = port(config.DB_PORT, 'DB_PORT');
  const owner = await json<Owner>(markerFile);
  if (!owner && !newConfig) {
    // An explicit existing local configuration is used as-is, never initialized or restarted.
    if (!(await listening(config.DB_HOST, dbPort))) throw new Error('Configured local PostgreSQL is not running; start that database or supply a dedicated new capture configuration');
    if (psql(bin, config, database, 'SELECT current_database()') !== database) throw new Error('Local database identity mismatch');
    return { managed: false, pid: null };
  }
  if (config.DB_HOST !== '127.0.0.1') throw new Error('Managed capture PostgreSQL binds only 127.0.0.1');
  const fingerprint = digest(JSON.stringify({ host: config.DB_HOST, port: dbPort, database, user: config.DB_USER, password: config.DB_PASS }));
  const version = run(join(bin, 'postgres'), ['--version']);
  const major = /PostgreSQL\) (\d+)/.exec(version)?.[1];
  if (!major) throw new Error('Could not identify the installed PostgreSQL major version');
  let marker: Owner = owner ?? { version: 1, core, data, port: dbPort, user: config.DB_USER, database, connectionHash: fingerprint, major, configHash: null };
  if (marker.version !== 1 || marker.core !== core || marker.data !== data || marker.port !== dbPort || marker.database !== database
    || marker.user !== config.DB_USER || marker.connectionHash !== fingerprint || marker.major !== major)
    throw new Error('Managed PostgreSQL ownership or configuration differs; existing data has been preserved');
  const exists = await info(data);
  if (!owner && exists) throw new Error('An unregistered PostgreSQL directory already exists; it will not be adopted');
  if (!exists) {
    if (await listening('127.0.0.1', dbPort)) throw new Error(`Port ${dbPort} is occupied by an unowned service; it will not be changed`);
    if (!owner) await save(markerFile, marker);
    const passwordFile = join(base, `.initdb-password-${process.pid}`);
    await fs.writeFile(passwordFile, config.DB_PASS + '\n', { flag: 'wx', mode: 0o600 });
    try {
      run(join(bin, 'initdb'), ['--pgdata', data, '--username', config.DB_USER, '--pwfile', passwordFile,
        '--auth-local=scram-sha-256', '--auth-host=scram-sha-256', '--encoding=UTF8', '--no-locale', '--no-instructions'], config, 30_000);
    } finally { await fs.unlink(passwordFile).catch(() => {}); }
    const settings = `\n# Dedicated CubeRoot capture development database.\nlisten_addresses = '127.0.0.1'\nport = ${dbPort}\nunix_socket_directories = ''\nmax_connections = 20\nshared_buffers = '32MB'\nwork_mem = '2MB'\nmaintenance_work_mem = '16MB'\neffective_cache_size = '64MB'\nautovacuum_max_workers = 1\nmax_worker_processes = 2\nmax_parallel_workers = 0\nmax_parallel_workers_per_gather = 0\nwal_buffers = '4MB'\nmin_wal_size = '32MB'\nmax_wal_size = '128MB'\njit = off\npassword_encryption = 'scram-sha-256'\n`;
    await fs.appendFile(join(data, 'postgresql.conf'), settings);
    marker = { ...marker, configHash: digest(await fs.readFile(join(data, 'postgresql.conf'), 'utf8')) };
    await save(markerFile, marker);
  }
  await safeDirectory(data);
  if ((await fs.readFile(join(data, 'PG_VERSION'), 'utf8')).trim() !== marker.major || !marker.configHash
    || digest(await fs.readFile(join(data, 'postgresql.conf'), 'utf8')) !== marker.configHash)
    throw new Error('Managed PostgreSQL files changed or initialization is incomplete; data has been preserved');
  const auto = await fs.readFile(join(data, 'postgresql.auto.conf'), 'utf8');
  if (auto.split('\n').some(line => line.trim() && !line.trim().startsWith('#')))
    throw new Error('Managed PostgreSQL has unexpected ALTER SYSTEM overrides; refusing to start');
  const status = spawnSync(join(bin, 'pg_ctl'), ['status', '-D', data], { encoding: 'utf8', timeout: 5000 });
  if (status.status !== 0) {
    if (await listening('127.0.0.1', dbPort)) throw new Error(`Port ${dbPort} is occupied by another service; it will not be changed`);
    run(join(bin, 'pg_ctl'), ['start', '-D', data, '-l', join(base, 'postgres.log'), '-w', '-t', '20'], config, 25_000);
  }
  const pidFile = (await fs.readFile(join(data, 'postmaster.pid'), 'utf8')).split('\n');
  const postgresPid = Number(pidFile[0]);
  if (!Number.isSafeInteger(postgresPid) || postgresPid <= 0 || resolve(pidFile[1]) !== data || Number(pidFile[3]) !== dbPort || !alive(postgresPid))
    throw new Error('Managed PostgreSQL process identity does not match its registered directory');
  // This maintenance connection is only to our own freshly registered cluster.
  const found = psql(bin, config, 'postgres', `SELECT 1 FROM pg_database WHERE datname = '${database}'`);
  if (found !== '1') run(join(bin, 'createdb'), [...connectionArgs(config), '--maintenance-db', 'postgres', database], config);
  const settings = JSON.parse(psql(bin, config, database,
    "SELECT json_build_object('database', current_database(), 'directory', current_setting('data_directory'), 'host', current_setting('listen_addresses'), 'port', current_setting('port'), 'buffers', current_setting('shared_buffers'), 'connections', current_setting('max_connections'))::text")) as Record<string, string>;
  if (settings.database !== database || resolve(settings.directory) !== data || settings.host !== '127.0.0.1'
    || Number(settings.port) !== dbPort || settings.buffers !== '32MB' || settings.connections !== '20')
    throw new Error('Running PostgreSQL does not match the dedicated capture configuration');
  return { managed: true, pid: postgresPid };
}

async function main() {
  if (process.argv.slice(2).some(arg => !['--help', '-h'].includes(arg))) throw new Error('Use recon:capture:dev without arguments');
  if (process.argv.length > 2) { console.log('Start the dedicated local PostgreSQL and capture API; leave the existing Next server running. Ctrl-C stops only this API.'); return; }
  await safeDirectory(base);
  const { config, newConfig } = await configuration();
  const apiPort = port(config.PORT, 'PORT');
  if (await listening('127.0.0.1', apiPort)) {
    const runtime = await json<Runtime>(runtimeFile);
    if (runtime?.core === core && runtime.apiPort === apiPort && runtime.helperPid && alive(runtime.helperPid)) {
      const response = await fetch(`http://127.0.0.1:${apiPort}/v1/recon-captures/status`, {
        headers: { 'X-Admin-Key': config.ADMIN_API_KEY }, redirect: 'error', signal: AbortSignal.timeout(3000),
      }).catch(() => null);
      if (response?.ok) { await response.body?.cancel(); console.log(`Local capture API is already running on 127.0.0.1:${apiPort}.`); return; }
      await response?.body?.cancel();
    }
    throw new Error(`Port ${apiPort} is occupied by an unowned or unavailable service; it will not be stopped`);
  }
  let lock;
  try { lock = await fs.open(lockFile, 'wx', 0o600); }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
    const previous = await json<{ pid: number; core: string }>(lockFile);
    if (!previous || previous.core !== core || !Number.isSafeInteger(previous.pid) || alive(previous.pid)) throw new Error('Another capture launcher owns the local startup lock');
    await fs.unlink(lockFile); lock = await fs.open(lockFile, 'wx', 0o600);
  }
  try {
    await lock.writeFile(JSON.stringify({ pid: process.pid, core }));
    await safeDirectory(config.DRIVE_STORAGE_DIR);
    const pg = await ensureDatabase(config, newConfig, await postgresBin());
    const runtime: Runtime = { version: 1, core, apiPort, helperPid: null, postgresPid: pg.pid, managedPostgres: pg.managed };
    helper = spawn(process.execPath, ['--max-old-space-size=256', '--import', import.meta.resolve('tsx'), resolve(core, 'apps/api/scripts/dev-recon-intake.ts')], {
      cwd: core, stdio: 'inherit', env: { ...process.env, ...config },
    });
    let helperExited = false;
    let spawnFailure: Error | null = null;
    const exited = new Promise<number>(resolve => {
      helper!.once('error', error => { helperExited = true; spawnFailure = error; resolve(1); });
      helper!.once('exit', (code, signal) => { helperExited = true; resolve(signal && stopping ? 0 : code ?? 1); });
    });
    runtime.helperPid = helper.pid ?? null;
    await save(runtimeFile, runtime);
    const stop = () => { if (!stopping) { stopping = true; helper?.kill('SIGTERM'); } };
    process.once('SIGINT', stop); process.once('SIGTERM', stop);
    try {
      let ready = false;
      for (let attempt = 0; attempt < 40 && !helperExited && !stopping; attempt++) {
        const response = await fetch(`http://127.0.0.1:${apiPort}/v1/recon-captures/status`, {
          headers: { 'X-Admin-Key': config.ADMIN_API_KEY }, redirect: 'error', signal: AbortSignal.timeout(1000),
        }).catch(() => null);
        if (response?.ok) ready = true;
        await response?.body?.cancel();
        if (ready) break;
        await sleep(250);
      }
      if (spawnFailure) throw spawnFailure;
      if (!ready && !stopping) { stop(); throw new Error('Local capture API did not become ready; inspect the helper output. Database and videos are preserved.'); }
      if (ready) {
        console.log(`Capture API ready: http://127.0.0.1:${apiPort}; use the existing https://dev.cuberoot.me timer.`);
        console.log(`Persistent local data: ${base}`);
        console.log('Ctrl-C stops only this API. PostgreSQL stays running for reuse; its PID is recorded in runtime.json.');
      }
      process.exitCode = await exited;
    } finally {
      process.removeListener('SIGINT', stop); process.removeListener('SIGTERM', stop);
      if (!helperExited) {
        helper.kill('SIGTERM');
        await Promise.race([exited, sleep(5000)]);
        if (!helperExited) { helper.kill('SIGKILL'); await Promise.race([exited, sleep(1000)]); }
      }
      await save(runtimeFile, { ...runtime, helperPid: null });
    }
  } finally { await lock.close(); await fs.unlink(lockFile); }
}

main().catch(error => { console.error(cleanError(error instanceof Error ? error.message : 'Local capture startup failed')); process.exitCode = 1; });
