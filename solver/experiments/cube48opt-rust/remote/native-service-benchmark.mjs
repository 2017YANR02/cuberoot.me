#!/usr/bin/env node
// Linux-only acceptance harness. No local large-table execution, retry, resume,
// API configuration changes, or artifact promotion. The operator disables API
// admission first; each engine owns one process and one table until stdin EOF.
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { appendFileSync, closeSync, existsSync, fsyncSync, lstatSync, mkdirSync, openSync,
  readFileSync, readdirSync, statSync, unlinkSync, writeFileSync, writeSync } from 'node:fs';
import { cpus, hostname, release } from 'node:os';
import { basename, dirname, isAbsolute, resolve } from 'node:path';
import { createInterface } from 'node:readline';
import { fileURLToPath } from 'node:url';

const GiB = 1024 ** 3;
const TABLE_BYTES = 7_782_727_680;
const CORPUS_SHA = '92171d593d13982924ed16723f099bd771a873aaa2c30a0e08f319c86b75dcde';
const READY_URL = 'http://127.0.0.1:3001/v1/scramble/optimal-solve/ready';
const MOVES = /^(?:[URFDLB](?:2|')?)(?: [URFDLB](?:2|')?)*$/;
export const LIMITS = Object.freeze({ reserveBytes: 2 * GiB, startupAvailableBytes: TABLE_BYTES + 3 * GiB,
  treeRssBytes: TABLE_BYTES + GiB, sampleMs: 1000, bootMs: 300_000, requestMs: 180_000,
  taskMs: 30 * 60_000, fullPressureAvg10: 5, logBytes: 64 * 1024 ** 2 });
const digest = bytes => createHash('sha256').update(bytes).digest('hex');
const save = (file, value) => writeFileSync(file, JSON.stringify(value, null, 2) + '\n', { flag: 'wx' });
const append = (file, value) => appendFileSync(file, JSON.stringify(value) + '\n');
const boundedRead = (file, max = 8 * 1024 ** 2) => {
  const stat = lstatSync(file); assert(stat.isFile() && stat.size <= max, `Not a bounded regular file: ${file}`);
  return readFileSync(file);
};

export function parseArguments(argv) {
  const values = {};
  assert.equal(argv.length, 10, 'usage: native-service-benchmark.mjs --daemon ABS_MJS --store ABS_DIR --binary ABS_BIN --corpus ABS_JSON --out ABS_NEW_DIR');
  for (let i = 0; i < argv.length; i += 2) {
    const key = argv[i];
    assert(['--daemon', '--store', '--binary', '--corpus', '--out'].includes(key) && !Object.hasOwn(values, key));
    assert(isAbsolute(argv[i + 1]), 'Paths must be absolute'); values[key.slice(2)] = resolve(argv[i + 1]);
  }
  return values;
}

export function readCorpus(file) {
  const bytes = boundedRead(file), corpus = JSON.parse(bytes);
  assert.equal(corpus.schema, 'cuberoot.solver.wca-first100.v1'); assert.equal(corpus.cases.length, 100);
  assert.equal(corpus.corpusSha256, CORPUS_SHA);
  assert.equal(new Set(corpus.cases.map(row => row.id)).size, 100);
  for (const [i, row] of corpus.cases.entries()) {
    assert.equal(row.sourceLine, i + 1); assert(/^\d+$/.test(row.id) && MOVES.test(row.scramble));
  }
  assert.equal(digest(corpus.cases.map(row => `${row.id},${row.scramble}\n`).join('')), CORPUS_SHA);
  return { corpus, fileSha256: digest(bytes) };
}

function fileIdentity(file) {
  const stat = statSync(file, { bigint: true });
  return Object.fromEntries(['dev', 'ino', 'size', 'mtimeNs', 'ctimeNs'].map(key => [key, String(stat[key])]));
}

