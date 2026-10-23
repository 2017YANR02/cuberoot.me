/** One user-requested ZBLL candidate sample. Never resumes a stopped scope. */
import assert from 'node:assert/strict';
import { constants, openSync, closeSync, fstatSync, readFileSync, existsSync, mkdirSync, writeFileSync, lstatSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { verifyOpt9Release } from './opt9-release.mts';
import { observeStatsResources } from './stats-resume-review.mts';
import { resumeHistory } from './zbll-resume-review.mts';

const here = import.meta.dirname, root = resolve(here, '../../..'), GiB = 2 ** 30;
const research = resolve(root, '.tmp/cubeopt-reverse');
const failedLabel = 'zbll-mcc-20261023-opt9';
const failedDir = resolve(root, '.tmp/zbll-mcc-20261023');
export const zbllMultisolutionLabel = 'zbll-mcc-20261023-opt9-single';
export const zbllMultisolutionDir = resolve(failedDir, 'single');
export const zbllMultisolutionPaths = {
  input: resolve(failedDir, 'input.tsv'),
  review: resolve(zbllMultisolutionDir, 'session.json'),
  receipt: resolve(zbllMultisolutionDir, 'receipt.json'),
  stop: resolve(zbllMultisolutionDir, 'stop.json'),
  executable: resolve(here, 'target/opt9-official/release/cube48opt-research'),
  small: resolve(research, 'opt9-generated/small-memory.bin'),
  table: resolve(research, 'opt9-generated/h48prun31h9.dat'),
  tableManifest: resolve(research, 'opt9-generated/table.json'),
};
const binarySha256 = '3314f88daaf8be5423ae862e359c98fc741a0f9ea8bbd9695f45fd474eb857a9';
const smallSha256 = '0db5898f544781d7088be836e9759c61d45ffcc7bf3ceb18010f5cba5932377d';
const tableManifestSha256 = '2f6046f7f33da72eaf052fca6505450a19a6430074addd4137fb6650f41faa9c';
const tableBytes = 15_565_455_360;
export const zbllMultisolutionMaxNodes = 5_000_000;
type Observation = { boot: string; swapouts: number; pressure: number; available: number };
const sha = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex');
function read(path: string, limit = 8 * 2 ** 20) {
  const fd = openSync(path, constants.O_RDONLY | constants.O_NOFOLLOW);
  try {
    const info = fstatSync(fd);
    assert(info.isFile() && info.size <= limit, `Expected bounded regular file: ${path}`);
    return readFileSync(fd);
  } finally { closeSync(fd); }
}
export function zbllMultisolutionRequest() {
  const p = zbllMultisolutionPaths;
  return { label: zbllMultisolutionLabel, executable: p.executable,
    args: ['solve', p.small, p.table, '8', '20', String(zbllMultisolutionMaxNodes)],
    env: { CUBEOPT_ZBLL_MULTISOLUTION_REVIEW: p.review, CUBEOPT_BACKEND: 'opt',
      CUBEOPT_VARIANT: '9', CUBEOPT_SOLVE_THREADS: '1', CUBEOPT_SEARCH_THREADS: '1', CUBEOPT_MEASURE_RSS: '1' } };
}
export function zbllMultisolutionPolicy(request: { label: string; executable: string; args: string[]; env: NodeJS.ProcessEnv }) {
  const expected = zbllMultisolutionRequest();
  assert.equal(request.label, expected.label); assert.equal(request.executable, expected.executable);
  assert.deepEqual(request.args, expected.args);
  assert.deepEqual(Object.fromEntries(Object.entries(request.env).filter(([key]) => key.startsWith('CUBEOPT_'))), expected.env);
  assert.equal(request.env.NODE_OPTIONS, undefined); assert.equal(request.env.NODE_PATH, undefined);
  assert.equal(process.platform, 'darwin'); assert.equal(process.arch, 'arm64');
  return { entry: 'native', mode: 'solve', backend: 'opt', variant: 9, h: null, tablePath: null,
    tableBytes, rssLimit: tableBytes + GiB, measureNativeRss: true, deadlineMs: 10 * 60_000,
    openBenchmark: true as const, zbllMultisolution: true as const, scopeStopPath: zbllMultisolutionPaths.stop };
}
export function validateZbllMultisolutionInput(input: Buffer) {
  assert(input.length > 0 && input.length <= 1024 * 1024, 'Candidate input must be bounded');
  const source = input.toString('utf8');
  assert(source.endsWith('\n') && !source.includes('\r'), 'Canonical LF input required');
  const rows = source.slice(0, -1).split('\n'), ids = new Set<string>();
  assert(rows.length >= 1 && rows.length <= 5000, 'At most 5000 candidate states');
  for (const row of rows) {
    const parts = row.split('\t');
    assert.equal(parts.length, 2);
    const [id, scramble] = parts;
    assert(/^[A-Za-z0-9_-]{1,64}$/.test(id) && !ids.has(id), 'Unique bounded candidate IDs required');
    ids.add(id);
    const moves = scramble.split(' ');
    assert(moves.length >= 1 && moves.length <= 100 && moves.every(move => /^[URFDLB](?:2|')?$/.test(move)),
      'Solver input must be canonical outer turns');
  }
  return { sha256: sha(input), rows: rows.length, bytes: input.length };
}

// The original run failed in CLI argument validation, before loading its table.
// This exact, immutable failure is the only predecessor accepted by this repair.
const setupFailureHashes = {
  review: ['session.json', '04b88057be24f1184a2bdb4657fc49c5f41969f3a01c9ccb63ee8d045b18e54d'],
  receipt: ['receipt.json', 'd6cedb355da79bf623ebeb3cd88935b703360f4cf0fd6481dd4413cc93597438'],
  stop: ['stop.json', 'df5c88ce7c47688195c3de30b2f61f247ed8673f26996e492dcaaf1ccb030bba'],
  run: ['run.json', '59898fa236a2b7bb200b6c6731116fbe30c1995950ddf49c8008d4cab37d7dff'],
  raw: ['raw.jsonl', 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'],
  stderr: ['stderr.log', 'a9012bb519ddf9e846fa68903221515c1e8e0daf3328a26f2aae44c761b3c964'],
  resources: [resolve(research, failedLabel + '-resources.json'), '9fbb8c37fb3540ee799450736cd0a906aa8a23b50af798ebbc0b56ee7ee8fcd0'],
  exit: [resolve(research, failedLabel + '-exit.json'), '59898fa236a2b7bb200b6c6731116fbe30c1995950ddf49c8008d4cab37d7dff'],
} as const;
export function validateZbllSetupFailure(failure: { review: any; receipt: any; stop: any; run: any;
    raw: Buffer; stderr: string; resources: any; exit: any }) {
  const { review, receipt, stop, run, raw, stderr, resources, exit } = failure;
  const request = zbllMultisolutionRequest();
  const failedRequest = { ...request, label: failedLabel, env: { ...request.env,
    CUBEOPT_ZBLL_MULTISOLUTION_REVIEW: resolve(failedDir, 'session.json'), CUBEOPT_SEARCH_THREADS: '4' } };
  assert.equal(review.schema, 'cuberoot.zbll-multisolution-review.v1'); assert.equal(review.scope, failedLabel);
  assert.deepEqual(review.request, failedRequest); assert.deepEqual(receipt.request, failedRequest);
  assert.equal(receipt.schema, 'cuberoot.zbll-multisolution-consumption.v1'); assert.equal(receipt.scope, failedLabel);
  assert.equal(receipt.reviewSha256, setupFailureHashes.review[1]);
  assert.equal(receipt.inputSha256, review.evidence.input.sha256);
  assert.deepEqual(resources.openBenchmarkReceipt, receipt);
  const reason = 'Opt10 fixed input pipe failed: Error: write EPIPE';
  for (const item of [stop, resources]) {
    assert.equal(item.stopped, reason); assert.equal(item.trigger.reason, reason);
    assert.equal(item.pressure, 1); assert.equal(item.boot, review.boot); assert.equal(item.swapouts, review.swapouts);
    assert.equal(item.trigger.details, undefined, 'Resource/observation stops are not eligible');
  }
  assert.equal(receipt.before.boot, review.boot); assert.equal(receipt.before.swapouts, review.swapouts);
  assert.equal(resources.sessionSha256, setupFailureHashes.review[1]);
  assert.equal(resources.rssLimit, tableBytes + GiB); assert.equal(resources.tableBytes, tableBytes);
  assert(resources.peakRss > 0 && resources.peakRss < 256 * 2 ** 20, 'Failure must precede table loading');
  assert(resources.minimumHeadroom >= 2 * GiB);
  assert.equal(raw.length, 0); assert.equal(run.count, 0); assert.equal(run.firstResultSeconds, null);
  assert.deepEqual(run.milestones, []); assert.equal(run.exitCode, 1); assert.equal(run.signal, null);
  assert(run.wallSeconds > 0 && run.wallSeconds < 5); assert.deepEqual(exit, run);
  assert.equal(run.guardPid, resources.guardPid);
  assert(stderr.startsWith('parallel single-cube search requires MAX_NODES=0; finite node budgets remain available with CUBEOPT_SEARCH_THREADS=1\n'));
  const nativePeak = Number(stderr.match(/^\s*(\d+)\s+maximum resident set size$/m)?.[1]);
  assert(nativePeak > 0 && nativePeak < 16 * 2 ** 20, 'Native CLI must exit before table allocation');
  assert(/^\s*0\s+swaps$/m.test(stderr)); assert(/^\s*0\s+block input operations$/m.test(stderr));
  return { boot: review.boot as string, swapouts: review.swapouts as number, nativePeakRss: nativePeak };
}
function collectSetupFailure() {
  const bytes = Object.fromEntries(Object.entries(setupFailureHashes).map(([name, [path, expected]]) => {
    const value = read(resolve(failedDir, path));
    assert.equal(sha(value), expected, `Original failure evidence changed: ${name}`);
    return [name, value];
  }));
  const failure = Object.fromEntries(Object.entries(bytes).map(([name, value]) =>
    [name, name === 'raw' ? value : name === 'stderr' ? value.toString() : JSON.parse(value.toString())])) as Parameters<typeof validateZbllSetupFailure>[0];
  return { failure, summary: { ...validateZbllSetupFailure(failure),
    hashes: Object.fromEntries(Object.entries(setupFailureHashes).map(([name, [path, hash]]) => [resolve(failedDir, path), hash])) } };
}
export function collectZbllMultisolutionEvidence() {
  const p = zbllMultisolutionPaths, release = verifyOpt9Release();
  assert.equal(release.executable, p.executable); assert.equal(release.manifest.executable.sha256, binarySha256);
  assert.equal(sha(read(p.executable)), binarySha256); assert.equal(sha(read(p.small)), smallSha256);
  assert.equal(lstatSync(p.small).size, 818_008);
  const tableInfo = lstatSync(p.table);
  assert(tableInfo.isFile() && tableInfo.size === tableBytes, 'Canonical Opt9 table required');
  assert.equal(sha(read(p.tableManifest)), tableManifestSha256);
  const history = resumeHistory();
  for (const path of [resolve(research, 'opt10-official-wca1000-mt16-20261022/stop.json'),
    resolve(root, '.tmp/scramble-stats-opt10/protected-stop.json'),
    ...['resume-stop-20261015.json', 'resume-stop-after-ps-review-20261015.json'].map(name => resolve(root, '.tmp/double-zbll-symmetry-v2', name))])
    if (existsSync(path)) history[path] = sha(read(path));
  const historySummary = Object.fromEntries(Object.keys(history).sort().map(path => {
    const value = JSON.parse(read(path).toString());
    return [path, { sha256: history[path], boot: value.boot ?? null, swapouts: value.swapouts ?? null,
      stopped: value.stopped ?? null }];
  }));
  const setup = collectSetupFailure(), input = validateZbllMultisolutionInput(read(p.input, 1024 * 1024));
  assert.deepEqual(input, setup.failure.review.evidence.input, 'Repair cannot change the fixed original input');
  assert.deepEqual(historySummary, setup.failure.review.evidence.history, 'Historical protection evidence changed after setup failure');
  return { input, setupFailure: setup.summary,
    executableSha256: binarySha256, smallSha256, table: { path: p.table, bytes: tableBytes, manifestSha256: tableManifestSha256,
      dev: tableInfo.dev, ino: tableInfo.ino, mtimeMs: tableInfo.mtimeMs }, history: historySummary,
    sources: Object.fromEntries(['guard.mts', 'zbll-multisolution-policy.mts', 'opt9-release.mts', 'native-release.mts',
      'stats-resume-review.mts', 'zbll-resume-review.mts'].map(name => [name, sha(read(resolve(here, name)))])) };
}
export function validateZbllMultisolutionSession(review: any, evidence: ReturnType<typeof collectZbllMultisolutionEvidence>,
    current: Observation, used = false, stopped = false, now = Date.now()) {
  assert(!used && !stopped, 'ZBLL sample consumed or stopped; no automatic restart');
  assert.equal(review.schema, 'cuberoot.zbll-multisolution-review.v1');
  assert.equal(review.scope, zbllMultisolutionLabel); assert.deepEqual(review.request, zbllMultisolutionRequest());
  assert.deepEqual([review.cases, review.resultLimit, review.passes, review.warmupCases], [1, 200, 1, 0]);
  assert(typeof review.authorization === 'string' && review.authorization.length > 0);
  assert(typeof review.boot === 'string' && review.boot.length > 0);
  assert(Number.isSafeInteger(review.swapouts) && review.swapouts >= 0);
  assert.equal(current.boot, review.boot); assert.equal(current.swapouts, review.swapouts);
  assert.equal(review.boot, evidence.setupFailure.boot, 'Repair cannot reset the failed launch boot');
  assert.equal(review.swapouts, evidence.setupFailure.swapouts, 'Repair cannot reset the failed launch swap baseline');
  assert.equal(current.pressure, 1);
  assert(Number.isSafeInteger(current.available) && current.available >= tableBytes + 4 * GiB, 'Insufficient Opt9 startup memory');
  const preparedAt = Date.parse(review.preparedAt);
  assert(Number.isFinite(preparedAt) && preparedAt <= now && now - preparedAt <= 24 * 60 * 60_000, 'Session preparation expired');
  assert.deepEqual(review.evidence, evidence, 'Input, release, guard or historical protection evidence changed');
  return review;
}
function used() {
  return existsSync(zbllMultisolutionPaths.receipt) || ['-resources.json', '-exit.json', '-started.json']
    .some(suffix => existsSync(resolve(research, zbllMultisolutionLabel + suffix)));
}
export function validateZbllMultisolutionReview(request: Parameters<typeof zbllMultisolutionPolicy>[0], current: Observation) {
  zbllMultisolutionPolicy(request);
  const bytes = read(zbllMultisolutionPaths.review), review = JSON.parse(bytes.toString());
  const evidence = collectZbllMultisolutionEvidence();
  validateZbllMultisolutionSession(review, evidence, current, used(), existsSync(zbllMultisolutionPaths.stop));
  const input = read(zbllMultisolutionPaths.input, 1024 * 1024);
  assert.equal(sha(input), evidence.input.sha256, 'Input changed before delivery');
  return { input, receiptPath: zbllMultisolutionPaths.receipt, receipt: {
    schema: 'cuberoot.zbll-multisolution-consumption.v1', scope: zbllMultisolutionLabel,
    reviewSha256: sha(bytes), inputSha256: evidence.input.sha256, request: zbllMultisolutionRequest(),
    before: current, consumedAt: new Date().toISOString() } };
}
export function prepareZbllMultisolution() {
  assert(!existsSync(zbllMultisolutionPaths.review), 'Do not replace a prepared session');
  const current = observeStatsResources();
  assert(!current.computeRunning && !current.lockExists, 'Another computation or retained lock prevents preparation');
  const evidence = collectZbllMultisolutionEvidence();
  const review = { schema: 'cuberoot.zbll-multisolution-review.v1', scope: zbllMultisolutionLabel,
    authorization: 'Repair only the verified CLI rejection before table loading: single search thread with the same 5000000-node cap, fixed input and original boot/swap baseline.',
    preparedAt: new Date().toISOString(), boot: current.boot, swapouts: current.swapouts,
    cases: 1, resultLimit: 200, passes: 1, warmupCases: 0, request: zbllMultisolutionRequest(), evidence };
  validateZbllMultisolutionSession(review, evidence, current, used(), existsSync(zbllMultisolutionPaths.stop));
  mkdirSync(zbllMultisolutionDir, { recursive: true });
  writeFileSync(zbllMultisolutionPaths.review, JSON.stringify(review, null, 2) + '\n', { flag: 'wx', mode: 0o600 });
  return { preparedOnly: true, engineStarted: false, review: zbllMultisolutionPaths.review, request: zbllMultisolutionRequest() };
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  assert.deepEqual(process.argv.slice(2), ['prepare'], 'Execution must use guard.mts');
  console.log(JSON.stringify(prepareZbllMultisolution(), null, 2));
}
