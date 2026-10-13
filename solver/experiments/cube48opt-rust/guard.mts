/** Backend-budgeted research. Shares the previous experiment's swap stop record. */
import { existsSync, mkdirSync, readFileSync, writeFileSync, renameSync, openSync, closeSync, unlinkSync, fstatSync, readSync } from 'node:fs';
import { execFileSync, spawn } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseVm, memorySummary, parseProcesses } from '../../../core/scripts/mac-system-recorder.mts';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '../../..');
const native = resolve(here, 'target/release/cube48opt-research');
const GiB = 2 ** 30, MiB = 2 ** 20;

/** Pure protocol validation. Tests never need to observe memory or open a PDB. */
export function researchPolicy(label: string, executable: string, args: string[], env: NodeJS.ProcessEnv = process.env) {
if (!label || !/^[a-z0-9-]+$/.test(label) || !executable ||
    !(resolve(executable) === native || executable === process.execPath &&
      ['oracle.mjs', 'validate.mjs', 'benchmark.mjs', 'verify-coordinates.mjs', 'verify-h10.mjs', 'validate-h10.mjs', 'h10-benchmark.mjs'].includes(args[0]?.split('/').at(-1) ?? '') &&
      resolve(args[0]) === resolve(here, args[0]?.split('/').at(-1) ?? '')))
  throw Error('Use guard.mts LABEL <native-binary | node oracle.mjs | node validate.mjs | node benchmark.mjs> [args]');
const entry = resolve(executable) === native ? 'native' : args[0].split('/').at(-1);
const mode = entry === 'native' ? args[0] : args[1];
const backend = env.CUBEOPT_BACKEND ?? 'opt';
if (!['opt', 'h10', 'h48'].includes(backend)) throw Error('CUBEOPT_BACKEND must be opt, h10 or h48');
const h48Entry = entry === 'native' && ['solve-h48', 'query-h48'].includes(mode);
// H11 has format support for inspection/tests only. No run-time override exists.
// Reject it before any file access, including requests using a renamed table.
if (env.CUBEOPT_H !== undefined && !/^(?:[0-9]|10)$/.test(env.CUBEOPT_H)
    || h48Entry && !/^(?:[0-9]|10)$/.test(args[1] ?? '')
    || entry === 'native' && /^(?:solve|query)-h11$/.test(mode))
  throw Error('H11 execution is prohibited; H48 research permits only canonical H0 through H10');
if ((backend === 'h48') !== h48Entry)
  throw Error('H48 entries require CUBEOPT_BACKEND=h48 and matching CUBEOPT_H=0..10');
if (backend !== 'h48' && env.CUBEOPT_H !== undefined)
  throw Error('CUBEOPT_H is only valid for CUBEOPT_BACKEND=h48');
const h10Entry = entry === 'native' ? ['solve-h10', 'query-h10'].includes(mode)
  : ['verify-h10.mjs', 'validate-h10.mjs', 'h10-benchmark.mjs'].includes(entry ?? '');
// Reject mismatches before observing memory or spawning: an H10 query must
// never accidentally inherit the default 30 MB Opt1 budget.
if ((backend === 'h10') !== h10Entry) throw Error('H10 entries require CUBEOPT_BACKEND=h10; Opt entries require CUBEOPT_BACKEND=opt (default)');
let h: number | null = null;
let tablePath: string | null = null;
if (h48Entry) {
  if (env.CUBEOPT_H !== args[1]) throw Error('CUBEOPT_H must exactly match the native H48 argument');
  if (!args[2] || (mode === 'query-h48' ? args.length !== 3 : args.length < 3 || args.length > 6))
    throw Error('Use solve-h48 H TABLE [CONTEXTS MAX_DEPTH MAX_NODES] or query-h48 H TABLE');
  const option = (index: number, min: number, max: number, name: string) => {
    if (args[index] !== undefined && (!/^(?:0|[1-9][0-9]*)$/.test(args[index])
        || !Number.isSafeInteger(Number(args[index])) || Number(args[index]) < min || Number(args[index]) > max))
      throw Error(`Invalid H48 ${name}`);
  };
  option(3, 1, 8, 'contexts');
  if (args[3] !== undefined && !['1', '8'].includes(args[3])) throw Error('H48 contexts must be 1 or 8');
  option(4, 0, 20, 'max depth');
  option(5, 0, Number.MAX_SAFE_INTEGER, 'node budget');
  h = Number(args[1]);
  tablePath = resolve(args[2]);
}
if (entry === 'native' && backend === 'opt' && !['inspect', 'solve'].includes(mode))
  throw Error('Unknown Opt native entry');
const optText = env.CUBEOPT_VARIANT ?? '1';
if (backend === 'opt' && !/^[1-9]$/.test(optText)) throw Error('CUBEOPT_VARIANT must be an integer from 1 to 9');
const variant = backend === 'opt' ? Number(optText) : null;
const tableBytes = h === null ? backend === 'h10' ? 30_336_314_216 : 30_401_280 * 2 ** (variant === 1 ? 0 : variant!)
  : h48FileBytes(h);
const measureRssText = env.CUBEOPT_MEASURE_RSS ?? '0';
if (!['0', '1'].includes(measureRssText)) throw Error('CUBEOPT_MEASURE_RSS must be 0 or 1');
const measureNativeRss = measureRssText === '1';
if (measureNativeRss && entry !== 'native') throw Error('CUBEOPT_MEASURE_RSS=1 requires the allowed native executable directly');
// verify-h10 is a fixed coordinate-only harness: ~2 MB auxiliary reads and
// sampled 64-byte main-table rows; no mmap, full scan, or solver dispatch.
// validate-h10 has its own full-table budget below.
const small = entry === 'verify-h10.mjs' || backend === 'opt' &&
  (entry === 'verify-coordinates.mjs' || ['inspect', 'small', 'verify-small', 'query-small'].includes(mode));
// Private resident pages already reduce free+file-backed pages. Subtracting RSS
// again double-counts the table. A fixed observation reserve covers sampling lag;
// preflight separately reserves the full expected process-tree peak.
// Generation briefly copies the sorted frontier before freeing the old one.
const rssLimit = small ? 512 * MiB : mode === 'generate' ? Math.ceil(tableBytes * 18 / 16) + 768 * MiB
  : entry === 'h10-benchmark.mjs' ? tableBytes + GiB
  : entry === 'benchmark.mjs' ? tableBytes * (args.includes('--sequential') ? 1 : 2) + GiB : tableBytes + 768 * MiB;
const deadlineMs = mode === 'generate' ? 6 * 60 * 60_000
  : ['benchmark.mjs', 'validate.mjs', 'h10-benchmark.mjs', 'verify-h10.mjs', 'validate-h10.mjs'].includes(entry ?? '') ? 60 * 60_000 : 10 * 60_000;
return { entry, mode, backend, variant, h, tablePath, tableBytes, measureNativeRss, rssLimit, deadlineMs };
}

