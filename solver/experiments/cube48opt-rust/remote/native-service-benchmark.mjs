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
  admissionMs: 10_000, taskMs: 30 * 60_000, fullPressureAvg10: 5, logBytes: 64 * 1024 ** 2 });
const digest = bytes => createHash('sha256').update(bytes).digest('hex');
const save = (file, value) => writeFileSync(file, JSON.stringify(value, null, 2) + '\n', { flag: 'wx' });
const append = (file, value) => appendFileSync(file, JSON.stringify(value) + '\n');
const boundedRead = (file, max = 8 * 1024 ** 2) => {
  const stat = lstatSync(file); assert(stat.isFile() && stat.size <= max, `Not a bounded regular file: ${file}`);
  return readFileSync(file);
};

export function parseArguments(argv) {
  const values = {};
  assert([8, 10].includes(argv.length), 'usage: native-service-benchmark.mjs --store ABS_DIR --corpus ABS_JSON --out ABS_NEW_DIR (--daemon ABS_MJS --binary ABS_BIN | --candidates ABS_JSON)');
  for (let i = 0; i < argv.length; i += 2) {
    const key = argv[i];
    assert(['--daemon', '--store', '--binary', '--corpus', '--out', '--candidates'].includes(key) && !Object.hasOwn(values, key.slice(2)));
    assert(isAbsolute(argv[i + 1]), 'Paths must be absolute'); values[key.slice(2)] = resolve(argv[i + 1]);
  }
  assert(values.store && values.corpus && values.out, 'Store, corpus and output are required');
  assert(values.candidates ? !values.binary && !values.daemon : values.binary && values.daemon,
    'Choose the original WASM/SIMD comparison or an explicit native candidate plan');
  return values;
}

/** Validate metadata only; safe for local plan/verifier checks without loading binaries. */
export function validateCandidatePlan(plan) {
  if (plan?.schema === 'cuberoot.opt8.service-comparison/v1') return validateServiceComparisonPlan(plan);
  assert.equal(plan?.schema, 'cuberoot.opt8.native-candidates/v1');
  assert(Array.isArray(plan.passes) && plan.passes.length >= 2 && plan.passes.length <= 12);
  const labels = new Set(), candidates = new Map();
  for (const pass of plan.passes) {
    assert(pass && typeof pass.label === 'string' && /^[a-z0-9][a-z0-9_-]{0,63}$/.test(pass.label) && !labels.has(pass.label), 'Pass labels must be unique portable names');
    assert(typeof pass.candidate === 'string' && /^[a-z0-9][a-z0-9_-]{0,63}$/.test(pass.candidate), 'Candidate name is required');
    assert(typeof pass.binary === 'string' && isAbsolute(pass.binary) && resolve(pass.binary) === pass.binary);
    assert(['scalar', 'avx2', 'avx512'].includes(pass.simd), 'SIMD must be explicit');
    assert(/^[a-f0-9]{64}$/.test(pass.sha256), 'Pin every candidate binary SHA-256');
    const identity = { binary: pass.binary, simd: pass.simd, sha256: pass.sha256 };
    if (candidates.has(pass.candidate)) assert.deepEqual(identity, candidates.get(pass.candidate), 'A repeated candidate changed identity');
    else candidates.set(pass.candidate, identity);
    labels.add(pass.label);
  }
  assert.equal(plan.passes[0].candidate, 'baseline', 'The first pass must establish the baseline');
  assert(candidates.size >= 2, 'At least one distinct named candidate is required');
  assert(new Set([...candidates.values()].map(value => `${value.sha256}:${value.simd}`)).size >= 2,
    'Candidate plan must compare different executable hashes or explicit SIMD modes');
  return plan;
}

