/** One local TypeScript entry for stages, 3x3 optimal, and puzzle statistics. */
import { availableParallelism } from 'node:os';
import { appendFile, mkdir, open, readFile, readdir, rename, stat, unlink, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  appendUniqueById, coreDir, exe, exists, fileSize, ids, jobDir, lineCount, openAnalyzerSession,
  puzzleDir, recordSeconds, repoRoot, run, runNode, runPnpm, runTs, solverDir, stamp,
  tableDir, taskProgress, wcaDir,
} from './common.js';
import { runPuzzles } from './puzzles.js';
import { sq1GrindResourcePlan } from './sq1-grind.js';
import { syncAnalyzerChunks, validateAnalyzerOutput } from './analyzer-chunks.js';
import { preflightStatsEngine, statsEngine } from '../../solver/333opt/stats-engine.mts';
import { registerStatsSummary, statsProtectionReason, statsResourcePlan, withStatsResourceMonitor } from './resource-monitor.js';

type Job = 'stages' | '333opt' | 'puzzles';
type Options = {
  jobs: Job[]; puzzles: string[]; variants: string[]; maxChunks: number;
  chunkSize?: number; dryRun: boolean; useCached: boolean; sourceCsv?: string;
  skipSolve333: boolean; skipSq1Grind: boolean; plan: boolean; noPublish: true;
};
const variantBins: Record<string, string> = {
  daisy: 'daisy_analyzer', first_layer: 'first_layer_analyzer', eo: 'eo_cross_analyzer',
  pseudo: 'pseudo_analyzer', pseudo_pair: 'pseudo_pair_analyzer', pair: 'pair_analyzer',
  f2leo: 'f2leo_analyzer', pseudo_f2leo: 'pseudo_f2leo_analyzer',
  '222': 'block222_analyzer', roux: 'roux_analyzer', '223': 'block223_analyzer',
  eoline: 'eoline_analyzer', dr: 'dr_analyzer', f2b: 'f2b_analyzer',
};
const defaultChunks: Record<string, number> = {
  daisy: 200_000, first_layer: 10_000, eo: 2_000, pair: 2_000,
  pseudo: 20_000, pseudo_pair: 20_000, f2leo: 20_000, pseudo_f2leo: 20_000,
  '222': 200_000, roux: 200_000, '223': 50_000, eoline: 200_000,
  dr: 50_000, f2b: 10_000,
};
const master = join(wcaDir, 'wca_scrambles_no_wide_move.txt');
const incremental = join(wcaDir, 'incremental');
const pendingInput = join(incremental, 'new_no_wide_move.txt');
const pendingStd = join(incremental, 'new_no_wide_move_std.csv');
const pendingSplit = join(incremental, 'new_split_mbf.csv');
const stageBuildStamp = join(tableDir, 'stats-stage-build.json');

async function stageSourceSnapshot(): Promise<string> {
  const files = ['std', ...Object.keys(variantBins)].map(name => join(wcaDir, 'stats', `${name}.csv`));
  files.push(master);
  return JSON.stringify(await Promise.all(files.map(async file => {
    try {
      const { size, mtimeMs } = await stat(file);
      return [file, size, mtimeMs];
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
      return [file, null];
    }
  })));
}

async function stageBuildIsStale(): Promise<boolean> {
  try { return (await readFile(stageBuildStamp, 'utf8')) !== await stageSourceSnapshot(); }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    return true;
  }
}

async function syncStageTriplet(required: boolean): Promise<boolean> {
  if (!await exists(pendingInput) || !await exists(pendingStd) || !await exists(pendingSplit)) {
    if (required) throw new Error('Stage input, std result, or split metadata is missing');
    return false;
  }
  const expected = await ids(pendingInput);
  const n = await lineCount(pendingInput);
  if (!n) return false;
  const std = await ids(pendingStd, true);
  const split = await ids(pendingSplit, true);
  const matches = expected.size === n && std.size === n && split.size === n
    && await lineCount(pendingStd) === n + 1 && await lineCount(pendingSplit) === n + 1
    && [...expected].every(id => std.has(id) && split.has(id));
  if (!matches) {
    if (required) throw new Error('Stage result IDs differ from input or split metadata');
    return false;
  }
  const addedStd = await appendUniqueById(join(wcaDir, 'stats', 'std.csv'), pendingStd, true, true);
  const addedMaster = await appendUniqueById(master, pendingInput, false, false);
  const addedSplit = await appendUniqueById(join(wcaDir, 'input', 'wca_scrambles_split_mbf.csv'), pendingSplit, true, true);
  for (const path of [join(wcaDir, 'stats', 'std.csv'), master, join(wcaDir, 'input', 'wca_scrambles_split_mbf.csv')]) {
    const file = await open(path, 'r');
    try { await file.sync(); } finally { await file.close(); }
  }
  if (addedStd || addedMaster || addedSplit) console.log(`[stages] 恢复/保存增量：std ${addedStd}，master ${addedMaster}，元数据 ${addedSplit}`);
  return Boolean(addedStd || addedMaster || addedSplit);
}

