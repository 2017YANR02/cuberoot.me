/** One local TypeScript entry for stages, 3x3 optimal, and puzzle statistics. */
import { availableParallelism } from 'node:os';
import { appendFile, mkdir, readFile, readdir, stat, unlink, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import {
  analyzer, appendData, appendUniqueById, coreDir, exe, exists, fileSize, ids, jobDir, lineCount, lines,
  puzzleDir, recordSeconds, repoRoot, run, runNode, runPnpm, runTs, solverDir, stamp,
  tableDir, wcaDir,
} from './common.js';
import { runPuzzles } from './puzzles.js';

type Job = 'stages' | '333opt' | 'puzzles';
type Options = {
  jobs: Job[]; puzzles: string[]; variants: string[]; maxChunks: number;
  chunkSize?: number; dryRun: boolean; useCached: boolean; sourceCsv?: string;
  skipSolve333: boolean; plan: boolean; noPublish: true;
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
  if (addedStd || addedMaster || addedSplit) console.log(`[stages] 恢复/保存增量：std ${addedStd}，master ${addedMaster}，元数据 ${addedSplit}`);
  return Boolean(addedStd || addedMaster || addedSplit);
}

function csv(value: string): string[] { return value === 'none' ? [] : value.split(',').map(item => item.trim()).filter(Boolean); }
function parse(argv: string[]): Options {
  const options: Options = {
    jobs: ['stages', '333opt', 'puzzles'], puzzles: ['222', 'pyraminx', 'skewb', 'clock', 'sq1'],
    variants: Object.keys(variantBins), maxChunks: 0, dryRun: false, useCached: false,
    skipSolve333: false, plan: false, noPublish: true,
  };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--plan') options.plan = true;
    else if (arg === '--no-publish') options.noPublish = true;
    else if (arg === '--dry-run') options.dryRun = true;
    else if (arg === '--use-cached') options.useCached = true;
    else if (arg === '--skip-solve-333') options.skipSolve333 = true;
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
  const csvFile = join(wcaDir, 'stats', `${name}.csv`);
  const have = await ids(csvFile, true);
  const missing: string[] = [];
  for await (const row of lines(master)) {
    const comma = row.indexOf(',');
    if (comma > 0 && !have.has(row.slice(0, comma))) missing.push(row);
  }
  if (!missing.length) { console.log(`[${name}] 已最新 (${have.size} 条)`); return false; }
  const size = options.chunkSize ?? defaultChunks[name];
  console.log(`[${name}] 待补 ${missing.length} 条，chunk=${size}`);
  const input = join(incremental, `sync_${name}.txt`);
  const output = join(incremental, `sync_${name}_${name}.csv`);
  const log = join(incremental, `sync_${name}.analyzer.log`);
  let chunks = 0;
  for (let i = 0; i < missing.length; i += size) {
    const expected = Math.min(size, missing.length - i);
    await writeFile(input, `${missing.slice(i, i + size).join('\n')}\n`);
    if (await exists(output)) await unlink(output);
    await analyzer(exe(variantBins[name]), [input], log, stageEnv(), name);
    const got = Math.max(0, (await lineCount(output)) - 1);
    if (got !== expected) throw new Error(`[${name}] analyzer returned ${got}/${expected} rows`);
    await appendData(csvFile, output, await fileSize(csvFile) > 0);
    await unlink(output);
    chunks++;
    console.log(`[${name}] ${Math.min(i + size, missing.length)}/${missing.length}`);
    if (options.maxChunks && chunks >= options.maxChunks) break;
  }
  return true;
}

async function runStages(options: Options): Promise<{ nNew: number; stdChanged: boolean; variantChanged: boolean }> {
  const recovered = options.dryRun ? false : await syncStageTriplet(false);
  console.log('\n=== stages: 增量取数 ===');
  const incrArgs = ['--data-dir', wcaDir];
  if (options.sourceCsv) incrArgs.push('--source-csv', options.sourceCsv);
  if (options.useCached) incrArgs.push('--use-cached');
  if (options.dryRun) incrArgs.push('--dry-run');
  await runTs(join(jobDir, 'src', 'incremental.ts'), incrArgs);
  if (options.dryRun) {
    console.log('[dry-run] 只读检查完成');
    return { nNew: 0, stdChanged: false, variantChanged: false };
  }
  const input = pendingInput;
  const nNew = await lineCount(input);
  console.log(`新打乱 ${nNew} 条`);
  let stdChanged = recovered;
  let variantChanged = false;
  if (nNew > 0) {
    console.log('\n=== stages: std_analyzer ===');
    const output = pendingStd;
    if (await exists(output)) await unlink(output);
    await analyzer(exe('std_analyzer'), [input], join(incremental, 'std_analyzer.log'), { ...stageEnv(), CUBE_RUN_FULL_STD: '1' }, 'std');
    const got = Math.max(0, (await lineCount(output)) - 1);
    if (got !== nNew) throw new Error(`std returned ${got}/${nNew} rows`);
    console.log('\n=== stages: 幂等同步 CSV ===');
    stdChanged = await syncStageTriplet(true) || stdChanged;
  }
  if (options.variants.length) {
    console.log(`\n=== stages: 补缺 ${options.variants.join(', ')} ===`);
    if (!await exists(master)) throw new Error(`Missing stage corpus: ${master}`);
    for (const name of options.variants) if (await syncVariant(name, options)) variantChanged = true;
  }
  return { nNew, stdChanged, variantChanged };
}

async function run333(options: Options, inject: boolean): Promise<boolean> {
  if (options.jobs.includes('333opt') && !options.skipSolve333) {
    console.log('\n=== 333opt: H48 h10 续解 ===');
    await runTs(join(solverDir, '333opt', 'solve_h10.mts'), [], coreDir, { ...process.env, CUBE_TABLE_DIR: tableDir, RAYON_NUM_THREADS: String(availableParallelism()) });
  }
  if (!inject) return false;
  const outputs = (await readdir(join(solverDir, '333opt'))).filter(name => /^out\..*\.csv$/.test(name));
  if (!outputs.length) { console.log('[333opt] 尚无 out.*.csv，跳过注入'); return false; }
  console.log('\n=== 333opt: 注入分布、首次出现与最优打乱 ===');
  for (const script of ['inject.mjs', 'inject_first_appearance.mjs', 'export_optimal.mjs']) {
    await runNode(join(solverDir, '333opt', script), [], repoRoot);
  }
  return true;
}

type Summary = { startedAt: string; finishedAt?: string; status: string; active?: string; partial?: string[]; steps: Array<{ name: string; seconds: number }> };
async function main(): Promise<void> {
  const options = parse(process.argv.slice(2));
  if (options.plan) {
    console.log(JSON.stringify({ ...options, analyzers: requiredAnalyzers(options), repoRoot, coreDir, jobDir, wcaDir, puzzleDir, tableDir, publish: false }, null, 2));
    return;
  }
  if (options.dryRun) {
    if (options.jobs.includes('stages')) await runStages(options);
    else console.log('[dry-run] 无 stages 取数步骤；使用 --plan 查看作业计划');
    return;
  }
  const runStart = Date.now();
  if (options.jobs.includes('333opt') && !options.skipSolve333) {
    const h10 = resolve(process.env.H48_H10_TABLE || join(tableDir, 'h48-nissy-core', 'h48h10.dat'));
    if (await fileSize(h10) !== 30_336_314_216) throw new Error(`H48 h10 table missing/incomplete: ${h10}`);
  }
  if (options.jobs.includes('puzzles') && options.puzzles.includes('sq1')) {
    const sq1 = join(tableDir, 'sq1_wca_jsqfull.bin');
    if (await fileSize(sq1) !== 13_005_619_200) throw new Error(`SQ1 table missing/incomplete: ${sq1}`);
  }
  await mkdir(tableDir, { recursive: true });
  const summaryPath = join(tableDir, `stats-local-${new Date().toISOString().replaceAll(':', '-')}.json`);
  const summary: Summary = { startedAt: new Date().toISOString(), status: 'running', steps: [] };
  const persist = () => writeFile(summaryPath, `${JSON.stringify(summary, null, 2)}\n`);
  const step = async (name: string, action: () => Promise<void>) => {
    const started = Date.now();
    summary.active = name;
    await persist();
    try { await action(); }
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
      partial.push(...await runPuzzles(options.puzzles));
      await runPnpm(['--filter', '@cuberoot/scramble-stats-build', 'build:puzzle-examples']);
      await runTs(join(jobDir, 'src', 'build_puzzle_first_appearance.ts'));
      await runNode(join(jobDir, 'export_puzzle_optimal.mjs'));
      puzzleChanged = true;
    });
    if (options.jobs.includes('stages')) stageBuildPending = stdChanged || variantChanged || await stageBuildIsStale();
    const buildEnv = { ...process.env, SCRAMBLE_STATS_STAMP: await stamp(), CUBE_TABLE_DIR: tableDir };
    if (options.jobs.includes('stages') || options.jobs.includes('puzzles')) await step('recent-events', () => runPnpm(['--filter', '@cuberoot/scramble-stats-build', 'build:recent-scrambles-events'], coreDir, buildEnv));
    const willInject = options.jobs.includes('333opt') || (options.jobs.includes('stages') && (stdChanged || variantChanged));
    if (!stageBuildPending && !willInject && !puzzleChanged) {
      console.log('没有数据变化，结束。');
      summary.status = 'complete';
      return;
    }
    if (stageBuildPending) await step('build-stage-json', async () => {
      for (const command of ['build', 'build:first-appearance', 'build:wca-cross', 'build:comp-steps']) {
        await runPnpm(['--filter', '@cuberoot/scramble-stats-build', command], coreDir, buildEnv);
      }
      await writeFile(stageBuildStamp, await stageSourceSnapshot());
    });
    if (willInject) await step('333opt', async () => { optChanged = await run333(options, true); });
    if (nNew > 0 || variantChanged || optChanged) await step('recent-333', () => runPnpm(['--filter', '@cuberoot/scramble-stats-build', 'build:recent-scrambles'], coreDir, buildEnv));
    if (options.jobs.includes('stages') || options.jobs.includes('puzzles')) await step('length-opt', () => runNode(join(jobDir, 'build_length_opt.mjs')));
    if (options.jobs.includes('stages')) {
      await step('bundle', () => runNode(join(jobDir, 'build_scramble_bundle.mjs')));
      await step('scramble-steps', () => runPnpm(['--filter', '@cuberoot/scramble-stats-build', 'build:scramble-steps'], coreDir, buildEnv));
    }
    summary.status = partial.length ? 'partial' : 'complete';
    if (partial.length) { summary.partial = partial; process.exitCode = 2; }
    console.log(`\n统计完成：${((Date.now() - runStart) / 60_000).toFixed(1)} 分钟；只写本地文件。`);
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
void main().catch(error => { console.error(error); process.exitCode = 1; });
