/** Explicit production entry. Local calculations remain in update-local.ts. */
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { coreDir, jobDir, repoRoot, run, runTs, solverDir, stamp } from './common.js';
import { publishScrambleIncremental } from './publish-static.js';
import { loadMirrorToPg, loadOptimalToPg, loadStepsToPg } from './publish-pg.js';

type Options = { jobs: string[]; publishOnly: boolean; push: boolean; localArgs: string[] };
export function parsePublishedArgs(args: string[]): Options {
  if (!args.includes('--publish')) throw new Error('Production publishing requires explicit --publish');
  const jobs = args.includes('--jobs') ? (args[args.indexOf('--jobs') + 1] ?? '').split(',') : ['stages', '333opt', 'puzzles'];
  if (!jobs.length || jobs.some(job => !['all', 'stages', '333opt', 'puzzles'].includes(job))) throw new Error('Invalid --jobs');
  const forwarded = new Set(['--jobs', '--puzzles', '--variants', '--source-csv', '--max-chunks', '--chunk-size']);
  const switches = new Set(['--use-cached', '--skip-solve-333']);
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
async function requireMainForPush(): Promise<void> {
  const { execFile } = await import('node:child_process');
  const { promisify } = await import('node:util');
  const { stdout: branch } = await promisify(execFile)('git', ['branch', '--show-current'], { cwd: repoRoot, encoding: 'utf8' });
  if (branch.trim() !== 'main') throw new Error(`--push requires local main, current branch is ${branch.trim() || '(detached)'}`);
}
async function pushStats(stampValue: string): Promise<void> {
  // Only the statistics output is staged. A non-fast-forward push stops and leaves the local commit for review.
  await requireMainForPush();
  await run('git', ['add', '--', 'stats/scramble'], repoRoot);
  const { spawn } = await import('node:child_process');
  const child = spawn('git', ['diff', '--cached', '--quiet', '--', 'stats/scramble'], { cwd: repoRoot, stdio: 'ignore' });
  const code = await new Promise<number>((done, fail) => { child.on('error', fail); child.on('close', value => done(value ?? 2)); });
  if (code === 0) { console.log('[git] stats/scramble unchanged'); return; }
  if (code !== 1) throw new Error(`git diff exited ${code}`);
  await run('git', ['commit', '-m', `chore(scramble-stats): incremental refresh (${stampValue})`, '--', 'stats/scramble'], repoRoot);
  await run('git', ['push', 'origin', 'main'], repoRoot);
}

export async function publishPipeline(options: Options): Promise<void> {
  if (options.push) await requireMainForPush();
  if (!options.publishOnly) await runTs(join(repoRoot, 'scripts', 'stats', 'update-local.ts'), options.localArgs, coreDir);
  const stampValue = await stamp();
  if (options.jobs.includes('stages')) await loadMirrorToPg();
  if (options.jobs.includes('stages')) {
    const steps = join(repoRoot, 'stats', 'scramble', 'steps');
    await loadStepsToPg(join(steps, 'wca_scramble_steps.csv'), join(steps, 'steps_layout.json'), join(steps, 'wca_scramble_steps_rare.csv'), stampValue);
  }
  if (options.jobs.includes('333opt')) await loadOptimalToPg(join(solverDir, '333opt', 'wca_optimal.csv'), '333');
  if (options.jobs.includes('puzzles')) await loadOptimalToPg(join(jobDir, 'wca_optimal_puzzle.csv'), 'puzzle');
  await publishScrambleIncremental();
  if (options.push) await pushStats(stampValue);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url))
  void publishPipeline(parsePublishedArgs(process.argv.slice(2))).catch(error => { console.error(error); process.exitCode = 1; });