export function h48FileBytes(h: number): number {
  if (!Number.isInteger(h) || h < 0 || h > 10) throw Error('H11 execution is prohibited; expected H0 through H10');
  return 64 * Math.ceil((3393 * 34650 * 2 ** h) / 254) + 2_060_648;
}

/** Main-header/size check prevents a renamed H11 or mismatched H table using a smaller budget. */
export function validateH48Metadata(h: number, fileBytes: number, header: Buffer): number {
  const expected = h48FileBytes(h);
  const mainBytes = expected - 2_060_648;
  if (fileBytes !== expected || header.length !== 512) throw Error(`H${h} requires exactly ${expected} file bytes and a 512-byte main header`);
  const entries = 3393 * 34650 * 2 ** h;
  const integer = (offset: number) => header.readBigUInt64LE(offset);
  const name = Buffer.alloc(100);
  name.write(`h48 solver h =${String(h).padStart(2, ' ')}`);
  if (header[324] !== h || header[325] !== 2 || header[326] !== (h < 4 ? 8 : h < 8 ? 9 : 10)
      || header[327] !== 3 || !header.subarray(224, 324).equals(name)
      || integer(168) !== 0n || integer(176) !== 512n || integer(184) !== BigInt(mainBytes + 512)
      || integer(200) !== BigInt(entries + 2 * (mainBytes / 64)) || integer(216) !== BigInt(mainBytes + 512))
    throw Error(`H${h} main header does not match its guarded 2-bit format`);
  return fileBytes;
}