function resolveAssets(config) {
  const pointerBytes = boundedRead(resolve(config.store, 'current.json'));
  const pointer = JSON.parse(pointerBytes);
  assert.equal(pointer.schema, 'cuberoot.cubeopt-current/v1');
  assert(/^cubeopt-opt8-[a-zA-Z0-9._-]+$/.test(pointer.bundle), 'Expected an Opt8 bundle');
  const root = resolve(config.store, 'bundles', pointer.bundle);
  const manifestBytes = boundedRead(resolve(root, 'manifest.json')), manifest = JSON.parse(manifestBytes);
  assert.equal(manifest.schema, 'cuberoot.cubeopt-artifact/v1'); assert.equal(manifest.bundle, pointer.bundle);
  assert.equal(manifest.engine, 'rust-wasm', 'Baseline must be the current production Rust WASM bundle');
  assert.equal(manifest.variant, 'opt8'); assert.equal(manifest.protocol, 1);
  assert.equal(manifest.maxThreads, 4);
  assert.equal(manifest.files.table.path, 'h48prun31h8.dat'); assert.equal(manifest.files.table.bytes, TABLE_BYTES);
  assert.equal(manifest.files.snapshot.path, 'cube48opt8.small.bin'); assert.equal(manifest.files.snapshot.bytes, 818_008);
  const table = resolve(root, manifest.files.table.path), snapshot = resolve(root, manifest.files.snapshot.path);
  assert(lstatSync(table).isFile() && statSync(table).size === TABLE_BYTES);
  assert.equal(digest(boundedRead(snapshot)), manifest.files.snapshot.sha256);
  const binaryBytes = boundedRead(config.binary, 64 * 1024 ** 2);
  assert(binaryBytes.subarray(0, 4).equals(Buffer.from([127, 69, 76, 70])), 'Native candidate must be an ELF executable');
  assert(statSync(config.binary).mode & 0o111, 'Candidate is not executable');
  return { table, snapshot, tableIdentity: fileIdentity(table), snapshotIdentity: fileIdentity(snapshot),
    binaryIdentity: fileIdentity(config.binary), binarySha256: digest(binaryBytes),
    daemonSha256: digest(boundedRead(config.daemon, 32 * 1024 ** 2)),
    pointerSha256: digest(pointerBytes), manifestSha256: digest(manifestBytes), manifest, root };
}

function assertAssetsUnchanged(config, assets) {
  assert.equal(digest(boundedRead(resolve(config.store, 'current.json'))), assets.pointerSha256, 'Current pointer changed');
  assert.equal(digest(boundedRead(resolve(assets.root, 'manifest.json'))), assets.manifestSha256, 'Baseline manifest changed');
  assert.deepEqual(fileIdentity(assets.table), assets.tableIdentity, 'Table changed');
  assert.deepEqual(fileIdentity(assets.snapshot), assets.snapshotIdentity, 'Snapshot changed');
  assert.deepEqual(fileIdentity(config.binary), assets.binaryIdentity, 'Native candidate changed');
  assert.equal(digest(boundedRead(config.daemon, 32 * 1024 ** 2)), assets.daemonSha256, 'Daemon changed');
}

function processRows() {
  return readdirSync('/proc').filter(name => /^\d+$/.test(name)).flatMap(name => {
    try {
      const status = readFileSync(`/proc/${name}/status`, 'utf8');
      const stat = readFileSync(`/proc/${name}/stat`, 'utf8');
      const fields = stat.slice(stat.lastIndexOf(') ') + 2).split(' ');
      return [{ pid: Number(name), ppid: Number(fields[1]), group: Number(fields[2]),
        rssBytes: Number(status.match(/^VmRSS:\s+(\d+) kB/m)?.[1] ?? 0) * 1024,
        swapBytes: Number(status.match(/^VmSwap:\s+(\d+) kB/m)?.[1] ?? 0) * 1024,
        argv: readFileSync(`/proc/${name}/cmdline`, 'utf8').split('\0').filter(Boolean) }];
    } catch (error) { if (['ENOENT', 'ESRCH'].includes(error.code)) return []; throw error; }
  });
}

function treeRows(rows, root) {
  const ids = new Set([root]);
  for (let old = -1; old !== ids.size;) {
    old = ids.size;
    for (const row of rows) if (ids.has(row.ppid) || row.group === root) ids.add(row.pid);
  }
  return rows.filter(row => ids.has(row.pid));
}

function assertNoConflict(rows, binary, allowed = []) {
  const allow = new Set([process.pid, ...allowed]);
  const conflicts = rows.filter(row => !allow.has(row.pid) && row.argv.length && (
    row.argv[0] === binary
    || (/cube48opt|cubeopt-native/.test(basename(row.argv[0])) && row.argv.some(arg => /^solve(?:-h\d+|-h48|-opt10)?$/.test(arg)))
    || row.argv.slice(0, 4).some(arg => /(?:^|\/)(?:(?:solve-)?daemon|cubeopt-daemon|(?:native-service|production|rust-candidate)-benchmark|profile-rust)\.mjs$/.test(arg))
  ));
  assert.equal(conflicts.length, 0, `Another daemon or benchmark is active: ${conflicts.map(row => row.pid).join(', ')}`);
}

