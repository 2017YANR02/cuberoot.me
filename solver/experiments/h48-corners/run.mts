/** Isolated H48 algorithm experiment. Never overwrites the active solver/table. */
import { createHash } from 'node:crypto';
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync, renameSync, openSync, closeSync, fsyncSync, unlinkSync, statSync } from 'node:fs';
import { execFileSync, spawn } from 'node:child_process';
import { availableParallelism } from 'node:os';
import { dirname, join, resolve, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseVm, memorySummary, parseProcesses } from '../../../core/scripts/mac-system-recorder.mts';
import { verifyRun } from './verify.mts';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '../../..');
const args = process.argv.slice(2);
if (args.some(a => !/^(--check|--run|--audit-determinism|--threads=\d+|--rounds=\d+|--variant=(corners|bpmx|bpmx-recursive|bpmx-face))$/.test(a)) || args.includes('--check') && args.includes('--run'))
  throw Error('Use --check or --run, optionally --threads=N --rounds=N --variant=corners|bpmx|bpmx-recursive|bpmx-face');
const variant = args.find(a => a.startsWith('--variant='))?.split('=')[1] || 'corners';
const candidateDir = variant === 'corners' ? here : resolve(here, `../h48-${variant}`);
const threads = Number(args.find(a => a.startsWith('--threads='))?.split('=')[1] || availableParallelism());
const rounds = Number(args.find(a => a.startsWith('--rounds='))?.split('=')[1] || 3);
const auditDeterminism = args.includes('--audit-determinism');
if (auditDeterminism && threads !== 1) throw Error('The targeted determinism audit requires --threads=1');
if (!Number.isInteger(threads) || threads < 1 || threads > availableParallelism() || threads > 127 || !Number.isInteger(rounds) || rounds < 1 || rounds > 5)
  throw Error('Invalid thread/round count');
