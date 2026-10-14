#!/usr/bin/env node
/** One prepared local run, once. Only guard.mts may start a solver. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { spawn } from 'node:child_process';
import { closeSync, existsSync, fsyncSync, lstatSync, mkdirSync, openSync, readFileSync, writeFileSync } from 'node:fs';
import { cpus } from 'node:os';
import { dirname, isAbsolute, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { collectMultithreadEvidence, multithreadPolicy, validateMultithreadReview } from './multithread-policy.mts';
import { parseCompleteJsonl } from './report-opt10-wca100.mjs';
import { reportNativeMultithread } from './native-multithread-report.mjs';
import { readWca100, validateSharedDepthResults } from './wasm-benchmark.mjs';
import { getVariant } from './variants.mjs';

const HERE = dirname(fileURLToPath(import.meta.url)), ROOT = resolve(HERE, '../../..');
const BASE = resolve(ROOT, '.tmp/cubeopt-reverse');
const hash = (bytes: Uint8Array | string) => createHash('sha256').update(bytes).digest('hex');
const CONTROL_ENV = ['CUBEOPT_MULTITHREAD_REVIEW', 'CUBEOPT_BACKEND', 'CUBEOPT_VARIANT', 'CUBEOPT_H',
  'CUBEOPT_SEARCH_THREADS', 'CUBEOPT_SOLVE_THREADS', 'CUBEOPT_MEASURE_RSS'];
const save = (path: string, value: unknown) => writeFileSync(path, JSON.stringify(value, null, 2) + '\n', { flag: 'wx', mode: 0o600 });
function read(path: string, max = 4 * 1024 ** 2) {
  assert(isAbsolute(path) && resolve(path) === path, 'Use canonical absolute evidence paths');
  const stat = lstatSync(path); assert(stat.isFile() && stat.size > 0 && stat.size <= max, `Invalid small evidence file: ${path}`);
  return readFileSync(path);
}
const json = (path: string) => JSON.parse(read(path).toString());

export function cleanRunEnvironment(env: Record<string, string>, inherited: NodeJS.ProcessEnv = process.env) {
  assert(env && typeof env === 'object' && !Array.isArray(env));
  const result = { ...inherited };
  for (const key of Object.keys(result)) if (key.startsWith('CUBEOPT_') || key === 'NODE_OPTIONS' || key === 'NODE_PATH') delete result[key];
  for (const [key, value] of Object.entries(env)) {
    assert(CONTROL_ENV.includes(key) && typeof value === 'string', `Unexpected control variable ${key}`);
    result[key] = value;
  }
  return result;
}

export function validatePreparedRequest(request: any, review: any, reviewBytes: Buffer, availableCpus: number) {
  assert.equal(request.schema, 'cuberoot.multithread-wca100-request.v1');
  assert.equal(request.reviewSha256, hash(reviewBytes));
  assert.equal(request.env.CUBEOPT_MULTITHREAD_REVIEW, request.reviewPath);
  assert.deepEqual([request.label, request.executable, request.args], [review.label, review.executable, review.args]);
  assert.equal(review.schema, 'cuberoot.multithread-wca100-review.v1');
  assert.equal(review.scope, 'mac18-wca100-single');
  assert.deepEqual([review.threads, review.batchThreads, review.cases, review.measuredPasses, review.warmupCases], [18, 1, 100, 1, 0]);
  cleanRunEnvironment(request.env, {});
  return multithreadPolicy(request, availableCpus);
}

export function validateRunCompletion(request: any, review: any, evidence: any, resource: any, completion: any) {
  assert.equal(completion.exitCode, 0); assert.equal(completion.signal, null);
  assert(Number.isFinite(Date.parse(completion.finishedAt)));
  const receipt = resource.multithreadReviewReceipt;
  assert.equal(receipt?.schema, 'cuberoot.multithread-wca100-consumption.v1');
  assert.equal(receipt.reviewPath, request.reviewPath); assert.equal(receipt.reviewSha256, request.reviewSha256);
  const identity = validateMultithreadReview(review, evidence, request, receipt.before);
  assert.deepEqual(receipt, { ...identity, schema: 'cuberoot.multithread-wca100-consumption.v1', scope: review.scope,
    reviewSha256: request.reviewSha256, reviewPath: request.reviewPath, before: receipt.before,
    consumedAt: receipt.consumedAt, pid: receipt.pid });
  assert(Number.isSafeInteger(receipt.pid) && receipt.pid > 0 && Number.isFinite(Date.parse(receipt.consumedAt)));
  assert.equal(resource.stopped, ''); assert.equal(resource.trigger, null); assert.equal(resource.pressure, 1);
  assert.equal(resource.boot, receipt.before.boot); assert.equal(resource.swapouts, receipt.before.swapouts);
  for (const key of ['backend', 'variant', 'h', 'entry', 'mode', 'measureNativeRss', 'tableBytes', 'rssLimit', 'deadlineMs'])
    assert.equal(resource[key], evidence.policy[key], `Guard resource policy mismatch: ${key}`);
  assert(resource.peakRss > 0 && resource.peakRss <= resource.rssLimit);
  assert(resource.minimumHeadroom >= 2 * 2 ** 30);
  assert(Date.parse(resource.sampledAt) >= Date.parse(receipt.consumedAt));
  assert(Date.parse(completion.finishedAt) >= Date.parse(resource.sampledAt));
}

export function validateWasmSummary(report: any, input: any, variant: number, corpus: any) {
  assert.equal(report.schema, 'cuberoot.rust-opt-wasm-benchmark-report.v2');
  assert.equal(input.schema, 'cuberoot.rust-opt-wasm-benchmark-input.v2');
  for (const object of [report, input]) {
    assert.equal(object.variant, variant); assert.equal(object.threads, 18);
    assert.equal(object.measuredPasses, 1); assert.equal(object.warmupCases, 0);
    assert.equal(object.corpusSha256, corpus.corpusSha256); assert.equal(object.machine.platform, 'darwin');
    assert.equal(object.machine.arch, 'arm64');
  }
  assert.equal(input.engine, 'both'); assert.equal(report.cases, 100); assert.equal(input.cases.length, 100);
  assert.deepEqual(report.machine, input.machine); assert.equal(report.tableSha256, input.tableSha256);
  assert.equal(report.sameSolveThreadCount, true);
  assert.deepEqual(Object.keys(report.engines).sort(), ['original', 'rust']);
  for (const [i, item] of corpus.cases.entries()) {
    assert.equal(input.cases[i].id, item.id); assert.equal(input.cases[i].scramble, item.scramble);
    assert(Number.isInteger(input.cases[i].htm) && input.cases[i].htm >= 0 && input.cases[i].htm <= 20);
  }
}

function checkedWasmResults(directory: string, review: any) {
  const input = json(resolve(directory, 'input.json')), report = json(resolve(directory, 'report.json'));
  const corpus = readWca100(); validateWasmSummary(report, input, review.variant, corpus);
  for (const key of ['platform', 'arch', 'cpuModel', 'osRelease']) assert.equal(input.machine[key], review.machine[key]);
  assert.equal(input.table, review.table.path); assert.equal(input.small, review.snapshot.path);
  for (const [file, digest] of Object.entries(input.sourceHashes)) assert.equal(hash(read(file)), digest);
  for (const role of ['wasm', 'wrapper', 'worker']) assert.equal(input.artifacts.rust.sha256[role], review.wasmBuild.artifacts[role].sha256);
  const original = getVariant(review.variant);
  assert.equal(input.artifacts.original.sha256.wasm, original.wasmSha256);
  assert.equal(input.artifacts.original.sha256.wrapper, original.wrapperSha256);
  const results = [];
  for (const engine of ['rust', 'original']) {
    const summary = report.engines[engine], dir = resolve(directory, engine);
    assert.deepEqual(summary, json(resolve(dir, 'report.json')));
    const rows = parseCompleteJsonl(read(resolve(dir, 'results.jsonl'), 32 * 1024 ** 2).toString(), 100);
    const raw = parseCompleteJsonl(read(resolve(dir, 'raw.jsonl'), 32 * 1024 ** 2).toString(), 102);
    assert.equal(raw[0].type, 'ready'); assert.equal(raw[0].threads, 18); assert.equal(raw[0].warmupCases, 0);
    assert.equal(raw.at(-1).type, 'finished'); assert.equal(raw.at(-1).cases, 100); assert.equal(raw.at(-1).threads, 18);
    assert.equal(summary.engine, engine); assert.equal(summary.processExited, true); assert.equal(summary.threads, 18);
    assert.equal(summary.cases, 100); assert.equal(summary.verifiedSolutions, 100); assert.equal(summary.optimalLengthsMatched, 100);
    assert.equal(summary.measuredPasses, 1); assert.equal(summary.warmupCases, 0);
    assert.equal(summary.tableSha256, input.tableSha256); assert.deepEqual(summary.artifacts, input.artifacts[engine]);
    for (const [role, file] of Object.entries(input.artifacts[engine].files)) assert.equal(hash(read(file as string)), input.artifacts[engine].sha256[role]);
    for (const [i, row] of rows.entries()) {
      assert.equal(row.id, corpus.cases[i].id); assert.equal(row.index, i); assert.equal(row.threads, 18);
      assert.equal(row.verified, true); assert.equal(row.optimalLengthMatched, true); assert.equal(row.length, input.cases[i].htm);
      assert.deepEqual(row, { ...raw[i + 1], verified: true, optimalLengthMatched: true, expectedLength: input.cases[i].htm });
      assert(Number.isFinite(row.seconds) && row.seconds >= 0);
      if (engine === 'rust') {
        assert.equal(row.search.threads, 18); assert.equal(row.search.contexts, 8); assert.equal(row.search.cancelled, false);
        validateSharedDepthResults(row.search, 18);
      }
    }
    assert.equal(summary.totalSeconds, rows.reduce((n: number, row: any) => n + row.seconds, 0));
    assert.equal(summary.peakRssBytes, raw.at(-1).maxRssKiB * 1024);
    assert(Number.isSafeInteger(summary.peakRssBytes) && summary.peakRssBytes > 0);
    results.push({ id: engine === 'rust' ? `rust-wasm-opt-${review.variant}` : `opt-${review.variant}`,
      machineId: 'mac', threads: 18, seconds: summary.totalSeconds, peakRssBytes: summary.peakRssBytes });
  }
  return { results, reportPath: resolve(directory, 'report.json'), reportSha256: hash(read(resolve(directory, 'report.json'))) };
}

export async function runMultithread(requestPath: string, output: string) {
  assert.equal(process.platform, 'darwin', 'This runner is for the reviewed local Mac only');
  assert(output.startsWith(BASE + '/'), 'Run summaries belong under the local research directory');
  const requestBytes = read(requestPath), request = JSON.parse(requestBytes.toString());
  const reviewBytes = read(request.reviewPath), review = JSON.parse(reviewBytes.toString());
  const policy = validatePreparedRequest(request, review, reviewBytes, cpus().length);
  const prefix = resolve(BASE, request.label);
  const stdoutPath = prefix + (policy.entry === 'native' ? '.jsonl' : '.stdout.log');
  const stderrPath = `${prefix}.stderr.log`, exitPath = `${prefix}-exit.json`;
  const resourcePath = `${prefix}-resources.json`, reportPath = resolve(output, 'native-report.json');
  const compactPath = resolve(output, 'compact-result.json'), startedPath = resolve(output, 'run-start.json');
  for (const file of [stdoutPath, stderrPath, exitPath, resourcePath, reportPath, compactPath, startedPath, resolve(output, 'failure.json')])
    assert(!existsSync(file), `Refusing to overwrite or resume ${file}`);
  if (policy.wasmConfig) assert(!existsSync(policy.wasmConfig.out), 'WASM output must be new');
  const env = cleanRunEnvironment(request.env);
  mkdirSync(output, { recursive: true });
  save(startedPath, { schema: 'cuberoot.multithread-wca100-run.v1', startedAt: new Date().toISOString(),
    requestPath, requestSha256: hash(requestBytes), reviewPath: request.reviewPath, reviewSha256: request.reviewSha256,
    label: request.label, automaticRetries: 0, automaticNextRun: false });
  const fds: number[] = [];
  try {
    fds.push(openSync(stdoutPath, 'wx', 0o600)); fds.push(openSync(stderrPath, 'wx', 0o600));
    // There is no direct native/WASM execution path and no inherited stdin.
    const child = spawn(process.execPath, ['--experimental-strip-types', resolve(HERE, 'guard.mts'),
      request.label, request.executable, ...request.args], { cwd: ROOT, env, stdio: ['ignore', fds[0], fds[1]] });
    let spawnError: string | null = null;
    child.on('error', error => { spawnError = String(error); });
    const interrupt = () => { child.kill('SIGTERM'); };
    process.once('SIGINT', interrupt); process.once('SIGTERM', interrupt);
    let completion;
    try {
      completion = await new Promise<{ exitCode: number | null; signal: NodeJS.Signals | null; finishedAt: string; spawnError: string | null }>(done => {
        child.once('close', (exitCode, signal) => done({ exitCode, signal, finishedAt: new Date().toISOString(), spawnError }));
      });
    } finally {
      process.removeListener('SIGINT', interrupt); process.removeListener('SIGTERM', interrupt);
    }
    for (const fd of fds) fsyncSync(fd);
    while (fds.length) closeSync(fds.pop()!);
    save(exitPath, completion);
    assert.equal(completion.spawnError, null); assert.equal(completion.exitCode, 0); assert.equal(completion.signal, null);
    assert.equal(hash(read(requestPath)), hash(requestBytes), 'Request changed during run');
    assert.equal(hash(read(request.reviewPath)), request.reviewSha256, 'Review changed during run');
    const resources = json(resourcePath), evidence = collectMultithreadEvidence(request);
    validateRunCompletion(request, review, evidence, resources, completion);
    let verified;
    if (policy.entry === 'native') {
      const report = await reportNativeMultithread({ reviewPath: request.reviewPath, prefix, output: reportPath });
      verified = { results: [{ id: report.id, machineId: 'mac', threads: 18, seconds: report.totalSeconds, peakRssBytes: report.peakRssBytes }],
        reportPath, reportSha256: hash(read(reportPath)) };
    } else verified = checkedWasmResults(policy.wasmConfig!.out, review);
    const compact = { schema: 'cuberoot.multithread-wca100-result.v1', completedAt: new Date().toISOString(),
      complete: true, corpusSha256: review.input.corpusSha256, machine: review.machine,
      threads: 18, cases: 100, measuredPasses: 1, warmupCases: 0, ...verified,
      requestPath, requestSha256: hash(requestBytes), reviewPath: request.reviewPath, reviewSha256: request.reviewSha256,
      resourcesPath: resourcePath, resourcesSha256: hash(read(resourcePath)), exitPath, exitSha256: hash(read(exitPath)) };
    save(compactPath, compact); return compact;
  } catch (error) {
    save(resolve(output, 'failure.json'), { failedAt: new Date().toISOString(), error: String(error),
      automaticRetries: 0, automaticNextRun: false, partialResultsPreserved: true });
    throw error;
  } finally { while (fds.length) closeSync(fds.pop()!); }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  assert(args.length === 4 && args[0] === '--request' && args[2] === '--out', 'Usage: run-multithread.mts --request REQUEST.json --out SUMMARY_DIRECTORY');
  runMultithread(resolve(args[1]), resolve(args[3])).then(result => console.log(JSON.stringify(result)))
    .catch(error => { console.error(error); process.exitCode = 1; });
}