function csv(value: string): string[] { return value === 'none' ? [] : value.split(',').map(item => item.trim()).filter(Boolean); }
export function parseLocalArgs(argv: string[]): Options {
  const options: Options = {
    jobs: ['stages', '333opt', 'puzzles'], puzzles: ['222', 'pyraminx', 'skewb', 'clock', 'sq1'],
    variants: Object.keys(variantBins), maxChunks: 0, dryRun: false, useCached: false,
    skipSolve333: false, skipSq1Grind: false, plan: false, noPublish: true,
  };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--plan') options.plan = true;
    else if (arg === '--no-publish') options.noPublish = true;
    else if (arg === '--dry-run') options.dryRun = true;
    else if (arg === '--use-cached') options.useCached = true;
    else if (arg === '--skip-solve-333') options.skipSolve333 = true;
    else if (arg === '--skip-sq1-grind') options.skipSq1Grind = true;
    else if (arg === '--jobs') {
      const items = csv(argv[++i] ?? '');
      options.jobs = items.includes('all') ? ['stages', '333opt', 'puzzles'] : items as Job[];
    } else if (arg === '--puzzles') options.puzzles = csv(argv[++i] ?? '');
    else if (arg === '--variants') options.variants = csv(argv[++i] ?? '');
    else if (arg === '--source-csv') options.sourceCsv = resolve(argv[++i] ?? '');
    else if (arg === '--max-chunks') options.maxChunks = Number(argv[++i]);
    else if (arg === '--chunk-size') options.chunkSize = Number(argv[++i]);
    else throw new Error(`Unknown option ${arg}; this entry is local only and never publishes`);
  }
  if (!options.jobs.length || options.jobs.some(job => !['stages', '333opt', 'puzzles'].includes(job))) throw new Error('Invalid --jobs selection');
  if (options.variants.some(name => !(name in variantBins))) throw new Error('Unknown stage variant');
  if (!Number.isInteger(options.maxChunks) || options.maxChunks < 0) throw new Error('--max-chunks must be a nonnegative integer');
  if (options.chunkSize !== undefined && (!Number.isInteger(options.chunkSize) || options.chunkSize < 1)) throw new Error('--chunk-size must be positive');
  return options;
}
function requiredAnalyzers(options: Options): string[] {
  const bins = new Set<string>();
  if (options.jobs.includes('stages')) {
    bins.add('std_analyzer');
    for (const name of options.variants) bins.add(variantBins[name]);
  }
  if (options.jobs.includes('puzzles')) {
    const puzzleBins: Record<string, string[]> = {
      '222': ['cube222_analyzer'], pyraminx: ['pyraminx_analyzer'],
      skewb: ['skewb_analyzer'], clock: [], sq1: ['sq1_analyzer', 'sq1_slash_mitm'],
    };
    for (const name of options.puzzles) {
      if (!(name in puzzleBins)) throw new Error(`Unknown puzzle: ${name}`);
      for (const bin of puzzleBins[name]) bins.add(bin);
    }
  }
  return [...bins];
}
function stageEnv(): NodeJS.ProcessEnv {
  const env = { ...process.env, CUBE_TABLE_DIR: tableDir, CUBE_ALLOW_HUGE_TABLES: '1', RAYON_NUM_THREADS: String(availableParallelism()) };
  for (const key of ['CUBE_RUN_FULL_STD', 'CUBE_EO_NO_DIAG', 'CUBE_PAIR_NO_DIAG', 'CUBE_PSEUDO_SKIP_XCROSS', 'CUBE_PSEUDO_SKIP_XXCROSS', 'CUBE_PSEUDO_SKIP_XXXCROSS']) delete env[key];
  return env;
}
async function syncVariant(name: string, options: Options): Promise<boolean> {
  return (await syncAnalyzerChunks({
    binary: exe(variantBins[name]), input: join(incremental, `sync_${name}.txt`),
    output: join(incremental, `sync_${name}_${name}.csv`), log: join(incremental, `sync_${name}.analyzer.log`),
    env: stageEnv(), label: name, master, target: join(wcaDir, 'stats', `${name}.csv`),
    chunkSize: options.chunkSize ?? defaultChunks[name], maxChunks: options.maxChunks,
  })) > 0;
}

