/** Backend-budgeted research. Shares the previous experiment's swap stop record. */
import { existsSync, mkdirSync, readFileSync, writeFileSync, renameSync, openSync, closeSync, unlinkSync, fstatSync, readSync, lstatSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { execFileSync, spawn } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { availableParallelism } from 'node:os';
import { parseVm, memorySummary, parseProcesses } from '../../../core/scripts/mac-system-recorder.mts';
import { parseWasmBenchmarkArguments } from './wasm-benchmark.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '../../..');
const native = resolve(here, 'target/release/cube48opt-research');
const zbllNative = resolve(here, 'target/zbll/release/cube48opt-research');
const opt10Native = resolve(here, 'target/opt10/release/cube48opt-research');
const opt10Small = resolve(root, '.tmp/cubeopt-reverse/opt9-generated/small-memory.bin');
const opt10Table = resolve(root, '.tmp/cubeopt-reverse/opt10-generated/cuberoot-opt10.dat');
const opt10Proof = resolve(root, '.tmp/cubeopt-reverse/opt10-generation-validation.json');
const opt10PayloadBytes = 31_130_910_720;
const opt10FileBytes = opt10PayloadBytes + 1024;
const opt10ProofSources = ['src/opt10_generate.rs', 'src/opt10.rs', 'src/opt10_table.rs', 'src/coord.rs', 'src/cube.rs'];
const digest = (bytes: Buffer) => createHash('sha256').update(bytes).digest('hex');
const GiB = 2 ** 30, MiB = 2 ** 20;

/** Pure protocol validation. Tests never need to observe memory or open a PDB. */
export function researchPolicy(label: string, executable: string, args: string[], env: NodeJS.ProcessEnv = process.env) {
if (env.CUBEOPT_BACKEND === 'opt10' || ['generate-opt10', 'solve-opt10'].includes(args[0]) || resolve(executable) === opt10Native) {
  const generation = args[0] === 'generate-opt10';
  if (!/^[a-z0-9-]+$/.test(label) || resolve(executable) !== opt10Native || env.CUBEOPT_BACKEND !== 'opt10'
      || env.CUBEOPT_VARIANT !== undefined || env.CUBEOPT_H !== undefined || env.CUBEOPT_BENCHMARK !== undefined
      || ![undefined, '1'].includes(env.CUBEOPT_SOLVE_THREADS)
      || ![undefined, '0', '1'].includes(env.CUBEOPT_MEASURE_RSS)
      || resolve(args[1] ?? '') !== opt10Small || resolve(args[2] ?? '') !== opt10Table
      || (generation ? args.length !== 4 || args[3] !== '16' || env.CUBEOPT_MEASURE_RSS === '1'
        : args[0] !== 'solve-opt10' || args.length !== 6 || args[3] !== '8' || args[4] !== '20' || args[5] !== '0'))
    throw Error('Opt10 requires the dedicated binary, canonical Opt9 snapshot/new Opt10 table, explicit backend and fixed generation/solve arguments');
  return {entry:'native',mode:args[0],backend:'opt10',variant:null,h:null,tablePath:opt10Table,
    tableBytes:opt10FileBytes,measureNativeRss:env.CUBEOPT_MEASURE_RSS === '1',
    rssLimit:opt10PayloadBytes+GiB,deadlineMs:(generation?6:1)*60*60_000};
}
if (resolve(executable) === resolve(here, 'target/release/examples/verify_opt10_generation')) {
  const small = resolve(root, '.tmp/cubeopt-reverse/opt9-generated/small-memory.bin');
  const table = resolve(root, '.tmp/cubeopt-reverse/opt1-generated/h48prun01.dat');
  if (!/^[a-z0-9-]+$/.test(label) || args.length !== 4 || args[0] !== '--verify-opt1'
      || resolve(args[1] ?? '') !== small || resolve(args[2] ?? '') !== table || args[3] !== '16'
      || env.CUBEOPT_BACKEND !== 'opt10-verify' || env.CUBEOPT_VARIANT !== '1'
      || env.CUBEOPT_H !== undefined || env.CUBEOPT_MEASURE_RSS !== undefined
      || env.CUBEOPT_BENCHMARK !== undefined || env.CUBEOPT_SOLVE_THREADS !== undefined)
    throw Error('Opt10 generator verification permits only the canonical Opt1 table, Opt9 small snapshot and sixteen threads');
  return {entry:'opt10-verify',mode:'verify-opt1',backend:'opt10-verify',variant:1,h:null,
    tablePath:null,tableBytes:30_401_280,measureNativeRss:false,rssLimit:512*MiB,deadlineMs:60*60_000};
}
if (executable === process.execPath && resolve(args[0] ?? '') === resolve(here, 'wasm-benchmark.mjs')) {
  const config = parseWasmBenchmarkArguments(args.slice(1));
  if (!/^[a-z0-9-]+$/.test(label) || env.CUBEOPT_BACKEND !== 'opt'
      || env.CUBEOPT_VARIANT !== String(config.variant) || env.CUBEOPT_H !== undefined
      || ![undefined, '1'].includes(env.CUBEOPT_SOLVE_THREADS)
      || env.CUBEOPT_MEASURE_RSS !== undefined || env.CUBEOPT_BENCHMARK !== undefined)
    throw Error('WASM comparison requires matching Opt8/9, one thread and the fixed sequential WCA100 protocol');
  const tableBytes = 30_401_280 * 2 ** config.variant;
  // Original WASM retains a table/16 frontier plus its fast-move allocation;
  // both workers run sequentially. Reserve another GiB for runtime and parent.
  return { entry:'wasm-benchmark.mjs', mode:'single-pass', backend:'opt', variant:config.variant,
    h:null, tablePath:null, tableBytes, measureNativeRss:false,
    rssLimit:tableBytes + tableBytes / 16 + 19_208_560 + GiB, deadlineMs:60*60_000 };
}
// User-authorized H9-only generation through the repository's sole generator.
if (resolve(executable) === resolve(root, 'solver/target/release/table_generator')) {
  if (!/^[a-z0-9-]+$/.test(label) || args.length !== 2 || args[0] !== '--only' || args[1] !== 'h48-h9'
      || env.CUBEOPT_BACKEND !== 'h9gen' || env.CUBEOPT_H !== undefined
      || env.CUBE_TABLE_DIR !== resolve(root, 'solver/tables') || env.RAYON_NUM_THREADS !== '16'
      || env.CUBEOPT_MEASURE_RSS !== undefined || env.CUBEOPT_BENCHMARK !== undefined)
    throw Error('Only guarded H9 generation with the canonical table directory and sixteen threads is authorized');
  return {entry:'generator',mode:'generate',backend:'h9gen',variant:null,h:9,tablePath:null,
    tableBytes:h48FileBytes(9),measureNativeRss:false,rssLimit:h48FileBytes(9)+2*GiB,deadlineMs:6*60*60_000};
}
if (!label || !/^[a-z0-9-]+$/.test(label) || !executable ||
    !([native, zbllNative].includes(resolve(executable)) || executable === process.execPath &&
      ['oracle.mjs', 'validate.mjs', 'benchmark.mjs', 'verify-coordinates.mjs', 'verify-h10.mjs', 'validate-h10.mjs', 'h10-benchmark.mjs', 'zbll-benchmark.mjs'].includes(args[0]?.split('/').at(-1) ?? '') &&
      resolve(args[0]) === resolve(here, args[0]?.split('/').at(-1) ?? '')))
  throw Error('Use guard.mts LABEL <native-binary | node oracle.mjs | node validate.mjs | node benchmark.mjs> [args]');
const entry = [native, zbllNative].includes(resolve(executable)) ? 'native' : args[0].split('/').at(-1);
const mode = entry === 'native' ? args[0] : args[1];
const solveThreads = env.CUBEOPT_SOLVE_THREADS ?? '1';
if (!/^[1-9][0-9]*$/.test(solveThreads) || Number(solveThreads) > availableParallelism())
  throw Error('Invalid CUBEOPT_SOLVE_THREADS: exceeds available CPU threads');
const backend = env.CUBEOPT_BACKEND ?? 'opt';
if (!['opt', 'h10', 'h48'].includes(backend)) throw Error('CUBEOPT_BACKEND must be opt, h10 or h48');
const h48Entry = entry === 'native' && ['solve-h48', 'query-h48'].includes(mode);
const benchmarkMode = env.CUBEOPT_BENCHMARK ?? '0';
if (!['0', '1'].includes(benchmarkMode) || benchmarkMode === '1' && !(h48Entry && mode === 'solve-h48'))
  throw Error('CUBEOPT_BENCHMARK=1 is only supported for guarded native H48 solves');
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
  : ['verify-h10.mjs', 'validate-h10.mjs', 'h10-benchmark.mjs', 'zbll-benchmark.mjs'].includes(entry ?? '');
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
const zbllBatch = entry === 'native' && resolve(executable) === zbllNative && backend === 'h10' && mode === 'solve-h10';
const deadlineMs = zbllBatch ? 2 * 60 * 60_000 : mode === 'generate' ? 6 * 60 * 60_000
  : benchmarkMode === '1' ? 60 * 60_000
  : ['benchmark.mjs', 'validate.mjs', 'h10-benchmark.mjs', 'verify-h10.mjs', 'validate-h10.mjs', 'zbll-benchmark.mjs'].includes(entry ?? '') ? 60 * 60_000 : 10 * 60_000;
return { entry, mode, backend, variant, h, tablePath, tableBytes, measureNativeRss, rssLimit, deadlineMs };
}

export function h48FileBytes(h: number): number {
  if (!Number.isInteger(h) || h < 0 || h > 10) throw Error('H11 execution is prohibited; expected H0 through H10');
  return 64 * Math.ceil((3393 * 34650 * 2 ** h) / 254) + 2_060_648;
}

/** Small, complete proof for the current generator; never reads or allocates a PDB. */
export function validateOpt10GenerationProof(proof: any, sourceHashes: Record<string,string>, current?: {boot:string;swapouts:number}) {
  const result = proof?.result, resource = proof?.resources;
  if (proof?.schema !== 'cuberoot.opt10.generation-proof.v1' || proof.exitCode !== 0
      || result?.schema !== 'cuberoot.opt10.opt1-generation-validation.v1' || result.sharedGenerator !== true
      || result.projectionEoBits !== 0 || result.base !== 7 || result.completedDepth !== 9 || result.threads !== 16
      || result.comparedValidCells !== 117_567_450 || result.differences !== 0 || result.allEqual !== true || result.tableWritten !== false
      || !Array.isArray(result.distribution) || result.distribution.length !== 11
      || result.distribution.some((n: unknown) => !Number.isSafeInteger(n) || Number(n) < 0)
      || result.distribution.reduce((sum:number,n:number)=>sum+n,0) !== 117_567_450
      || resource?.backend !== 'opt10-verify' || resource.variant !== 1 || resource.mode !== 'verify-opt1'
      || resource.stopped !== '' || resource.pressure !== 1 || typeof resource.boot !== 'string'
      || !Number.isSafeInteger(resource.swapouts) || resource.swapouts < 0
      || !Number.isFinite(resource.peakRss) || resource.peakRss <= 0 || resource.peakRss > 512*MiB
      || !Number.isFinite(resource.minimumHeadroom) || resource.minimumHeadroom < 2*GiB)
    throw Error('Opt10 requires a successful full Opt1 generator validation with zero differences and intact resource protection');
  for (const name of opt10ProofSources) {
    if (!/^[a-f0-9]{64}$/.test(proof.sourceSha256?.[name] ?? '') || proof.sourceSha256[name] !== sourceHashes[name])
      throw Error(`Opt10 generator changed since its full Opt1 validation: ${name}`);
  }
  if (current && (resource.boot !== current.boot || resource.swapouts !== current.swapouts))
    throw Error('Opt10 validation boot/swap baseline changed; cannot reset');
}

/** Fixed-size header validation rejects a renamed H/Opt table before mapping. */
export function validateOpt10Metadata(fileBytes: number, header: Buffer, snapshotSha256: string) {
  if (fileBytes !== opt10FileBytes || header.length !== 1024)
    throw Error(`Opt10 requires exactly ${opt10FileBytes} file bytes and a 1024-byte header`);
  const u32 = (at:number) => header.readUInt32LE(at), u64 = (at:number) => header.readBigUInt64LE(at);
  const validEntries = BigInt(3393*70*495*1024);
  if (!header.subarray(0,16).equals(Buffer.from('CBRT-OPT10-PDB\0\0'))
      || u32(16)!==1 || u32(20)!==1024 || u32(24)!==10 || u32(28)!==1
      || u64(32)!==BigInt(opt10PayloadBytes)*4n || u64(40)!==validEntries || u64(48)!==BigInt(opt10PayloadBytes)
      || header[56]!==10 || header[57]!==13 || header[58]<12 || header[58]>20 || header[59]!==1 || u64(64)!==818008n
      || header.subarray(72,104).toString('hex')!==snapshotSha256
      || digest(header.subarray(0,992))!==header.subarray(992).toString('hex')
      || [...header.subarray(60,64),...header.subarray(136,160),...header.subarray(288,992)].some(n=>n!==0))
    throw Error('Opt10 header does not match its completed EO10 format or snapshot');
  const distribution = Array.from({length:16},(_,index)=>u64(160+index*8));
  if (distribution.reduce((sum,n)=>sum+n,0n)!==validEntries || distribution.slice(14).some(n=>n!==0n))
    throw Error('Opt10 header has invalid distribution coverage');
  return fileBytes;
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
let generationProof: any;
if (backend === 'opt10') {
  // Normalize the paths validated in the caller's cwd before spawning at root.
  args[1] = opt10Small; args[2] = opt10Table;
  if (!lstatSync(opt10Small).isFile() || lstatSync(opt10Small).size !== 818_008)
    throw Error('Opt10 requires its canonical regular 818008-byte Opt9 snapshot');
  const sourceHashes = Object.fromEntries(opt10ProofSources.map(name=>[name,digest(readFileSync(resolve(here,name)))]));
  generationProof = JSON.parse(readFileSync(opt10Proof,'utf8'));
  validateOpt10GenerationProof(generationProof,sourceHashes);
  if (mode === 'generate-opt10') {
    if (existsSync(opt10Table) || existsSync(opt10Table+'.partial'))
      throw Error('Opt10 output or partial already exists; refusing to overwrite');
  } else {
    if (!lstatSync(opt10Table).isFile()) throw Error('Opt10 table must be a regular file, not a symlink');
    const fd = openSync(opt10Table,'r');
    try {
      const header = Buffer.alloc(1024);
      if (readSync(fd,header,0,header.length,0)!==1024) throw Error('Truncated Opt10 header');
      tableBytes = validateOpt10Metadata(fstatSync(fd).size,header,digest(readFileSync(opt10Small)));
    } finally { closeSync(fd); }
  }
}
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
if (generationProof) {
  const sourceHashes = Object.fromEntries(opt10ProofSources.map(name=>[name,digest(readFileSync(resolve(here,name)))]));
  validateOpt10GenerationProof(generationProof,sourceHashes,before);
}
if (process.env.AUF_EXPECTED_BOOT !== undefined && (process.env.AUF_EXPECTED_BOOT !== before.boot || Number(process.env.AUF_EXPECTED_SWAPOUTS) !== before.swapouts))
  throw Error('Long-job boot/swap baseline changed; cannot reset');
const otherComputations = command('/bin/ps', ['-axo', 'pid,comm']).split('\n')
  .filter(line => /solve_h48_h10|cube48opt-research|table_generator/.test(line));
if (otherComputations.length) throw Error('Another native computation is running: ' + otherComputations.join('; '));
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
const child = spawn(measureNativeRss ? '/usr/bin/time' : executable,
  measureNativeRss ? ['-l', executable, ...args] : args,
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
