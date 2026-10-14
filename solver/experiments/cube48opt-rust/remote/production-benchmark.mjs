#!/usr/bin/env node
// Linux production acceptance only. This entry never opens or changes a local
// Mac guard lock/baseline; it cannot run on macOS. No retries or implicit resume.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { constants, copyFileSync, existsSync, fsyncSync, lstatSync, mkdirSync, openSync,
  closeSync, readFileSync, readdirSync, realpathSync, statfsSync, statSync, unlinkSync, writeFileSync, writeSync } from 'node:fs';
import { basename, dirname, isAbsolute, resolve } from 'node:path';
import { cpus, hostname, release } from 'node:os';
import { fileURLToPath } from 'node:url';
import { readWca100, sharedBuildSources, startSession, wasmBuildContract } from '../wasm-benchmark.mjs';
import { getVariant } from '../variants.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const GiB = 1024 ** 3;
const TABLE_SHA = '0c742e0ad31d2c6bb428ae8658fa0fe88ffe2f7ac09072dbc3eaab8fcad850f1';
const SMALL_SHA = '90c95b69404f00858e32529f83daa985d0c377a745b288a5d0fd4261cf3e6dbd';
const READY_URL = 'http://127.0.0.1:3001/v1/scramble/optimal-solve/ready';
export const LIMITS = Object.freeze({ reserveBytes: 2 * GiB, maxTreeRssBytes: 7782727680 + GiB,
  sampleMs: 1000, maxSessionMs: 30 * 60_000, maxFullPressureAvg10: 5 });
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const save = (path, value) => writeFileSync(path, JSON.stringify(value, null, 2) + '\n', { flag: 'wx' });

export function parseArguments(argv) {
  assert.equal(argv.length, 4, 'usage: production-benchmark.mjs --fixture-input ABS_JSON --out ABS_NEW_DIR');
  const values = {};
  for (let i = 0; i < argv.length; i += 2) {
    assert(['--fixture-input', '--out'].includes(argv[i]) && !Object.hasOwn(values, argv[i]));
    assert(isAbsolute(argv[i + 1]), 'All paths must be absolute'); values[argv[i]] = argv[i + 1];
  }
  assert(values['--fixture-input'] && values['--out']);
  return { fixture: values['--fixture-input'], out: values['--out'] };
}

function descriptor(value, expectedBytes = null, expectedHash = null) {
  assert(value && isAbsolute(value.path) && /^[a-f0-9]{64}$/.test(value.sha256));
  assert(Number.isSafeInteger(value.bytes) && value.bytes > 0);
  if (expectedBytes !== null) assert.equal(value.bytes, expectedBytes);
  if (expectedHash !== null) assert.equal(value.sha256, expectedHash);
  const stat = lstatSync(value.path); assert(stat.isFile() && stat.size === value.bytes, `Invalid asset: ${value.path}`);
  assert.equal(realpathSync(value.path), value.path, 'Use canonical asset paths');
  return stat;
}
function smallAsset(value, expectedBytes = null, expectedHash = null) {
  descriptor(value, expectedBytes, expectedHash); assert(value.bytes <= 8 * 1024 ** 2, 'Only small assets may be read here');
  const bytes = readFileSync(value.path); assert.equal(hash(bytes), value.sha256, `Asset changed: ${value.path}`); return bytes;
}

