import assert from 'node:assert/strict';
import { test } from 'node:test';
import { spawn, execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { once } from 'node:events';
import { parseProcesses } from '../../core/scripts/mac-system-recorder.mts';
import { GiB, analyzerTableNames, isTsxService, parseIdentities, resourceLimits, resourceValues, runWhileMonitored, sameIdentity, tableBudget, trackedTree, validateResumeReview, type Identity, type ProcessRow, type TableBudget } from './resource-monitor.js';

const identity = (pid: number, command = `process-${pid}`, start = 'Wed Oct 21 12:00:00 2026'): Identity => ({ pid, start, command });
const row = (pid: number, ppid: number, rssBytes = 0): ProcessRow => ({ pid, ppid, rssBytes, cpuPercent: 0, state: 'S', name: `process-${pid}` });
const observation = { sampledAt: '', boot: '123', swapouts: 0, pressure: 1, available: 50 * GiB, computeRunning: false, lockExists: false };
const budget: TableBudget = { binary: 'fixture', profile: 'high-memory', tableBytes: 40 * GiB, mapped: true, rssLimit: 44 * GiB, files: [] };

test('resource boundaries preserve boot and Swapouts and deduct only active mapped RSS', () => {
  const rows = [row(1, 0, GiB), row(2, 1, 40 * GiB)], budgets = new Map([[2, budget]]);
  assert.equal(resourceLimits(observation, observation, rows, budgets).headroom, 9.5 * GiB);
  assert.equal(resourceValues(observation, [row(1, 0), row(2, 1, GiB)], budgets).mappedEstimate, GiB);
  assert.equal(resourceValues(observation, rows, new Map([[2, { ...budget, mapped: false }]])).headroom, 49.5 * GiB);
  for (const change of [{ boot: '456' }, { swapouts: 1 }, { pressure: 2 }])
    assert.throws(() => resourceLimits(observation, { ...observation, ...change }, rows, budgets));
  assert.equal(resourceLimits(observation, { ...observation, available: 42.5 * GiB }, rows, budgets).headroom, 2 * GiB);
  assert.throws(() => resourceLimits(observation, { ...observation, available: 42.5 * GiB - 1 }, rows, budgets), /headroom/);
  assert.throws(() => resourceLimits(observation, observation, [row(2, 1, 44 * GiB + 1)], budgets), /RSS/);
  assert.throws(() => resourceLimits(observation, observation, [row(2, 1), row(3, 1)], new Map([[2, budget], [3, budget]])), /Concurrent/);
});

test('table plan follows EO profile and optional table flags; unknown binaries fail closed', () => {
  const normal = analyzerTableNames('eo_cross_analyzer', {}, 55 * GiB);
  const high = analyzerTableNames('eo_cross_analyzer', {}, 56 * GiB);
  assert.equal(normal.names.length, 18);
  assert.equal(high.names.length, 23);
  assert.equal(analyzerTableNames('eo_cross_analyzer', { CUBE_TABLE_PROFILE: 'default', CUBE_EO_NO_DIAG: '1' }, 64 * GiB).names.length, 17);
  assert.throws(() => analyzerTableNames('unknown_analyzer', {}, 64 * GiB), /No reviewed/);
  const inspect = (() => ({ isFile: () => true, size: 100, mtimeMs: 0, ino: 1, dev: 1 })) as Parameters<typeof tableBudget>[3];
  assert.equal(tableBudget('eo_cross_analyzer', {}, 64 * GiB, inspect).rssLimit, 2300 + 4 * GiB);
  assert.equal(tableBudget('sq1_analyzer', {}, 64 * GiB, inspect).workingBytes, 240_000_000 * 114);
  assert.equal(tableBudget('sq1_analyzer', {}, 64 * GiB, inspect).mapped, false);
  assert.equal(tableBudget('sq1_analyzer', { SQ1_SLASH_VIA_WCA: '1' }, 64 * GiB, inspect).tableBytes, 0);
  assert.equal(tableBudget('sq1_analyzer', { SQ1_TT_BUDGET: '10' }, 64 * GiB, inspect).workingBytes, 1140);
  assert.throws(() => tableBudget('sq1_analyzer', { SQ1_TT_BUDGET: '-1' }, 64 * GiB, inspect));
  assert.throws(() => tableBudget('sq1_analyzer', { SQ1_TT_BUDGET: '' }, 64 * GiB, inspect));
  assert.equal(tableBudget('sq1_slash_mitm', {}, 64 * GiB, inspect).workingBytes, 20_736_638_976);
});

test('unexpected monitor exit, including code zero, interrupts a pending action', async () => {
  for (const code of [0, 1]) {
    let failed = false;
    await assert.rejects(runWhileMonitored(() => new Promise(() => {}), Promise.resolve(code), () => { failed = true; }), /monitor exited/);
    assert.equal(failed, true);
  }
  let failed = false;
  let exit!: (code: number) => void;
  const exited = new Promise<number>(done => { exit = done; });
  await runWhileMonitored(async () => {}, exited, () => { failed = true; });
  exit(0);
  await exited;
  assert.equal(failed, false);
});

test('tree tracking retains known orphans, excludes monitor descendants and rejects PID reuse', () => {
  const root = identity(1), original = identity(2), monitor = identity(3);
  const known = new Map([[1, root], [2, original]]);
  const current = new Map([[1, root], [2, original], [3, monitor], [4, identity(4)], [5, identity(5)]]);
  const rows = [row(1, 0), row(2, 0), row(3, 1), row(4, 3), row(5, 2)];
  assert.deepEqual(trackedTree(root, known, rows, current, 3).map(p => p.pid), [1, 2, 5]);
  current.set(2, identity(2, 'unrelated', 'Wed Oct 21 12:01:00 2026'));
  current.set(5, identity(5, 'unrelated-child'));
  assert.deepEqual(trackedTree(root, known, rows, current, 3).map(p => p.pid), [1]);
  assert.equal(sameIdentity(original, current.get(2)), false);
  assert.deepEqual(parseIdentities(' 2 Wed Oct  7 12:00:00 2026 /path with spaces --arg\n'), [{ pid: 2, start: 'Wed Oct 7 12:00:00 2026', command: '/path with spaces --arg' }]);
});

test('resume review binds exact retained proof and cannot refresh its original baseline', () => {
  const stop = { path: '/retained-stop.json', sha256: 'abc', baseline: observation };
  const review = { schema: 'cuberoot.stats-resource-review/v1', stopPath: stop.path, stopSha256: stop.sha256, boot: '123', swapouts: 0, reason: 'Explicitly reviewed', reviewedAt: '2026-10-21T12:00:00Z' };
  validateResumeReview(review, stop, observation);
  for (const change of [{ stopSha256: 'def' }, { swapouts: 1 }, { boot: '456' }, { reason: '' }])
    assert.throws(() => validateResumeReview({ ...review, ...change }, stop, observation));
  assert.throws(() => validateResumeReview(review, stop, { ...observation, swapouts: 1 }));
});

test('actual idle tsx fixture only exempts its esbuild service from completion', { skip: process.platform !== 'darwin', timeout: 8000 }, async () => {
  const dir = mkdtempSync(join(tmpdir(), 'stats-monitor-tsx-'));
  const file = join(dir, 'fixture.ts');
  writeFileSync(file, 'const pid: number = process.pid; console.log(pid); setTimeout(() => {}, 2000);\n');
  const child = spawn(resolve('core/node_modules/.bin/tsx'), [file], { stdio: ['ignore', 'pipe', 'inherit'] });
  const closed = once(child, 'close');
  try {
    const [data] = await once(child.stdout, 'data');
    const pid = Number(String(data).trim());
    assert(Number.isSafeInteger(pid));
    const identities = new Map(parseIdentities(execFileSync('/bin/ps', ['-axo', 'pid=,lstart=,command='], { encoding: 'utf8', env: { ...process.env, LC_ALL: 'C' } })).map(p => [p.pid, p]));
    const rows = parseProcesses(execFileSync('/bin/ps', ['-axo', 'pid,ppid,rss,pcpu,stat,comm'], { encoding: 'utf8' }));
    const descendants = trackedTree(identities.get(pid)!, new Map(), rows, identities, -1).filter(p => p.pid !== pid);
    assert.equal(descendants.length, 1);
    assert.equal(isTsxService(descendants[0], identities.get(descendants[0].pid)), true);
    assert.equal(isTsxService({ ...descendants[0], name: 'eo_cross_analyzer' }, identities.get(descendants[0].pid)), false);
    assert.equal(isTsxService(descendants[0], identity(descendants[0].pid, '/tmp/esbuild --service=0.25.0 --ping')), false);
    await closed;
  } finally { child.kill('SIGTERM'); await closed; rmSync(dir, { recursive: true, force: true }); }
});

test('isolated real watcher completes normally and fails closed before child-close continuation', { skip: process.platform !== 'darwin', timeout: 25000 }, async () => {
  const temporary = mkdtempSync(join(tmpdir(), 'stats-monitor-lifecycle-'));
  const fixture = join(temporary, 'entry.mts');
  writeFileSync(fixture, `
    import { spawn } from 'node:child_process';
    import { writeFileSync } from 'node:fs';
    import { once } from 'node:events';
    import { withStatsResourceMonitor } from ${JSON.stringify(resolve('scripts/stats/resource-monitor.ts'))};
    await withStatsResourceMonitor(async () => {
      if (process.argv[3] === 'normal') return;
      const child = spawn(process.execPath, ['-e', 'setInterval(() => {}, 1000)']);
      writeFileSync(process.argv[2] + '/work.pid', String(child.pid));
      await once(child, 'close');
      writeFileSync(process.argv[2] + '/unexpected-continuation', 'BUG');
      await new Promise(() => {});
    }, process.argv[2]);
  `);
  const waitFor = async (condition: () => boolean) => {
    const deadline = Date.now() + 8000;
    while (!condition()) {
      if (Date.now() > deadline) throw Error('Lifecycle fixture readiness timeout');
      await new Promise(done => setTimeout(done, 25));
    }
  };
  try {
    for (const mode of ['normal', 'crash']) {
      const state = join(temporary, mode);
      const child = spawn(process.execPath, [...process.execArgv, fixture, state, mode], { stdio: ['ignore', 'pipe', 'pipe'] });
      let output = '';
      child.stdout.on('data', data => { output += data; }); child.stderr.on('data', data => { output += data; });
      const closed = once(child, 'close');
      let watcher: number | undefined, work: number | undefined;
      try {
        if (mode === 'crash') {
          await waitFor(() => existsSync(join(state, 'work.pid')) || child.exitCode !== null);
          assert.equal(child.exitCode, null, output);
          work = Number(readFileSync(join(state, 'work.pid'), 'utf8'));
          const run = join(state, 'runs', readdirSync(join(state, 'runs'))[0]);
          watcher = JSON.parse(readFileSync(join(run, 'owner.json'), 'utf8')).monitor.pid;
          process.kill(watcher!, 'SIGKILL');
        }
        const [code] = await closed;
        assert.equal(code, mode === 'normal' ? 0 : 1, output);
        assert.equal(existsSync(join(state, 'protected-stop.json')), mode === 'crash');
        assert.equal(existsSync(join(state, 'unexpected-continuation')), false);
        if (mode === 'normal') assert.equal(existsSync(join(state, 'active.lock')), false);
        else {
          const stop = JSON.parse(readFileSync(join(state, 'protected-stop.json'), 'utf8'));
          assert.equal(stop.reason, 'Statistics resource monitor failed');
          await waitFor(() => { try { process.kill(work!, 0); return false; } catch { return true; } });
        }
      } finally {
        if (child.exitCode === null && child.signalCode === null) child.kill('SIGKILL');
        for (const pid of [watcher, work]) if (pid) { try { process.kill(pid, 'SIGKILL'); } catch { /* fixture exited */ } }
        await closed;
      }
    }
  } finally { rmSync(temporary, { recursive: true, force: true }); }
});