function systemSample() {
  const meminfo = readFileSync('/proc/meminfo', 'utf8'), vm = readFileSync('/proc/vmstat', 'utf8');
  const fields = Object.fromEntries([...meminfo.matchAll(/^(\w+):\s+(\d+) kB$/gm)].map(m => [m[1], Number(m[2]) * 1024]));
  assert(fields.MemAvailable > 0 && fields.MemTotal >= fields.MemAvailable);
  let fullPressureAvg10 = null;
  try {
    const pressure = readFileSync('/proc/pressure/memory', 'utf8').match(/^full avg10=([\d.]+)/m);
    assert(pressure, 'Malformed memory pressure data'); fullPressureAvg10 = Number(pressure[1]);
  } catch (error) { if (error.code !== 'ENOENT') throw error; }
  return { at: new Date().toISOString(), bootId: readFileSync('/proc/sys/kernel/random/boot_id', 'utf8').trim(),
    availableBytes: fields.MemAvailable, totalBytes: fields.MemTotal, swapFreeBytes: fields.SwapFree,
    swapTotalBytes: fields.SwapTotal, fullPressureAvg10,
    swapInPages: Number(vm.match(/^pswpin (\d+)$/m)?.[1]), swapOutPages: Number(vm.match(/^pswpout (\d+)$/m)?.[1]) };
}

async function admissionDisabled() {
  const response = await fetch(READY_URL, { signal: AbortSignal.timeout(2000), redirect: 'error', cache: 'no-store' });
  assert.equal(response.status, 200, 'Cannot verify API admission');
  const body = await response.json(); assert.equal(body.enabled, false, 'API CubeOpt admission must remain disabled');
  return body;
}

function assertResources(sample, rssBytes, startup = false) {
  assert(sample.availableBytes >= (startup ? LIMITS.startupAvailableBytes : LIMITS.reserveBytes), 'Insufficient MemAvailable');
  assert(rssBytes <= LIMITS.treeRssBytes, 'Process tree RSS exceeded limit');
  assert(sample.fullPressureAvg10 === null || sample.fullPressureAvg10 <= LIMITS.fullPressureAvg10, 'Memory pressure exceeded limit');
}

export function parseResult(line, id) {
  const fields = line.split('\t'); assert.equal(fields.length, 3, 'Malformed result');
  assert.equal(fields[0], id, 'Result ID mismatch'); assert(/^\d+$/.test(fields[1]), `Solver error: ${line}`);
  const length = Number(fields[1]), solution = fields[2];
  assert(length >= 0 && length <= 20); assert(solution === '' || MOVES.test(solution), 'Malformed solution');
  assert.equal(solution ? solution.split(' ').length : 0, length);
  return { id, length, solution };
}

