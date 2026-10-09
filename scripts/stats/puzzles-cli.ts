/** Standalone puzzle distribution updater; the full one-click pipeline is update-local.ts. */
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runPuzzles } from './puzzles.js';

export async function puzzlesCli(args: string[]): Promise<void> {
  const values = new Map<string, string>();
  const switches = new Set<string>();
  const valueFlags = new Set(['--puzzles', '--max-new', '--chunk-size', '--sampled-n', '--sampled-events']);
  const switchFlags = new Set(['--build-only', '--sampled', '--rebuild-tier-b']);
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (switchFlags.has(arg)) switches.add(arg);
    else if (valueFlags.has(arg)) values.set(arg, args[++i] ?? '');
    else throw new Error(`Unknown puzzle option: ${arg}`);
  }
  const maxNew = Number(values.get('--max-new') ?? 0);
  const chunkSize = Number(values.get('--chunk-size') ?? 200_000);
  const sampledN = Number(values.get('--sampled-n') ?? 0);
  if (![maxNew, sampledN].every(n => Number.isInteger(n) && n >= 0) || !Number.isInteger(chunkSize) || chunkSize < 1) throw new Error('Invalid puzzle count');
  await runPuzzles((values.get('--puzzles') ?? '').split(',').filter(Boolean), maxNew, {
    buildOnly: switches.has('--build-only'), chunkSize, sampled: switches.has('--sampled'), sampledN,
    sampledEvents: (values.get('--sampled-events') ?? '').split(',').filter(Boolean), rebuildTierB: switches.has('--rebuild-tier-b'),
  });
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url))
  void puzzlesCli(process.argv.slice(2)).catch(error => { console.error(error); process.exitCode = 1; });
