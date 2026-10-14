#!/usr/bin/env node
// Linux-only diagnosis. This never runs the original engine or emits an
// acceptance-schema report: profiler timings cannot authorize deployment.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { closeSync, constants, copyFileSync, createReadStream, existsSync, fsyncSync, lstatSync,
  mkdirSync, openSync, readFileSync, readdirSync, statSync, unlinkSync, writeFileSync, writeSync } from 'node:fs';
import { basename, dirname, isAbsolute, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { checkProfileStorage, monitoredSession, prepare } from './production-benchmark.mjs';
import { readBaseline } from './rust-candidate-benchmark.mjs';
import { profilerNodeFlags } from '../wasm-benchmark.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const save = (file, value) => writeFileSync(file, JSON.stringify(value, null, 2) + '\n', { flag: 'wx' });
// Function indices belong to a particular binary, not to a Rust source name.
// V2's inlined search is function 12; later builds can use another index.
export const PROFILE_WASM_SHA256 = 'd884224c266c08c496a8ba8c9e9a185114f6e8003ceb25cde7ff5ee5a65b3429';
export function assertProfileArtifact(input) {
  assert.equal(input.artifacts.rust.sha256.wasm, PROFILE_WASM_SHA256,
    'Function 12 diagnosis is pinned to the sampled V2 WASM; another artifact needs its own verified function mapping');
}
export function parseProfileArguments(argv) {
  assert.equal(argv.length, 8, 'usage: profile-rust.mjs --fixture-input ABS_JSON --baseline-dir ABS_RUN --baseline-sha256 ORIGINAL_REPORT_SHA --out ABS_NEW_DIR');
  const values = {};
  for (let i = 0; i < argv.length; i += 2) {
    const key = argv[i], value = argv[i + 1];
    assert(['--fixture-input', '--baseline-dir', '--baseline-sha256', '--out'].includes(key) && !Object.hasOwn(values, key));
    assert(key === '--baseline-sha256' ? /^[a-f0-9]{64}$/.test(value) : isAbsolute(value)); values[key] = value;
  }
  assert.equal(Object.keys(values).length, 4);
  return { fixture: values['--fixture-input'], baseline: values['--baseline-dir'], baselineSha256: values['--baseline-sha256'], out: values['--out'] };
}

export async function describeProfileLogs(directory, expectedPid) {
  checkProfileStorage(directory);
  const logs = [];
  for (const name of readdirSync(directory).sort()) {
    assert(name.endsWith(`-${expectedPid}-v8.log`), 'Profiler log belongs to another process');
    const file = resolve(directory, name), before = lstatSync(file);
    assert(before.isFile() && before.size > 0);
    const digest = createHash('sha256');
    for await (const chunk of createReadStream(file)) digest.update(chunk);
    const after = lstatSync(file);
    for (const key of ['dev', 'ino', 'size', 'mtimeMs']) assert.equal(before[key], after[key], 'Profile log changed after child exit');
    logs.push({ name, bytes: before.size, sha256: digest.digest('hex') });
  }
  assert(logs.length >= 5, 'Need main isolate plus all four solver Worker isolate logs');
  return logs;
}

export async function main(argv = process.argv.slice(2)) {
  assert.equal(process.platform, 'linux', 'Real Rust profiling is Linux-only; local Mac solver runs still require guard.mts');
  const config = parseProfileArguments(argv); assert(!existsSync(config.out), 'Refusing to overwrite or resume a diagnosis');
  mkdirSync(dirname(config.out), { recursive: true });
  const lock = resolve(dirname(config.out), '.opt8-production-benchmark.lock'), lockFd = openSync(lock, 'wx');
  writeSync(lockFd, JSON.stringify({ pid: process.pid, out: config.out, diagnostic: true, executedEngines: ['rust'] }) + '\n'); fsyncSync(lockFd);
  mkdirSync(config.out);
  try {
    const { input, tableBefore } = prepare(config.fixture, config.out);
    assertProfileArtifact(input); // Reject before spawning or loading any PDB.
    const bootId = readFileSync('/proc/sys/kernel/random/boot_id', 'utf8').trim();
    const baseline = readBaseline(config.baseline, config.baselineSha256, input, bootId);
    assert.deepEqual(baseline.reference, JSON.parse(readFileSync(resolve(config.out, 'reference-first-pass.json'))));
    for (const [name, bytes] of Object.entries(baseline.bytes)) {
      const target = resolve(config.out, 'baseline', name); mkdirSync(dirname(target), { recursive: true });
      writeFileSync(target, bytes, { flag: 'wx' });
    }
    const profileDirectory = resolve(config.out, 'profiles'); mkdirSync(profileDirectory);
    input.schema = 'cuberoot.opt8.production-profile-input.v1'; input.diagnostic = true; input.performanceEligible = false;
    input.executedEngines = ['rust']; input.engineOrder = ['rust']; input.freshPaired = false;
    input.baselineReusedFrom = baseline.evidence;
    input.profiling = { kind: 'v8-prof', logDirectory: profileDirectory,
      nodeFlags: profilerNodeFlags(profileDirectory, 'rust', true), samplingIntervalUs: 1000,
      disassemblyFunctionIndex: 12, disassemblyWasmSha256: PROFILE_WASM_SHA256,
      disassemblyFile: 'rust/stdout.log',
      node: process.version, v8: process.versions.v8, maximumLogBytes: 512 * 1024 ** 2, minimumDiskFreeBytes: 2 * 1024 ** 3 };
    input.method = 'Diagnostic only: Rust Opt8 four workers, fixed WCA100 once without warmup; V8 sampling enabled. Original baseline is archived, never rerun. Sampled timings are ineligible for performance/deployment decisions.';
    for (const file of [fileURLToPath(import.meta.url), resolve(HERE, 'rust-candidate-benchmark.mjs')]) {
      input.sourceHashes[file] = hash(readFileSync(file));
      copyFileSync(file, resolve(config.out, 'source', basename(file)), constants.COPYFILE_EXCL);
    }
    const inputFile = resolve(config.out, 'input.json'); save(inputFile, input);
    const rust = await monitoredSession(inputFile, 'rust', config.out, input, { profileDirectory });
    const exit = JSON.parse(readFileSync(resolve(config.out, 'rust/exit.json')));
    assert.equal(exit.code, 0); assert.equal(exit.signal, null); assert.equal(rust.processExited, true);
    const logs = await describeProfileLogs(profileDirectory, rust.profiler.pid);
    const after = statSync(input.table);
    for (const key of ['dev', 'ino', 'size', 'mtimeMs']) assert.equal(after[key], tableBefore[key], `Table changed: ${key}`);
    for (const [name, sha] of Object.entries(baseline.evidence.files))
      assert.equal(hash(readFileSync(resolve(config.baseline, name))), sha, `Historical baseline changed: ${name}`);
    const report = { schema: 'cuberoot.opt8.production-profile.v1', complete: true, diagnostic: true, performanceEligible: false,
      inputSha256: hash(readFileSync(inputFile)), variant: 8, threads: 4, cases: 100, measuredPasses: 1, warmupCases: 0,
      engineOrder: ['rust'], executedEngines: ['rust'], freshPaired: false, baselineReusedFrom: baseline.evidence,
      corpusSha256: input.corpusSha256, tableSha256: input.tableSha256, machine: input.machine, artifacts: input.artifacts,
      method: input.method, measurement: input.measurement, engines: { rust }, independentReplay: false,
      profiler: { ...input.profiling, pid: rust.profiler.pid, logs, logsClosedAfterExit: true,
        functionAttribution: 'pending offline per-isolate processing; isolate IDs are not worker indices' },
      limitations: ['Sampling alters runtime. No speed ratio or deployment acceptance result is produced.',
        'All 100 solutions require independent replay. Raw isolate logs must be processed before claiming sampled hotspots.'] };
    save(resolve(config.out, 'report.json'), report); process.stdout.write(JSON.stringify(report, null, 2) + '\n');
  } catch (error) {
    save(resolve(config.out, 'failure.json'), { at: new Date().toISOString(), diagnostic: true,
      performanceEligible: false, error: String(error.stack ?? error), partialResultsPreserved: true }); throw error;
  } finally { closeSync(lockFd); unlinkSync(lock); }
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main().catch(error => { console.error(error); process.exitCode = 1; });