async function runEngine(config, assets, cases, engine, taskStarted) {
  assertAssetsUnchanged(config, assets);
  const initial = systemSample(); assertResources(initial, 0, true); await admissionDisabled();
  assertNoConflict(processRows(), config.binary);
  const directory = resolve(config.out, engine); mkdirSync(directory);
  const resultsFd = openSync(resolve(directory, 'results.jsonl'), 'wx');
  const env = { ...process.env, CUBEOPT_ARTIFACT_DIR: config.store, CUBEOPT_THREADS: '4',
    CUBEOPT_PROTOCOL: 'tsv-v1', CUBEOPT_VARIANT: '8', CUBEOPT_SOLVE_THREADS: '1', CUBEOPT_SEARCH_THREADS: '4' };
  delete env.NODE_OPTIONS;
  delete env.CUBEOPT_VERIFY_TABLE;
  if (engine !== 'wasm') env.CUBEOPT_SIMD = engine;
  const executable = engine === 'wasm' ? process.execPath : config.binary;
  const args = engine === 'wasm' ? [config.daemon] : ['solve', assets.snapshot, assets.table, '8', '20', '0'];
  const started = performance.now();
  const child = spawn(executable, args, { env, detached: true, stdio: ['pipe', 'pipe', 'pipe'] });
  let failure = null, waiter = null, killTimer, pendingSample = Promise.resolve(), sampling = false;
  let peakTreeRssBytes = 0, logBytes = 0, closed = false, exitResult;
  const lines = [];
  const signal = kind => { try { process.kill(-child.pid, kind); } catch (error) { if (error.code !== 'ESRCH') throw error; } };
  const stop = error => {
    if (failure) return; failure = error;
    if (waiter) { waiter.reject(error); waiter = null; }
    if (child.pid && !closed) { signal('SIGTERM'); killTimer = setTimeout(() => signal('SIGKILL'), 1500); }
  };
  const exit = new Promise(resolveExit => {
    child.once('error', stop);
    child.once('close', (code, exitSignal) => {
      closed = true; exitResult = { pid: child.pid ?? null, code, signal: exitSignal, at: new Date().toISOString() };
      if (waiter) { waiter.reject(failure ?? Error('Solver exited before its response')); waiter = null; }
      resolveExit(exitResult);
    });
  });
  child.stdin.on('error', stop);
  const log = (file, text) => {
    try { logBytes += Buffer.byteLength(text); assert(logBytes <= LIMITS.logBytes, 'Log budget exceeded'); appendFileSync(resolve(directory, file), text); }
    catch (error) { stop(error); }
  };
  child.stderr.on('data', chunk => log('stderr.log', chunk));
  const reader = createInterface({ input: child.stdout });
  reader.on('line', line => {
    log('stdout.log', line + '\n');
    if (waiter) { const current = waiter; waiter = null; current.resolve(line); }
    else { lines.push(line); if (lines.length > 2) stop(Error('Unsolicited solver output')); }
  });
  const nextLine = timeout => {
    if (failure) return Promise.reject(failure);
    if (lines.length) return Promise.resolve(lines.shift());
    if (closed) return Promise.reject(Error('Solver is closed'));
    return new Promise((resolveLine, rejectLine) => {
      assert.equal(waiter, null);
      const timer = setTimeout(() => stop(Error(`Solver response timeout (${timeout}ms)`)), timeout);
      waiter = { resolve: line => { clearTimeout(timer); resolveLine(line); }, reject: error => { clearTimeout(timer); rejectLine(error); } };
    });
  };
  const sample = async () => {
    if (sampling) return; sampling = true;
    try {
      const rows = processRows(), tree = treeRows(rows, child.pid), current = systemSample();
      const rssBytes = tree.reduce((sum, row) => sum + row.rssBytes, 0); peakTreeRssBytes = Math.max(peakTreeRssBytes, rssBytes);
      append(resolve(directory, 'resources.jsonl'), { ...current, pid: child.pid, processIds: tree.map(row => row.pid),
        treeRssBytes: rssBytes, treeSwapBytes: tree.reduce((sum, row) => sum + row.swapBytes, 0),
        swapInDeltaPages: current.swapInPages - initial.swapInPages, swapOutDeltaPages: current.swapOutPages - initial.swapOutPages });
      assert.equal(current.bootId, initial.bootId, 'System boot changed'); assertResources(current, rssBytes);
      assertNoConflict(rows, config.binary, tree.map(row => row.pid));
      assert(performance.now() - taskStarted < LIMITS.taskMs, 'Task time limit exceeded');
      await admissionDisabled();
    } catch (error) { stop(error); }
    finally { sampling = false; }
  };
  const poll = () => { if (!sampling) pendingSample = sample(); };
  const timer = setInterval(poll, LIMITS.sampleMs);
  const interrupt = () => stop(Error('Benchmark interrupted'));
  process.once('SIGTERM', interrupt); process.once('SIGINT', interrupt);
  try {
    poll(); const readyLine = await nextLine(LIMITS.bootMs);
    assert.equal(readyLine, 'READY\t4'); if (failure) throw failure;
    const startupSeconds = (performance.now() - started) / 1000;
    save(resolve(directory, 'startup.json'), { pid: child.pid, engine, readyLine, startupSeconds, threads: 4 });
    const results = [];
    for (const item of cases) {
      const requestStarted = performance.now(), response = nextLine(LIMITS.requestMs);
      child.stdin.write(`${item.id}\t${item.scramble}\n`);
      const line = await response; if (failure) throw failure;
      const result = { ...parseResult(line, item.id), scramble: item.scramble, engine, pid: child.pid,
        wallSeconds: (performance.now() - requestStarted) / 1000, raw: line, independentlyReplayed: false };
      if (item.expectedLength !== undefined) assert.equal(result.length, item.expectedLength, 'Optimal length differs from WASM baseline');
      writeSync(resultsFd, JSON.stringify(result) + '\n'); fsyncSync(resultsFd); results.push(result);
      process.stderr.write(`[native-service-benchmark] ${engine} ${results.length}/100 ${result.wallSeconds.toFixed(6)}s\n`);
    }
    child.stdin.end();
    const eofTimer = setTimeout(() => stop(Error('Solver did not exit after EOF')), 15_000);
    try { await exit; } finally { clearTimeout(eofTimer); }
    clearInterval(timer); await pendingSample;
    if (failure) throw failure;
    assert.equal(exitResult.code, 0); assert.equal(exitResult.signal, null);
    assert.equal(treeRows(processRows(), child.pid).length, 0, 'Solver left descendants alive');
    assertAssetsUnchanged(config, assets);
    const report = { engine, pid: child.pid, cases: results.length, threads: 4, startupSeconds,
      totalWallSeconds: results.reduce((sum, row) => sum + row.wallSeconds, 0), peakTreeRssBytes,
      processExited: true, independentReplay: false, measuredPasses: 1, warmupCases: 0 };
    save(resolve(directory, 'report.json'), report);
    return { report, results };
  } catch (error) {
    stop(error); save(resolve(directory, 'failure.json'), { at: new Date().toISOString(), error: String(error.stack ?? error), partialResultsPreserved: true });
    throw error;
  } finally {
    clearInterval(timer); await pendingSample;
    if (!closed) { signal('SIGTERM'); const force = setTimeout(() => signal('SIGKILL'), 1500); await exit; clearTimeout(force); }
    // Also terminate any reparented child in the detached process group.
    if (child.pid && treeRows(processRows(), child.pid).length) signal('SIGKILL');
    clearTimeout(killTimer); closeSync(resultsFd); reader.close();
    process.off('SIGTERM', interrupt); process.off('SIGINT', interrupt);
    save(resolve(directory, 'exit.json'), { ...exitResult, remainingPids: treeRows(processRows(), child.pid).map(row => row.pid) });
  }
}

