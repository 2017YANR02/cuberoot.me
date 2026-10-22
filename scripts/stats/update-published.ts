/** Explicit production entry. Local calculations remain in update-local.ts. */
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { CommandExitError, coreDir, jobDir, repoRoot, run, runTs, solverDir, stamp, taskProgress, tsx } from './common.js';
import { publishScrambleIncremental } from './publish-static.js';
import { loadMirrorToPg, loadOptimalToPg, loadStepsToPg } from './publish-pg.js';
import { existsSync } from 'node:fs';
import { withStatsResourceMonitor } from './resource-monitor.js';

type Options = { jobs: string[]; publishOnly: boolean; push: boolean; localArgs: string[] };
export function parsePublishedArgs(args: string[]): Options {
  if (!args.includes('--publish')) throw new Error('Production publishing requires explicit --publish');
  const jobs = args.includes('--jobs') ? (args[args.indexOf('--jobs') + 1] ?? '').split(',') : ['stages', '333opt', 'puzzles'];
  if (!jobs.length || jobs.some(job => !['all', 'stages', '333opt', 'puzzles'].includes(job))) throw new Error('Invalid --jobs');
  const forwarded = new Set(['--jobs', '--puzzles', '--variants', '--source-csv', '--max-chunks', '--chunk-size']);
  const switches = new Set(['--use-cached', '--skip-solve-333', '--skip-sq1-grind']);
  const localArgs: string[] = [];
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (forwarded.has(arg)) localArgs.push(arg, args[++i] ?? '');
    else if (switches.has(arg)) localArgs.push(arg);
    else if (!['--publish', '--publish-only', '--push'].includes(arg)) throw new Error(`Unknown production option ${arg}`);
  }
  return { jobs: jobs.includes('all') ? ['stages', '333opt', 'puzzles'] : jobs, publishOnly: args.includes('--publish-only'),
    push: args.includes('--push'), localArgs };
}
// Exit 2 is emitted only after local artifacts have all been built, with unresolved
// puzzle states recorded in the summary. Failed steps still exit 1 and block publishing.
export async function runLocalForPublish(args: string[], execute = runTs): Promise<void> {
  const script = join(repoRoot, 'scripts', 'stats', 'update-local.ts');
  try { await execute(script, args, coreDir); }
  catch (error) {
    if (!(error instanceof CommandExitError) || error.command !== tsx || error.args[0] !== script || error.code !== 2) throw error;
    console.warn('[统计警告] 本地产物已生成，但仍有待解/待定状态（见上方原因与 Run summary）。继续发布已生成的统计；未解状态保留供后续续算，不视为精确结果。');
  }
}

export async function publishPipeline(options: Options): Promise<void> {
  if (!existsSync(join(repoRoot, 'stats/.stats-release-base.json'))) throw new Error('Statistics publication baseline missing; hydrate the latest Release before computing (pnpm stats:hydrate). Existing local files are preserved.');
  if (!options.publishOnly) await runLocalForPublish(options.localArgs);
  const stampValue = await stamp();
  const operations = [
    ...(options.jobs.includes('stages') ? ['mirror', 'steps'] : []),
    ...(options.jobs.includes('333opt') ? ['optimal-333'] : []),
    ...(options.jobs.includes('puzzles') ? ['optimal-puzzle'] : []),
    'release', 'static',
  ];
  let completed = 0;
  const publishStep = async (name: string, action: () => Promise<unknown>): Promise<void> => {
    taskProgress(`publish:${name}`, 0, 1);
    await action();
    taskProgress(`publish:${name}`, 1, 1);
    taskProgress('publish', ++completed, operations.length);
  };
  taskProgress('publish', 0, operations.length);
  if (options.jobs.includes('stages')) await publishStep('mirror', loadMirrorToPg);
  if (options.jobs.includes('stages')) {
    const steps = join(repoRoot, 'stats', 'scramble', 'steps');
    await publishStep('steps', () => loadStepsToPg(join(steps, 'wca_scramble_steps.csv'), join(steps, 'steps_layout.json'), join(steps, 'wca_scramble_steps_rare.csv'), stampValue));
  }
  if (options.jobs.includes('333opt')) await publishStep('optimal-333', () => loadOptimalToPg(join(solverDir, '333opt', 'wca_optimal.csv'), '333'));
  if (options.jobs.includes('puzzles')) await publishStep('optimal-puzzle', () => loadOptimalToPg(join(jobDir, 'wca_optimal_puzzle.csv'), 'puzzle'));
  await publishStep('release', () => run(process.execPath, [join(repoRoot, 'scripts/wca-data/snapshot-cli.ts'), 'submit', 'scramble', join(repoRoot, 'stats')], repoRoot));
  await publishStep('static', publishScrambleIncremental);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url))
  void withStatsResourceMonitor(() => publishPipeline(parsePublishedArgs(process.argv.slice(2)))).catch(error => { console.error(error); process.exitCode = 1; });
