import { spawn, type ChildProcess } from 'node:child_process';
import { createHash } from 'node:crypto';
import { createReadStream, createWriteStream } from 'node:fs';
import { access, appendFile, mkdir, open, readFile, stat, unlink, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { createInterface } from 'node:readline';
import { dataRoot, puzzleDir, repoRoot, tableDir, wcaDir } from '../../core/jobs/scramble-stats-build/pipeline_paths.mjs';
import { prepareStatsAnalyzer, resolveStatsAnalyzerEnv } from './resource-monitor.js';

export { dataRoot, puzzleDir, repoRoot, tableDir, wcaDir };
export const coreDir = join(repoRoot, 'core');
export const jobDir = join(coreDir, 'jobs', 'scramble-stats-build');
export const solverDir = join(repoRoot, 'solver');
export const exe = (name: string) => join(solverDir, 'target', 'release', `${name}${process.platform === 'win32' ? '.exe' : ''}`);
export const tsx = join(coreDir, 'node_modules', '.bin', process.platform === 'win32' ? 'tsx.cmd' : 'tsx');

const progressPercent = new Map<string, number>();
export function taskProgress(task: string, done: number, total: number): void {
  const percent = total > 0 ? Math.min(100, Math.floor(100 * done / total)) : 100;
  if (done === 0 && total > 0 && (progressPercent.get(task) ?? 0) > 0) progressPercent.delete(task);
  const previous = progressPercent.get(task);
  if (previous !== undefined && (percent <= previous || (percent < 100 && percent - previous < 10))) return;
  progressPercent.set(task, percent);
  console.log(`[进度] ${task} ${percent}%${total > 1 ? ` (${done}/${total})` : ''}`);
}

export async function exists(file: string): Promise<boolean> {
  try { await access(file); return true; } catch { return false; }
}
export async function fileSize(file: string): Promise<number> {
  try { return (await stat(file)).size; } catch { return -1; }
}
export async function* lines(file: string): AsyncGenerator<string> {
  const input = createReadStream(file, { encoding: 'utf8' });
  const reader = createInterface({ input, crlfDelay: Infinity });
  try { for await (const line of reader) yield line; }
  finally { reader.close(); input.destroy(); }
}
export async function lineCount(file: string): Promise<number> {
  if (!await exists(file)) return 0;
  let count = 0;
  for await (const _ of lines(file)) count++;
  return count;
}
export async function ids(file: string, skipHeader = false): Promise<Set<string>> {
  const result = new Set<string>();
  if (!await exists(file)) return result;
  let first = true;
  for await (const line of lines(file)) {
    if (first && skipHeader) { first = false; continue; }
    first = false;
    const comma = line.indexOf(',');
    if (comma > 0) result.add(line.slice(0, comma));
  }
  return result;
}
export async function appendData(target: string, source: string, skipHeader: boolean): Promise<void> {
  await mkdir(dirname(target), { recursive: true });
  const size = await fileSize(target);
  if (size > 0) {
    const file = await open(target, 'r');
    const last = Buffer.alloc(1);
    try { await file.read(last, 0, 1, size - 1); }
    finally { await file.close(); }
    if (last[0] !== 10) await appendFile(target, '\n');
  }
  const output = createWriteStream(target, { flags: 'a', encoding: 'utf8' });
  let first = true;
  try {
    for await (const line of lines(source)) {
      if (first && skipHeader) { first = false; continue; }
      first = false;
      if (!output.write(`${line}\n`)) await new Promise<void>(done => output.once('drain', done));
    }
    await new Promise<void>((done, fail) => { output.end(done); output.once('error', fail); });
  } catch (error) { output.destroy(); throw error; }
}
/** Append only missing IDs, so a run interrupted between related CSV writes can resume. */
export async function appendUniqueById(target: string, source: string, sourceHeader: boolean, targetHeader: boolean): Promise<number> {
  const known = await ids(target, targetHeader);
  const temp = `${source}.dedup.${process.pid}`;
  const output = createWriteStream(temp, { encoding: 'utf8' });
  let first = true;
  let added = 0;
  try {
    for await (const row of lines(source)) {
      if (first && sourceHeader) {
        first = false;
        if (!output.write(`${row}\n`)) await new Promise<void>(done => output.once('drain', done));
        continue;
      }
      first = false;
      const comma = row.indexOf(',');
      if (comma < 1) continue;
      const id = row.slice(0, comma);
      if (known.has(id)) continue;
      known.add(id);
      if (!output.write(`${row}\n`)) await new Promise<void>(done => output.once('drain', done));
      added++;
    }
    await new Promise<void>((done, fail) => { output.end(done); output.once('error', fail); });
    if (added) await appendData(target, temp, sourceHeader && await fileSize(target) > 0);
  } finally {
    output.destroy();
    if (await exists(temp)) await unlink(temp);
  }
  return added;
}
export class CommandExitError extends Error {
  constructor(public readonly command: string, public readonly args: string[], public readonly code: number) {
    super(`${command} ${args.join(' ')} exited with ${code}`);
    this.name = 'CommandExitError';
  }
}
export async function run(command: string, args: string[], cwd: string, env: NodeJS.ProcessEnv = process.env): Promise<void> {
  const child = spawn(command, args, { cwd, env, stdio: 'inherit', shell: process.platform === 'win32' && /\.cmd$/i.test(command) });
  const code = await new Promise<number>((done, fail) => { child.on('error', fail); child.on('close', value => done(value ?? 1)); });
  if (code !== 0) throw new CommandExitError(command, args, code);
}
export async function runPnpm(args: string[], cwd = coreDir, env: NodeJS.ProcessEnv = process.env): Promise<void> {
  await run(process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm', args, cwd, env);
}
export async function runNode(script: string, args: string[] = [], cwd = jobDir, env: NodeJS.ProcessEnv = process.env): Promise<void> {
  await run(process.execPath, [script, ...args], cwd, env);
}
export async function runTs(script: string, args: string[] = [], cwd = jobDir, env: NodeJS.ProcessEnv = process.env): Promise<void> {
  await run(tsx, [script, ...args], cwd, env);
}
/** Reap only the child we just spawned if resource registration fails. */
export async function reapUnregisteredAnalyzer(child: ChildProcess): Promise<void> {
  if (child.exitCode !== null || child.signalCode !== null) return;
  const closed = new Promise<void>(done => { child.once('close', () => done()); });
  child.on('error', () => {});
  child.stdin?.on('error', () => {});
  child.stdout?.resume();
  child.stderr?.resume();
  child.kill('SIGTERM');
  const force = setTimeout(() => {
    if (child.exitCode === null && child.signalCode === null) child.kill('SIGKILL');
  }, 1500);
  try { await closed; } finally { clearTimeout(force); }
}
async function launchAnalyzer(binary: string, logFile: string, env: NodeJS.ProcessEnv, label: string, args: string[], cwd: string, onLine?: (line: string) => void) {
  env = resolveStatsAnalyzerEnv(binary, env);
  await mkdir(dirname(logFile), { recursive: true });
  const attachResource = prepareStatsAnalyzer(binary, env);
  const child = spawn(binary, args, { cwd, env, stdio: ['pipe', 'pipe', 'pipe'], shell: process.platform === 'win32' && /\.cmd$/i.test(binary) });
  let releaseResource: () => void;
  try { releaseResource = child.pid ? attachResource(child.pid) : () => {}; }
  catch (error) { await reapUnregisteredAnalyzer(child); throw error; }
  child.stdin.on('error', () => {}); // run/write callbacks and child exit report failures
  const log = createWriteStream(logFile, { flags: 'w', encoding: 'utf8' });
  let logFailure: Error | undefined;
  log.on('error', error => { logFailure = error; child.kill('SIGTERM'); });
  let lastStatus = 0;
  let lastPercent = -1;
  const show = (done: number, total: number) => {
    const percent = total > 0 ? Math.min(100, Math.floor(100 * done / total)) : 0;
    if (percent <= lastPercent) return;
    const now = Date.now();
    if (percent < 100 && now - lastStatus < 60_000) return;
    console.log(`[进度] ${label} ${percent}% (${done}/${total})`);
    lastPercent = percent;
    lastStatus = now;
  };
  const capture = async (stream: NodeJS.ReadableStream) => {
    const reader = createInterface({ input: stream, crlfDelay: Infinity });
    for await (const line of reader) {
      log.write(`${line}\n`);
      onLine?.(line);
      const match = line.match(/\[PROG\]\s+(\d+)\s*\/\s*(\d+)/);
      if (match) show(Number(match[1]), Number(match[2]));
    }
  };
  const progressFile = env.ANALYZER_PROGRESS_FILE;
  const heartbeat = progressFile ? setInterval(async () => {
    try {
      const size = await fileSize(progressFile);
      if (size <= 0) return;
      const file = await open(progressFile, 'r');
      const length = Math.min(size, 4096);
      const buffer = Buffer.alloc(length);
      try { await file.read(buffer, 0, length, size - length); }
      finally { await file.close(); }
      const matches = [...buffer.toString('utf8').matchAll(/\[PROG\]\s+(\d+)\s*\/\s*(\d+)/g)];
      const last = matches.at(-1);
      if (!last) return;
      const done = Number(last[1]); const total = Number(last[2]);
      show(done, total);
    } catch { /* progress file may be between writes */ }
  }, 10_000) : undefined;
  const output = Promise.all([capture(child.stdout), capture(child.stderr)]);
  const finished = (async () => {
    let code: number;
    try { code = await new Promise<number>((done, fail) => { child.on('error', fail); child.on('close', value => done(value ?? 1)); }); }
    finally { if (heartbeat) clearInterval(heartbeat); releaseResource(); }
    await output;
    if (logFailure) throw logFailure;
    await new Promise<void>((done, fail) => { log.end(done); log.once('error', fail); });
    if (code !== 0) throw new Error(`${label} exited with ${code}; see ${logFile}`);
    if (lastPercent < 100) console.log(`[进度] ${label} 100%`);
  })();
  // Callers can be preparing the next input while a child exits.
  void finished.catch(() => {});
  return { child, finished, resetProgress: () => { lastStatus = 0; lastPercent = -1; } };
}

export async function analyzer(binary: string, inputFiles: string[], logFile: string, env: NodeJS.ProcessEnv, label: string, args: string[] = [], cwd = dirname(inputFiles[0]), terminator = 'exit'): Promise<void> {
  const { child, finished } = await launchAnalyzer(binary, logFile, env, label, args, cwd);
  child.stdin.end(`${inputFiles.join('\n')}\n${terminator ? `${terminator}\n` : ''}`);
  await finished;
}

export async function openAnalyzerSession(binary: string, logFile: string, env: NodeJS.ProcessEnv, label: string, args: string[] = [], cwd = dirname(logFile)) {
  // Resolve auto once, before hashing, so checkpoint identity and the spawned
  // analyzer use the same explicit table profile across every resident batch.
  env = resolveStatsAnalyzerEnv(binary, env);
  // Bind checkpoints to the real executable and all solver configuration, but
  // exclude monitoring/progress and thread count, which do not change results.
  const hash = createHash('sha256');
  for await (const bytes of createReadStream(binary)) hash.update(bytes);
  hash.update(JSON.stringify(args));
  hash.update(JSON.stringify(Object.entries(env).filter(([key]) => key.startsWith('CUBE_')).sort(([a], [b]) => a.localeCompare(b))));
  const checkpointId = hash.digest('hex');
  let pending: { output: string; resolve: () => void; reject: (error: Error) => void } | undefined;
  let ended = false;
  const { child, finished, resetProgress } = await launchAnalyzer(binary, logFile,
    { ...env, ANALYZER_CHECKPOINT_ID: checkpointId, ANALYZER_PROGRESS_FILE: undefined }, label, args, cwd, line => {
      const done = line.match(/\[DONE\].*output=(.+)$/);
      if (!done || !pending) return;
      const current = pending;
      pending = undefined;
      if (resolve(cwd, done[1]) !== current.output) current.reject(new Error('Analyzer completed an unexpected output file'));
      else current.resolve();
    });
  void finished.then(() => {
    ended = true;
    pending?.reject(new Error('Analyzer exited before completing its input'));
    pending = undefined;
  }, error => { ended = true; pending?.reject(error); pending = undefined; });
  return {
    pid: child.pid,
    checkpointId,
    async run(input: string, output: string) {
      if (ended || pending) throw new Error('Analyzer session is closed or already processing a file');
      if (/[\r\n]/.test(input)) throw new Error('Analyzer input path contains a line break');
      resetProgress();
      await new Promise<void>((done, fail) => {
        pending = { output: resolve(output), resolve: done, reject: fail };
        child.stdin.write(`${input}\n`, error => { if (error) { pending = undefined; fail(error); } });
      });
    },
    async close() {
      if (pending) throw new Error('Cannot close an analyzer with unfinished work');
      if (!ended) child.stdin.end('exit\n');
      await finished;
    },
    async abort() {
      if (child.exitCode === null && child.signalCode === null) child.kill('SIGTERM');
      const force = setTimeout(() => {
        if (child.exitCode === null && child.signalCode === null) child.kill('SIGKILL');
      }, 1500);
      try { await finished.catch(() => {}); } finally { clearTimeout(force); }
    },
  };
}
export async function stamp(): Promise<string> {
  const file = join(wcaDir, 'incremental', 'export_date.txt');
  return await exists(file) ? (await readFile(file, 'utf8')).trim() : new Date().toISOString().slice(0, 10);
}
export async function recordSeconds(file: string, jobs: string[], started: number): Promise<void> {
  await mkdir(dirname(file), { recursive: true });
  if (!await exists(file)) await writeFile(file, 'timestamp,seconds,jobs,no_publish\n');
  await appendFile(file, `${new Date().toISOString()},${((Date.now() - started) / 1000).toFixed(3)},${jobs.join('+')},true\n`);
}
