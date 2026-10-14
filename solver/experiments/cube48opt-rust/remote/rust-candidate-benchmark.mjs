#!/usr/bin/env node
// Linux-only Rust candidate measurement. The original engine is NEVER started
// here: its complete, explicitly pinned first pass is preserved as evidence.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { constants, closeSync, copyFileSync, existsSync, fsyncSync, lstatSync, mkdirSync, openSync,
  readFileSync, realpathSync, statSync, unlinkSync, writeFileSync, writeSync } from 'node:fs';
import { basename, dirname, isAbsolute, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { assertResources, monitoredSession, prepare } from './production-benchmark.mjs';
import { parsePrintedSolution } from '../wasm-benchmark.mjs';

const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const save = (file, value) => writeFileSync(file, JSON.stringify(value, null, 2) + '\n', { flag: 'wx' });
const json = bytes => JSON.parse(bytes.toString());
const jsonl = bytes => bytes.toString().trim().split('\n').map(line => JSON.parse(line));
export const BASELINE_FILES = Object.freeze(['input.json', 'reference-first-pass.json', 'cases-source.json',
  'original/raw.jsonl', 'original/results.jsonl', 'original/report.json', 'original/exit.json',
  'original/resources.jsonl', 'original/startup.json', 'artifacts/original/cube48opt8.mjs', 'artifacts/original/cube48opt8.wasm']);

export function parseCandidateArguments(argv) {
  assert.equal(argv.length, 8, 'usage: rust-candidate-benchmark.mjs --fixture-input ABS_JSON --baseline-dir ABS_RUN --baseline-sha256 ORIGINAL_REPORT_SHA --out ABS_NEW_DIR');
  const values = {};
  for (let i = 0; i < argv.length; i += 2) {
    const key = argv[i], value = argv[i + 1];
    assert(['--fixture-input', '--baseline-dir', '--baseline-sha256', '--out'].includes(key) && !Object.hasOwn(values, key));
    assert(key === '--baseline-sha256' ? /^[a-f0-9]{64}$/.test(value) : isAbsolute(value)); values[key] = value;
  }
  assert(Object.keys(values).length === 4);
  return { fixture: values['--fixture-input'], baseline: values['--baseline-dir'], baselineSha256: values['--baseline-sha256'], out: values['--out'] };
}

export function validateOriginalBaseline(old, current, expectedBootId) {
  const { input, report, rows, raw, exit, resources, reference, casesSource } = old;
  assert.equal(input.schema, 'cuberoot.opt8.production-benchmark-input.v1');
  assert.equal(input.variant, 8); assert.equal(input.threads, 4); assert.equal(input.warmupCases, 0); assert.equal(input.measuredPasses, 1);
  assert.deepEqual(input.engineOrder, ['original', 'rust'], 'Baseline must be the preserved original first comparison');
  assert.equal(input.baselineReusedFrom, undefined, 'Cannot silently chain a reused baseline');
  assert.deepEqual(input.machine, current.machine, 'Historical baseline machine/runtime changed');
  assert.equal(input.machine.platform, 'linux');
  for (const key of ['corpusSha256', 'tableSha256', 'tableBytes', 'referenceSha256', 'measurement']) assert.equal(input[key], current[key], `Baseline differs: ${key}`);
  assert.deepEqual(input.cases, current.cases); assert.equal(input.cases.length, 100);
  assert.deepEqual(input.artifacts.original.sha256, current.artifacts.original.sha256, 'Original artifacts changed');
  assert.equal(reference.length, 100); assert.equal(casesSource.corpusSha256, input.corpusSha256);
  assert.deepEqual(casesSource.cases.map((item, i) => ({ ...item, htm: reference[i].length })), current.cases);
  for (const [i, row] of reference.entries()) { assert.equal(row.id, `r0_${input.cases[i].id}`); assert.equal(row.cancelled, false); }
  assert.equal(exit.code, 0); assert.equal(exit.signal, null);
  assert(resources.length > 0, 'Baseline resource trace is required');
  for (const sample of resources) {
    assert.equal(sample.bootId, expectedBootId, 'Baseline belongs to another system boot');
    assert(Number.isFinite(sample.treeRssBytes) && sample.treeRssBytes >= 0); assertResources(sample, sample.treeRssBytes);
  }
  assert.equal(report.engine, 'original'); assert.equal(report.cases, 100); assert.equal(report.threads, 4);
  assert.equal(report.measuredPasses, 1); assert.equal(report.warmupCases, 0); assert.equal(report.processExited, true);
  assert.equal(report.optimalLengthsMatched, 100); assert.deepEqual(report.artifacts, input.artifacts.original);
  assert.equal(raw.length, 102); assert.equal(rows.length, 100);
  const ready = raw[0], finished = raw.at(-1);
  assert.equal(ready.type, 'ready'); assert.equal(ready.engine, 'original'); assert.equal(ready.threads, 4); assert.equal(ready.warmupCases, 0);
  assert.equal(ready.loaded.sha256, input.tableSha256); assert.equal(ready.loaded.bytes, input.tableBytes);
  assert.equal(finished.type, 'finished'); assert.equal(finished.engine, 'original'); assert.equal(finished.cases, 100); assert.equal(finished.threads, 4);
  for (const [index, item] of input.cases.entries()) {
    const row = rows[index], source = raw[index + 1];
    assert.equal(source.type, 'result'); assert.equal(source.engine, 'original'); assert.equal(source.index, index);
    assert.equal(source.id, item.id); assert.equal(source.threads, 4); assert.equal(source.length, item.htm);
    assert(Number.isFinite(source.seconds) && source.seconds >= 0);
    assert.equal(source.solution.trim().split(/\s+/).filter(Boolean).length, item.htm);
    const printed = parsePrintedSolution(source.output); assert.equal(printed.solution, source.solution); assert.equal(printed.length, source.length);
    assert.deepEqual(row, { ...source, expectedLength: item.htm, optimalLengthMatched: true, independentlyReplayed: false });
  }
  assert.equal(report.totalSeconds, rows.reduce((sum, row) => sum + row.seconds, 0));
  assert.equal(report.peakRssBytes, finished.maxRssKiB * 1024); assert.equal(report.loadSeconds, ready.loadSeconds);
  return report;
}

export function readBaseline(directory, expectedReportSha256, current, expectedBootId) {
  assert.equal(realpathSync(directory), directory, 'Baseline directory must be canonical');
  assert(!existsSync(resolve(directory, 'original/failure.json')), 'Original baseline failed');
  const bytes = {}, digests = {};
  for (const name of BASELINE_FILES) {
    const path = resolve(directory, name), stat = lstatSync(path);
    assert(stat.isFile() && stat.size <= 16 * 1024 ** 2, `Not bounded baseline evidence: ${name}`);
    bytes[name] = readFileSync(path); digests[name] = hash(bytes[name]);
  }
  assert.equal(digests['original/report.json'], expectedReportSha256, 'Pinned original report changed');
  const old = { input: json(bytes['input.json']), report: json(bytes['original/report.json']),
    raw: jsonl(bytes['original/raw.jsonl']), rows: jsonl(bytes['original/results.jsonl']), exit: json(bytes['original/exit.json']),
    resources: jsonl(bytes['original/resources.jsonl']), reference: json(bytes['reference-first-pass.json']), casesSource: json(bytes['cases-source.json']) };
  validateOriginalBaseline(old, current, expectedBootId);
  assert.deepEqual(json(bytes['original/startup.json']), old.raw[0]);
  assert.equal(digests['artifacts/original/cube48opt8.mjs'], old.input.artifacts.original.sha256.wrapper);
  assert.equal(digests['artifacts/original/cube48opt8.wasm'], old.input.artifacts.original.sha256.wasm);
  return { ...old, bytes, evidence: { directory, originalReportSha256: expectedReportSha256,
    files: digests, bootId: expectedBootId, machine: old.input.machine, artifacts: old.input.artifacts.original,
    originalTotalSeconds: old.report.totalSeconds, sourceExitCode: 0, sourceCases: 100 } };
}

export async function main(argv = process.argv.slice(2)) {
  assert.equal(process.platform, 'linux', 'Rust candidate measurement runs only on Linux; local Mac work must use guard.mts');
  const config = parseCandidateArguments(argv); assert(!existsSync(config.out), 'Refusing to overwrite or resume a candidate');
  mkdirSync(dirname(config.out), { recursive: true });
  const lock = resolve(dirname(config.out), '.opt8-production-benchmark.lock'), lockFd = openSync(lock, 'wx');
  writeSync(lockFd, JSON.stringify({ pid: process.pid, out: config.out, executedEngines: ['rust'] }) + '\n'); fsyncSync(lockFd);
  mkdirSync(config.out);
  try {
    const { input, tableBefore } = prepare(config.fixture, config.out);
    const bootId = readFileSync('/proc/sys/kernel/random/boot_id', 'utf8').trim();
    const baseline = readBaseline(config.baseline, config.baselineSha256, input, bootId);
    assert.deepEqual(baseline.reference, JSON.parse(readFileSync(resolve(config.out, 'reference-first-pass.json'))));
    for (const [name, bytes] of Object.entries(baseline.bytes)) {
      const target = resolve(config.out, 'baseline', name); mkdirSync(dirname(target), { recursive: true }); writeFileSync(target, bytes, { flag: 'wx' });
      if (name.startsWith('original/')) {
        const mirror = resolve(config.out, name); mkdirSync(dirname(mirror), { recursive: true }); writeFileSync(mirror, bytes, { flag: 'wx' });
      }
    }
    input.artifacts.original = baseline.input.artifacts.original;
    input.executedEngines = ['rust']; input.engineOrder = ['rust']; input.freshPaired = false;
    input.baselineReusedFrom = baseline.evidence;
    input.method = 'Only Rust executes this run: fixed WCA100 once without warmup; original is the pinned completed first pass on the same host/runtime/boot, not a fresh paired comparison';
    const ownSource = fileURLToPath(import.meta.url); input.sourceHashes[ownSource] = hash(readFileSync(ownSource));
    copyFileSync(ownSource, resolve(config.out, 'source', basename(ownSource)), constants.COPYFILE_EXCL);
    const inputFile = resolve(config.out, 'input.json'); save(inputFile, input);
    // This entry has exactly one executable session call; original is data only.
    const rust = await monitoredSession(inputFile, 'rust', config.out, input);
    readBaseline(config.baseline, config.baselineSha256, input, bootId);
    for (const [name, expected] of Object.entries(baseline.evidence.files)) assert.equal(hash(readFileSync(resolve(config.baseline, name))), expected, `Baseline changed during candidate: ${name}`);
    const after = statSync(input.table);
    for (const key of ['dev', 'ino', 'size', 'mtimeMs']) assert.equal(after[key], tableBefore[key], `Table changed: ${key}`);
    const ratio = baseline.report.totalSeconds / rust.totalSeconds;
    const report = { schema: 'cuberoot.opt8.production-benchmark-report.v1', complete: true, inputSha256: hash(readFileSync(inputFile)),
      variant: 8, threads: 4, cases: 100, measuredPasses: 1, warmupCases: 0, engineOrder: ['rust'], executedEngines: ['rust'], freshPaired: false,
      baselineReusedFrom: baseline.evidence, corpusSha256: input.corpusSha256, tableSha256: input.tableSha256,
      machine: input.machine, artifacts: input.artifacts, method: input.method, measurement: input.measurement,
      engines: { original: baseline.report, rust }, originalOverRustTotalRatio: ratio, rustFasterOnThisRun: ratio > 1, independentReplay: false,
      limitations: ['The original 100-case pass is reused, not rerun; timing drift between measurements is not estimated.',
        'No fresh paired performance claim is made. Baseline raw rows, exit proof, machine/boot and artifact hashes are retained.',
        'Independent replay of all 200 solutions is still required before deployment acceptance.'] };
    save(resolve(config.out, 'report.json'), report); console.log(JSON.stringify(report, null, 2));
  } catch (error) { save(resolve(config.out, 'failure.json'), { at: new Date().toISOString(), error: String(error.stack ?? error), partialResultsPreserved: true }); throw error; }
  finally { closeSync(lockFd); unlinkSync(lock); }
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main().catch(error => { console.error(error); process.exitCode = 1; });
