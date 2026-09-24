/** Standalone SQ1 exact, slash, and monster maintenance without PowerShell. */
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { grindSq1Monsters } from './sq1-grind.js';
import { runSq1Slash } from './sq1-slash.js';
import { runSq1Wca } from './sq1-wca.js';

export async function sq1Cli(args: string[]): Promise<void> {
  const action = args[0];
  if (!['wca', 'slash', 'grind'].includes(action)) throw new Error('Usage: sq1.ts wca|slash|grind [--option value]');
  const flags = new Map<string, string>();
  const booleanFlags = new Set(action === 'grind' ? [] : ['--build-only', '--merge-only', '--split', '--no-mitm']);
  for (let i = 1; i < args.length; i++) {
    const flag = args[i];
    if (!flag.startsWith('--')) throw new Error(`Unexpected SQ1 argument: ${flag}`);
    if (booleanFlags.has(flag)) flags.set(flag, 'true');
    else {
      const value = args[++i];
      if (value === undefined || value.startsWith('--')) throw new Error(`Missing value for ${flag}`);
      flags.set(flag, value);
    }
  }
  const allowed: Record<string, string[]> = {
    wca: ['--chunk-size', '--threads', '--build-only'],
    slash: ['--chunk-size', '--threads', '--timeout-secs', '--split', '--split-depth', '--split-timeout-secs', '--merge-only', '--no-mitm'],
    grind: ['--threads', '--tt-budget', '--timeout-secs', '--chunk-size', '--split'],
  };
  for (const key of flags.keys()) if (!allowed[action].includes(key)) throw new Error(`Unsupported ${action} option: ${key}`);
  const number = (key: string) => flags.has(key) ? Number(flags.get(key)) : undefined;
  for (const key of flags.keys()) if (!booleanFlags.has(key) && (!Number.isSafeInteger(number(key)) || Number(flags.get(key)) < 0)) throw new Error(`Invalid number: ${key}`);
  for (const key of ['--chunk-size', '--threads', '--tt-budget', '--split-depth']) if (flags.has(key) && number(key)! < 1) throw new Error(`${key} must be positive`);
  if (action === 'wca') await runSq1Wca({ chunkSize: number('--chunk-size'), threads: number('--threads'), buildOnly: flags.has('--build-only') });
  else if (action === 'slash') await runSq1Slash({ chunkSize: number('--chunk-size'), threads: number('--threads'), timeoutSecs: number('--timeout-secs'),
    split: flags.has('--split'), splitDepth: number('--split-depth'), splitTimeoutSecs: number('--split-timeout-secs'),
    mergeOnly: flags.has('--merge-only'), noMitm: flags.has('--no-mitm') });
  else await grindSq1Monsters({ ladder: false, threads: number('--threads'), ttBudget: number('--tt-budget'),
    timeoutSecs: number('--timeout-secs'), chunkSize: number('--chunk-size'), split: number('--split') });
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url))
  void sq1Cli(process.argv.slice(2)).catch(error => { console.error(error); process.exitCode = 1; });
