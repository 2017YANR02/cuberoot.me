/** Reviewed generation and resident fixed-input acceptance; no retries or publication. */
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { closeSync, createWriteStream, existsSync, openSync, readFileSync, renameSync, statSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { availableParallelism, totalmem } from 'node:os';
import { openAnalyzerSession } from '../../scripts/stats/common.ts';
import { prepareStatsTask, registerStatsSummary, tableBudget, validateResumeReview, withStatsResourceMonitor, type TableBudget } from '../../scripts/stats/resource-monitor.ts';
import { observeStatsResources, validateStatsRun } from '../experiments/cube48opt-rust/stats-resume-review.mts';
import { root, relative, readJob, digest, resolvedModes } from './stage_table_policy.mts';

const [mode, id, ...extra] = process.argv.slice(2);
assert(!extra.length && ['--plan', '--run'].includes(mode) && id, 'Use --plan JOB or --run JOB');
const { directory, plan, approval } = readJob(id);
if (mode === '--plan') { console.log(JSON.stringify(plan, null, 2)); process.exit(0); }
assert.equal(process.platform, 'darwin'); assert(totalmem() >= 128 * 2 ** 30);
assert(availableParallelism() >= plan.threads && !process.env.CUBEROOT_STATS_RESOURCE_RUN);
const env: NodeJS.ProcessEnv = { ...process.env };
for (const key of Object.keys(env)) if (/^(CUBE_|ANALYZER_|RAYON_)/.test(key)) delete env[key];
Object.assign(env, resolvedModes(plan.env, plan.analyzer), { CUBE_TABLE_DIR: resolve(root, 'solver/tables'), CUBE_TABLE_PROFILE: 'high-memory',
  CUBE_ALLOW_HUGE_TABLES: '1', CUBE_RUN_FULL_STD: '1', RAYON_NUM_THREADS: String(plan.threads) });
const stateDir = resolve(root, 'solver/tables/stats-resources');
const before = observeStatsResources(); validateStatsRun(plan.baseline, before);
assert(!before.computeRunning && !before.lockExists, 'Another computation or retained lock');
const stopPath = resolve(stateDir, 'protected-stop.json');
if (existsSync(stopPath)) {
  const stop = JSON.parse(readFileSync(stopPath, 'utf8'));
  const review = JSON.parse(readFileSync(resolve(stateDir, 'resume-review.json'), 'utf8'));
  validateResumeReview(review, { path: stopPath, sha256: digest(stopPath), baseline: stop.baseline }, { ...before, boot: '1794194703' });
  // The shared monitor verifies the old owner's death before releasing its lock,
  // retains the original baseline, and archives the stop only after completion.
} else assert(!existsSync(resolve(stateDir, 'active.lock')), 'Existing computation lock');
assert(before.available >= plan.startupRequiredBytes, `Insufficient startup memory: available=${before.available}, required=${plan.startupRequiredBytes}`);
const budget: TableBudget = plan.kind === 'generate'
  ? { binary: plan.binary, profile: 'new-stage-table', tableBytes: plan.mappedBytes ?? 0, mapped: (plan.mappedBytes ?? 0) > 0, rssLimit: plan.rssLimitBytes, files: [] }
  : tableBudget(plan.binary, env);
assert.equal(budget.rssLimit, plan.rssLimitBytes, 'Reviewed process budget changed');
if (plan.kind === 'benchmark') assert.deepEqual(budget.files, plan.files, 'Input table metadata changed');
const output = plan.kind === 'generate' ? resolve(env.CUBE_TABLE_DIR!, plan.table + '.bin') : undefined;
if (output) assert(!existsSync(output), 'Existing table must be preserved; do not regenerate');
const fd = openSync(resolve(directory, 'used.json'), 'wx', 0o600);
try { writeFileSync(fd, JSON.stringify({ ...approval, consumedAt: new Date().toISOString(), before }, null, 2) + '\n'); } finally { closeSync(fd); }
const execution: any = { schema: 'cuberoot.stage-table-result/v1', status: 'starting', before, plan, rounds: [] };
const summary = resolve(directory, 'execution.json');
function save() { writeFileSync(summary + '.new', JSON.stringify(execution, null, 2) + '\n'); renameSync(summary + '.new', summary); }
save();
function csv(path: string, count: number) {
  const lines = readFileSync(path, 'utf8').trimEnd().split(/\r?\n/), header = lines.shift()!.split(',');
  assert.equal(lines.length, count);
  const rows = lines.map(line => line.split(','));
  assert.equal(new Set(rows.map(row => row[0])).size, count);
  for (const row of rows) { assert.equal(row.length, header.length); assert(row.slice(1).every(v => /^\d+$/.test(v) && Number(v) < 99)); }
  return { header, rows };
}
try {
  await withStatsResourceMonitor(async () => {
    const run = process.env.CUBEROOT_STATS_RESOURCE_RUN!;
    execution.resourceRun = run; registerStatsSummary(summary);
    const owner = JSON.parse(readFileSync(resolve(run, 'owner.json'), 'utf8'));
    assert.equal(owner.baseline.boot, '1794194703'); assert.equal(owner.baseline.swapouts, 336);
    const timeout = setTimeout(() => writeFileSync(resolve(run, 'request-stop.json'), JSON.stringify({ reason: `Stage table job exceeded ${plan.timeoutSeconds}s` })), plan.timeoutSeconds * 1000);
    execution.status = 'running'; save();
    try {
      if (plan.kind === 'generate') {
        const attach = prepareStatsTask(budget), log = createWriteStream(resolve(directory, 'generator.log'), { flags: 'wx' });
        const child = spawn(plan.binary, ['--only', 'rust', '--table', plan.table], { cwd: resolve(root, 'solver'), env, stdio: ['ignore', 'pipe', 'pipe'] });
        const finished = new Promise<void>((done, fail) => { child.once('error', fail); child.once('close', (code, signal) => code === 0 ? done() : fail(Error(`Generator exited ${code ?? signal}`))); });
        void finished.catch(() => {});
        let release = () => {};
        try { assert(child.pid); release = attach(child.pid); }
        catch (error) { child.kill('SIGKILL'); await finished.catch(() => {}); log.end(); throw error; }
        const capture = (data: Buffer) => { log.write(data); process.stdout.write(data); };
        child.stdout.on('data', capture); child.stderr.on('data', capture);
        log.on('error', () => child.kill('SIGKILL'));
        execution.pid = child.pid; save();
        try { await finished; } finally { release(); await new Promise<void>(done => log.end(done)); }
        assert.equal(statSync(output!).size, plan.outputBytes, 'Generated table size mismatch');
        execution.output = { path: output, bytes: statSync(output!).size };
      } else {
        const log = resolve(directory, 'analyzer.log');
        const sessionStarted = performance.now();
        const session = await openAnalyzerSession(plan.binary, log, { ...env, CUBEROOT_STATS_RESOURCE_RUN: run }, id, [], directory);
        execution.pid = session.pid; execution.checkpointId = session.checkpointId; save();
        try {
          for (const name of ['warmup', 'sample1', 'sample2', 'sample3']) {
            const outputCsv = resolve(directory, `${name}_${plan.analyzer}.csv`);
            assert(!existsSync(outputCsv));
            const roundStarted = name === 'warmup' ? sessionStarted : performance.now();
            await session.run(resolve(directory, name + '.txt'), outputCsv);
            const wallSeconds = (performance.now() - roundStarted) / 1000;
            const actual = csv(outputCsv, name === 'warmup' ? 100 : 1000);
            const inputIds = readFileSync(resolve(directory, name + '.txt'), 'utf8').trimEnd().split(/\r?\n/).map(row => row.slice(0, row.indexOf(',')));
            assert.deepEqual(actual.rows.map(row => row[0]), inputIds);
            if (name === 'warmup' && plan.goldenFile) assert.deepEqual(actual, csv(resolve(root, plan.goldenFile), 100), 'Mismatch against existing golden fixture');
            if (plan.referenceDirectory) assert.deepEqual(actual, csv(resolve(plan.referenceDirectory, `${name}_${plan.analyzer}.csv`), actual.rows.length), 'Distance mismatch against frozen baseline');
            if (name !== 'warmup' && name !== 'sample1') assert.deepEqual(actual, csv(resolve(directory, `sample1_${plan.analyzer}.csv`), 1000));
            // The first wall interval includes launch/loading and warmup. Keep
            // it separate from the native warm-sample timings used for ranking.
            execution.rounds.push({ name, rows: actual.rows.length, columns: actual.header.length - 1, wallSeconds }); save();
          }
          await session.close();
        } catch (error) { await session.abort(); throw error; }
        const text = readFileSync(log, 'utf8'); assert(!text.includes('[RESUME]'));
        const done = [...text.matchAll(/\[DONE\] (\d+) tasks in ([\d.]+)s, nodes=(\d+), output=([^\r\n]+)/g)];
        assert.equal(done.length, 4);
        execution.measurements = done.map((m, i) => ({ name: execution.rounds[i].name, cases: Number(m[1]), seconds: Number(m[2]), nodes: Number(m[3]) }));
        execution.medianSeconds = execution.measurements.slice(1).map((m: any) => m.seconds).sort((a: number, b: number) => a - b)[1];
      }
      execution.status = 'verified'; save();
    } finally { clearTimeout(timeout); }
  }, stateDir);
  execution.status = 'complete'; execution.after = observeStatsResources(); execution.finishedAt = new Date().toISOString(); save();
  console.log(JSON.stringify({ status: execution.status, output: execution.output, medianSeconds: execution.medianSeconds }));
} catch (error) { execution.status = 'failed'; execution.error = String(error); save(); throw error; }