/** One pass per endpoint, historical WASM followed by deployed native. */
export function validateServiceComparisonPlan(plan) {
  assert.equal(plan?.schema, 'cuberoot.opt8.service-comparison/v1');
  const sha = value => assert(typeof value === 'string' && /^[a-f0-9]{64}$/.test(value));
  const path = value => assert(typeof value === 'string' && isAbsolute(value) && resolve(value) === value);
  path(plan.wasm.store); path(plan.wasm.daemon); sha(plan.wasm.daemonSha256); sha(plan.wasm.manifestSha256);
  assert(/^cubeopt-opt8-[A-Za-z0-9._-]+$/.test(plan.wasm.bundle));
  assert(/^cubeopt-opt8-native-[A-Za-z0-9._-]+$/.test(plan.production.bundle)); sha(plan.production.manifestSha256);
  assert(/^v24\.\d+\.\d+$/.test(plan.node.version)); path(plan.node.path); sha(plan.node.sha256);
  const order = ['baseline', 'native'];
  assert.equal(plan.passes?.length, 2, 'Run each endpoint once; repeated passes are not authorized');
  for (const [i, pass] of plan.passes.entries()) {
    const candidate = order[i]; assert.equal(pass.candidate, candidate);
    assert.equal(pass.label, `r1-${candidate}`);
    assert.equal(pass.kind, candidate === 'baseline' ? 'wasm' : 'native'); sha(pass.sha256);
    if (pass.kind === 'native') { path(pass.binary); assert.equal(pass.simd, 'avx2'); }
    else { assert.equal(pass.binary, undefined); assert.equal(pass.simd, undefined); }
  }
  return plan;
}