export function parseMemory(meminfo, pressure = null) {
  const fields = Object.fromEntries([...meminfo.matchAll(/^(\w+):\s+(\d+) kB$/gm)].map(m => [m[1], Number(m[2]) * 1024]));
  assert(fields.MemAvailable > 0 && fields.MemTotal >= fields.MemAvailable, 'MemAvailable is required');
  const full = pressure === null ? null : pressure.match(/^full avg10=([\d.]+) avg60=([\d.]+) avg300=([\d.]+) total=(\d+)$/m);
  assert(pressure === null || full, 'Malformed /proc/pressure/memory full-pressure data');
  return { availableBytes: fields.MemAvailable, totalBytes: fields.MemTotal,
    swapTotalBytes: fields.SwapTotal, swapFreeBytes: fields.SwapFree,
    pressureMetricUnavailable: pressure === null,
    fullPressureAvg10: full ? Number(full[1]) : null, fullPressureTotalUs: full ? Number(full[4]) : null };
}
function processes() {
  return readdirSync('/proc').filter(name => /^\d+$/.test(name)).flatMap(name => {
    try {
      const status = readFileSync(`/proc/${name}/status`, 'utf8');
      const procStat = readFileSync(`/proc/${name}/stat`, 'utf8');
      const fields = procStat.slice(procStat.lastIndexOf(') ') + 2).split(' ');
      return [{ pid: Number(name), ppid: Number(status.match(/^PPid:\s+(\d+)/m)?.[1]),
        processGroup: Number(fields[2]),
        rssBytes: Number(status.match(/^VmRSS:\s+(\d+) kB/m)?.[1] ?? 0) * 1024,
        command: readFileSync(`/proc/${name}/cmdline`, 'utf8').replaceAll('\0', ' ') }];
    } catch (error) { if (['ENOENT', 'ESRCH'].includes(error.code)) return []; throw error; }
  });
}
export function descendants(rows, root) {
  const ids = new Set([root]);
  for (let previous = -1; previous !== ids.size;) { previous = ids.size; for (const row of rows) if (ids.has(row.ppid)) ids.add(row.pid); }
  return rows.filter(row => ids.has(row.pid));
}
function benchmarkTree(rows, root) {
  const ids = new Set(descendants(rows, root).map(row => row.pid));
  return rows.filter(row => ids.has(row.pid) || row.processGroup === root);
}
export function conflictingProcesses(rows, ownPid, allowedIds = []) {
  const allowed = new Set([ownPid, ...allowedIds]);
  return rows.filter(row => !allowed.has(row.pid)
    && /(?:cubeopt-daemon|cubeopt\/(?:solve-)?daemon\.mjs|production-benchmark\.mjs|rust-candidate-benchmark\.mjs|profile-rust\.mjs|wasm-benchmark\.mjs\s+--worker)/.test(row.command)
    && !/^(?:[^ ]*\/?(?:bash|sh|zsh)\s+-c)\b/.test(row.command));
}
function systemSample() {
  const vm = readFileSync('/proc/vmstat', 'utf8');
  let pressure = null;
  try { pressure = readFileSync('/proc/pressure/memory', 'utf8'); }
  catch (error) { if (error.code !== 'ENOENT') throw error; }
  return { at: new Date().toISOString(), bootId: readFileSync('/proc/sys/kernel/random/boot_id', 'utf8').trim(),
    ...parseMemory(readFileSync('/proc/meminfo', 'utf8'), pressure),
    swapInPages: Number(vm.match(/^pswpin (\d+)$/m)?.[1]), swapOutPages: Number(vm.match(/^pswpout (\d+)$/m)?.[1]) };
}
async function admissionDisabled() {
  const response = await fetch(READY_URL, { signal: AbortSignal.timeout(2000), cache: 'no-store', redirect: 'error' });
  assert.equal(response.status, 200, 'Cannot verify API admission state');
  const state = await response.json();
  assert.equal(state.enabled, false, 'API CubeOpt admission was restored during benchmark');
  assert.equal(state.ready, false, 'API CubeOpt daemon became resident during benchmark');
  return state;
}
export function assertResources(sample, rssBytes, startup = false) {
  assert(sample.availableBytes >= LIMITS.reserveBytes + (startup ? LIMITS.maxTreeRssBytes : 0), 'Insufficient MemAvailable');
  if (sample.pressureMetricUnavailable) assert.equal(sample.fullPressureAvg10, null, 'Unavailable PSI must not be represented as zero');
  else assert(Number.isFinite(sample.fullPressureAvg10) && sample.fullPressureAvg10 <= LIMITS.maxFullPressureAvg10, 'System memory pressure exceeded limit');
  assert(rssBytes <= LIMITS.maxTreeRssBytes, 'Benchmark process tree RSS exceeded limit');
}

