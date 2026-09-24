import { spawn } from 'node:child_process';
import { createReadStream, createWriteStream } from 'node:fs';
import { access, appendFile, mkdir, open, readFile, stat, unlink, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { createInterface } from 'node:readline';
import { dataRoot, puzzleDir, repoRoot, tableDir, wcaDir } from '../../core/jobs/scramble-stats-build/pipeline_paths.mjs';

export { dataRoot, puzzleDir, repoRoot, tableDir, wcaDir };
export const coreDir = join(repoRoot, 'core');
export const jobDir = join(coreDir, 'jobs', 'scramble-stats-build');
export const solverDir = join(repoRoot, 'solver');
export const exe = (name: string) => join(solverDir, 'target', 'release', `${name}${process.platform === 'win32' ? '.exe' : ''}`);
export const tsx = join(coreDir, 'node_modules', '.bin', process.platform === 'win32' ? 'tsx.cmd' : 'tsx');

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
export async function run(command: string, args: string[], cwd: string, env: NodeJS.ProcessEnv = process.env): Promise<void> {
  const child = spawn(command, args, { cwd, env, stdio: 'inherit', shell: process.platform === 'win32' && /\.cmd$/i.test(command) });
  const code = await new Promise<number>((done, fail) => { child.on('error', fail); child.on('close', value => done(value ?? 1)); });
  if (code !== 0) throw new Error(`${command} exited with ${code}`);
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
export async function analyzer(binary: string, inputFiles: string[], logFile: string, env: NodeJS.ProcessEnv, label: string, args: string[] = [], cwd = dirname(inputFiles[0]), terminator = 'exit'): Promise<void> {
  await mkdir(dirname(logFile), { recursive: true });
  const child = spawn(binary, args, { cwd, env, stdio: ['pipe', 'pipe', 'pipe'], shell: process.platform === 'win32' && /\.cmd$/i.test(binary) });
  const log = createWriteStream(logFile, { flags: 'w', encoding: 'utf8' });
  let lastStatus = 0;
  let shown = '';
  const show = (status: string) => {
    const now = Date.now();
    if (now - lastStatus < (process.stdout.isTTY ? 1000 : 300_000)) return;
    if (process.stdout.isTTY) process.stdout.write(`\r${status.padEnd(78)}`);
    else console.log(status);
    shown = status;
    lastStatus = now;
  };
  const capture = async (stream: NodeJS.ReadableStream) => {
    const reader = createInterface({ input: stream, crlfDelay: Infinity });
    for await (const line of reader) {
      log.write(`${line}\n`);
      const match = line.match(/\[PROG\]\s+(\d+)\s*\/\s*(\d+)/);
      if (match) show(`${label} ${match[1]}/${match[2]}`);
    }
  };
  const progressFile = env.ANALYZER_PROGRESS_FILE;
  const start = Date.now();
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
      const elapsed = Math.floor((Date.now() - start) / 1000);
      const eta = done > 0 && total > done ? ` | ETA 约 ${Math.round(elapsed * (total - done) / done / 60)} 分钟` : '';
      show(`${label} ${done}/${total} | 已运行 ${Math.floor(elapsed / 60)} 分钟${eta}`);
    } catch { /* progress file may be between writes */ }
  }, 10_000) : undefined;
  const output = Promise.all([capture(child.stdout), capture(child.stderr)]);
  child.stdin.end(`${inputFiles.join('\n')}\n${terminator ? `${terminator}\n` : ''}`);
  let code: number;
  try { code = await new Promise<number>((done, fail) => { child.on('error', fail); child.on('close', value => done(value ?? 1)); }); }
  finally { if (heartbeat) clearInterval(heartbeat); }
  await output;
  await new Promise<void>((done, fail) => { log.end(done); log.once('error', fail); });
  if (process.stdout.isTTY && shown) process.stdout.write('\n');
  if (code !== 0) throw new Error(`${label} exited with ${code}; see ${logFile}`);
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