const sha = (value: string | Buffer) => createHash('sha256').update(value).digest('hex');
function files(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap(e => e.isDirectory() ? files(join(dir, e.name)) : [join(dir, e.name)]).sort();
}
const vendor = join(root, 'solver/vendor/nissy-core');
const sourceFiles = [...files(join(vendor, 'src')), ...files(here), ...(variant === 'corners' ? [] : files(candidateDir))].sort();
const sourceHashes = Object.fromEntries(sourceFiles.map(f => [f.slice(root.length + 1), sha(readFileSync(f))]));
const sourceHash = sha(JSON.stringify(sourceHashes));
const build = join(root, `solver/target/h48-${variant}`, `${sourceHash.slice(0, 16)}-t${threads}`);
mkdirSync(build, { recursive: true });
const copied = join(build, 'vendor');
const originalSource = join(build, 'vendor-original');
const experiment = join(build, 'experiment');
const candidate = variant === 'corners' ? experiment : join(build, 'variant');
const command = (bin: string, argv: string[], cwd = root) => execFileSync(bin, argv, { cwd, encoding: 'utf8', timeout: 180_000, maxBuffer: 2 ** 22 });
const probeCommand = (bin: string, argv: string[] = []) => execFileSync(bin, argv, { cwd: root, encoding: 'utf8', timeout: 2000, maxBuffer: 2 ** 22 });
if (!existsSync(originalSource)) cpSync(join(vendor, 'src'), join(originalSource, 'src'), { recursive: true });
if (!existsSync(join(copied, '.patched'))) {
  cpSync(join(vendor, 'src'), join(copied, 'src'), { recursive: true });
  const destination = `--directory=${relative(root, copied)}`;
  command('git', ['apply', destination, '--check', join(candidateDir, 'candidate.patch')]);
  command('git', ['apply', destination, join(candidateDir, 'candidate.patch')]);
  command('git', ['apply', destination, '--check', join(here, 'deterministic.patch')]);
  command('git', ['apply', destination, join(here, 'deterministic.patch')]);
  if (!readFileSync(join(copied, 'src/solvers/h48/solve.h'), 'utf8').includes(variant === 'corners' ? 'h48_prune_corners(arg,' : 'bpmx'))
    throw Error('Candidate patch was not applied');
  writeFileSync(join(copied, '.patched'), sourceHash);
}
if (!existsSync(experiment)) cpSync(here, experiment, { recursive: true });
if (!existsSync(candidate)) cpSync(candidateDir, candidate, { recursive: true });
const arch = process.arch === 'arm64' ? '-DNEON' : '-DPORTABLE';
const flags = ['-std=c11', '-D_POSIX_C_SOURCE=200809L', arch, `-DTHREADS=${threads}`, '-O3', '-pthread'];
const bench = join(build, `h48_${variant.replaceAll('-', '_')}_bench`);
const original = join(build, 'h48_original_bench');
const check = join(build, `h48_${variant}_check`);
const determinismCheck = join(build, 'h48_determinism_check');
for (const [output, sources, includes, extra] of [
  [bench, [join(candidate, 'engine.c'), join(experiment, 'bench.c')], [join(copied, 'src'), candidate], variant !== 'corners' ? ['-DH48_BPMX'] : []],
  [original, [join(originalSource, 'src/nissy.c'), join(experiment, 'bench.c')], [join(originalSource, 'src')], ['-DH48_ORIGINAL']],
  [check, [join(candidate, 'engine.test.c')], [join(copied, 'src')], []],
  [determinismCheck, [join(experiment, 'determinism.test.c')], [join(copied, 'src')], []],
] as [string, string[], string[], string[]][]) {
  if (!existsSync(output)) command('cc', [...flags, ...extra, ...includes.flatMap(i => ['-I', i]), ...sources, '-o', output]);
}
writeFileSync(join(build, 'build.json'), JSON.stringify({ variant, sourceHash, sourceHashes, threads, flags, compiler: command('cc', ['--version']).split('\n')[0] }, null, 2));
console.log(command(check, []).trim());
console.log(command(determinismCheck, []).trim());
console.log(`Build: ${build}`);
if (!args.includes('--run')) process.exit(0);
if (process.platform !== 'darwin') throw Error('This runner currently requires the reviewed macOS resource monitor');

const GiB = 2 ** 30;
const work = join(root, '.tmp/h48-corners-research');
mkdirSync(work, { recursive: true });
function atomic(path: string, value: unknown) {
  const fd = openSync(path + '.new', 'w');
  try { writeFileSync(fd, JSON.stringify(value, null, 2) + '\n'); fsyncSync(fd); } finally { closeSync(fd); }
  renameSync(path + '.new', path);
}
function memory() {
  const vm = parseVm(probeCommand('/usr/bin/vm_stat'));
  const summary = memorySummary(vm);
  const pressure = Number(probeCommand('/usr/sbin/sysctl', ['-n', 'kern.memorystatus_vm_pressure_level']).trim());
  if (!summary || ![1, 2, 4].includes(pressure)) throw Error('Incomplete memory observation');
  const boot = probeCommand('/usr/sbin/sysctl', ['-n', 'kern.boottime']).trim();
  return { boot, swapouts: vm.pages.Swapouts, available: summary.reclaimableEstimateBytes, pressure };
}
const lock = join(work, 'owner.pid');
if (existsSync(lock)) {
  const pid = Number(readFileSync(lock, 'utf8'));
  try { process.kill(pid, 0); throw Error(`Experiment already running (${pid})`); }
  catch (e: any) { if (e.code !== 'ESRCH') throw e; }
  unlinkSync(lock);
}
writeFileSync(lock, String(process.pid), { flag: 'wx' });
process.on('exit', () => { try { unlinkSync(lock); } catch {} });
const baselineFile = join(work, 'resource-baseline.json');
const before = memory();
const baseline = existsSync(baselineFile) ? JSON.parse(readFileSync(baselineFile, 'utf8')) : before;
if (baseline.stopped || baseline.boot !== before.boot || baseline.swapouts !== before.swapouts)
  throw Error('Resource baseline changed or protection stopped a previous run; review required, never auto-reset');
