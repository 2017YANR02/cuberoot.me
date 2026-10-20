/** Shared daily-statistics selection; metadata checks never load the PDB. */
import { resolve } from 'node:path';
import { statSync } from 'node:fs';
import { availableParallelism } from 'node:os';
import { opt10Configuration } from './rust-h10-adapter.mts';
import {observeStatsResources,statsStartupReady} from '../experiments/cube48opt-rust/stats-resume-review.mts';
export function statsEngine(root: string, env: NodeJS.ProcessEnv = process.env) {
  const engine = env.H10_ENGINE ?? 'opt10';
  if (!['c', 'rust', 'opt10'].includes(engine)) throw Error('Invalid H10_ENGINE');
  const threads = Number(env.THREADS || Math.min(availableParallelism(), engine === 'opt10' ? 16 : Infinity));
  if (!Number.isSafeInteger(threads) || threads < 1) throw Error('Invalid THREADS');
  const table = engine === 'opt10' ? resolve(root, '.tmp/cubeopt-reverse/opt10-generated-v2/cuberoot-opt10.dat')
    : resolve(env.H48_H10_TABLE || resolve(env.CUBE_TABLE_DIR || resolve(root,'solver/tables'),'h48-nissy-core/h48h10.dat'));
  return { engine, threads, table, expectedBytes: engine === 'opt10' ? 31_130_911_744 : 30_336_314_216 };
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
  return config;
}
