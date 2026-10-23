#!/usr/bin/env node
/** Serial, bounded puzzle measurements. Monitoring does not disable OS swap. */
import { execFileSync, spawn, type ChildProcess } from 'node:child_process';
import { createHash } from 'node:crypto';
import { appendFileSync, closeSync, existsSync, mkdirSync, openSync, readFileSync, readdirSync, renameSync, unlinkSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseProcesses, parseVm } from '../../../scripts/mac-system-recorder.mts';
import { EXACT_DOWNLOAD_JOBS } from './prepare-exact-state-downloads.mts';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '../../../..');
const worker = resolve(here, 'small-puzzle-distribution-worker.ts');
const GiB = 2 ** 30;
const rssLimitBytes = 512 * 2 ** 20;
const allowedEvents = ['ivy', '223', 'skewb', 'sfl', 'tetraminx', 'jingpyraminx', 'pyramorphix', 'pyramorphix-qtm', 'dino', 'half', 'lsemu', "offline-bic", "offline-ivy", "offline-223", "offline-sfl", "offline-133", "offline-8p", "offline-cm2", "offline-gear", "offline-ufo", "offline-dmd", "offline-pyraminx_duo", "lsemu-qtm", "roux-eolr-ac", "roux-eolr-mc", "roux-eodm", 'htr-dr', 'fr-htr', ...EXACT_DOWNLOAD_JOBS] as const;
let events: readonly string[] = allowedEvents.slice(0, 5);
const sessionDirectory = resolve(root, '.local/small-puzzle-distributions-20261023');
let directory = sessionDirectory;
if (process.argv.includes('--help')) {
  console.log('Usage: node --max-old-space-size=128 --import tsx scripts/measure-small-puzzle-distributions.mts [--events ivy,223,...] [--output-dir PATH]. All batches retain the original session resource baseline.');
  process.exit(0);
}
if (process.platform !== 'darwin') throw Error('This resource observer requires macOS');
for (let i = 2; i < process.argv.length; i += 2) {
  const name = process.argv[i], value = process.argv[i + 1];
  if (!value || value.startsWith('--')) throw Error(`${name} requires a value`);
  if (name === '--output-dir') directory = resolve(value);
  else if (name === '--events') events = value.split(',');
  else throw Error(`Unknown argument: ${name}`);
}
if (!events.length || new Set(events).size !== events.length
  || events.some(event => !allowedEvents.includes(event as typeof allowedEvents[number]))) throw Error('Unknown or duplicate event');
