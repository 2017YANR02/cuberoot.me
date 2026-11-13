/** Frozen h10 comparisons; the original installation and prior runs are retained. */
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { closeSync, existsSync, mkdirSync, openSync, readFileSync, renameSync, unlinkSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { prepareStatsTask, registerStatsSummary, withStatsResourceMonitor } from '../../../../scripts/stats/resource-monitor.ts';
import { observeStatsResources, validateStatsRun } from '../../cube48opt-rust/stats-resume-review.mts';
import { directory as initialDirectory, followupDirectory, splitDirectory, repeatDirectory, digest, read, readPlan, root, tableIdentity } from './policy.mts';
import { verifyResults } from './verify.mts';

const args = process.argv.slice(2);
assert(args.length === 1 && ['--plan', '--run', '--help', '--plan-ternary', '--run-ternary', '--plan-split-ternary', '--run-split-ternary', '--plan-lanes-repeatability', '--run-lanes-repeatability'].includes(args[0]), 'Use a documented fixed mode');
const followup = args[0].endsWith('-lanes-repeatability') ? 'repeat' : args[0].endsWith('-split-ternary') ? 'split' : args[0].endsWith('-ternary');
const directory = followup === 'repeat' ? repeatDirectory : followup === 'split' ? splitDirectory : followup ? followupDirectory : initialDirectory;
if (!args[0].startsWith('--run')) {
  console.log(args[0] === '--help' ? 'Frozen h10 comparisons: --plan / --run; append -ternary, -split-ternary or -lanes-repeatability for the corresponding fixed scope.' : readFileSync(resolve(directory, 'plan.json'), 'utf8'));
  process.exit(0);
}
assert.equal(process.platform, 'darwin'); assert.equal(process.arch, 'arm64');
assert(!process.env.CUBEROOT_STATS_RESOURCE_RUN, 'Do not nest this experiment');
const { plan, frozen } = readPlan(true, followup), cases = read(resolve(directory, 'cases.json'));
assert.equal(cases.length, 1000); assert.equal(new Set(cases.map((c: { id: string }) => c.id)).size, 1000);
assert.equal(readFileSync(resolve(directory, 'input.txt'), 'utf8'), cases.map((c: { scramble: string }) => c.scramble).join('\n') + '\n');
const observe = () => { const now = observeStatsResources(); return { ...now, boot: /sec\s*=\s*(\d+)/.exec(now.boot)?.[1] ?? '' }; };
const stateDir = resolve(root, 'solver/tables/stats-resources');
const lockPath = resolve(root, '.local-data/cubeopt-reverse/compute.lock');
const before = observe(); validateStatsRun(plan.baseline, before);
assert(!before.computeRunning && !before.lockExists && before.available >= plan.startupRequiredBytes);
assert(!existsSync(resolve(stateDir, 'active.lock')) && !existsSync(resolve(stateDir, 'protected-stop.json')), 'Keep and review prior protection records');
writeFileSync(resolve(directory, 'used.json'), JSON.stringify({ at: new Date().toISOString(), before, ...frozen }) + '\n', { flag: 'wx' });
const summary = resolve(directory, 'execution.json');
const execution: any = { status: 'starting', before, variants: [], planSha256: frozen.planSha256 };
const save = () => { writeFileSync(summary + '.new', JSON.stringify(execution, null, 2) + '\n'); renameSync(summary + '.new', summary); };
save();
try {
  await withStatsResourceMonitor(async () => {
    const run = process.env.CUBEROOT_STATS_RESOURCE_RUN!; assert(run);
    execution.resourceRun = run; registerStatsSummary(summary);
    assert.deepEqual({ boot: read(resolve(run, 'owner.json')).baseline.boot, swapouts: read(resolve(run, 'owner.json')).baseline.swapouts }, plan.baseline);
    const token = `${process.pid}:${frozen.planSha256}`;
    writeFileSync(lockPath, JSON.stringify({ pid: process.pid, token, scope: directory }), { flag: 'wx' });
    const timeout = setTimeout(() => writeFileSync(resolve(run, 'request-stop.json'), JSON.stringify({ reason: 'H10 comparison exceeded ten minutes' })), plan.deadlineMs);
    let completed = false;
    try {
      for (const variant of plan.variants) {
        const now = observe(); validateStatsRun(plan.baseline, now);
        assert(!now.computeRunning && now.available >= plan.startupRequiredBytes, 'Another computation or insufficient memory');
        assert.equal(digest(variant.binary), variant.sha256);
        assert.deepEqual(tableIdentity(plan.table.path), plan.table);
        const work = resolve(directory, variant.label); mkdirSync(work);
        const argv = ['--table', plan.table.path, '-t', '16', '-c', '1', '-l', String(variant.lanes), '--json', '--load', 'copy'];
        const { trailerSha256: _, ...file } = plan.table;
        const register = prepareStatsTask({ binary: variant.binary, profile: 'egg-h10-isolated', tableBytes: file.bytes,
          mapped: false, rssLimit: plan.rssLimit, files: [file] });
        const fds = [openSync(resolve(directory, 'input.txt'), 'r'), openSync(resolve(work, 'results.jsonl'), 'wx'), openSync(resolve(work, 'stderr.log'), 'wx')];
        const env = { ...process.env };
        for (const key of Object.keys(env)) if (/^(EGG_|RUST_LOG|RAYON_|CUBE_|H10_ENGINE)/.test(key)) delete env[key];
        const started = performance.now();
        const child = spawn(variant.binary, argv, { cwd: directory, env, stdio: fds });
        const exited = new Promise<{ code: number | null; signal: string | null }>((done, fail) => {
          child.once('error', fail); child.once('close', (code, signal) => done({ code, signal }));
        });
        let unregister = () => {};
        try {
          assert(child.pid); unregister = register(child.pid);
          const record: any = { label: variant.label, pid: child.pid, binary: variant.binary, sha256: variant.sha256, argv, startedAt: new Date().toISOString() };
          execution.status = `running-${variant.label}`; execution.variants.push(record); save();
          const result = await exited;
          Object.assign(record, result, { processSeconds: (performance.now() - started) / 1000 }); save();
          assert.equal(result.code, 0); assert.equal(result.signal, null);
          Object.assign(record, await verifyResults(resolve(work, 'results.jsonl'), cases, variant.lanes));
          record.resultsSha256 = digest(resolve(work, 'results.jsonl')); save();
          console.log(JSON.stringify({ label: record.label, seconds: record.searchSeconds, p95: record.p95Seconds, verified: record.verifiedSolutions }));
        } finally {
          if (child.exitCode === null && child.signalCode === null) {
            child.kill('SIGKILL'); await exited.catch(() => {});
          }
          unregister(); for (const fd of fds) closeSync(fd);
        }
      }
      completed = true;
    } finally {
      clearTimeout(timeout);
      // A failed/protected run keeps its lock as evidence; no automatic retry.
      if (completed && read(lockPath).token === token) unlinkSync(lockPath);
    }
  }, stateDir);
  execution.status = 'complete'; execution.after = observe(); validateStatsRun(plan.baseline, execution.after); save();
} catch (error) { execution.status = 'failed'; execution.error = String(error); save(); throw error; }
