/** One explicitly authorized evaluation. Monitoring is not OS-enforced no-swap. */
import { execFileSync, spawn } from 'node:child_process';
import { appendFileSync, closeSync, existsSync, lstatSync, openSync, readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseEnv } from 'node:util';
import { parseVm } from '../../../scripts/mac-system-recorder.mts';
import { loadEvaluationResume, resumeHelperSha256 } from './assistant-evaluation-resume.mts';
import { monitorClockMs, type MonitorLease } from './assistant-monitor-lease.mts';

const GiB = 2 ** 30;
export const limits = { treeRss: GiB, minimumFree: 2 * GiB, startupFree: 3.5 * GiB, milliseconds: 30 * 60_000, sampleMs: 2000 };
type Sample = { at: string; boot: string; swapouts: number; pressure: number; free: number; rss: number };
export function violation(baseline: Sample, now: Sample, elapsed: number): string | undefined {
  if (now.boot !== baseline.boot) return 'boot_changed';
  if (now.swapouts !== baseline.swapouts) return 'swapouts_changed';
  if (now.pressure !== 1) return 'memory_pressure';
  if (now.free < limits.minimumFree) return 'memory_headroom';
  if (now.rss > limits.treeRss) return 'tree_rss';
  if (elapsed >= limits.milliseconds) return 'time_limit';
}
const cmd = (bin: '/usr/bin/vm_stat' | '/usr/sbin/sysctl' | '/bin/ps', args: string[]) => execFileSync(bin, args, { encoding: 'utf8', timeout: 4000, env: { ...process.env, LC_ALL: 'C' } }).trim();
function sample(group?: number) {
  const vm = parseVm(cmd('/usr/bin/vm_stat', []));
  const boot = cmd('/usr/sbin/sysctl', ['-n', 'kern.boottime']).match(/sec\s*=\s*(\d+)/)?.[1];
  const pressure = Number(cmd('/usr/sbin/sysctl', ['-n', 'kern.memorystatus_vm_pressure_level']));
  const rows = cmd('/bin/ps', ['-axo', 'pid=,ppid=,pgid=,rss=']).split('\n').map(line => line.trim().split(/\s+/).map(Number));
  const family = new Set([process.pid, ...(group ? [group] : [])]);
  for (let changed = true; changed;) {
    changed = false;
    for (const [pid, parent, pgid] of rows) if ((family.has(parent) || group && pgid === group) && !family.has(pid)) { family.add(pid); changed = true; }
  }
  const rss = rows.filter(([pid]) => family.has(pid)).reduce((sum, row) => sum + row[3] * 1024, 0);
  const free = vm.pages['Pages free'] * vm.pageSize;
  if (!boot || ![pressure, rss, free, vm.pages.Swapouts].every(Number.isFinite)) throw Error('Incomplete resource observation');
  return { at: new Date().toISOString(), monotonicAtMs: monitorClockMs(), boot, swapouts: vm.pages.Swapouts, pressure, free, rss };
}
async function main() {
  if (process.platform !== 'darwin') throw Error('This supervisor is for local macOS evaluation');
  const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../../..');
  const arg = (name: string) => process.argv.find(v => v.startsWith(`--${name}=`))?.slice(name.length + 3);
  const dir = resolve(root, arg('out') ?? '.local-data/assistant-reliability-20261116-verified');
  const envFile = resolve(root, arg('env-file') ?? '.local-data/assistant-evaluation-config/deepseek.env');
  const read = (name: string) => JSON.parse(readFileSync(resolve(dir, name), 'utf8'));
  const sha = (path: string) => createHash('sha256').update(readFileSync(path)).digest('hex');
  const save = (name: string, value: unknown) => writeFileSync(resolve(dir, name), JSON.stringify(value, null, 2) + '\n', { flag: 'wx', mode: 0o600 });
  const runner = resolve(root, 'core/apps/api/scripts/benchmark-assistant-context.mjs');
  const manifest = read('build-manifest.json');
  if (manifest.resumeHelperSha256 !== resumeHelperSha256) throw Error('Frozen continuation verifier changed');
  const resume = loadEvaluationResume(dir, root);
  const priorElapsedMs = resume?.priorElapsedMs ?? 0;
  if (sha(resolve(root, 'core/apps/api/scripts/assistant-monitor-lease.mts')) !== manifest.monitorSha256) throw Error('Frozen resource lease changed');
  if (sha(runner) !== manifest.runnerSha256 || sha(resolve(dir, 'cases.json')) !== manifest.casesSha256) throw Error('Frozen runner or cases changed');
  for (const variant of ['before', 'after']) if (sha(resolve(dir, variant + '.mjs')) !== manifest.variants[variant].bundleSha256) throw Error('Frozen runtime changed');
  const stat = lstatSync(envFile);
  if (!stat.isFile() || stat.isSymbolicLink() || stat.mode & 0o077) throw Error('Credential file must be an owner-only regular file');
  const env = parseEnv(readFileSync(envFile, 'utf8'));
  if (env.SITE_ASSISTANT_PROVIDER !== 'deepseek' || env.DEEPSEEK_MODEL !== 'deepseek-flash') throw Error('Keep the frozen provider/model configuration');
  const baseline = sample();
  if (resume && (resume.boot !== baseline.boot || resume.swapouts !== baseline.swapouts)) throw Error('Original resource baseline changed');
  const fingerprint = { runner: sha(runner), manifest: sha(resolve(dir, 'build-manifest.json')), supervisor: sha(fileURLToPath(import.meta.url)), resume: resume?.sha256 ?? null, resumeHelper: resumeHelperSha256 };
  if (!process.argv.includes('--run')) {
    console.log(JSON.stringify({ baseline, fingerprint, limits, priorElapsedMs, remainingRequests: resume ? read('cases.json').cases.length * 4 - resume.done.length : undefined, keyPresent: Boolean(env.DEEPSEEK_API_KEY?.trim()), osNoSwapGuaranteed: false }));
    return;
  }
  if (!env.DEEPSEEK_API_KEY?.trim()) throw Error('Fill DEEPSEEK_API_KEY in the private evaluation file');
  if (existsSync(resolve(dir, 'resource-stop.json')) || existsSync(resolve(dir, 'local-used.json')) || existsSync(resolve(dir, 'paid-ledger.json'))) throw Error('Prior run or stop exists; no automatic restart');
  const approval = read('local-authorization.json');
  if (approval.scope !== 'assistant-reliability-monitored-local-once' || approval.userApproved !== true
    || approval.boot !== baseline.boot || approval.swapouts !== baseline.swapouts
    || !Number.isFinite(Date.parse(approval.expiresAt)) || Date.parse(approval.expiresAt) <= Date.now()
    || JSON.stringify(approval.fingerprint) !== JSON.stringify(fingerprint)
    || JSON.stringify(approval.limits) !== JSON.stringify(limits)) throw Error('Missing or mismatched explicit one-run authorization');
  const initial = violation(baseline, baseline, priorElapsedMs);
  if (initial || baseline.free < limits.startupFree) throw Error(initial ?? 'Insufficient startup headroom');
  save('local-used.json', { baseline, fingerprint, limits, at: new Date().toISOString() });
  const log = openSync(resolve(dir, 'real-model.log'), 'wx', 0o600);
  const child = spawn(process.execPath, ['--max-old-space-size=768', runner, '--run', `--out=${dir}`, `--env-file=${envFile}`], { cwd: root, detached: true, stdio: ['ignore', log, log, 'ipc'] });
  closeSync(log);
  const started = monitorClockMs();
  const deadlineMonotonicAtMs = started + limits.milliseconds - priorElapsedMs;
  let sequence = 0;
  let stopped = false, childExited = false, last = baseline;
  const stop = (reason: string) => {
    if (stopped) return;
    stopped = true;
    try {
      if (!existsSync(resolve(dir, 'resource-stop.json'))) save('resource-stop.json', { reason, baseline, last, at: new Date().toISOString(), inFlightUsageMayBeUnknown: true });
    } finally {
      if (child.pid && !childExited) { try { process.kill(-child.pid, 'SIGKILL'); } catch { /* Already exited. */ } }
    }
  };
  const observe = () => {
    try {
      last = sample(child.pid);
      appendFileSync(resolve(dir, 'local-resources.jsonl'), JSON.stringify(last) + '\n', { mode: 0o600 });
      const reason = violation(baseline, last, priorElapsedMs + last.monotonicAtMs - started);
      if (reason) stop(reason);
      else if (child.connected) {
        const lease: MonitorLease = { type: 'resource-sample', parent: process.pid, sequence: ++sequence,
          sampledAt: Date.parse(last.at), sampledMonotonicAtMs: last.monotonicAtMs, deadlineMonotonicAtMs };
        child.send(lease, error => { if (error) stop('monitor_channel_failed'); });
      }
    } catch { stop('resource_observation_failed'); }
  };
  observe();
  const timer = setInterval(observe, limits.sampleMs);
  process.once('SIGINT', () => stop('interrupted'));
  process.once('SIGTERM', () => stop('terminated'));
  console.log(JSON.stringify({ started: true, pid: child.pid, evidence: dir, limits }));
  const exitCode = await new Promise<number>(resolveExit => {
    child.once('error', () => { stop('spawn_failed'); resolveExit(1); });
    child.once('close', (code) => { childExited = true; resolveExit(code ?? 1); });
  });
  clearInterval(timer);
  if (existsSync(resolve(dir, 'resource-stop.json'))) stopped = true;
  // Never signal a process group after the child's exit, to avoid PID reuse.
  try {
    last = sample();
    const reason = violation(baseline, last, priorElapsedMs + last.monotonicAtMs - started);
    if (reason && !stopped) { stopped = true; if (!existsSync(resolve(dir, 'resource-stop.json'))) save('resource-stop.json', { reason, baseline, last }); }
  } catch { stopped = true; if (!existsSync(resolve(dir, 'resource-stop.json'))) save('resource-stop.json', { reason: 'final_observation_failed', baseline }); }
  const elapsedMs = monitorClockMs() - started;
  save('local-exit.json', { exitCode, stopped, baseline, last, elapsedMs, priorElapsedMs, totalElapsedMs: priorElapsedMs + elapsedMs });
  console.log(JSON.stringify({ exitCode, stopped, elapsedMs }));
  process.exitCode = stopped ? 1 : exitCode;
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main().catch(error => { console.error(error.message); process.exitCode = 1; });
