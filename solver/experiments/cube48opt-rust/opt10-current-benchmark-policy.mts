/** One newly authorized Opt10 measurement; historical runs remain immutable. */
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { availableParallelism } from 'node:os';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { officialArgs, officialPaths, officialPolicy, officialBinarySha256,
  collectOfficialEvidence, officialDigest, readOfficialRecord } from './opt10-official-policy.mts';
import { observeStatsResources } from './stats-resume-review.mts';
import { resumeHistory } from './zbll-resume-review.mts';

const here = import.meta.dirname, root = resolve(here, '../../..');
export const currentLabel = 'opt10-official-wca1000-mt16-20261022';
export const currentDirectory = resolve(root, '.tmp/cubeopt-reverse', currentLabel);
export const currentReviewPath = resolve(currentDirectory, 'session.json');
export const currentStopPath = resolve(currentDirectory, 'stop.json');
export const currentReceiptPath = resolve(currentDirectory, 'receipt.json');
export const currentBoot = '{ sec = 1792552678, usec = 709045 } Tue Oct 20 20:17:58 2026';
const corpusSha256 = '5b42a18086b27e974115a73696702017b5dde0a19c9819a77c88c8014d67c8ea';
type Observation = { boot: string; swapouts: number; pressure: number; available: number };

export function currentRequest() {
  return { label: currentLabel, executable: officialPaths.executable, args: [...officialArgs], env: {
    CUBEOPT_OPT10_CURRENT_REVIEW: currentReviewPath, CUBEOPT_BACKEND: 'opt10',
    CUBEOPT_SEARCH_THREADS: '16', CUBEOPT_SOLVE_THREADS: '1', CUBEOPT_MEASURE_RSS: '1',
  } };
}
export function currentPolicy(request: { label: string; executable: string; args: string[]; env: NodeJS.ProcessEnv }) {
  const expected = currentRequest();
  assert.equal(request.label, expected.label); assert.equal(request.executable, expected.executable);
  assert.deepEqual(request.args, expected.args);
  assert.deepEqual(Object.fromEntries(Object.entries(request.env).filter(([key]) => key.startsWith('CUBEOPT_'))), expected.env);
  assert.equal(request.env.NODE_OPTIONS, undefined); assert.equal(request.env.NODE_PATH, undefined);
  assert.equal(process.platform, 'darwin'); assert.equal(process.arch, 'arm64');
  // Reuse the exact release command and budget without reusing its old boot review.
  const { CUBEOPT_OPT10_CURRENT_REVIEW: _, ...env } = expected.env;
  const policy = officialPolicy({ ...expected, env: { ...env,
    CUBEOPT_OPT10_OFFICIAL_REVIEW: resolve(officialPaths.reviews, `${currentLabel}.json`),
  } }, availableParallelism());
  return { ...policy, openBenchmark: true as const, opt10CurrentBenchmark: true as const,
    scopeStopPath: currentStopPath };
}

/** Existing release verification reads only small files and the 1024-byte header. */
export function collectCurrentEvidence() {
  const release = collectOfficialEvidence();
  const sources = ['guard.mts', 'opt10-current-benchmark-policy.mts', 'opt10-official-policy.mts',
    'opt10-release.mts', 'stats-resume-review.mts', 'zbll-resume-review.mts'];
  return {
    releaseSha256: release.releaseSha256, executableSha256: release.executableSha256,
    snapshotManifestSha256: release.snapshotManifestSha256, benchmarkSha256: release.benchmarkSha256,
    input: release.input, table: release.table, snapshot: release.snapshot,
    history: resumeHistory(),
    sources: Object.fromEntries(sources.map(name => [name, officialDigest(readOfficialRecord(resolve(here, name)))])),
  };
}
export function validateCurrentSession(review: any, evidence: ReturnType<typeof collectCurrentEvidence>,
    current: Observation, used = false, stopped = false) {
  const policy = currentPolicy(currentRequest());
  assert(!used && !stopped, 'This Opt10 run was consumed or stopped; no automatic retry');
  assert.equal(review.schema, 'cuberoot.opt10-current-benchmark-review.v1');
  assert.equal(review.scope, currentLabel); assert.deepEqual(review.request, currentRequest());
  assert.deepEqual([review.cases, review.threads, review.passes, review.warmupCases], [1000, 16, 1, 0]);
  assert.equal(review.boot, currentBoot); assert.equal(review.swapouts, 0);
  assert.equal(current.boot, review.boot); assert.equal(current.swapouts, review.swapouts);
  assert.equal(current.pressure, 1); assert(current.available >= policy.rssLimit + 3 * 2 ** 30, 'Insufficient Opt10 startup memory');
  assert.equal(evidence.executableSha256, officialBinarySha256);
  assert.equal(evidence.input.corpusSha256, corpusSha256); assert.equal(evidence.input.cases, 1000);
  assert.deepEqual(review.evidence, evidence, 'Release, input, guard or historical protection records changed');
  assert(Number.isFinite(Date.parse(review.preparedAt)));
  return review;
}
function used() {
  return existsSync(currentReceiptPath) || ['-resources.json', '-exit.json', '-started.json']
    .some(suffix => existsSync(resolve(root, '.tmp/cubeopt-reverse', currentLabel + suffix)));
}
export function validateCurrentReview(request: Parameters<typeof currentPolicy>[0], current: Observation) {
  currentPolicy(request);
  const reviewBytes = readOfficialRecord(currentReviewPath), review = JSON.parse(reviewBytes.toString());
  const evidence = collectCurrentEvidence();
  validateCurrentSession(review, evidence, current, used(), existsSync(currentStopPath));
  const input = readOfficialRecord(officialPaths.input);
  assert.equal(officialDigest(input), evidence.input.sha256, 'Input changed between validation and delivery');
  return { receiptPath: currentReceiptPath, input, receipt: {
    schema: 'cuberoot.opt10-current-benchmark-consumption.v1', scope: currentLabel,
    reviewSha256: officialDigest(reviewBytes), request: currentRequest(), before: current,
    consumedAt: new Date().toISOString(),
  } };
}
export function prepareCurrentBenchmark() {
  assert(!existsSync(currentReviewPath), 'Session already prepared; do not overwrite');
  const current = observeStatsResources();
  assert(!current.computeRunning && !current.lockExists, 'Another computation or retained lock prevents preparation');
  const evidence = collectCurrentEvidence();
  const review = { schema: 'cuberoot.opt10-current-benchmark-review.v1', scope: currentLabel,
    authorization: 'User requested a new Opt10-only WCA1000 measurement, one pass without warmup; no push or deployment.',
    preparedAt: new Date().toISOString(), boot: currentBoot, swapouts: 0,
    cases: 1000, threads: 16, passes: 1, warmupCases: 0, request: currentRequest(), evidence };
  validateCurrentSession(review, evidence, current, used(), existsSync(currentStopPath));
  mkdirSync(currentDirectory, { recursive: true });
  writeFileSync(currentReviewPath, JSON.stringify(review, null, 2) + '\n', { flag: 'wx', mode: 0o600 });
  return { preparedOnly: true, engineStarted: false, review: currentReviewPath, request: currentRequest() };
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  assert.deepEqual(process.argv.slice(2), ['prepare'], 'Only prepare is supported; execution must use guard.mts');
  console.log(JSON.stringify(prepareCurrentBenchmark(), null, 2));
}