if (before.pressure !== 1 || before.available < 34 * GiB) throw Error('Need normal pressure and at least 34 GiB reclaimable before loading H10');
const processes = parseProcesses(probeCommand('/bin/ps', ['-axo', 'pid,ppid,rss,pcpu,stat,comm']));
if (processes.some(p => /^(solve_h48|h48_(corners|bpmx(?:_recursive|_face)?|original)_bench|table_generator)/.test(p.name)))
  throw Error('Another solver is running; preserve it and retry after it finishes');
if (!existsSync(baselineFile)) atomic(baselineFile, baseline);
const runDir = join(work, `run-${new Date().toISOString().replace(/[:.]/g, '-')}-${variant}-t${threads}`);
mkdirSync(runDir);
let peakRss = 0, minimumHeadroom = Infinity, failure = '';
let child: ReturnType<typeof spawn> | undefined;
function sampleUnchecked() {
  const m = memory();
  const all = parseProcesses(probeCommand('/bin/ps', ['-axo', 'pid,ppid,rss,pcpu,stat,comm']));
  if (!all.some(p => p.pid === process.pid)) throw Error('Process memory observation incomplete');
  const family = new Set([process.pid]);
  for (let changed = true; changed;) {
    changed = false;
    for (const p of all) if (family.has(p.ppid) && !family.has(p.pid)) { family.add(p.pid); changed = true; }
  }
  const rss = all.reduce((sum, p) => sum + (family.has(p.pid) ? p.rssBytes : 0), 0);
  peakRss = Math.max(peakRss, rss);
  minimumHeadroom = Math.min(minimumHeadroom, m.available - rss);
  let reason = '';
  if (m.boot !== baseline.boot || m.swapouts !== baseline.swapouts) reason = 'Boot or Swapouts changed';
  else if (m.pressure !== 1) reason = 'Memory pressure abnormal';
  else if (rss > 32 * GiB || m.available - rss < 2 * GiB) reason = 'RSS/headroom limit reached';
  if (reason) {
    atomic(baselineFile, { ...baseline, stopped: reason, observed: m });
    throw Error(reason);
  }
  atomic(join(runDir, 'resources.json'), { ...m, rss, peakRss, minimumHeadroom, updatedAt: new Date().toISOString() });
}
function sample() {
  try { sampleUnchecked(); }
  catch (error) {
    atomic(baselineFile, { ...baseline, stopped: String(error), updatedAt: new Date().toISOString() });
    throw error;
  }
}
function stop(reason: string) {
  if (failure) return;
  failure = reason;
  if (child?.pid && child.exitCode === null) {
    const active = child, pid = child.pid;
    try { process.kill(-pid, 'SIGTERM'); } catch {}
    setTimeout(() => {
      if (active.exitCode === null && active.signalCode === null) try { process.kill(-pid, 'SIGKILL'); } catch {}
    }, 2000).unref();
  }
}
process.on('SIGINT', () => stop('Interrupted by user'));
process.on('SIGTERM', () => stop('Interrupted by user'));
async function run(bin: string, argv: string[], input: string, label: string) {
  sample();
  console.log(`Starting ${label}`);
  const fd = openSync(join(runDir, label + '.jsonl'), 'wx');
  let pending = '';
  const rows: any[] = [];
  const accept = (line: string) => {
    if (!line) return;
    writeFileSync(fd, line + '\n'); fsyncSync(fd);
    const row = JSON.parse(line); rows.push(row);
    if (rows.length % 50 === 0) console.log(`${label}: ${rows.length} results`);
  };
  child = spawn(bin, argv, { cwd: root, detached: true, stdio: ['pipe', 'pipe', 'pipe'] });
  const current = child;
  let outputError: unknown;
  const closed = new Promise<number>((ok, no) => { current.on('error', no); current.on('close', c => ok(c ?? -1)); });
  current.stdout!.setEncoding('utf8');
  current.stdout!.on('data', (chunk: string) => {
    try { pending += chunk; const lines = pending.split('\n'); pending = lines.pop()!; lines.forEach(accept); }
    catch (e) { outputError = e; stop('Invalid worker output'); }
  });
  current.stderr!.on('data', d => process.stderr.write(d));
  current.stdin!.on('error', e => { if ((e as any).code !== 'EPIPE') stop(String(e)); });
  current.stdin!.end(input);
  const timer = setInterval(() => { try { sample(); } catch (e) { stop(String(e)); } }, 500);
  const timeout = setTimeout(() => stop(`${label}: 10-minute timeout`), 600_000);
  try {
    const code = await closed;
    if (pending) accept(pending);
    if (failure || outputError || code !== 0) throw Error(failure || String(outputError || `${label} exited ${code}`));
    sample();
    return rows;
  } finally { clearInterval(timer); clearTimeout(timeout); closeSync(fd); child = undefined; }
}

