/** Daily Egg coordinator; table size follows physical memory. One table load, indexed output, append-only resume. */
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { createReadStream, existsSync, mkdirSync, openSync, closeSync, writeSync, fsyncSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs';
import { createInterface } from 'node:readline';
import { resolve } from 'node:path';
import { pathToFileURL as fileUrl } from 'node:url';
import { preflightStatsEngine, verifyEggEngine } from './stats-engine.mts';
import { rustScramble } from './rust-h10-adapter.mts';
import { wcaDir } from './data_paths.mjs';
import { withStatsResourceMonitor } from '../../scripts/stats/resource-monitor.ts';

export type PendingCube = { id: string; scramble: string };
/** Egg may report adjacent indices out of order, even with -c 1. */
export function decodeEggResult(raw: string, pending: PendingCube[], seen: Set<number>) {
  const row = JSON.parse(raw);
  if (row.type === 'total') {
    if (row.cubes !== pending.length || seen.size !== pending.length) throw Error('Incomplete Egg output');
    return null;
  }
  if (row.type !== 'solved' || !Number.isSafeInteger(row.index) || row.index < 0 || row.index >= pending.length || seen.has(row.index)
    || row.ok !== true || !Number.isInteger(row.length) || row.length < 0 || row.length > 20 || typeof row.moves !== 'string'
    || !/^(?:[URFDLB](?:2|')?(?:\s+|$))*$/.test(row.moves)
    || row.moves.trim().split(/\s+/).filter(Boolean).length !== row.length) throw Error('Invalid/duplicate Egg result');
  seen.add(row.index);
  return { ...pending[row.index], length: row.length, solution: row.moves.trim() };
}
async function* lines(path: string) {
  const stream = createReadStream(path, 'utf8'), reader = createInterface({ input: stream, crlfDelay: Infinity });
  try { for await (const line of reader) if (line.trim()) yield line; }
  finally { reader.close(); stream.destroy(); }
}
export async function runEggStats() {
  await withStatsResourceMonitor(async () => {
    const root = resolve(import.meta.dirname, '../..');
    const config = verifyEggEngine(root);
    const label = `Egg ${config.memoryGiB}G`;
    const corpus = resolve(process.env.CORPUS || resolve(wcaDir, 'wca_scrambles_no_wide_move.txt'));
    const output = resolve(process.env.OUT || resolve(import.meta.dirname, 'out.0.csv'));
    const done = new Set<string>(), counts: Record<string, number> = {}, pending: PendingCube[] = [];
    if (existsSync(output)) for await (const row of lines(output)) {
      const [id, length, solution] = row.split(',');
      if (!/^\d+$/.test(id) || !/^\d+$/.test(length) || Number(length) > 20 || solution === undefined || done.has(id)) throw Error('Malformed/duplicate saved optimal row');
      done.add(id); counts[length] = (counts[length] ?? 0) + 1;
    }
    let total = 0, completed = 0;
    const inputIds = new Set<string>();
    for await (const row of lines(corpus)) {
      const comma = row.indexOf(','), id = row.slice(0, comma);
      if (comma < 1 || !/^\d+$/.test(id) || inputIds.has(id)) throw Error('Malformed/duplicate corpus ID');
      inputIds.add(id); total++;
      if (done.has(id)) completed++;
      else pending.push({ id, scramble: rustScramble(row.slice(comma + 1)) });
    }
    if (!total) throw Error('Empty WCA corpus');
    if (!pending.length) { console.log(`[${label}] corpus complete: ${completed}/${total}`); return; }
    preflightStatsEngine(root);
    const lock = resolve(root, '.local-data/cubeopt-reverse/compute.lock');
    mkdirSync(resolve(lock, '..'), { recursive: true });
    const lockFd = openSync(lock, 'wx', 0o600);
    const token = `${process.pid}-${Date.now()}`;
    try { writeSync(lockFd, JSON.stringify({ pid: process.pid, scope: 'scramble-stats-egg-session', token })); }
    finally { closeSync(lockFd); }
    let child: ReturnType<typeof spawn> | undefined, closed = false;
    try {
      const { cube3x3x3 } = await import(fileUrl(resolve(root, 'core/packages/client/node_modules/cubing/dist/lib/cubing/puzzles/index.js')).href);
      const solved = (await cube3x3x3.kpuzzle()).defaultPattern();
      const args = ['--table', config.table, '--load', 'copy', '-t', String(config.threads), '-c', '1', '--json'];
      // Lanes use the upstream default; do not read a stale tuning override.
      if (existsSync(config.table + '.tune')) throw Error('Remove/review Egg tuning override before using default lanes');
      const env = { ...process.env };
      for (const key of Object.keys(env)) if (key.startsWith('EGG_SOLVER_')) delete env[key];
      child = spawn(config.binary!, args, { env, stdio: ['pipe', 'pipe', 'inherit'] });
      const worker = child;
      console.log(`[${label}] resident solver PID=${worker.pid}; pending=${pending.length}; threads=${config.threads}; lanes=default; RSS cap=${config.memoryGiB} GiB`);
      writeFileSync(`${output}.egg-run-${Date.now()}.json`, JSON.stringify({ ...config, args, pid: worker.pid, corpus, output, pending: pending.length, startedAt: new Date().toISOString() }, null, 2));
      const abort = new AbortController();
      const exited = new Promise<void>((yes, no) => {
        worker.once('error', error => { closed = true; abort.abort(error); no(error); });
        worker.once('close', (code, signal) => { closed = true;
          if (code === 0 && worker.stdin!.writableEnded) yes();
          else { const error = Error(`Egg exited ${code ?? signal}; saved results retained`); abort.abort(error); no(error); }
        });
      });
      worker.stdin!.on('error', error => abort.abort(error));
      const feed = (async () => {
        for (const cube of pending) {
          abort.signal.throwIfAborted();
          if (!worker.stdin!.write(cube.scramble + '\n')) await once(worker.stdin!, 'drain', { signal: abort.signal });
        }
        worker.stdin!.end();
      })();
      const seen = new Set<number>(), fd = openSync(output, 'a');
      let summary = false;
      const collect = (async () => {
        for await (const raw of createInterface({ input: worker.stdout!, crlfDelay: Infinity })) {
          if (summary) throw Error('Egg output after total');
          const row = decodeEggResult(raw, pending, seen);
          if (!row) { summary = true; continue; }
          if (!solved.applyAlg(row.scramble).applyAlg(row.solution).isIdentical(solved)) throw Error(`Egg independent replay failed: ${row.id}`);
          writeSync(fd, `${row.id},${row.length},${row.solution}\n`);
          counts[row.length] = (counts[row.length] ?? 0) + 1;
          if (seen.size % 100 === 0) { fsyncSync(fd); console.log(`[${label}] ${completed + seen.size}/${total}`); }
        }
      })();
      try {
        await Promise.all([feed, collect, exited]);
        if (!summary || seen.size !== pending.length) throw Error('Egg output incomplete');
      } catch (error) {
        abort.abort(error); worker.stdin!.destroy(); worker.kill('SIGTERM');
        await Promise.allSettled([feed, collect, exited]); throw error;
      } finally { fsyncSync(fd); closeSync(fd); }
      if (!process.argv.includes('--no-counts')) writeFileSync(resolve(import.meta.dirname, 'counts.json'), JSON.stringify({ samples: done.size + seen.size, counts }, null, 2) + '\n');
      console.log(`[${label}] complete: ${total}/${total}; independently replayed ${seen.size} new solutions`);
    } finally {
      // A protection kill deliberately leaves the lock and evidence for review.
      if ((!child || closed) && JSON.parse(readFileSync(lock, 'utf8')).token === token) unlinkSync(lock);
    }
  });
}
