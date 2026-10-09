#!/usr/bin/env node
/** Start, inspect, stop and merge resumable LSLL solver shards. */
import { spawn, spawnSync } from 'node:child_process';
import { closeSync, createReadStream, createWriteStream, existsSync, mkdirSync, openSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { availableParallelism, freemem } from 'node:os';
import { randomUUID } from 'node:crypto';
import { basename, dirname, join, resolve } from 'node:path';
import { createInterface } from 'node:readline';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const repo = resolve(here, '../..');
const corpus = join(here, 'corpus.txt');
const out = join(here, 'out.csv');
const shardDir = join(here, 'shards');
const pidFile = join(shardDir, 'pids.json');
const action = ['--status', '--watch', '--stop', '--merge'].find((flag) => process.argv.includes(flag));
function option(name: string, fallback: string): string {
  const i = process.argv.indexOf(name);
  if (i < 0) return fallback;
  const value = process.argv[i + 1];
  if (!value || value.startsWith('--')) throw new Error(`${name} requires a value`);
  return value;
}
function positive(value: string, name: string): number {
  const n = Number(value);
  if (!Number.isSafeInteger(n) || n < 1) throw new Error(`${name} must be a positive integer`);
  return n;
}
if (process.argv.includes('--help')) {
  console.log('Usage: tsx solver/lsll/run_lsll.mts [--procs N] [--threads N] [--table h5|h6|h9] [--no-watch] | --status | --watch | --stop | --merge');
  process.exit(0);
}
const procs = positive(option('--procs', '1'), '--procs');
const threads = positive(option('--threads', String(Math.max(1, Math.floor(availableParallelism() / procs)))), '--threads');
const table = option('--table', 'h9');
if (!['h5', 'h6', 'h9'].includes(table)) throw new Error(`Unsupported table: ${table}`);

type RunRecord = { pid: number; shard: number; started: string; token: string };
function records(): RunRecord[] {
  try { return JSON.parse(readFileSync(pidFile, 'utf8')) as RunRecord[]; }
  catch { return []; }
}
type ProcessEntry = { pid: number; command: string };
function processEntries(): ProcessEntry[] {
  if (process.platform === 'win32') {
    const script = '$items = @(Get-CimInstance Win32_Process -Filter "Name = \'node.exe\'" | Select-Object ProcessId, CommandLine); ConvertTo-Json -InputObject $items -Compress';
    const listing = spawnSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', script], { encoding: 'utf8' });
    if (listing.status !== 0) throw new Error('Cannot verify Windows process command lines');
    const parsed = JSON.parse(listing.stdout.trim() || '[]') as Array<{ ProcessId: number; CommandLine?: string }>;
    return parsed.map((item) => ({ pid: item.ProcessId, command: item.CommandLine ?? '' }));
  }
  const listing = spawnSync('ps', ['-axo', 'pid=,command='], { encoding: 'utf8' });
  if (listing.status !== 0) throw new Error('Cannot inspect existing solver processes');
  return listing.stdout.split('\n').flatMap((line) => {
    const match = /^\s*(\d+)\s+(.+)$/.exec(line);
    return match ? [{ pid: Number(match[1]), command: match[2] }] : [];
  });
}
function solverEntries(): ProcessEntry[] {
  return processEntries().filter((entry) => /\bnode(?:\.exe)?\b/i.test(entry.command) && /(?:^|[ /\\])solve_loop\.mjs(?:["'\s]|$)/.test(entry.command));
}
function running(): RunRecord[] {
  const commands = new Map(solverEntries().map((entry) => [entry.pid, entry.command]));
  return records().filter((record) => Boolean(record.token && commands.get(record.pid)?.includes(record.token)));
}
function untrackedSolverPids(): number[] {
  const known = new Set(running().map((record) => record.pid));
  return solverEntries().filter((entry) => !known.has(entry.pid)).map((entry) => entry.pid);
}
function key(line: string): string | undefined {
  const comma = line.indexOf(',');
  return comma > 0 ? line.slice(0, comma) : undefined;
}
async function lines(path: string, visit: (line: string) => void): Promise<void> {
  if (!existsSync(path)) return;
  for await (const line of createInterface({ input: createReadStream(path), crlfDelay: Infinity })) visit(line);
}
function shardOuts(): string[] {
  if (!existsSync(shardDir)) return [];
  return readdirSync(shardDir).filter((name) => /^out_\d+\.csv$/.test(name)).map((name) => join(shardDir, name));
}
async function done(): Promise<{ count: number; main: number; keys: Set<string> }> {
  const keys = new Set<string>();
  await lines(out, (line) => { const k = key(line); if (k) keys.add(k); });
  const main = keys.size;
  for (const path of shardOuts()) await lines(path, (line) => { const k = key(line); if (k) keys.add(k); });
  return { count: keys.size, main, keys };
}
async function total(): Promise<number> {
  if (!existsSync(corpus)) throw new Error(`Corpus missing: ${corpus}`);
  let n = 0;
  await lines(corpus, (line) => { if (key(line)) n++; });
  return n;
}
const sleep = (ms: number) => new Promise((done) => setTimeout(done, ms));
async function progress(watch: boolean): Promise<void> {
  const n = await total();
  let previous = await done();
  console.log(`${previous.count.toLocaleString()}/${n.toLocaleString()} (${(100 * previous.count / n).toFixed(2)}%) · out.csv ${previous.main.toLocaleString()} · shards ${(previous.count - previous.main).toLocaleString()} · running ${running().length}`);
  if (!watch || running().length === 0) return;
  console.log('Ctrl-C 只退出进度显示，求解继续运行。');
  while (true) {
    const started = Date.now();
    await sleep(15_000);
    const current = await done();
    const live = running();
    const rate = (current.count - previous.count) / ((Date.now() - started) / 1000);
    const eta = rate > 0 ? `剩 ${(n - current.count) / rate / 3600 >= 1 ? `${((n - current.count) / rate / 3600).toFixed(1)}h` : `${Math.ceil((n - current.count) / rate / 60)}m`}` : '本次采样无新行';
    const message = `${current.count.toLocaleString()}/${n.toLocaleString()} (${(100 * current.count / n).toFixed(2)}%) · ${live.length} 分片 · ${rate.toFixed(2)} case/s · ${eta}`;
    process.stdout.write(`\r${message.padEnd(100)}`);
    if (current.count >= n || live.length === 0) { process.stdout.write('\n'); return; }
    previous = current;
  }
}

if (action === '--status' || action === '--watch') {
  await progress(action === '--watch');
  process.exit(0);
}
if (action === '--stop') {
  const live = running();
  if (live.length === 0) { console.log('没有在跑的求解进程。'); process.exit(0); }
  for (const record of live) {
    if (!solverEntries().some((entry) => entry.pid === record.pid && entry.command.includes(record.token))) {
      throw new Error(`Shard ${record.shard} PID no longer matches its launch token; refusing to stop it`);
    }
    if (process.platform === 'win32') {
      const result = spawnSync('taskkill', ['/PID', String(record.pid), '/T', '/F'], { stdio: 'inherit' });
      if (result.status !== 0) throw new Error(`Failed to stop shard ${record.shard}`);
    } else process.kill(-record.pid, 'SIGTERM');
  }
  console.log(`已停 ${live.length} 个分片；每个 case 落盘，可续跑。`);
  process.exit(0);
}
if (action === '--merge') {
  const paths = shardOuts();
  if (paths.length === 0) { console.log('没有分片结果可合并。'); process.exit(0); }
  const seen = new Set<string>();
  await lines(out, (line) => { const k = key(line); if (k) seen.add(k); });
  const before = seen.size;
  const writer = createWriteStream(out, { flags: 'a' });
  for (const path of paths) {
    for await (const line of createInterface({ input: createReadStream(path), crlfDelay: Infinity })) {
      const k = key(line);
      if (k && !seen.has(k)) {
        seen.add(k);
        if (!writer.write(`${line}\n`)) await new Promise<void>((done) => writer.once('drain', done));
      }
    }
  }
  await new Promise<void>((done) => writer.end(done));
  console.log(`out.csv ${before} → ${seen.size}（合并 ${seen.size - before} 行，来自 ${paths.length} 个分片）`);
  process.exit(0);
}

if (!existsSync(corpus)) throw new Error(`语料不存在: ${corpus}`);
if (running().length) throw new Error('已有分片在跑；先用 --status 查看，或用 --stop 停止。');
const untracked = untrackedSolverPids();
if (untracked.length) throw new Error(`发现未由此入口登记的 solve_loop.mjs 进程（PID ${untracked.join(', ')}）；先确认并处理它们，避免重复启动。`);
const tableRoot = resolve(process.env.CUBE_TABLE_DIR ?? join(repo, 'solver/tables'));
const tableFile = join(tableRoot, 'h48', `h48prun31${table}.dat`);
const moduleFile = join(repo, 'core/packages/client/public/cubeopt', `cube48opt${table.slice(1)}.mjs`);
for (const path of [tableFile, moduleFile]) if (!existsSync(path)) throw new Error(`找不到 ${path}`);
const tableGiB = statSync(tableFile).size / 1024 ** 3;
const needGiB = tableGiB * procs;
const freeGiB = freemem() / 1024 ** 3;
console.log(`表 ${basename(tableFile)} · ${tableGiB.toFixed(1)} GiB × ${procs} 进程 = ${needGiB.toFixed(1)} GiB，空闲 ${freeGiB.toFixed(1)} GiB`);
if (needGiB > freeGiB - 1) throw new Error('物理内存不够；先释放内存或减少 --procs，避免换页。');
mkdirSync(shardDir, { recursive: true });
const completed = (await done()).keys;
const writers = Array.from({ length: procs }, (_, i) => createWriteStream(join(shardDir, `corpus_${i}.txt`)));
let todo = 0;
let count = 0;
await lines(corpus, (line) => {
  const k = key(line);
  if (!k) return;
  count++;
  if (completed.has(k)) return;
  writers[todo % procs].write(`${line}\n`);
  todo++;
});
await Promise.all(writers.map((writer) => new Promise<void>((done) => writer.end(done))));
if (todo === 0) { console.log(`全部 ${count} 个 case 已算完；运行 --merge 后导出。`); process.exit(0); }
console.log(`待解 ${todo}/${count}（已完成 ${completed.size}）`);
const live: RunRecord[] = [];
for (let i = 0; i < procs; i++) {
  const log = openSync(join(shardDir, `log_${i}.txt`), 'w');
  const err = openSync(join(shardDir, `err_${i}.txt`), 'w');
  const token = randomUUID();
  const child = spawn(process.execPath, ['solve_loop.mjs', `--run-token=${token}`], {
    cwd: here, detached: true, windowsHide: true, stdio: ['ignore', log, err],
    env: { ...process.env, CORPUS: join(shardDir, `corpus_${i}.txt`), OUT: join(shardDir, `out_${i}.csv`), MODULE: moduleFile, TABLE: tableFile, THREADS: String(threads) },
  });
  closeSync(log);
  closeSync(err);
  if (!child.pid) throw new Error(`Failed to start shard ${i}`);
  child.unref();
  live.push({ pid: child.pid, shard: i, started: new Date().toISOString(), token });
}
writeFileSync(pidFile, JSON.stringify(live, null, 2) + '\n');
console.log(`${procs} 个分片已启动（每个 ${threads} 线程）。`);
console.log('查看：--status / --watch；停止：--stop；合并：--merge。');
if (!process.argv.includes('--no-watch')) await progress(true);
