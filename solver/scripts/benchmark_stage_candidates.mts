/** Fixed 100-case, single-pass stage comparison. --plan never loads tables. */
import assert from 'node:assert/strict';
import { closeSync, existsSync, openSync, readFileSync, readSync, readdirSync, renameSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { availableParallelism, totalmem } from 'node:os';
import { openAnalyzerSession } from '../../scripts/stats/common.ts';
import { registerStatsSummary, tableBudget, withStatsResourceMonitor } from '../../scripts/stats/resource-monitor.ts';
import { observeStatsResources, validateStatsRun } from '../experiments/cube48opt-rust/stats-resume-review.mts';
import { stageRelative, stageFollowupRelative, stageRoot as root, readStageApproval } from './stage_candidate_policy.mts';

const args = process.argv.slice(2), followup = args[0] === '--run-pseudo-pair-conjugate';
const directory = resolve(root, followup ? stageFollowupRelative : stageRelative);
assert(args.length <= 1 && (!args.length || ['--plan', '--run', '--help', '--run-pseudo-pair-conjugate'].includes(args[0])), 'Use a documented fixed mode only');
if (args[0] !== '--run' && !followup) {
  console.log(args[0] === '--help' ? 'benchmark_stage_candidates.mts [--plan|--run]; one reviewed comparison only' : readFileSync(resolve(directory, 'plan.json'), 'utf8'));
  process.exit(0);
}
assert.equal(process.platform, 'darwin');
assert(!process.env.CUBEROOT_STATS_RESOURCE_RUN, 'Cannot nest benchmark runs');
const { approval, plan } = readStageApproval(root, followup);
const stageKeys = Object.keys(plan.stages);
assert(totalmem() >= 128 * 2 ** 30 && availableParallelism() >= plan.threads);
const env: NodeJS.ProcessEnv = { ...process.env };
for (const key of Object.keys(env)) if (/^(CUBE_|ANALYZER_|RAYON_)/.test(key)) delete env[key];
Object.assign(env, { CUBE_TABLE_DIR: resolve(root, 'solver/tables'), CUBE_TABLE_PROFILE: 'high-memory', CUBE_ALLOW_HUGE_TABLES: '1', CUBE_RUN_FULL_STD: '1', RAYON_NUM_THREADS: '18' });
const frozen = JSON.parse(readFileSync(resolve(directory, 'resource-plan.json'), 'utf8'));
const stateDir = resolve(root, 'solver/tables/stats-resources');
function preflight(key: string) {
  const now = observeStatsResources();
  validateStatsRun(plan.baselineToPreserve, now);
  assert(!now.computeRunning && !now.lockExists, 'Existing computation or retained research lock');
  assert(now.available >= plan.stages[key].startupRequiredBytes, 'Insufficient stage startup memory');
  const budget = tableBudget(`${key}_analyzer`, env);
  assert.equal(budget.rssLimit, plan.stages[key].rssLimitBytes);
  assert.deepEqual(budget.files, frozen[key].files.map(({ headerHex: _, ...meta }: { headerHex: string }) => meta), 'Stage tables changed');
  for (const file of frozen[key].files) {
    const header = Buffer.alloc(16), fd = openSync(file.path, 'r');
    try { assert.equal(readSync(fd, header, 0, 16, 0), 16); } finally { closeSync(fd); }
    assert.equal(header.toString('hex'), file.headerHex, `Changed table header: ${file.path}`);
  }
  return now;
}
const before = preflight(stageKeys[0]);
assert(!existsSync(resolve(stateDir, 'protected-stop.json')) && !existsSync(resolve(stateDir, 'active.lock')), 'Review existing resource stop/lock; never reset it');
for (const key of stageKeys) for (const name of Object.keys(plan.stages[key].versions))
  assert.deepEqual(readdirSync(resolve(directory, key, name)).sort(), ['input.txt', `${key}_analyzer`].sort(), 'Prior execution evidence exists');
const inputIds = readFileSync(resolve(directory, 'input.txt'), 'utf8').trimEnd().split(/\r?\n/).map(row => row.slice(0, row.indexOf(',')));
assert.equal(new Set(inputIds).size, 100);
function readCsv(file: string, columns: number) {
  const [header, ...rows] = readFileSync(file, 'utf8').trimEnd().split(/\r?\n/);
  assert.equal(header.split(',').length, columns + 1); assert.equal(rows.length, 100);
  const data = rows.map(row => row.split(','));
  assert.deepEqual(data.map(row => row[0]), inputIds);
  for (const row of data) { assert.equal(row.length, columns + 1); assert(row.slice(1).every(v => /^\d+$/.test(v) && Number(v) < 99), 'Invalid stage distance'); }
  return { header, data };
}
writeFileSync(resolve(directory, 'used.json'), JSON.stringify({ ...approval, consumedAt: new Date().toISOString(), before }, null, 2) + '\n', { flag: 'wx', mode: 0o600 });
const execution: { status: string; resourceRun?: string; versions: any[]; comparisons: any[]; [key: string]: unknown } = { status: 'starting', before, versions: [], comparisons: [] };
const summary = resolve(directory, 'execution.json');
function save() { writeFileSync(summary + '.new', JSON.stringify(execution, null, 2) + '\n'); renameSync(summary + '.new', summary); }
save();
try {
  await withStatsResourceMonitor(async () => {
    execution.resourceRun = process.env.CUBEROOT_STATS_RESOURCE_RUN; assert(execution.resourceRun);
    registerStatsSummary(summary);
    const owner = JSON.parse(readFileSync(resolve(execution.resourceRun, 'owner.json'), 'utf8'));
    assert.equal(owner.baseline.boot, '1794194703'); assert.equal(owner.baseline.swapouts, 336);
    const timeout = setTimeout(() => writeFileSync(resolve(execution.resourceRun!, 'request-stop.json'), JSON.stringify({ reason: 'Stage comparison exceeded its 10-minute bound' })), 600_000);
    try {
      for (const key of stageKeys) {
        const stage = plan.stages[key];
        let expected = key === 'pseudo_f2leo' ? undefined : readCsv(resolve(directory, key, 'expected.csv'), stage.columns);
        const versions: any[] = followup ? [plan.reference.baseline] : [];
        for (const name of Object.keys(stage.versions)) {
          preflight(key);
          const work = resolve(directory, key, name), log = resolve(work, 'analyzer.log'), output = resolve(work, `input_${key}.csv`);
          execution.status = `running-${key}-${name}`; save();
          const started = performance.now();
          const session = await openAnalyzerSession(stage.versions[name].binary, log, { ...env, CUBEROOT_STATS_RESOURCE_RUN: execution.resourceRun }, `${key} ${name}`, [], work);
          const version: any = { key, name, pid: session.pid, checkpointId: session.checkpointId, startedAt: new Date().toISOString() };
          execution.versions.push(version); versions.push(version); save();
          try { await session.run(resolve(work, 'input.txt'), output); await session.close(); }
          catch (error) { await session.abort(); throw error; }
          const actual = readCsv(output, stage.columns);
          expected ??= actual;
          assert.deepEqual(actual, expected, `${key} ${name}: distance mismatch`);
          const logText = readFileSync(log, 'utf8');
          assert(!logText.includes('[RESUME]'), 'Resumed results cannot be benchmark evidence');
          const done = [...logText.matchAll(/\[DONE\] (\d+) tasks in ([\d.]+)s, nodes=(\d+), output=([^\r\n]+)/g)];
          assert.equal(done.length, 1); assert.equal(Number(done[0][1]), 100);
          Object.assign(version, { finishedAt: new Date().toISOString(), processSeconds: (performance.now() - started) / 1000, seconds: Number(done[0][2]), nodes: Number(done[0][3]), checkedDistances: 100 * stage.columns });
          save();
        }
        const [baseline, candidate] = versions;
        if (key === 'pseudo_pair') assert.equal(candidate.nodes, baseline.nodes, 'State caching must preserve the search tree');
        else assert(candidate.nodes <= baseline.nodes, 'Candidate unexpectedly expands more nodes');
        const comparison = { key, baselineSeconds: baseline.seconds, candidateSeconds: candidate.seconds, baselineNodes: baseline.nodes, candidateNodes: candidate.nodes, speedup: baseline.seconds / candidate.seconds, nodeReduction: 1 - candidate.nodes / baseline.nodes, checkedDistances: (followup ? 100 : 200) * stage.columns, reusedBaseline: followup };
        execution.comparisons.push(comparison); save(); console.log(JSON.stringify(comparison));
      }
      execution.status = 'verified'; save();
    } finally { clearTimeout(timeout); }
  }, stateDir);
  execution.status = 'complete'; execution.finishedAt = new Date().toISOString(); execution.after = observeStatsResources(); save();
} catch (error) { execution.status = 'failed'; execution.error = String(error); save(); throw error; }
