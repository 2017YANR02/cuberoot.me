/** Fixed, user-approved EO comparison. Default/--plan is read-only. */
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { closeSync, existsSync, openSync, readFileSync, readSync, readdirSync, renameSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { availableParallelism, totalmem } from 'node:os';
import { openAnalyzerSession } from '../../scripts/stats/common.ts';
import { registerStatsSummary, tableBudget, withStatsResourceMonitor } from '../../scripts/stats/resource-monitor.ts';
import { observeStatsResources, validateStatsRun } from '../experiments/cube48opt-rust/stats-resume-review.mts';
import { eoExperimentRelative, eoExperimentRoot as root, readEoExperimentApproval } from './eo_stage_experiment_policy.mts';

const args = process.argv.slice(2);
assert(args.length <= 1 && (!args.length || ['--plan', '--run', '--help'].includes(args[0])), 'Use --plan or --run only');
const directory = resolve(root, eoExperimentRelative);
if (args[0] !== '--run') {
  console.log(args[0] === '--help' ? 'benchmark_eo_stages.mts [--plan|--run]; one approved comparison only' : readFileSync(resolve(directory, 'plan.json'), 'utf8'));
  process.exit(0);
}
assert.equal(process.platform, 'darwin', 'This scope is only for the reviewed MacBook Pro');
assert(!process.env.CUBEROOT_STATS_RESOURCE_RUN, 'Start a new monitored comparison, not a nested statistics job');
const { approval, plan } = readEoExperimentApproval();
assert(totalmem() >= 128 * 2 ** 30 && availableParallelism() >= plan.threads);
const env: NodeJS.ProcessEnv = { ...process.env };
for (const key of Object.keys(env)) if (key.startsWith('CUBE_') || key.startsWith('ANALYZER_') || key.startsWith('RAYON_')) delete env[key];
Object.assign(env, { CUBE_TABLE_DIR: resolve(root, 'solver/tables'), CUBE_TABLE_PROFILE: 'high-memory', CUBE_ALLOW_HUGE_TABLES: '1', RAYON_NUM_THREADS: '18' });
const frozen = JSON.parse(readFileSync(resolve(directory, 'resource-plan.json'), 'utf8'));
const expected = readFileSync(resolve(directory, 'expected.csv'), 'utf8').replaceAll('\r', '');
function preflight() {
  const now = observeStatsResources();
  validateStatsRun(plan.baselineToPreserve, now);
  assert(!now.computeRunning && !now.lockExists, 'Another compute task or retained lock exists');
  assert(now.available >= plan.resourceBudget.startupRequiredBytes, 'Insufficient EO startup memory');
  const budget = tableBudget('eo_cross_analyzer', env);
  assert.equal(budget.rssLimit, plan.resourceBudget.rssLimitBytes);
  assert.deepEqual(budget.files, frozen.budget.files.map(({ headerHex: _, ...meta }: { headerHex: string }) => meta), 'Existing EO tables changed');
  for (const file of frozen.budget.files) {
    const header = Buffer.alloc(16), fd = openSync(file.path, 'r');
    try { assert.equal(readSync(fd, header, 0, 16, 0), 16); } finally { closeSync(fd); }
    assert.equal(header.toString('hex'), file.headerHex, `Changed table header: ${file.path}`);
  }
  return now;
}
const before = preflight();
const stateDir = resolve(root, 'solver/tables/stats-resources');
assert(!existsSync(resolve(stateDir, 'protected-stop.json')) && !existsSync(resolve(stateDir, 'active.lock')), 'Existing resource stop/lock must be reviewed, not reset');
for (const name of ['baseline', 'candidate']) assert.deepEqual(readdirSync(resolve(directory, name)).sort(), ['eo_cross_analyzer', 'input.txt'], `${name}: prior execution evidence exists`);
writeFileSync(resolve(directory, 'used.json'), JSON.stringify({ ...approval, consumedAt: new Date().toISOString(), before }, null, 2) + '\n', { flag: 'wx', mode: 0o600 });
const execution: { status: string; resourceRun?: string; versions: object[]; error?: string; [key: string]: unknown } = { status: 'starting', before, versions: [] };
const summary = resolve(directory, 'execution.json');
function save() { writeFileSync(summary + '.new', JSON.stringify(execution, null, 2) + '\n'); renameSync(summary + '.new', summary); }
save();
try {
  await withStatsResourceMonitor(async () => {
    execution.resourceRun = process.env.CUBEROOT_STATS_RESOURCE_RUN;
    assert(execution.resourceRun, 'Resource monitor did not attach');
    registerStatsSummary(summary);
    const owner = JSON.parse(readFileSync(resolve(execution.resourceRun, 'owner.json'), 'utf8'));
    assert.equal(owner.baseline.boot, '1794194703'); assert.equal(owner.baseline.swapouts, 336);
    const timeout = setTimeout(() => writeFileSync(resolve(execution.resourceRun!, 'request-stop.json'), JSON.stringify({ reason: 'EO comparison exceeded its 10-minute bound' })), 600_000);
    try {
      for (const name of ['baseline', 'candidate']) {
        preflight();
        const work = resolve(directory, name), startedAt = new Date().toISOString(), started = performance.now();
        execution.status = `running-${name}`; save();
        // Copy the live monitor token after it is established; all other solver
        // settings remain the reviewed explicit environment above.
        const session = await openAnalyzerSession(plan.versions[name].binary, resolve(work, 'analyzer.log'), { ...env, CUBEROOT_STATS_RESOURCE_RUN: execution.resourceRun }, `EO ${name}`, [], work);
        const version = { name, pid: session.pid, checkpointId: session.checkpointId, startedAt };
        execution.versions.push(version); save();
        try { await session.run(resolve(work, 'input.txt'), resolve(work, 'input_eo.csv')); await session.close(); }
        catch (error) { await session.abort(); throw error; }
        assert.equal(readFileSync(resolve(work, 'input_eo.csv'), 'utf8').replaceAll('\r', ''), expected, `${name}: golden mismatch`);
        Object.assign(version, { finishedAt: new Date().toISOString(), processSeconds: (performance.now() - started) / 1000 }); save();
      }
      const comparison = execFileSync(process.execPath, ['--experimental-strip-types', resolve(root, 'solver/scripts/compare_eo_stages.mts'), directory], { encoding: 'utf8' });
      writeFileSync(resolve(directory, 'comparison.json'), comparison, { flag: 'wx' });
      execution.status = 'verified'; save();
    } finally { clearTimeout(timeout); }
  }, stateDir);
  execution.status = 'complete'; execution.finishedAt = new Date().toISOString(); execution.after = observeStatsResources(); save();
  console.log(readFileSync(resolve(directory, 'comparison.json'), 'utf8'));
} catch (error) { execution.status = 'failed'; execution.error = String(error); save(); throw error; }