export function summarizeCandidates(passes, engines) {
  const summaries = {};
  for (const pass of passes) {
    if (!Object.hasOwn(summaries, pass.candidate)) summaries[pass.candidate] = { binary: pass.binary, sha256: pass.sha256, simd: pass.simd, ...(pass.kind === 'wasm' ? { kind: 'wasm' } : {}), passes: [] };
    const summary = summaries[pass.candidate];
    summary.passes.push({ label: pass.label, totalWallSeconds: engines[pass.label].totalWallSeconds });
  }
  for (const summary of Object.values(summaries)) {
    const times = summary.passes.map(pass => pass.totalWallSeconds).sort((a, b) => a - b), mid = times.length >> 1;
    summary.medianTotalWallSeconds = times.length % 2 ? times[mid] : (times[mid - 1] + times[mid]) / 2;
  }
  for (const summary of Object.values(summaries)) summary.baselineOverCandidateMedian = summaries.baseline.medianTotalWallSeconds / summary.medianTotalWallSeconds;
  return summaries;
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

export function resolveAssets(config, passes, plan) {
  const pointerBytes = boundedRead(resolve(config.store, 'current.json'));
  const pointer = JSON.parse(pointerBytes);
  assert.equal(pointer.schema, 'cuberoot.cubeopt-current/v1');
  assert(/^cubeopt-opt8-[a-zA-Z0-9._-]+$/.test(pointer.bundle), 'Expected an Opt8 bundle');
  const root = resolve(config.store, 'bundles', pointer.bundle);
  const manifestBytes = boundedRead(resolve(root, 'manifest.json')), manifest = JSON.parse(manifestBytes);
  assert.equal(manifest.schema, 'cuberoot.cubeopt-artifact/v1'); assert.equal(manifest.bundle, pointer.bundle);
  if (config.candidates) assert(['rust-wasm', 'rust-native'].includes(manifest.engine), 'Expected a published Rust Opt8 bundle');
  else assert.equal(manifest.engine, 'rust-wasm', 'Baseline must be the current production Rust WASM bundle');
  assert.equal(manifest.variant, 'opt8'); assert.equal(manifest.protocol, 1);
  assert.equal(manifest.maxThreads, 4);
  assert.equal(manifest.files.table.path, 'h48prun31h8.dat'); assert.equal(manifest.files.table.bytes, TABLE_BYTES);
  assert.equal(manifest.files.snapshot.path, 'cube48opt8.small.bin'); assert.equal(manifest.files.snapshot.bytes, 818_008);
  const table = resolve(root, manifest.files.table.path), snapshot = resolve(root, manifest.files.snapshot.path);
  assert(lstatSync(table).isFile() && statSync(table).size === TABLE_BYTES);
  assert.equal(digest(boundedRead(snapshot)), manifest.files.snapshot.sha256);
  const binaries = {};
  for (const pass of passes.filter(pass => pass.binary)) {
    if (!binaries[pass.binary]) {
      const bytes = boundedRead(pass.binary, 64 * 1024 ** 2);
      assert(bytes.length >= 20 && bytes.subarray(0, 4).equals(Buffer.from([127, 69, 76, 70]))
        && bytes[4] === 2 && bytes[5] === 1 && bytes.readUInt16LE(18) === 62, 'Candidate must be an x86-64 little-endian ELF64 executable');
      assert(statSync(pass.binary).mode & 0o111, 'Candidate is not executable');
      binaries[pass.binary] = { identity: fileIdentity(pass.binary), sha256: digest(bytes) };
    }
    if (pass.sha256) assert.equal(binaries[pass.binary].sha256, pass.sha256, 'Pinned candidate changed');
  }
  let wasm;
  if (plan?.schema === 'cuberoot.opt8.service-comparison/v1') {
    assert.equal(manifest.engine, 'rust-native'); assert.equal(pointer.bundle, plan.production.bundle);
    assert.equal(digest(manifestBytes), plan.production.manifestSha256);
    const native = passes.find(pass => pass.kind === 'native');
    assert.equal(native.binary, resolve(root, manifest.files.binary.path));
    assert.equal(native.sha256, manifest.files.binary.sha256);
    assert.equal(process.version, plan.node.version); assert.equal(process.execPath, plan.node.path);
    assert.equal(digest(boundedRead(process.execPath, 256 * 1024 ** 2)), plan.node.sha256);
    const wasmPointer = boundedRead(resolve(plan.wasm.store, 'current.json'));
    assert.deepEqual(JSON.parse(wasmPointer), { schema: 'cuberoot.cubeopt-current/v1', bundle: plan.wasm.bundle });
    const wasmRoot = resolve(plan.wasm.store, 'bundles', plan.wasm.bundle);
    const wasmManifestBytes = boundedRead(resolve(wasmRoot, 'manifest.json')), wasmManifest = JSON.parse(wasmManifestBytes);
    assert.equal(digest(wasmManifestBytes), plan.wasm.manifestSha256);
    assert.equal(wasmManifest.engine, 'rust-wasm'); assert.equal(wasmManifest.bundle, plan.wasm.bundle);
    assert.equal(wasmManifest.maxThreads, 4); assert.equal(wasmManifest.variant, 'opt8');
    assert.equal(wasmManifest.files.wasm.sha256, passes[0].sha256);
    const files = {};
    for (const [role, declared] of Object.entries(wasmManifest.files)) {
      assert(/^[A-Za-z0-9._-]+$/.test(declared.path));
      const file = resolve(wasmRoot, declared.path); assert(lstatSync(file).isFile());
      assert.equal(statSync(file).size, declared.bytes);
      if (role !== 'table') assert.equal(digest(boundedRead(file)), declared.sha256);
      files[role] = { path: file, identity: fileIdentity(file), sha256: declared.sha256 };
    }
    // The production bundles hard-link the same table; no second copy or new table.
    assert.deepEqual(files.table.identity, fileIdentity(table));
    assert.equal(files.table.sha256, manifest.files.table.sha256);
    assert.equal(files.snapshot.sha256, manifest.files.snapshot.sha256);
    assert.equal(digest(boundedRead(plan.wasm.daemon, 32 * 1024 ** 2)), plan.wasm.daemonSha256);
    wasm = { ...plan.wasm, root: wasmRoot, pointerSha256: digest(wasmPointer), manifest: wasmManifest, files,
      daemonIdentity: fileIdentity(plan.wasm.daemon), nodeIdentity: fileIdentity(process.execPath) };
  }
  return { table, snapshot, tableIdentity: fileIdentity(table), snapshotIdentity: fileIdentity(snapshot),
    binaries, ...(wasm ? { wasm } : {}),
    ...(config.binary ? { binaryIdentity: binaries[config.binary].identity, binarySha256: binaries[config.binary].sha256,
      daemonSha256: digest(boundedRead(config.daemon, 32 * 1024 ** 2)) } : {}),
    pointerSha256: digest(pointerBytes), manifestSha256: digest(manifestBytes), manifest, root };
}

function assertAssetsUnchanged(config, assets) {
  assert.equal(digest(boundedRead(resolve(config.store, 'current.json'))), assets.pointerSha256, 'Current pointer changed');
  assert.equal(digest(boundedRead(resolve(assets.root, 'manifest.json'))), assets.manifestSha256, 'Baseline manifest changed');
  assert.deepEqual(fileIdentity(assets.table), assets.tableIdentity, 'Table changed');
  assert.deepEqual(fileIdentity(assets.snapshot), assets.snapshotIdentity, 'Snapshot changed');
  for (const [binary, expected] of Object.entries(assets.binaries)) {
    assert.deepEqual(fileIdentity(binary), expected.identity, 'Native candidate identity changed');
    assert.equal(digest(boundedRead(binary, 64 * 1024 ** 2)), expected.sha256, 'Native candidate bytes changed');
  }
  if (config.daemon) assert.equal(digest(boundedRead(config.daemon, 32 * 1024 ** 2)), assets.daemonSha256, 'Daemon changed');
  if (assets.wasm) {
    const wasm = assets.wasm;
    assert.equal(digest(boundedRead(resolve(wasm.store, 'current.json'))), wasm.pointerSha256);
    assert.equal(digest(boundedRead(resolve(wasm.root, 'manifest.json'))), wasm.manifestSha256);
    assert.deepEqual(fileIdentity(wasm.daemon), wasm.daemonIdentity);
    assert.equal(digest(boundedRead(wasm.daemon, 32 * 1024 ** 2)), wasm.daemonSha256);
    assert.deepEqual(fileIdentity(process.execPath), wasm.nodeIdentity);
    for (const [role, file] of Object.entries(wasm.files)) {
      assert.deepEqual(fileIdentity(file.path), file.identity);
      if (role !== 'table') assert.equal(digest(boundedRead(file.path)), file.sha256);
    }
  }
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

function assertNoConflict(rows, binaries, allowed = []) {
  const allow = new Set([process.pid, ...allowed]);
  const conflicts = rows.filter(row => !allow.has(row.pid) && row.argv.length && (
    binaries.includes(row.argv[0])
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
  const cpu = readFileSync('/proc/stat', 'utf8').match(/^cpu\s+(.+)$/m)[1].trim().split(/\s+/);
  return { at: new Date().toISOString(), cpuTicks: Object.fromEntries(['user', 'nice', 'system', 'idle', 'iowait', 'irq', 'softirq', 'steal', 'guest', 'guestNice'].map((key, i) => [key, cpu[i] ?? null])),
    loadavg: readFileSync('/proc/loadavg', 'utf8').trim(), bootId: readFileSync('/proc/sys/kernel/random/boot_id', 'utf8').trim(),
    availableBytes: fields.MemAvailable, totalBytes: fields.MemTotal, swapFreeBytes: fields.SwapFree,
    swapTotalBytes: fields.SwapTotal, fullPressureAvg10,
    swapInPages: Number(vm.match(/^pswpin (\d+)$/m)?.[1]), swapOutPages: Number(vm.match(/^pswpout (\d+)$/m)?.[1]) };
}

function memorySettings() {
  const settings = {};
  for (const key of ['enabled', 'defrag', 'hpage_pmd_size']) {
    try { settings[key] = readFileSync(`/sys/kernel/mm/transparent_hugepage/${key}`, 'utf8').trim(); }
    catch (error) { if (error.code === 'ENOENT') settings[key] = null; else throw error; }
  }
  return { at: new Date().toISOString(), transparentHugepage: settings };
}

function saveProcessMemory(directory, pid, phase) {
  const rollup = readFileSync(`/proc/${pid}/smaps_rollup`, 'utf8');
  const stat = readFileSync(`/proc/${pid}/stat`, 'utf8');
  const fields = stat.slice(stat.lastIndexOf(') ') + 2).trim().split(/\s+/);
  const kilobytes = Object.fromEntries([...rollup.matchAll(/^(\w+):\s+(\d+) kB$/gm)].map(match => [match[1], Number(match[2]) * 1024]));
  assert(Number.isFinite(kilobytes.AnonHugePages), 'smaps_rollup lacks AnonHugePages');
  const sample = { at: new Date().toISOString(), pid, phase, anonHugePagesBytes: kilobytes.AnonHugePages,
    rssBytes: kilobytes.Rss, anonymousBytes: kilobytes.Anonymous, swapBytes: kilobytes.Swap,
    minorFaults: Number(fields[7]), majorFaults: Number(fields[9]),
    childMinorFaults: Number(fields[8]), childMajorFaults: Number(fields[10]) };
  for (const key of ['minorFaults', 'majorFaults', 'childMinorFaults', 'childMajorFaults']) {
    assert(Number.isSafeInteger(sample[key]) && sample[key] >= 0, 'Invalid /proc stat fault count');
  }
  writeFileSync(resolve(directory, `memory-${phase}.smaps_rollup`), rollup, { flag: 'wx' });
  writeFileSync(resolve(directory, `memory-${phase}.stat`), stat, { flag: 'wx' });
  save(resolve(directory, `memory-${phase}.json`), sample);
}

export async function admissionDisabled({ signal, timeoutMs = LIMITS.admissionMs, url = READY_URL } = {}) {
  const deadline = AbortSignal.timeout(timeoutMs);
  const response = await fetch(url, { signal: signal ? AbortSignal.any([signal, deadline]) : deadline,
    redirect: 'error', cache: 'no-store' });
  assert.equal(response.status, 200, 'Cannot verify API admission');
  const body = await response.json(); assert.equal(body.enabled, false, 'API CubeOpt admission must remain disabled');
  return body;
}

async function recordAdmission(probe, signal, onSample, phase) {
  const started = performance.now(), startedAt = new Date().toISOString();
  let evidence;
  try {
    const body = await probe(signal);
    evidence = { outcome: 'disabled', body };
    return body;
  } catch (error) {
    evidence = { outcome: signal?.aborted ? 'cancelled' : 'error', error: error.name, message: error.message };
    throw error;
  } finally {
    onSample({ startedAt, at: new Date().toISOString(), phase, durationMs: performance.now() - started, ...evidence });
  }
}

/** HTTP may be pending; resource sampling must still run on every timer tick. */
export function startSafetyMonitor({ sampleResources, probeAdmission = signal => admissionDisabled({ signal }),
  onAdmission, onFailure, intervalMs = LIMITS.sampleMs }) {
  let active = true, pending = null, controller = null, timer;
  const fail = error => {
    if (!active) return;
    active = false; clearInterval(timer); controller?.abort(); onFailure(error);
  };
  const tick = () => {
    if (!active) return;
    try { sampleResources(); } catch (error) { fail(error); }
    if (!active || pending) return;
    controller = new AbortController();
    // Defer invocation so a synchronous probe failure cannot race assignment
    // of pending. Never overlap admission requests or retry a failed probe.
    pending = Promise.resolve().then(() => recordAdmission(probeAdmission, controller.signal, onAdmission, 'runtime'))
      .catch(error => { if (active) fail(error); })
      .finally(() => { pending = null; controller = null; });
  };
  timer = setInterval(tick, intervalMs); tick();
  return { async stop() {
    active = false; clearInterval(timer); controller?.abort();
    await pending;
  } };
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

async function runEngine(config, assets, cases, pass, taskStarted) {
  const engine = pass.label;
  const isWasm = pass.kind === 'wasm';
  assertAssetsUnchanged(config, assets);
  const directory = resolve(config.out, engine); mkdirSync(directory);
  const admissionEvidence = row => append(resolve(directory, 'admission.jsonl'), row);
  const initial = systemSample(); assertResources(initial, 0, true);
  await recordAdmission(() => admissionDisabled(), undefined, admissionEvidence, 'preflight');
  // HTTP verification may take up to ten seconds. Recheck memory/conflicts
  // immediately before allocation, rather than trusting an older snapshot.
  assertResources(systemSample(), 0, true);
  assertNoConflict(processRows(), Object.keys(assets.binaries));
  const resultsFd = openSync(resolve(directory, 'results.jsonl'), 'wx');
  const env = { ...process.env, CUBEOPT_ARTIFACT_DIR: isWasm && assets.wasm ? assets.wasm.store : config.store, CUBEOPT_THREADS: '4',
    CUBEOPT_PROTOCOL: 'tsv-v1', CUBEOPT_VARIANT: '8', CUBEOPT_SOLVE_THREADS: '1', CUBEOPT_SEARCH_THREADS: '4' };
  delete env.NODE_OPTIONS;
  delete env.CUBEOPT_VERIFY_TABLE;
  delete env.CUBEOPT_SIMD;
  if (!isWasm) env.CUBEOPT_SIMD = pass.simd;
  const executable = isWasm ? process.execPath : pass.binary;
  const args = isWasm ? [assets.wasm?.daemon ?? config.daemon] : ['solve', assets.snapshot, assets.table, '8', '20', '0'];
  const started = performance.now();
  const child = spawn(executable, args, { env, detached: true, stdio: ['pipe', 'pipe', 'pipe'] });
  let failure = null, waiter = null, killTimer;
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
  const sample = () => {
    const rows = processRows(), tree = treeRows(rows, child.pid), current = systemSample();
    const rssBytes = tree.reduce((sum, row) => sum + row.rssBytes, 0); peakTreeRssBytes = Math.max(peakTreeRssBytes, rssBytes);
    append(resolve(directory, 'resources.jsonl'), { ...current, pid: child.pid, processIds: tree.map(row => row.pid),
      treeRssBytes: rssBytes, treeSwapBytes: tree.reduce((sum, row) => sum + row.swapBytes, 0),
      swapInDeltaPages: current.swapInPages - initial.swapInPages, swapOutDeltaPages: current.swapOutPages - initial.swapOutPages });
    assert.equal(current.bootId, initial.bootId, 'System boot changed'); assertResources(current, rssBytes);
    assertNoConflict(rows, Object.keys(assets.binaries), tree.map(row => row.pid));
    assert(performance.now() - taskStarted < LIMITS.taskMs, 'Task time limit exceeded');
  };
  const monitor = startSafetyMonitor({ sampleResources: sample, onAdmission: admissionEvidence, onFailure: stop });
  const interrupt = () => stop(Error('Benchmark interrupted'));
  process.once('SIGTERM', interrupt); process.once('SIGINT', interrupt);
  try {
    const readyLine = await nextLine(LIMITS.bootMs);
    assert.equal(readyLine, 'READY\t4'); if (failure) throw failure;
    const startupSeconds = (performance.now() - started) / 1000;
    save(resolve(directory, 'startup.json'), { pid: child.pid, engine, readyLine, startupSeconds, threads: 4 });
    saveProcessMemory(directory, child.pid, 'ready');
    const results = [];
    for (const item of cases) {
      const requestStarted = performance.now(), response = nextLine(LIMITS.requestMs);
      child.stdin.write(`${item.id}\t${item.scramble}\n`);
      const line = await response; if (failure) throw failure;
      const result = { ...parseResult(line, item.id), scramble: item.scramble, engine, pid: child.pid,
        wallSeconds: (performance.now() - requestStarted) / 1000, raw: line, independentlyReplayed: false };
      if (item.expectedLength !== undefined) assert.equal(result.length, item.expectedLength, 'Optimal length differs from first baseline pass');
      writeSync(resultsFd, JSON.stringify(result) + '\n'); fsyncSync(resultsFd); results.push(result);
      process.stderr.write(`[native-service-benchmark] ${engine} ${results.length}/100 ${result.wallSeconds.toFixed(6)}s\n`);
    }
    saveProcessMemory(directory, child.pid, 'complete');
    child.stdin.end();
    const eofTimer = setTimeout(() => stop(Error('Solver did not exit after EOF')), 15_000);
    try { await exit; } finally { clearTimeout(eofTimer); }
    await monitor.stop();
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
    await monitor.stop();
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
    const candidateBytes = config.candidates ? boundedRead(config.candidates) : null;
    const candidatePlan = candidateBytes ? validateCandidatePlan(JSON.parse(candidateBytes)) : null;
    const comparison = candidatePlan?.schema === 'cuberoot.opt8.service-comparison/v1';
    const passes = candidatePlan ? candidatePlan.passes.map(pass => ({ ...pass, kind: pass.kind ?? 'native' })) : [
      { label: 'wasm', kind: 'wasm' },
      { label: 'avx2', kind: 'native', binary: config.binary, simd: 'avx2' },
      { label: 'avx512', kind: 'native', binary: config.binary, simd: 'avx512' },
    ];
    const assets = resolveAssets(config, passes, candidatePlan), { corpus, fileSha256 } = readCorpus(config.corpus);
    const input = { schema: 'cuberoot.opt8.native-service-benchmark-input.v1', config, assets,
      corpusSha256: CORPUS_SHA, corpusFileSha256: fileSha256, cases: corpus.cases, limits: LIMITS,
      memoryEvidence: 'ready-and-complete-v1',
      engineOrder: passes.map(pass => pass.label), warmupCases: 0, measuredPasses: 1,
      ...(candidatePlan ? { mode: comparison ? 'service-comparison' : 'native-candidates', candidatePlan, candidatePlanSha256: digest(candidateBytes) } : {}),
      sourceSha256: digest(readFileSync(fileURLToPath(import.meta.url))),
      machine: { hostname: hostname(), platform: process.platform, arch: process.arch, osRelease: release(),
        cpuModel: cpus()[0]?.model ?? null, logicalCpus: cpus().length, node: process.version },
      measurement: 'Monotonic external stdin-write to complete stdout-response wall time, including IPC/scheduling but excluding HTTP/network/API queue; startup separately measured; each engine remains resident for all 100 requests.',
      limitations: [candidatePlan ? 'Explicit ordered candidate passes; use recorded repetitions to assess drift and variability.'
        : 'One fixed-order pass; cache and thermal drift are not estimated.', 'Independent solution replay must be completed before deployment acceptance.',
        ...(comparison ? ['Startup is test-entry spawn-to-READY: historical WASM Node daemon versus direct native ELF, not complete API cold startup.',
          'Each endpoint runs exactly once. Shared-server CPU/load counters diagnose drift; this single comparison does not measure repeatability.'] : [])] };
    if (candidateBytes) writeFileSync(resolve(config.out, 'candidates.json'), candidateBytes, { flag: 'wx' });
    save(resolve(config.out, 'system-memory-settings.json'), memorySettings());
    save(resolve(config.out, 'input.json'), input);
    const engines = {};
    const baseline = await runEngine(config, assets, corpus.cases, passes[0], started); engines[passes[0].label] = baseline.report;
    const cases = corpus.cases.map((row, i) => ({ ...row, expectedLength: baseline.results[i].length }));
    for (const pass of passes.slice(1)) engines[pass.label] = (await runEngine(config, assets, cases, pass, started)).report;
    const report = { schema: 'cuberoot.opt8.native-service-benchmark-report.v1', complete: true,
      engines, lengthMatches: passes.length * 100, independentReplay: false, corpusSha256: CORPUS_SHA,
      ...(candidatePlan ? { mode: comparison ? 'service-comparison' : 'native-candidates', candidates: summarizeCandidates(candidatePlan.passes, engines) } : {
        wasmOverAvx2: engines.wasm.totalWallSeconds / engines.avx2.totalWallSeconds,
        wasmOverAvx512: engines.wasm.totalWallSeconds / engines.avx512.totalWallSeconds }),
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