async function main() {
const [label, executable, ...args] = process.argv.slice(2);
const policy = researchPolicy(label, executable, args);
const { entry, mode, backend, variant, h, tablePath, measureNativeRss, rssLimit, deadlineMs } = policy;
let { tableBytes } = policy;
if (tablePath !== null && h !== null) {
  // The child runs at repo root, so pass the exact path checked in the caller's
  // directory rather than interpreting a relative table path a second time.
  args[2] = tablePath;
  const fd = openSync(tablePath, 'r');
  try {
    const info = fstatSync(fd);
    if (!info.isFile() || info.size !== tableBytes) throw Error(`H${h} requires a regular file of exactly ${tableBytes} bytes`);
    const header = Buffer.alloc(512);
    if (readSync(fd, header, 0, header.length, 1_120_256) !== header.length) throw Error('Truncated H48 main header');
    tableBytes = validateH48Metadata(h, info.size, header);
  } finally { closeSync(fd); }
}
if (process.platform !== 'darwin') throw Error('This resource guard requires macOS');
const observationReserve = 256 * MiB;
const output = resolve(root, '.tmp/cubeopt-reverse');
mkdirSync(output, { recursive: true });
const record = resolve(root, '.tmp/h48-corners-research/resource-baseline.json');
const ownRecord = resolve(output, 'resource-baseline.json');
const lockPath = resolve(output, 'compute.lock');
const atomic = (path: string, value: unknown) => { writeFileSync(path + '.new', JSON.stringify(value, null, 2) + '\n'); renameSync(path + '.new', path); };
const command = (exe: string, argv: string[] = []) => execFileSync(exe, argv, { encoding: 'utf8', timeout: 3000 });
function memory() {
  const vm = parseVm(command('/usr/bin/vm_stat'));
  const summary = memorySummary(vm);
  if (!summary || !Number.isSafeInteger(vm.pages.Swapouts) || vm.pages.Swapouts < 0 ||
      !Number.isSafeInteger(summary.reclaimableEstimateBytes) || summary.reclaimableEstimateBytes < 0)
    throw Error('Missing or invalid memory observation');
  return { boot: command('/usr/sbin/sysctl', ['-n', 'kern.boottime']).trim(), swapouts: vm.pages.Swapouts,
    pressure: Number(command('/usr/sbin/sysctl', ['-n', 'kern.memorystatus_vm_pressure_level']).trim()), available: summary.reclaimableEstimateBytes };
}
const before = memory();
for (const file of [record, ownRecord]) if (existsSync(file)) {
  const prior = JSON.parse(readFileSync(file, 'utf8'));
  if (prior.stopped || prior.boot !== before.boot || prior.swapouts !== before.swapouts)
    throw Error(`Prior resource baseline requires review: ${file}`);
}
if (before.pressure !== 1 || before.available < rssLimit + 3 * GiB)
  throw Error(`Insufficient memory headroom: ${backend === 'h48' ? `h${h}` : backend === 'h10' ? 'h10' : `opt${variant}`} ${entry}/${mode} requires ${rssLimit + 3 * GiB} bytes; observed ${before.available}`);
// An abandoned lock requires explicit inspection; never erase it to auto-restart.
const lock = openSync(lockPath, 'wx');
writeFileSync(lock, JSON.stringify({ pid: process.pid, backend, variant, h, entry, mode, boot: before.boot }));
closeSync(lock);
if (!existsSync(ownRecord)) atomic(ownRecord, before);
let peakRss = 0, minimumHeadroom = before.available, stopped = '';
let forceKill: ReturnType<typeof setTimeout> | undefined;
// Only wrap the already validated native executable. time writes its child
// rusage to inherited stderr; it and the native remain in the guarded group.
const child = spawn(measureNativeRss ? '/usr/bin/time' : entry === 'native' ? native : executable,
  measureNativeRss ? ['-l', native, ...args] : args,
  { cwd: root, detached: true, stdio: 'inherit' });
const closed = new Promise<number>((ok, no) => { child.on('error', no); child.on('close', code => ok(code ?? 1)); });
function stop(reason: string, protection = false) {
  if (stopped) return;
  stopped = reason;
  if (protection) atomic(ownRecord, { ...before, stopped: reason });
  if (child.pid && child.exitCode === null && child.signalCode === null) {
    try { process.kill(-child.pid, 'SIGTERM'); } catch {}
    const pgid = -child.pid;
    forceKill = setTimeout(() => { try { process.kill(pgid, 'SIGKILL'); } catch {} }, 1500);
  }
}
async function cleanProcessGroup() {
  if (!child.pid) return;
  const pgid = -child.pid;
  const alive = () => { try { process.kill(pgid, 0); return true; } catch { return false; } };
  if (!alive()) return;
  if (!stopped) stopped = 'Child processes outlived the command';
  try { process.kill(pgid, 'SIGTERM'); } catch {}
  await new Promise(resolve => setTimeout(resolve, 1500));
  // A group can survive its leader. Do not use child.exitCode here and do not
  // release the research lock while a retained child may still be computing.
  if (alive()) { try { process.kill(pgid, 'SIGKILL'); } catch {} }
}
function sample() {
  try {
    const now = memory();
    const all = parseProcesses(command('/bin/ps', ['-axo', 'pid,ppid,rss,pcpu,stat,comm']));
    if (!all.some(p => p.pid === process.pid)) throw Error('Incomplete process observation');
    const family = new Set([process.pid]);
    for (let changed = true; changed;) {
      changed = false;
      for (const p of all) if (family.has(p.ppid) && !family.has(p.pid)) { family.add(p.pid); changed = true; }
    }
    const rss = all.reduce((n, p) => n + (family.has(p.pid) ? p.rssBytes : 0), 0);
    peakRss = Math.max(peakRss, rss);
    const headroom = now.available - observationReserve;
    minimumHeadroom = Math.min(minimumHeadroom, headroom);
    if (now.boot !== before.boot || now.swapouts !== before.swapouts || now.pressure !== 1 ||
        rss > rssLimit || headroom < 2 * GiB)
      stop('Memory pressure / swap / variant RSS budget / 2 GiB headroom protection', true);
    atomic(resolve(output, `${label}-resources.json`), { ...now, backend, variant, h, entry, mode, measureNativeRss, tableBytes, rssLimit, deadlineMs, peakRss, minimumHeadroom, stopped, sampledAt: new Date().toISOString() });
  } catch (e) { stop(String(e), true); }
}
const interval = setInterval(sample, 500);
const deadline = setTimeout(() => stop('Research deadline'), deadlineMs);
process.on('SIGINT', () => stop('Interrupted'));
process.on('SIGTERM', () => stop('Interrupted'));
try { const status = await closed; await cleanProcessGroup(); sample(); process.exitCode = stopped ? 1 : status; }
finally { await cleanProcessGroup(); clearInterval(interval); clearTimeout(deadline); clearTimeout(forceKill); unlinkSync(lockPath); }
if (stopped) console.error(stopped);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();