try {
  const cornerFile = join(work, 'corners.dat');
  if (variant === 'corners' && !existsSync(cornerFile)) await run(bench, ['--generate-corners', cornerFile], '', 'generate-corners');
  const h10 = join(root, 'solver/tables/h48-nissy-core/h48h10.dat');
  const tableBefore = statSync(h10);
  const old = JSON.parse(readFileSync(join(root, 'solver/testdata/benchmarks/h48-h10-2026-10-04.json'), 'utf8'));
  const fixtures: { id: string, scramble: string, htm?: number }[] = old.sample.rows;
  const extra = ['', 'R2', 'U2', 'F2', "D U'", "R U R' F2", "R2 U2 F2 D2 L2", "F R U R' U' F'", "R2 F2 U D' L2 B2", "R U2 R' F2 D L2 B'"];
  const cases = auditDeterminism ? fixtures.filter(item => ['22001', '73549001', '348442001'].includes(item.id)) : [...fixtures, ...extra.map((scramble, i) => ({ id: `short${i}`, scramble }))];
  if (auditDeterminism && cases.length !== 3) throw Error('Missing determinism regression fixtures');
  const lines: string[] = [];
  for (let round = 0; round <= rounds; round++) for (const item of cases) {
    const id = `${round === 0 ? 'warm' : `r${round}`}-${item.id}`;
    lines.push(`${id},${item.scramble}`);
  }
  const input = lines.join('\n') + '\n';
  atomic(join(runDir, 'input.json'), { variant, fixtureSet: auditDeterminism ? 'rank-determinism-regressions' : 'full-60-plus-10-boundaries', baselineControl: 'initialized-rank-total-order-v1', pairOrder: 'id-parity-v1', cases, rounds, sourceHash, sourceHashes, threads, baseline, cornerSha256: variant === 'corners' ? sha(readFileSync(cornerFile)) : null, h10Stat: { path: h10, size: tableBefore.size, mtimeMs: tableBefore.mtimeMs } });
  const argv = ['--benchmark', h10, cornerFile, String(threads)];
  await run(original, argv, input, 'original');
  await run(bench, argv, input, 'paired');
  const tableAfter = statSync(h10);
  if (tableBefore.size !== tableAfter.size || tableBefore.mtimeMs !== tableAfter.mtimeMs) throw Error('H10 file changed');
  sample();
  const report = await verifyRun(runDir, () => {
    sample();
    if (failure) throw Error(failure);
  });
  console.log(JSON.stringify({ report: join(runDir, 'report.json'), status: report.status, variant, verifiedSolutions: report.verifiedSolutions, sums: report.sums }, null, 2));
} catch (e) {
  stop(String(e));
  atomic(join(runDir, 'failure.json'), { reason: String(e), baseline, peakRss, minimumHeadroom, sourceHash });
  throw e;
}