async function runStages(options: Options): Promise<{ nNew: number; stdChanged: boolean; variantChanged: boolean }> {
  const units = 2 + options.variants.length;
  let completedUnits = 0;
  let stdSession: Awaited<ReturnType<typeof openAnalyzerSession>> | undefined;
  const solveStd = async () => {
    stdSession ??= await openAnalyzerSession(exe('std_analyzer'), join(incremental, 'std_analyzer.log'),
      { ...stageEnv(), CUBE_RUN_FULL_STD: '1' }, 'std');
    await stdSession.run(pendingInput, pendingStd);
    await validateAnalyzerOutput(pendingInput, pendingStd);
  };
  const clearStdCheckpoint = async () => {
    for (const suffix of ['.checkpoint', '.checkpoint.meta']) {
      if (await exists(pendingStd + suffix)) await unlink(pendingStd + suffix);
    }
  };
  let nNew = 0;
  let stdChanged = false;
  let variantChanged = false;
  try {
    if (!options.dryRun) {
      const pending = await exists(pendingStd + '.checkpoint') || await exists(pendingStd + '.checkpoint.meta');
      if (pending) {
        // Recover the old exact input before incremental.ts replaces any triplet member.
        const expected = await ids(pendingInput);
        const saved = await Promise.all([
          ids(join(wcaDir, 'stats', 'std.csv'), true), ids(master),
          ids(join(wcaDir, 'input', 'wca_scrambles_split_mbf.csv'), true),
        ]);
        const alreadyCommitted = expected.size > 0 && saved.every(set => [...expected].every(id => set.has(id)));
        if (!alreadyCommitted) {
          await solveStd();
          stdChanged = await syncStageTriplet(true);
        }
        await clearStdCheckpoint();
      } else stdChanged = await syncStageTriplet(false);
    }
    console.log('\n=== stages: 增量取数 ===');
    const incrArgs = ['--data-dir', wcaDir];
    if (options.sourceCsv) incrArgs.push('--source-csv', options.sourceCsv);
    if (options.useCached) incrArgs.push('--use-cached');
    if (options.dryRun) incrArgs.push('--dry-run');
    await runTs(join(jobDir, 'src', 'incremental.ts'), incrArgs);
    if (!options.dryRun) taskProgress('stages', ++completedUnits, units);
    if (options.dryRun) {
      console.log('[dry-run] 只读检查完成');
      return { nNew: 0, stdChanged: false, variantChanged: false };
    }
    const input = pendingInput;
    nNew = await lineCount(input);
    console.log(`新打乱 ${nNew} 条`);
    if (nNew > 0) {
      console.log('\n=== stages: std_analyzer ===');
      const output = pendingStd;
      if (await exists(output)) await unlink(output);
      await solveStd();
      const got = Math.max(0, (await lineCount(output)) - 1);
      if (got !== nNew) throw new Error(`std returned ${got}/${nNew} rows`);
      console.log('\n=== stages: 幂等同步 CSV ===');
      stdChanged = await syncStageTriplet(true) || stdChanged;
      await clearStdCheckpoint();
    }
  } finally {
    if (stdSession) {
      try { await stdSession.close(); } catch (error) { await stdSession.abort(); throw error; }
    }
  }
  taskProgress('stages', ++completedUnits, units);
  if (options.variants.length) {
    console.log(`\n=== stages: 补缺 ${options.variants.join(', ')} ===`);
    if (!await exists(master)) throw new Error(`Missing stage corpus: ${master}`);
    for (const name of options.variants) {
      if (await syncVariant(name, options)) variantChanged = true;
      taskProgress('stages', ++completedUnits, units);
    }
  }
  return { nNew, stdChanged, variantChanged };
}