export function prepare(fixturePath, out) {
  const fixtureBytes = readFileSync(fixturePath); assert(fixtureBytes.length <= 1024 ** 2);
  const fixture = JSON.parse(fixtureBytes); assert.equal(fixture.schema, 'cuberoot.opt8.production-benchmark-fixture.v1');
  assert.equal(fixture.variant, 8); assert.equal(fixture.threads, 4);
  assert.equal(fixture.warmupCases, 0); assert.equal(fixture.measuredPasses, 1);
  assert.deepEqual(fixture.engineOrder, ['original', 'rust']);
  const variant = getVariant(8);
  const tableBefore = descriptor(fixture.table, variant.tableBytes, TABLE_SHA);
  smallAsset(fixture.corpus); const corpus = readWca100(fixture.corpus.path);
  const reference = JSON.parse(smallAsset(fixture.referenceFirstPass)); assert.equal(reference.length, 100);
  const cases = corpus.cases.map((item, index) => {
    const row = reference[index]; assert.equal(row.id, `r0_${item.id}`); assert.equal(row.cancelled, false);
    assert(Number.isSafeInteger(row.length) && row.length >= 0 && row.length <= 20);
    assert.equal(row.solution.trim().split(/\s+/).filter(Boolean).length, row.length);
    return { ...item, htm: row.length };
  });
  const rustBuild = JSON.parse(smallAsset(fixture.rustBuild));
  wasmBuildContract({ variant: 8, threads: 4 }, rustBuild); sharedBuildSources(rustBuild);
  const fixed = { original: { wrapper: ['cube48opt8.mjs', null, variant.wrapperSha256], wasm: ['cube48opt8.wasm', null, variant.wasmSha256] },
    rust: { wrapper: ['cube48opt-rust8.mjs', null, rustBuild.wrapperSha256], wasm: ['cube48opt-rust8.wasm', rustBuild.wasmBytes, rustBuild.wasmSha256],
      worker: ['cube48opt-rust8-worker.mjs', null, rustBuild.workerSha256], small: ['cube48opt8.small.bin', variant.smallMemoryBytes, SMALL_SHA] } };
  const artifacts = {};
  for (const [engine, roles] of Object.entries(fixed)) {
    assert.deepEqual(Object.keys(fixture.artifacts[engine]).sort(), Object.keys(roles).sort());
    artifacts[engine] = { files: {}, sha256: {} };
    const dir = resolve(out, 'artifacts', engine); mkdirSync(dir, { recursive: true });
    for (const [role, [name, size, sha]] of Object.entries(roles)) {
      const bytes = smallAsset(fixture.artifacts[engine][role], size, sha), destination = resolve(dir, name);
      writeFileSync(destination, bytes, { flag: 'wx' }); artifacts[engine].files[role] = destination; artifacts[engine].sha256[role] = sha;
    }
  }
  const sourceHashes = {};
  mkdirSync(resolve(out, 'source'));
  for (const file of [fileURLToPath(import.meta.url), resolve(HERE, '../wasm-benchmark.mjs'), resolve(HERE, '../variants.mjs')]) {
    sourceHashes[file] = hash(readFileSync(file)); copyFileSync(file, resolve(out, 'source', basename(file)), constants.COPYFILE_EXCL);
  }
  save(resolve(out, 'fixture-input.json'), fixture); save(resolve(out, 'cases-source.json'), corpus);
  save(resolve(out, 'reference-first-pass.json'), reference); save(resolve(out, 'rust-build-metadata.json'), rustBuild);
  const input = { schema: 'cuberoot.opt8.production-benchmark-input.v1', fixtureSha256: hash(fixtureBytes), variant: 8, threads: 4,
    cases, corpusSha256: corpus.corpusSha256, table: fixture.table.path, tableSha256: TABLE_SHA, tableBytes: variant.tableBytes,
    referenceSha256: fixture.referenceFirstPass.sha256, artifacts, sourceHashes, rustBuild,
    warmupCases: 0, measuredPasses: 1, engineOrder: ['original', 'rust'], resourceLimits: LIMITS,
    machine: { platform: process.platform, arch: process.arch, osRelease: release(), hostname: hostname(),
      cpuModel: cpus()[0]?.model ?? null, logicalCpus: cpus().length, node: process.version },
    method: 'Fresh sequential Linux processes; original then Rust; fixed WCA100 order once; no solve warmup or retries',
    measurement: 'Monotonic elapsed time around awaited solve_scramble(scramble,4,1,true); loading/checksum excluded' };
  return { input, tableBefore };
}

export function checkProfileStorage(directory) {
  const files = readdirSync(directory);
  let bytes = 0;
  for (const name of files) {
    assert(/^isolate-[0-9a-fx]+-\d+-v8\.log$/.test(name), 'Unexpected profiler output file');
    const stat = lstatSync(resolve(directory, name)); assert(stat.isFile(), 'Profiler output must be regular files'); bytes += stat.size;
  }
  // Same-run native disassembly goes to the ordinary solver stdout. It must
  // share the log budget, otherwise fixed-function dumps could fill the disk.
  for (const name of ['stdout.log', 'stderr.log']) {
    const file = resolve(dirname(directory), 'rust', name);
    if (existsSync(file)) { const stat = lstatSync(file); assert(stat.isFile()); bytes += stat.size; }
  }
  assert(bytes <= 512 * 1024 ** 2, 'Profiler log budget exceeded');
  const disk = statfsSync(directory); assert(disk.bavail * disk.bsize >= 2 * GiB, 'Insufficient profiler disk reserve');
  return { files: files.length, bytes };
}