export async function main(argv = process.argv.slice(2)) {
  assert.equal(process.platform, 'linux', 'Linux only: local Mac large-table tasks must use guard.mts');
  assert.equal(process.arch, 'x64', 'AVX acceptance requires x86-64');
  const config = parseArguments(argv); assert(!existsSync(config.out), 'Output must be new; no automatic resume');
  mkdirSync(dirname(config.out), { recursive: true });
  const lock = resolve(dirname(config.out), '.opt8-production-benchmark.lock'), lockFd = openSync(lock, 'wx');
  writeSync(lockFd, JSON.stringify({ pid: process.pid, out: config.out }) + '\n'); fsyncSync(lockFd);
  const started = performance.now();
  try {
    mkdirSync(config.out);
    const assets = resolveAssets(config), { corpus, fileSha256 } = readCorpus(config.corpus);
    const input = { schema: 'cuberoot.opt8.native-service-benchmark-input.v1', config, assets,
      corpusSha256: CORPUS_SHA, corpusFileSha256: fileSha256, cases: corpus.cases, limits: LIMITS,
      engineOrder: ['wasm', 'avx2', 'avx512'], warmupCases: 0, measuredPasses: 1,
      sourceSha256: digest(readFileSync(fileURLToPath(import.meta.url))),
      machine: { hostname: hostname(), platform: process.platform, arch: process.arch, osRelease: release(),
        cpuModel: cpus()[0]?.model ?? null, logicalCpus: cpus().length, node: process.version },
      measurement: 'Monotonic external request-to-response wall time; startup separately measured; each engine remains resident for all 100 requests.',
      limitations: ['One fixed-order pass; cache and thermal drift are not estimated.', 'Independent solution replay must be completed before deployment acceptance.'] };
    save(resolve(config.out, 'input.json'), input);
    const engines = {};
    const baseline = await runEngine(config, assets, corpus.cases, 'wasm', started); engines.wasm = baseline.report;
    const cases = corpus.cases.map((row, i) => ({ ...row, expectedLength: baseline.results[i].length }));
    for (const engine of ['avx2', 'avx512']) engines[engine] = (await runEngine(config, assets, cases, engine, started)).report;
    const report = { schema: 'cuberoot.opt8.native-service-benchmark-report.v1', complete: true,
      engines, lengthMatches: 300, independentReplay: false, corpusSha256: CORPUS_SHA,
      wasmOverAvx2: engines.wasm.totalWallSeconds / engines.avx2.totalWallSeconds,
      wasmOverAvx512: engines.wasm.totalWallSeconds / engines.avx512.totalWallSeconds,
      machine: input.machine, limitations: input.limitations };
    save(resolve(config.out, 'report.json'), report); console.log(JSON.stringify(report, null, 2));
  } catch (error) {
    if (existsSync(config.out)) save(resolve(config.out, 'failure.json'), { at: new Date().toISOString(), error: String(error.stack ?? error), partialResultsPreserved: true });
    throw error;
  } finally { closeSync(lockFd); unlinkSync(lock); }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch(error => { console.error(error); process.exitCode = 1; });
}