async function run333(options: Options, inject: boolean): Promise<boolean> {
  const solve = options.jobs.includes('333opt') && !options.skipSolve333;
  const units = Number(solve) + (inject ? 3 : 0);
  let completedUnits = 0;
  if (options.jobs.includes('333opt') && !options.skipSolve333) {
    console.log('\n=== 333opt: ' + statsEngine(repoRoot).engine + ' 续解 ===');
    await runTs(join(solverDir, '333opt', 'solve_h10.mts'), [], coreDir, { ...process.env, CUBE_TABLE_DIR: tableDir, RAYON_NUM_THREADS: String(availableParallelism()) });
    taskProgress('333opt', ++completedUnits, units);
  }
  if (!inject) return false;
  const outputs = (await readdir(join(solverDir, '333opt'))).filter(name => /^out\..*\.csv$/.test(name));
  if (!outputs.length) { console.log('[333opt] 尚无 out.*.csv，跳过注入'); return false; }
  console.log('\n=== 333opt: 注入分布、首次出现与最优打乱 ===');
  for (const script of ['inject.mjs', 'inject_first_appearance.mjs', 'export_optimal.mjs']) {
    await runNode(join(solverDir, '333opt', script), [], repoRoot);
    taskProgress('333opt', ++completedUnits, units);
  }
  return true;
}