export async function monitoredSession(inputFile, engine, out, input, { profileDirectory = null } = {}) {
  if (profileDirectory !== null) {
    assert.equal(input.schema, 'cuberoot.opt8.production-profile-input.v1');
    assert.equal(input.diagnostic, true); assert.equal(input.performanceEligible, false); assert.equal(engine, 'rust');
    assert.equal(input.profiling.logDirectory, profileDirectory); checkProfileStorage(profileDirectory);
  }
  const initial = systemSample(); assertResources(initial, 0, true);
  await admissionDisabled();
  assert.equal(conflictingProcesses(processes(), process.pid).length, 0, 'Another CubeOpt daemon or benchmark is active');
  const directory = resolve(out, engine), session = startSession(inputFile, engine, directory, { detached: true, profileDirectory });
  let samples, results;
  try {
    samples = openSync(resolve(directory, 'resources.jsonl'), 'wx'); results = openSync(resolve(directory, 'results.jsonl'), 'wx');
  } catch (error) {
    // A disk/permission failure immediately after spawn must not orphan the
    // detached solver. Attach to ready rejection before terminating it.
    session.ready.catch(() => {}); await session.close();
    if (samples !== undefined) closeSync(samples); if (results !== undefined) closeSync(results);
    throw error;
  }
  const started = performance.now(); let failure = null, peakTreeRssBytes = 0, killTimer, sampling = false;
  const stop = error => { if (failure) return; failure = error; session.terminate('SIGTERM'); killTimer = setTimeout(() => session.terminate('SIGKILL'), 1500); };
  const sample = async () => {
    if (sampling) return; sampling = true;
    try {
      const rows = processes(), tree = benchmarkTree(rows, session.pid), current = systemSample();
      const rssBytes = tree.reduce((sum, row) => sum + row.rssBytes, 0); peakTreeRssBytes = Math.max(peakTreeRssBytes, rssBytes);
      writeSync(samples, JSON.stringify({ ...current, swapInDeltaPages: current.swapInPages - initial.swapInPages,
        swapOutDeltaPages: current.swapOutPages - initial.swapOutPages,
        rootPid: session.pid, processIds: tree.map(row => row.pid), treeRssBytes: rssBytes }) + '\n');
      assert.equal(current.bootId, initial.bootId, 'Host boot changed'); assertResources(current, rssBytes);
      if (profileDirectory !== null) checkProfileStorage(profileDirectory);
      assert.equal(conflictingProcesses(rows, process.pid, tree.map(row => row.pid)).length, 0, 'Concurrent CubeOpt process appeared');
      assert(performance.now() - started < LIMITS.maxSessionMs, 'Session time limit exceeded');
      await admissionDisabled();
    } catch (error) { stop(error); }
    finally { sampling = false; }
  };
  let samplePending = Promise.resolve();
  const poll = () => { if (!sampling) samplePending = sample(); };
  const timer = setInterval(poll, LIMITS.sampleMs); poll();
  const interrupt = () => stop(Error('Benchmark interrupted')); process.once('SIGTERM', interrupt); process.once('SIGINT', interrupt);
  try {
    const ready = await session.ready; if (failure) throw failure;
    assert.equal(ready.threads, 4); assert.equal(ready.warmupCases, 0); save(resolve(directory, 'startup.json'), ready);
    if (profileDirectory !== null) {
      assert.equal(ready.profiler?.kind, 'v8-prof'); assert.equal(ready.profiler.pid, session.pid);
      assert.equal(ready.profiler.diagnostic, true); assert.equal(ready.profiler.performanceEligible, false);
      assert.deepEqual(ready.profiler.execArgv, input.profiling.nodeFlags);
    }
    const rows = [];
    for (const [index, item] of input.cases.entries()) {
      const result = await session.request(index); if (failure) throw failure;
      assert.equal(result.index, index); assert.equal(result.id, item.id); assert.equal(result.threads, 4);
      assert(Number.isFinite(result.seconds) && result.seconds >= 0);
      assert.equal(result.length, item.htm); assert.equal(result.solution.split(/\s+/).filter(Boolean).length, item.htm);
      assert(/^(?:[URFDLB](?:2|')?(?:\s+|$))*$/.test(result.solution));
      const row = { ...result, expectedLength: item.htm, optimalLengthMatched: true, independentlyReplayed: false };
      rows.push(row); writeSync(results, JSON.stringify(row) + '\n'); fsyncSync(results);
      process.stderr.write(`[production-benchmark] ${engine} ${index + 1}/100 ${result.seconds.toFixed(6)}s\n`);
    }
    const resource = await session.finish(); clearInterval(timer); await samplePending; if (failure) throw failure;
    const exit = await session.exit; assert.equal(exit.code, 0); assert.equal(exit.signal, null);
    assert.equal(benchmarkTree(processes(), session.pid).length, 0, 'Benchmark descendants survived child exit');
    save(resolve(directory, 'exit.json'), { ...exit, finishedAt: new Date().toISOString() });
    const report = { engine, cases: 100, threads: 4, measuredPasses: 1, warmupCases: 0, optimalLengthsMatched: 100,
      independentlyReplayed: false, totalSeconds: rows.reduce((sum, row) => sum + row.seconds, 0),
      peakRssBytes: resource.maxRssKiB * 1024, peakTreeRssBytes,
      peakRssMethod: 'Linux Node child resourceUsage.maxRSS KiB ×1024; worker threads share this PID; /proc descendants sampled separately',
      pressureMetricUnavailable: initial.pressureMetricUnavailable,
      linearMemoryBytes: resource.linearMemoryBytes, loadSeconds: ready.loadSeconds, processExited: true,
      artifacts: input.artifacts[engine] };
    if (profileDirectory !== null) {
      report.diagnostic = true; report.performanceEligible = false; report.profiler = ready.profiler;
    }
    if (engine === 'rust') {
      report.workerNodes = Array.from({ length: 4 }, (_, worker) => rows.reduce((sum, row) => sum + row.search.workers[worker], 0));
      assert(report.workerNodes.every(n => n > 0)); report.verifiedDepthBarriers = 100;
    }
    save(resolve(directory, 'report.json'), report); return report;
  } catch (error) {
    save(resolve(directory, 'failure.json'), { error: String((failure ?? error).stack ?? failure ?? error), at: new Date().toISOString() }); throw failure ?? error;
  } finally {
    clearInterval(timer); await samplePending; clearTimeout(killTimer); process.off('SIGTERM', interrupt); process.off('SIGINT', interrupt);
    await session.close(); fsyncSync(samples); closeSync(samples); closeSync(results);
    if (!existsSync(resolve(directory, 'exit.json'))) save(resolve(directory, 'exit.json'), { ...await session.exit, finishedAt: new Date().toISOString() });
  }
}

export async function main(argv = process.argv.slice(2)) {
  assert.equal(process.platform, 'linux', 'Production benchmark runs only on Linux; local Mac work must use guard.mts');
  const config = parseArguments(argv); assert(!existsSync(config.out), 'Refusing to overwrite or resume a previous run');
  mkdirSync(dirname(config.out), { recursive: true });
  // Persistent failure record + exclusive lock in the supplied staging parent.
  // Existing locks are never cleared or adopted automatically.
  const lock = resolve(dirname(config.out), '.opt8-production-benchmark.lock');
  const lockFd = openSync(lock, 'wx'); writeSync(lockFd, JSON.stringify({ pid: process.pid, out: config.out }) + '\n'); fsyncSync(lockFd);
  mkdirSync(config.out);
  try {
    const { input, tableBefore } = prepare(config.fixture, config.out), inputFile = resolve(config.out, 'input.json');
    save(inputFile, input);
    const engines = {};
    for (const engine of input.engineOrder) engines[engine] = await monitoredSession(inputFile, engine, config.out, input);
    const after = statSync(input.table);
    for (const key of ['dev', 'ino', 'size', 'mtimeMs']) assert.equal(after[key], tableBefore[key], `Table changed: ${key}`);
    const ratio = engines.original.totalSeconds / engines.rust.totalSeconds;
    const report = { schema: 'cuberoot.opt8.production-benchmark-report.v1', complete: true, inputSha256: hash(readFileSync(inputFile)),
      variant: 8, threads: 4, cases: 100, measuredPasses: 1, warmupCases: 0, engineOrder: input.engineOrder,
      corpusSha256: input.corpusSha256, tableSha256: input.tableSha256, machine: input.machine, artifacts: input.artifacts,
      method: input.method, measurement: input.measurement, engines,
      originalOverRustTotalRatio: ratio, rustFasterOnThisRun: ratio > 1, independentReplay: false,
      limitations: ['Independent solution replay must be completed from the retained raw output before deployment acceptance.',
        'Single-pass performance has no estimate of noise; both engines ran on this recorded Linux host with four threads.',
        'Remote swap follows host policy; this tool neither disables swap nor changes the local Mac guard baseline.'] };
    save(resolve(config.out, 'report.json'), report); process.stdout.write(JSON.stringify(report, null, 2) + '\n');
  } catch (error) { save(resolve(config.out, 'failure.json'), { at: new Date().toISOString(), error: String(error.stack ?? error), partialResultsPreserved: true }); throw error; }
  finally { closeSync(lockFd); unlinkSync(lock); }
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main().catch(error => { console.error(error); process.exitCode = 1; });