const path = (name: string) => resolve(directory, name);
const sessionPath = (name: string) => resolve(sessionDirectory, name);
function atomic(name: string, value: unknown) {
  const temporary = path(`${name}.new-${process.pid}`);
  writeFileSync(temporary, JSON.stringify(value, null, 2) + '\n', { mode: 0o600, flush: true });
  renameSync(temporary, path(name));
}
const command = (binary: string, args: string[] = []) => execFileSync(binary, args, {
  encoding: 'utf8', timeout: 5000, maxBuffer: 4 * 2 ** 20, env: { ...process.env, LC_ALL: 'C' },
});
function observe() {
  const vm = parseVm(command('/usr/bin/vm_stat'));
  const free = vm.pages['Pages free'], speculative = vm.pages['Pages speculative'];
  if (![free, speculative, vm.pages.Swapouts].every(value => Number.isSafeInteger(value) && value >= 0)) throw Error('Incomplete vm_stat observation');
  const rows = parseProcesses(command('/bin/ps', ['-axo', 'pid,ppid,rss,pcpu,stat,comm']));
  if (!rows.some(row => row.pid === process.pid)) throw Error('Cannot observe wrapper RSS');
  const family = new Set([process.pid]);
  for (let changed = true; changed;) {
    changed = false;
    for (const row of rows) if (family.has(row.ppid) && !family.has(row.pid)) { family.add(row.pid); changed = true; }
  }
  const processes = rows.filter(row => family.has(row.pid));
  return {
    at: new Date().toISOString(), boot: command('/usr/sbin/sysctl', ['-n', 'kern.boottime']).trim(),
    swapouts: vm.pages.Swapouts,
    pressure: Number(command('/usr/sbin/sysctl', ['-n', 'kern.memorystatus_vm_pressure_level']).trim()),
    availableBytes: (free + speculative) * vm.pageSize,
    rssBytes: processes.reduce((sum, row) => sum + row.rssBytes, 0),
    processes: processes.map(row => ({ pid: row.pid, ppid: row.ppid, rssBytes: row.rssBytes, name: row.name })),
  };
}
type Observation = ReturnType<typeof observe>;
type Baseline = Observation & { workerSha256: string; events: readonly string[] };
type Result = { event: string; completed: boolean; elapsedMs: number; maxRssBytes: number; [key: string]: unknown };
type Entry = { event: string; status: string; output: string; workerPid?: number; workerElapsedMs?: number; workerMaxRssBytes?: number; sampledTreeMaxRssBytes?: number; coldStartWallMs?: number; result?: Result };
mkdirSync(directory, { recursive: true });
mkdirSync(sessionDirectory, { recursive: true });
if (existsSync(sessionPath('protected-stop.json')) || existsSync(path('protected-stop.json'))) throw Error('A resource-protection stop exists; inspect it before any new run. No automatic restart.');
const lockPath = resolve(root, '.local/small-puzzle-distributions.lock');
mkdirSync(dirname(lockPath), { recursive: true });
const lock = openSync(lockPath, 'wx', 0o600);
writeFileSync(lock, JSON.stringify({ pid: process.pid, startedAt: new Date().toISOString(), worker, directory }) + '\n');
closeSync(lock);
let child: ChildProcess | undefined;
let current: Entry | undefined;
let stopped = '';
let protectionStopped = false;
let stopRecordFailed = false;
let forceKill: ReturnType<typeof setTimeout> | undefined;
let baseline: Baseline | undefined;
let maximumRss = 0;
const runStarted = performance.now();
const report = {
  schema: 'cuberoot.small-puzzle-distributions.v1', startedAt: new Date().toISOString(), status: 'running',
  nodeVersion: process.version, wrapperPid: process.pid, gitHead: '', wallMs: 0,
  workerSha256: '', events, sessionBaselinePath: sessionPath('baseline.json'),
  observer: { intervalMs: 500, rssLimitBytes, startupAvailableBytes: 3 * GiB, minimumAvailableBytes: 2 * GiB,
    availability: 'vm_stat Pages free + Pages speculative', osSwapDisabled: false },
  baseline: undefined as Baseline | undefined, completedAt: undefined as string | undefined,
  maxSampledTreeRssBytes: 0, stopped: '', entries: [] as Entry[],
};
function saveReport() {
  report.maxSampledTreeRssBytes = maximumRss;
  report.stopped = stopped;
  report.wallMs = performance.now() - runStarted;
  atomic('run-report.json', report);
}
function killWorker(signal: NodeJS.Signals) {
  if (!child?.pid) return;
  try { process.kill(-child.pid, signal); } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ESRCH') throw error;
  }
}
function workerGroupAlive() {
  if (!child?.pid) return false;
  try { process.kill(-child.pid, 0); return true; } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ESRCH') return false;
    throw error;
  }
}
async function cleanupWorker() {
  if (!workerGroupAlive()) return;
  for (const signal of ['SIGTERM', 'SIGKILL'] as const) {
    killWorker(signal);
    const deadline = performance.now() + 2000;
    while (workerGroupAlive() && performance.now() < deadline) await new Promise(done => setTimeout(done, 50));
    if (!workerGroupAlive()) { child = undefined; return; }
  }
  throw Error(`Worker process group ${child?.pid} remains alive after SIGKILL; retaining global lock`);
}
function stop(reason: string, protection: boolean, observation?: Observation) {
  if (stopped) return;
  stopped = reason;
  protectionStopped = protection;
  // Stop the child even when the disk cannot persist a protection record.
  forceKill = setTimeout(() => killWorker('SIGKILL'), 2000);
  forceKill.unref();
  killWorker('SIGTERM');
  try {
    atomic(protection ? 'protected-stop.json' : 'interrupted.json', { reason, baseline, observation, event: current?.event, at: new Date().toISOString() });
    if (protection && directory !== sessionDirectory) {
      writeFileSync(sessionPath('protected-stop.json'), JSON.stringify({ reason, baseline, observation,
        outputDirectory: directory, event: current?.event, at: new Date().toISOString() }, null, 2) + '\n', { flag: 'wx', flush: true });
    }
  } catch (error) {
    stopRecordFailed = true;
    console.error(`[stop] Could not persist stop record; retaining lock: ${String(error)}`);
  }
  console.error(`[stop] ${reason}`);
}
function sample(starting = false) {
  const now = observe();
  maximumRss = Math.max(maximumRss, now.rssBytes);
  if (current) current.sampledTreeMaxRssBytes = Math.max(current.sampledTreeMaxRssBytes ?? 0, now.rssBytes);
  appendFileSync(path('resources.jsonl'), JSON.stringify({ ...now, event: current?.event ?? null, starting }) + '\n');
  const reasons = [
    baseline && now.boot !== baseline.boot && 'system boot changed',
    baseline && now.swapouts !== baseline.swapouts && 'Swapouts changed',
    now.pressure !== 1 && `memory pressure ${now.pressure}`,
    now.rssBytes > rssLimitBytes && `process-tree RSS ${now.rssBytes} exceeds ${rssLimitBytes}`,
    now.availableBytes < (starting ? 3 : 2) * GiB && `conservative available memory ${now.availableBytes} below ${(starting ? 3 : 2)} GiB`,
  ].filter(Boolean);
  if (reasons.length) stop(reasons.join('; '), true, now);
  return now;
}
function resultFor(event: string, filename = path(`${event}.json`)): Result {
  const result = JSON.parse(readFileSync(filename, 'utf8')) as Result;
  if (result.event !== event || result.completed !== true || !Number.isFinite(result.elapsedMs) || result.elapsedMs < 0
    || !Number.isFinite(result.maxRssBytes) || result.maxRssBytes <= 0) throw Error(`Invalid completed result: ${event}.json; preserved without rerunning`);
  const histogram = result.histogram as number[];
  if (!Array.isArray(histogram) || !histogram.every(count => Number.isSafeInteger(count) && count >= 0)
    || histogram.reduce((sum, count) => sum + count, 0) !== result.total) throw Error(`Invalid histogram: ${event}`);
  const csv = result.csv as { sha256?: string };
  if (createHash('sha256').update(readFileSync(resolve(dirname(filename), `${event}.csv`))).digest('hex') !== csv?.sha256) throw Error(`CSV hash mismatch: ${event}`);
  return result;
}
const onInterrupt = () => stop('User interrupted the run', false);
process.on('SIGINT', onInterrupt);
process.on('SIGTERM', onInterrupt);
let interval: ReturnType<typeof setInterval> | undefined;
try {
  if (existsSync(path('run-report.json'))) writeFileSync(path(`run-report-previous-${Date.now()}.json`), readFileSync(path('run-report.json')), { flag: 'wx' });
  report.gitHead = command('/usr/bin/git', ['-C', root, 'rev-parse', 'HEAD']).trim();
  const workerSha256 = createHash('sha256').update(readFileSync(worker)).digest('hex');
  report.workerSha256 = workerSha256;
  if (existsSync(sessionPath('baseline.json'))) {
    // Candidate/source revisions belong to each batch, never to a new swap baseline.
    baseline = JSON.parse(readFileSync(sessionPath('baseline.json'), 'utf8')) as Baseline;
  } else {
    baseline = { ...observe(), workerSha256, events };
    writeFileSync(sessionPath('baseline.json'), JSON.stringify(baseline, null, 2) + '\n', { flag: 'wx', flush: true });
  }
  report.baseline = baseline;
  saveReport();
  sample(true);
  interval = setInterval(() => {
    try { sample(); } catch (error) { stop(`Resource observation failed: ${String(error)}`, true); }
  }, 500);
  for (const event of events) {
    if (stopped) break;
    current = { event, status: 'pending', output: path(`${event}.json`) };
    report.entries.push(current);
    // Completed events remain reusable when a later batch changes output directory.
    if (!existsSync(current.output)) {
      const saved = readdirSync(sessionDirectory, { recursive: true, encoding: 'utf8' })
        .find(name => name === `${event}.json` || name.endsWith(`/${event}.json`));
      if (saved) current.output = resolve(sessionDirectory, saved);
    }
    if (existsSync(current.output)) {
      const result = resultFor(event, current.output);
      Object.assign(current, { status: 'skipped-completed', workerElapsedMs: result.elapsedMs, workerMaxRssBytes: result.maxRssBytes, result });
      console.log(`[${event}] keeping completed result`);
      saveReport();
      continue;
    }
    sample(true);
    if (stopped) break;
    if (createHash('sha256').update(readFileSync(worker)).digest('hex') !== workerSha256) throw Error('Worker changed during the active batch');
    // A crash between CSV and JSON persistence leaves evidence, not a completed result.
    if (existsSync(path(`${event}.csv`))) renameSync(path(`${event}.csv`), path(`${event}.partial-${Date.now()}.csv`));
    console.log(`[${event}] starting one bounded worker`);
    current.status = 'running';
    const started = performance.now();
    const log = openSync(path(`${event}.log`), 'a', 0o600);
    let outcome: { code: number | null; signal: NodeJS.Signals | null };
    try {
      child = spawn(process.execPath, ['--max-old-space-size=128', '--import', 'tsx', worker, event, current.output], {
        cwd: resolve(here, '..'), detached: true, stdio: ['ignore', log, log],
      });
      // A report-write failure must still reach cleanup if spawn then emits error.
      child.once('error', () => {});
      current.workerPid = child.pid;
      saveReport();
      outcome = await new Promise((done, reject) => {
        child!.once('error', reject);
        child!.once('close', (code, signal) => done({ code, signal }));
      });
    } finally { closeSync(log); }
    current.coldStartWallMs = performance.now() - started;
    child = undefined;
    if (forceKill) { clearTimeout(forceKill); forceKill = undefined; }
    sample();
    if (stopped) { current.status = protectionStopped ? 'protected-stop' : 'interrupted'; saveReport(); break; }
    if (outcome.code !== 0) { current.status = 'failed'; throw Error(`${event} worker exited ${outcome.code ?? outcome.signal}; see ${event}.log`); }
    const result = resultFor(event);
    Object.assign(current, { status: 'completed', workerElapsedMs: result.elapsedMs, workerMaxRssBytes: result.maxRssBytes, result });
    if (result.maxRssBytes > rssLimitBytes) {
      stop(`${event} worker reported peak RSS ${result.maxRssBytes} above ${rssLimitBytes}`, true);
      current.status = 'protected-stop';
      saveReport();
      break;
    }
    console.log(`[${event}] completed in ${result.elapsedMs.toFixed(1)} ms; worker peak RSS ${(result.maxRssBytes / 2 ** 20).toFixed(1)} MiB`);
    saveReport();
  }
  report.status = stopped ? (protectionStopped ? 'protected-stop' : 'interrupted') : 'completed';
  if (stopped) process.exitCode = 1;
} catch (error) {
  report.status = 'failed';
  if (current?.status === 'running') current.status = 'failed';
  stopped ||= String(error);
  console.error(String(error));
  process.exitCode = 1;
} finally {
  if (interval) clearInterval(interval);
  let releaseLock = !stopRecordFailed;
  try { await cleanupWorker(); } catch (error) {
    releaseLock = false;
    report.status = 'failed';
    stopped = `${stopped ? `${stopped}; ` : ''}${String(error)}`;
    process.exitCode = 1;
    console.error(String(error));
  }
  if (forceKill) clearTimeout(forceKill);
  process.off('SIGINT', onInterrupt);
  process.off('SIGTERM', onInterrupt);
  report.completedAt = new Date().toISOString();
  saveReport();
  if (releaseLock) unlinkSync(lockPath);
}
