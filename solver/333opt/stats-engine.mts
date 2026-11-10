/** Shared daily-statistics selection; metadata checks never load the PDB. */
import { resolve } from 'node:path';
import { statSync, readFileSync, openSync, readSync, closeSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { availableParallelism, totalmem } from 'node:os';
import { opt10Configuration } from './rust-h10-adapter.mts';
import {observeStatsResources,statsStartupReady} from '../experiments/cube48opt-rust/stats-resume-review.mts';
export function statsEngine(root: string, env: NodeJS.ProcessEnv = process.env, physicalMemoryBytes = totalmem()) {
  const engine = env.H10_ENGINE ?? 'egg';
  if (!['c', 'rust', 'opt10', 'egg'].includes(engine)) throw Error('Invalid H10_ENGINE');
  const threads = Number(env.THREADS || Math.min(availableParallelism(), ['opt10', 'egg'].includes(engine) ? 16 : Infinity));
  if (!Number.isSafeInteger(threads) || threads < 1) throw Error('Invalid THREADS');
  if (engine === 'egg') {
    if (!Number.isSafeInteger(physicalMemoryBytes) || physicalMemoryBytes < 64 * 2 ** 30)
      throw Error('Automatic Egg selection requires at least 64 GiB physical memory');
    const large = physicalMemoryBytes >= 128 * 2 ** 30;
    const memoryGiB = large ? 64 : 32;
    return {
    engine, threads, physicalMemoryBytes, memoryGiB, h: large ? 11 : 10,
    expectedBytes: large ? 62_261_825_536 : 31_130_914_816,
    tableChecksum: large ? '0e756b40bf50e2b2' : 'f2c101eb651ea2c9',
    rssLimit: memoryGiB * 2 ** 30, startupRequiredBytes: (memoryGiB + 3) * 2 ** 30,
    table: resolve(env.EGG_SOLVER_TABLE || resolve(root, large
      ? '../egg-solver-benchmarks/2026-11-09-h11-nocache-retry/h11'
      : '../egg-solver-benchmarks/2026-11-09-m5-max/h10')),
    binary: resolve(env.EGG_SOLVER_BINARY || resolve(root, '../egg-solver/target/macos-nocache-io-fix/release/solve')),
    binarySha256: '4c7a994372cd976ff8903f8b4a31a6b163b438b44508c41a535b2fde9f9f81ba',
  };
  }
  const table = engine === 'opt10' ? resolve(root, '.local-data/cubeopt-reverse/opt10-generated-v2/cuberoot-opt10.dat')
    : resolve(env.H48_H10_TABLE || resolve(env.CUBE_TABLE_DIR || resolve(root,'solver/tables'),'h48-nissy-core/h48h10.dat'));
  return { engine, threads, table, expectedBytes: engine === 'opt10' ? 31_130_911_744 : 30_336_314_216 };
}
/** Pin the accepted macOS copy loader; inspect only the existing table trailer. */
export function verifyEggEngine(root: string, env: NodeJS.ProcessEnv = process.env, physicalMemoryBytes = totalmem()) {
  const config = statsEngine(root, env, physicalMemoryBytes);
  if (config.engine !== 'egg' || !config.binary) throw Error('Egg engine required');
  if (process.platform !== 'darwin') throw Error('This Egg release is accepted for macOS only');
  if (statSync(config.table).size !== config.expectedBytes) throw Error(`Egg ${config.memoryGiB}G table missing/incomplete`);
  if (createHash('sha256').update(readFileSync(config.binary)).digest('hex') !== config.binarySha256) throw Error('Egg executable differs from accepted release');
  const fd = openSync(config.table, 'r'), trailer = Buffer.alloc(4096);
  try { if (readSync(fd, trailer, 0, trailer.length, config.expectedBytes - trailer.length) !== trailer.length) throw Error('Incomplete Egg trailer'); }
  finally { closeSync(fd); }
  if (!trailer.toString().startsWith(`egg-solver h48 table v1\nlayout h48\nk ${config.h}\nbase 10\nbytes ${config.expectedBytes - 4096}\n`)
    || !trailer.toString().includes(`\nchecksum ${config.tableChecksum}\n`)) throw Error(`Egg table differs from accepted h${config.h}/base10`);
  return config;
}
export function statsOpt10Configuration(root: string, threads: number) {
  const config = opt10Configuration(root, threads);
  return {...config, args: config.args.map((arg,i)=>i === 1 ? 'scramble-stats-opt10-session' : arg)};
}
export function preflightStatsEngine(root: string) {
  const config = statsEngine(root);
  if (statSync(config.table, {throwIfNoEntry:false})?.size !== config.expectedBytes)
    throw Error(config.engine + ' table missing/incomplete: ' + config.table);
  if (config.engine === 'opt10') {
    statsOpt10Configuration(root, config.threads);
    statsStartupReady(observeStatsResources(), config.threads);
  }
  if (config.engine === 'egg') {
    verifyEggEngine(root);
    const now = observeStatsResources();
    if (now.pressure !== 1 || now.computeRunning || now.lockExists || now.available < config.startupRequiredBytes!)
      throw Error(`Egg ${config.memoryGiB}G startup requires normal pressure, exclusive compute access and ${config.startupRequiredBytes! / 2 ** 30} GiB available; current available=${(now.available / 2 ** 30).toFixed(1)} GiB, pressure=${now.pressure}, computeRunning=${now.computeRunning}, lockExists=${now.lockExists}`);
  }
  return config;
}