type Summary = { startedAt: string; finishedAt?: string; status: string; protectionReason?: string; active?: string; partial?: string[]; steps: Array<{ name: string; seconds: number }> };
async function main(): Promise<void> {
  const options = parseLocalArgs(process.argv.slice(2));
  if (options.plan) {
    const resourceBudgets = [
      ...statsResourcePlan(requiredAnalyzers(options), stageEnv(), options.jobs.includes('333opt')),
      ...(options.jobs.includes('puzzles') && options.puzzles.includes('sq1') && !options.skipSq1Grind ? sq1GrindResourcePlan(stageEnv()) : []),
    ];
    console.log(JSON.stringify({ ...options, analyzers: requiredAnalyzers(options), resourceBudgets, repoRoot, coreDir, jobDir, wcaDir, puzzleDir, tableDir, optimalEngine: statsEngine(repoRoot), publish: false }, null, 2));
    return;
  }
  if (options.dryRun) {
    if (options.jobs.includes('stages')) await runStages(options);
    else console.log('[dry-run] 无 stages 取数步骤；使用 --plan 查看作业计划');
    return;
  }
  const runStart = Date.now();
  if (options.jobs.includes('333opt') && !options.skipSolve333) {
    preflightStatsEngine(repoRoot);
  }
  if (options.jobs.includes('puzzles') && options.puzzles.includes('sq1')) {
    const sq1 = join(tableDir, 'sq1_wca_jsqfull.bin');
    if (await fileSize(sq1) !== 13_005_619_200) throw new Error(`SQ1 table missing/incomplete: ${sq1}`);
  }
  await mkdir(tableDir, { recursive: true });
  const summaryPath = join(tableDir, `stats-local-${new Date().toISOString().replaceAll(':', '-')}.json`);
  const summary: Summary = { startedAt: new Date().toISOString(), status: 'running', steps: [] };
  registerStatsSummary(summaryPath);
  const persist = async () => {
    const reason = statsProtectionReason();
    if (reason) { summary.status = 'protected-stop'; summary.protectionReason = reason; }
    const temporary = `${summaryPath}.${process.pid}.new`;
    await writeFile(temporary, `${JSON.stringify(summary, null, 2)}\n`);
    await rename(temporary, summaryPath);
  };
  const step = async (name: string, action: () => Promise<void>) => {
    const started = Date.now();
    summary.active = name;
    await persist();
    taskProgress(name, 0, 1);
    try { await action(); taskProgress(name, 1, 1); }
    finally { summary.steps.push({ name, seconds: (Date.now() - started) / 1000 }); delete summary.active; await persist(); }
  };
  let nNew = 0; let stdChanged = false; let variantChanged = false; let puzzleChanged = false; let optChanged = false;
  let stageBuildPending = false;
  const partial: string[] = [];
  try {
    await step('build-analyzers', async () => {
      const bins = requiredAnalyzers(options);
      if (bins.length) await run('cargo', ['build', '--release', ...bins.flatMap(bin => ['--bin', bin])], solverDir);
    });
    await step('prepare-config', () => runNode(join(jobDir, 'prepare_config.mjs')));
    if (options.jobs.includes('stages')) await step('stages', async () => {
      ({ nNew, stdChanged, variantChanged } = await runStages(options));
    });
    if (options.jobs.includes('puzzles')) await step('puzzles', async () => {
      partial.push(...await runPuzzles(options.puzzles, 0, { skipSq1Grind: options.skipSq1Grind }));
      taskProgress('puzzles', 1, 4);
      await runPnpm(['--filter', '@cuberoot/scramble-stats-build', 'build:puzzle-examples']);
      taskProgress('puzzles', 2, 4);
      await runTs(join(jobDir, 'src', 'build_puzzle_first_appearance.ts'));
      taskProgress('puzzles', 3, 4);
      await runNode(join(jobDir, 'export_puzzle_optimal.mjs'));
      taskProgress('puzzles', 4, 4);
      puzzleChanged = true;
    });
    if (options.jobs.includes('stages')) stageBuildPending = stdChanged || variantChanged || await stageBuildIsStale();
    const buildEnv = { ...process.env, SCRAMBLE_STATS_STAMP: await stamp(), CUBE_TABLE_DIR: tableDir };
    // Full export scan is independent of stage CSV deltas: new classifiers must also run
    // when existing solver results are already current. Never treat a fixture CSV as a full export.
    if (!options.sourceCsv && (options.jobs.includes('stages') || (options.jobs.includes('puzzles') && options.puzzles.includes('222')))) {
      await step('no-bar', () => runPnpm(['--filter', '@cuberoot/scramble-stats-build', 'build:no-bar'], coreDir, buildEnv));
    }
    const refreshRecentEvents = async () => {
      if (options.jobs.includes('stages') || options.jobs.includes('puzzles')) await step('recent-events', () => runPnpm(['--filter', '@cuberoot/scramble-stats-build', 'build:recent-scrambles-events'], coreDir, buildEnv));
    };
    const willInject = options.jobs.includes('333opt') || stageBuildPending;
    if (!stageBuildPending && !willInject && !puzzleChanged) {
      await refreshRecentEvents();
      console.log('没有数据变化，结束。');
      summary.status = 'complete';
      return;
    }
    if (stageBuildPending) await step('build-stage-json', async () => {
      const commands = ['build', 'build:first-appearance', 'build:wca-cross', 'build:comp-steps'];
      for (const [index, command] of commands.entries()) {
        await runPnpm(['--filter', '@cuberoot/scramble-stats-build', command], coreDir, buildEnv);
        taskProgress('build-stage-json', index + 1, commands.length);
      }
      await writeFile(stageBuildStamp, await stageSourceSnapshot());
    });
    if (willInject) await step('333opt', async () => { optChanged = await run333(options, true); });
    if (optChanged) await step('example-shards', () => runPnpm(['--filter', '@cuberoot/scramble-stats-build', 'build:example-shards'], coreDir, buildEnv));
    // OH/FMC/BLD recent rows join out.0.csv, so refresh after its optimal solves finish.
    await refreshRecentEvents();
    if (nNew > 0 || variantChanged || optChanged) await step('recent-333', () => runPnpm(['--filter', '@cuberoot/scramble-stats-build', 'build:recent-scrambles'], coreDir, buildEnv));
    if (options.jobs.includes('stages') || options.jobs.includes('puzzles')) await step('length-opt', () => runNode(join(jobDir, 'build_length_opt.mjs')));
    if (options.jobs.includes('stages')) {
      await step('bundle', () => runNode(join(jobDir, 'build_scramble_bundle.mjs')));
      await step('scramble-steps', () => runPnpm(['--filter', '@cuberoot/scramble-stats-build', 'build:scramble-steps'], coreDir, buildEnv));
    }
    summary.status = partial.length ? 'partial' : 'complete';
    if (partial.length) {
      summary.partial = partial;
      process.exitCode = 2;
      for (const reason of partial) console.warn(`[统计待完成] ${reason}`);
      console.warn('已保存本轮结果；退出码 2 表示仍有待解/待定状态，下次从保存结果继续。');
    }
    console.log(`\n统计${partial.length ? '产物已生成（仍有待完成项）' : '完成'}：${((Date.now() - runStart) / 60_000).toFixed(1)} 分钟；只写本地文件。`);
  } catch (error) {
    summary.status = `failed: ${String(error)}`;
    throw error;
  } finally {
    summary.finishedAt = new Date().toISOString();
    await persist();
    await recordSeconds(join(tableDir, 'stats-pipeline-times.csv'), options.jobs, runStart);
    console.log(`Run summary: ${summaryPath}`);
  }
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const readOnly = process.argv.includes('--plan') || process.argv.includes('--dry-run');
  void (readOnly ? main() : withStatsResourceMonitor(main)).catch(error => { console.error(error); process.exitCode = 1; });
}
