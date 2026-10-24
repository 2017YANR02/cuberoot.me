import { randomUUID } from 'node:crypto';
import { existsSync, mkdirSync, mkdtempSync, rmSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { saveTestRun, historyDirectory, readTestRuns, readRegressionCases } from '../packages/client/lib/recon-test-history.server.ts';
import type { ReconTestRun } from '../packages/client/lib/recon-test-results.ts';

export function startResult(root: string, fingerprint: string, trigger: string) {
  const cases = readRegressionCases(root);
  const git = (...args: string[]) => spawnSync('git', ['-C', root, ...args], { encoding: 'utf8' }).stdout?.trim() ?? '';
  const run: ReconTestRun = { version: 1, id: randomUUID(), startedAt: new Date().toISOString(),
    status: 'running', trigger, commit: git('rev-parse', 'HEAD'), dirty: !!git('status', '--porcelain'),
    fingerprint, pid: process.pid, cases, passed: 0, failed: 0, total: 0, errors: [] };
  saveTestRun(root, run);
  const directoryOut = join(historyDirectory(root), run.id); mkdirSync(directoryOut, { recursive: true });
  return { run, reportFile: join(directoryOut, 'vitest.json'), captureDirectory: directoryOut };
}
export function finishResult(root: string, context: ReturnType<typeof startResult>, status: number, message = '') {
  const { run, reportFile, captureDirectory } = context;
  run.finishedAt = new Date().toISOString();
  run.status = status === 0 ? 'passed' : 'failed';
  if (message) run.errors.push(message);
  try {
  if (existsSync(reportFile)) {
    const report = JSON.parse(readFileSync(reportFile, 'utf8'));
    run.passed = report.numPassedTests ?? 0; run.failed = report.numFailedTests ?? 0; run.total = report.numTotalTests ?? 0;
    run.skipped = report.numPendingTests ?? 0;
    const assertions = (report.testResults ?? []).flatMap((suite: { assertionResults?: unknown[] }) => suite.assertionResults ?? []);
    for (const sample of run.cases) {
      if (!sample.approved) continue;
      const result = assertions.find((assertion: { title: string }) => assertion.title === sample.id + '.json');
      if (result) {
        sample.status = result.status === 'passed' ? 'passed' : result.status === 'failed' ? 'failed' : 'not-run';
        sample.durationMs = result.duration; sample.errors = result.failureMessages ?? [];
      }
      const capture = join(captureDirectory, sample.id + '.json');
      if (existsSync(capture)) sample.actual = JSON.parse(readFileSync(capture, 'utf8'));
    }
    for (const suite of report.testResults ?? []) {
      for (const assertion of suite.assertionResults ?? []) {
        if (assertion.status === 'failed') run.errors.push(`${assertion.fullName}\n${(assertion.failureMessages ?? []).join('\n')}`);
      }
      if (suite.message) run.errors.push(suite.message);
    }
  } else if (status === 0) {
    run.status = 'failed'; run.errors.push('Test result report is missing.'); status = 2;
  }
  } catch { run.errors.push('Test report could not be read.'); status = status || 2; }
  if (status === 0 && (run.failed > 0 || run.errors.length || run.passed + (run.skipped ?? 0) !== run.total || run.cases.some(sample => sample.approved && (sample.status !== 'passed' || !sample.actual)))) {
    run.errors.push('The report is incomplete or contains failed checks.'); status = 2;
  }
  run.status = status === 0 ? 'passed' : 'failed';
  // Store portable diagnostics; local checkout paths are not useful to viewers.
  run.errors = run.errors.map(error => error.replaceAll(root, '<checkout>').replace(/\u001b\[[0-9;]*m/g, '').slice(0, 20000)).slice(0, 100);
  for (const sample of run.cases) sample.errors = sample.errors.map(error => error.replaceAll(root, '<checkout>').replace(/\u001b\[[0-9;]*m/g, '').slice(0, 20000)).slice(0, 100);
  saveTestRun(root, run);
  return status;
}


/** Acknowledged reports are immutable; failed uploads stay queued for the next run. */
export async function publishResults(root: string, options: { key?: string; url?: string; fetcher?: typeof fetch } = {}) {
  const key = options.key ?? process.env.ADMIN_API_KEY;
  if (!key) return { sent: 0, pending: true };
  const endpoint = options.url ?? 'https://api.cuberoot.me/v1/recon-ground-truth/runs';
  const fetcher = options.fetcher ?? fetch;
  let sent = 0;
  for (const run of readTestRuns(root)) {
    if (run.status === 'running' || !run.finishedAt) continue;
    const receipt = join(historyDirectory(root), run.id + '.synced');
    if (existsSync(receipt) && readFileSync(receipt, 'utf8') === endpoint) continue;
    try {
      const response = await fetcher(endpoint, { method: 'POST', redirect: 'error',
        headers: { 'Content-Type': 'application/json', 'X-Admin-Key': key },
        body: JSON.stringify(run), signal: AbortSignal.timeout(5000) });
      if (!response.ok || (await response.json()).saved !== true) return { sent, pending: true };
      writeFileSync(receipt, endpoint, { mode: 0o600 }); sent++;
    } catch { return { sent, pending: true }; }
  }
  return { sent, pending: false };
}

if (resolve(process.argv[1] ?? '') === fileURLToPath(import.meta.url) && process.argv[2] === 'publish') {
  const root = resolve(process.argv[3]);
  const config = join(root, 'core/.env.recon-tests.local');
  if (existsSync(config)) process.loadEnvFile(config);
  const result = await publishResults(root);
  console.log(result.pending ? 'Reports saved locally; cloud synchronization pending.' : 'Test history synchronized.');
}


// Trusted main-branch CI reuses deployment access; the API key remains on the server.
if (resolve(process.argv[1] ?? '') === fileURLToPath(import.meta.url) && process.argv[2] === 'publish-ci') {
  const root = resolve(process.argv[3]);
  const { DEPLOY_HOST: host, DEPLOY_USER: user, SSH_KEY: key } = process.env;
  if (!host || !user || !key || !/^[a-zA-Z0-9.-]+$/.test(host) || !/^[a-zA-Z0-9_-]+$/.test(user)) {
    console.error('Cloud sync credentials unavailable; reports retained as CI artifacts.'); process.exitCode = 1;
  } else {
    const dir = mkdtempSync(join(tmpdir(), 'recon-test-upload-'));
    try {
      writeFileSync(join(dir, 'key'), key.replaceAll('\r\n', '\n').trimEnd() + '\n', { mode: 0o600 });
      const scan = spawnSync('ssh-keyscan', ['-H', host], { encoding: 'utf8', timeout: 15000 });
      if (scan.status !== 0) throw Error('Host unavailable');
      writeFileSync(join(dir, 'known_hosts'), scan.stdout);
      const remoteCode = `let text = ''; for await (const chunk of process.stdin) text += chunk;
        const report = JSON.parse(text);
        const r = await fetch('http://127.0.0.1:3001/v1/recon-ground-truth/runs', {
          method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Admin-Key': process.env.ADMIN_API_KEY },
          body: JSON.stringify(report), signal: AbortSignal.timeout(10000)
        }); if (!r.ok || (await r.json()).saved !== true) process.exitCode = 1;`;
      const quote = (value: string) => "'" + value.replaceAll("'", "'\"'\"'") + "'";
      for (const run of readTestRuns(root).filter(run => run.finishedAt)) {
        const result = spawnSync('ssh', ['-i', join(dir, 'key'), '-o', 'BatchMode=yes', '-o', 'ConnectTimeout=10',
          '-o', `UserKnownHostsFile=${join(dir, 'known_hosts')}`, `${user}@${host}`,
          'node --env-file=/root/core-api/.env --input-type=module -e ' + quote(remoteCode)],
          { input: JSON.stringify(run), encoding: 'utf8', timeout: 20000 });
        if (result.status !== 0) {
          const reason = /error in libcrypto|invalid format/.test(result.stderr ?? '') ? 'invalid SSH key format'
            : /Permission denied/.test(result.stderr ?? '') ? 'SSH permission denied'
            : /node: command not found|node: not found/.test(result.stderr ?? '') ? 'remote Node unavailable'
            : `remote upload exit ${result.status ?? 'unknown'}`;
          throw Error(reason);
        }
      }
      console.log('CI test history synchronized.');
    } catch (error) { console.error(`Cloud sync failed (${error instanceof Error ? error.message : 'unknown'}); reports retained as CI artifacts.`); process.exitCode = 1; }
    finally { rmSync(dir, { recursive: true, force: true }); }
  }
}
