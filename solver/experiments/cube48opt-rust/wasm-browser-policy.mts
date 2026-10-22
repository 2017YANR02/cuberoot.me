/** Four explicitly authorized Chrome cohorts, each consumed once, sharing one stop boundary. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { closeSync, constants, existsSync, fstatSync, mkdirSync, openSync, readFileSync, readSync, statSync, writeFileSync } from 'node:fs';
import { availableParallelism } from 'node:os';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { openBase, openHere, openRoot } from './open-benchmark-policy.mts';
import { getVariant } from './variants.mjs';
import { readWca100, sharedBuildSources } from './wasm-benchmark.mjs';
import { opt9RoundScopes, opt9RoundStopPath, validateOpt9RoundResourceRecords } from './wasm-dual-candidate-policy.mts';

const GiB = 2 ** 30, MiB = 2 ** 20;
export const browserSlots = ['original8', 'rust8', 'original9', 'rust9'] as const;
export type BrowserSlot = typeof browserSlots[number];
type Request = {label: string; executable: string; args: string[]; env: NodeJS.ProcessEnv};
export const browserDir = resolve(openBase, 'wasm-browser-20261015');
export const browserReviewPath = resolve(browserDir, 'session.json');
export const browserStopPath = resolve(browserDir, 'stop.json');
export const browserBoot = '{ sec = 1791771877, usec = 170806 } Sun Oct 11 19:24:37 2026';
const authorization = '本机 Chrome 对照原版和我们的 WASM：8 GB 档 WCA100、4线程；16 GB 档 WCA1000、16线程；每版一轮、零预热，Node 四版结束后运行';
const startupReserveAuthorization = '启动安全余量：3 GiB 该成 1G,然后测试';
const chromePath = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const chromeVersion = '155.0.8059.40';
const corpusHashes = {8: '92171d593d13982924ed16723f099bd771a873aaa2c30a0e08f319c86b75dcde',
  9: '5b42a18086b27e974115a73696702017b5dde0a19c9819a77c88c8014d67c8ea'};
const rustBuilds = {
  8: {dir: 'build-FcRcSF', sha256: 'b600c699ab91c29f0bef5a14b7c2871bf1fb03d840b8813d5656266132433bb6',
    metadataSha256: '6fd36070afdd7b1744e8cd8c22e27e0232d69c0a9dc937263999e0a30c2375e4'},
  9: {dir: 'build-gLDBF5', sha256: '17d66df66935894e28a5ee0c7494853f79444c96eac3b9b2b9d4832eedcfb545',
    metadataSha256: '7c029055137c3f8afd8ca87a29e4708c50b6eac67fa957c29a3b05e6f4318640'},
};
const nodeReportHashes = {
  'opt9-batch': '7c6ec49d8da419bbcb59ef12030c844a252b1f57694e6bc51a17af8a690d8954',
  'opt9-padded': '3cb25c8c5e46cc5351d4b91d69a43417fb44abfb3f497a66f3750e1439c5e775',
  'opt9-batch-padded': '262d2597bec20fbd3d0d5f5397325b8b33f4e24c6d98e650ff07a5d8cb36ebf7',
  'opt9-select': 'e0b40732cefec526b42aaf1a232e860cb4a8e3bd7864a2fe78b1fcfbfc744b64',
};
const frozenControls = resolve(openBase, 'wasm-opt9-round-controls-20261015');
const controlManifestSha256 = '47fa3afdb687b0b6fd3f22d066596168530b5e3f534baff324d315b0ffe51ca2';
export function isBrowserSlot(value: string): value is BrowserSlot { return (browserSlots as readonly string[]).includes(value); }
export function browserSlotConfig(slot: BrowserSlot) {
  assert(isBrowserSlot(slot), 'Unknown Chrome cohort');
  const variant = (slot.endsWith('8') ? 8 : 9) as 8 | 9, engine = slot.startsWith('rust') ? 'rust' : 'original';
  const publicDir = resolve(openRoot, 'core/packages/client/public/cubeopt');
  const wasm = engine === 'rust' ? resolve(openBase, 'rust-wasm-shared-builds', rustBuilds[variant].dir, 'cube48opt-rust8.wasm')
    : resolve(publicDir, `cube48opt${variant}.wasm`);
  return {slot, variant, engine, threads: variant === 8 ? 4 : 16, cases: variant === 8 ? 100 : 1000,
    passes: 1, warmupCases: 0, wasm, wasmSha256: engine === 'rust' ? rustBuilds[variant].sha256 : getVariant(variant).wasmSha256,
    wrapper: engine === 'rust' ? resolve(dirname(wasm), 'cube48opt-rust8.mjs') : resolve(publicDir, `cube48opt${variant}.mjs`),
    table: variant === 8 ? resolve(openBase, 'opt8-generated/h48prun31h8.dat')
      : resolve(openBase, 'opt9-generated/h48prun31h9.dat'),
    tableBytes: getVariant(variant).tableBytes, small: resolve(openBase, `opt${variant}-generated/small-memory.bin`),
    corpus: resolve(openRoot, `solver/testdata/benchmarks/wca-first${variant === 8 ? 100 : 1000}.json`), corpusSha256: corpusHashes[variant],
    out: resolve(browserDir, slot), label: `wasm-browser-${slot}-20261015`, chromePath, chromeVersion,
    profilePath: resolve(browserDir, 'profiles', slot)};
}
export const browserResourcePath = (slot: BrowserSlot) => resolve(openBase, `${browserSlotConfig(slot).label}-resources.json`);
export const browserReceiptPath = (slot: BrowserSlot) => resolve(browserDir, `${slot}-receipt.json`);
export function browserRequest(slot: BrowserSlot): Request {
  const config = browserSlotConfig(slot);
  return {label: config.label, executable: process.execPath,
    args: [resolve(openHere, 'wasm-browser-benchmark.mjs'), '--slot', slot, '--out', config.out],
    env: {CUBEOPT_BROWSER_REVIEW: browserReviewPath, CUBEOPT_BACKEND: 'opt', CUBEOPT_VARIANT: String(config.variant), CUBEOPT_SOLVE_THREADS: '1'}};
}
export function browserPolicy(request: Request) {
  assert.equal(request.env.CUBEOPT_BROWSER_REVIEW, browserReviewPath);
  const slot = request.args[2] as BrowserSlot, expected = browserRequest(slot), config = browserSlotConfig(slot);
  assert.equal(request.executable, expected.executable); assert.equal(request.label, expected.label); assert.deepEqual(request.args, expected.args);
  assert.deepEqual(Object.fromEntries(Object.entries(request.env).filter(([name]) => name.startsWith('CUBEOPT_'))), expected.env);
  assert.equal(process.platform, 'darwin'); assert.equal(process.arch, 'arm64'); assert(availableParallelism() >= config.threads);
  // Same table/frontier/worker allowance as Node, plus 256 MiB for Chrome's browser/GPU/helpers.
  const rssLimit = (config.variant === 8 ? 9_563_425_136 : 19_778_730_352) + 256 * MiB;
  return {entry: 'wasm-browser-benchmark.mjs', mode: 'single-pass', backend: 'opt', variant: config.variant,
    h: null, tablePath: null, tableBytes: config.tableBytes, measureNativeRss: false, wasmThreads: config.threads,
    rssLimit, startupReserveBytes: GiB, deadlineMs: 60 * 60_000, openBenchmark: true, browserBenchmark: true,
    browserSlot: slot, scopeStopPath: browserStopPath};
}
function sha(path: string) {
  const fd = openSync(path, constants.O_RDONLY | constants.O_NOFOLLOW), hash = createHash('sha256');
  try {
    const info = fstatSync(fd); assert(info.isFile() && info.size <= 128 * MiB, 'Only bounded evidence may be hashed, never a PDB');
    const buffer = Buffer.alloc(MiB);
    for (let offset = 0; offset < info.size;) {
      const count = readSync(fd, buffer, 0, Math.min(buffer.length, info.size - offset), offset);
      assert(count > 0); hash.update(buffer.subarray(0, count)); offset += count;
    }
    return hash.digest('hex');
  } finally { closeSync(fd); }
}
function read(path: string) {
  const fd = openSync(path, constants.O_RDONLY | constants.O_NOFOLLOW);
  try { const info = fstatSync(fd); assert(info.isFile() && info.size <= 4 * MiB); return JSON.parse(readFileSync(fd, 'utf8')); }
  finally { closeSync(fd); }
}
const hashes = (paths: string[]) => Object.fromEntries([...new Set(paths)].map(path => [path, sha(path)]));
const sources = ['wasm-browser-policy.mts', 'guard.mts', 'wasm-browser-benchmark.mjs', 'wasm-browser-adapter.mjs',
  'wasm-browser-worker.mjs', 'wasm-benchmark.mjs', 'wasm-dual-candidate-policy.mts', 'open-benchmark-policy.mts',
  'variants.mjs', 'original-wasm-compat.mjs'].map(name => resolve(openHere, name));
function collectHistory() {
  assert(!existsSync(opt9RoundStopPath), 'The Node round stopped; cannot continue into Chrome');
  const manifestPath = resolve(frozenControls, 'manifest.json'); assert.equal(sha(manifestPath), controlManifestSha256);
  const manifest = read(manifestPath), paths = [manifestPath];
  for (const [name, expected] of Object.entries(manifest.sources)) {
    const frozen = resolve(frozenControls, 'source', name); assert.equal(sha(frozen), expected); paths.push(frozen);
  }
  const resources: Record<string, any> = {};
  for (const scope of opt9RoundScopes) {
    const dir = resolve(openBase, `wasm-${scope}-20261015`), reportPath = resolve(dir, 'opt9-report.json');
    assert.equal(sha(reportPath), nodeReportHashes[scope]);
    const report = read(reportPath), reviewPath = resolve(dir, 'session.json'), review = read(reviewPath);
    assert.equal(report.exitCode, 0); assert.equal(report.verifiedSolutions, 1000); assert.equal(report.optimalLengthsMatched, 1000);
    assert.equal(report.cases, 1000); assert.equal(report.threads, 16); assert.equal(report.passes, 1); assert.equal(report.warmupCases, 0);
    assert.equal(report.reviewSha256, sha(reviewPath));
    for (const [path, expected] of Object.entries(review.history)) { assert.equal(sha(path), expected); paths.push(path); }
    // Compare historical controls to their immutable archive, never today's edited guard.
    for (const [path, expected] of Object.entries(review.sources)) {
      const relative = path.slice(openRoot.length + 1), frozen = resolve(frozenControls, 'source', relative);
      assert.equal(manifest.sources[relative], expected); assert.equal(sha(frozen), expected);
    }
    const receiptPath = resolve(dir, 'opt9-receipt.json'), receipt = read(receiptPath);
    assert.equal(report.receiptSha256, sha(receiptPath)); assert.equal(receipt.reviewSha256, sha(reviewPath));
    const resourcePath = resolve(openBase, `wasm-${scope}-20261015-resources.json`), resource = read(resourcePath);
    resources[scope] = resource; assert.equal(report.resourceSha256, sha(resourcePath)); assert.deepEqual(resource.openBenchmarkReceipt, receipt);
    const exitPath = resolve(dir, 'opt9-exit.json'); assert.equal(read(exitPath).exitCode, 0);
    const raw = resolve(dir, 'opt9/rust/results.jsonl'); assert.equal(report.rawSha256, sha(raw));
    paths.push(reportPath, reviewPath, receiptPath, resourcePath, exitPath, raw);
  }
  validateOpt9RoundResourceRecords(resources, false);
  return hashes(paths);
}
function chromeEvidence() {
  const version = execFileSync(chromePath, ['--version'], {encoding: 'utf8', timeout: 5000}).trim();
  assert(version.includes(chromeVersion), 'Chrome version changed; review the new runtime before using it');
  return {path: chromePath, version, executableSha256: sha(chromePath)};
}
function collectArtifacts() {
  const paths: string[] = [];
  for (const slot of browserSlots) {
    const config = browserSlotConfig(slot); assert.equal(sha(config.wasm), config.wasmSha256); paths.push(config.wasm, config.wrapper);
    if (config.engine === 'rust') {
      const metadata = resolve(dirname(config.wasm), 'build-metadata.json'), build = read(metadata);
      assert.equal(sha(metadata), rustBuilds[config.variant].metadataSha256);
      assert.equal(build.wasmSha256, config.wasmSha256); assert.equal(sha(config.wrapper), build.wrapperSha256);
      const worker = resolve(dirname(config.wasm), 'cube48opt-rust8-worker.mjs'); assert.equal(sha(worker), build.workerSha256);
      paths.push(metadata, worker);
      for (const [name, expected] of Object.entries(sharedBuildSources(build))) {
        const path = resolve(dirname(config.wasm), 'source', name); assert.equal(sha(path), expected); paths.push(path);
      }
    } else assert.equal(sha(config.wrapper), getVariant(config.variant).wrapperSha256);
  }
  return hashes(paths);
}
function collectInputs() {
  const referencePath = resolve(openBase, 'wca1000-mt16-rust-native-opt9-exp-fixed.jsonl');
  const referenceSha256 = sha(referencePath);
  return Object.fromEntries(browserSlots.map(slot => {
    const config = browserSlotConfig(slot), corpus = readWca100(config.corpus, config.cases);
    assert.equal(corpus.corpusSha256, config.corpusSha256); assert.equal(statSync(config.table).size, config.tableBytes);
    const tableManifestPath = resolve(openBase, `opt${config.variant}-generated/table.json`), tableManifest = read(tableManifestPath);
    assert.equal(tableManifest.variant, config.variant); assert.equal(tableManifest.tableBytes, config.tableBytes);
    assert(/^[a-f0-9]{64}$/.test(tableManifest.tableSha256));
    return [slot, {corpusSha256: corpus.corpusSha256, smallSha256: sha(config.small), tablePath: config.table, tableBytes: config.tableBytes,
      tableManifestPath, tableManifestSha256: sha(tableManifestPath), tableSha256: tableManifest.tableSha256,
      referencePath, referenceSha256}];
  }));
}
/** Pure checks: changing browser slots never resets the round's resource protection. */
export function validateBrowserState(review: any, current: any, policy: ReturnType<typeof browserPolicy>,
  state: {used: boolean; stopped: boolean}, now = Date.now()) {
  assert.equal(review.schema, 'cuberoot.chrome-wasm-review.v1'); assert.equal(review.authorization, authorization);
  assert.equal(review.startupReserveAuthorization, startupReserveAuthorization); assert.equal(review.startupReserveBytes, GiB);
  assert.deepEqual(review.slots, browserSlots); assert.equal(review.stopPath, browserStopPath);
  assert.equal(review.boot, browserBoot); assert.equal(review.swapouts, 48);
  assert.equal(current.boot, browserBoot); assert.equal(current.swapouts, 48); assert.equal(current.pressure, 1);
  assert(Number.isSafeInteger(current.available) && current.available >= policy.rssLimit + policy.startupReserveBytes, 'Insufficient memory');
  assert(!state.used && !state.stopped, 'Consumed browser cohort or stopped browser round');
  assert(now < Date.parse('2026-10-17T00:00:00Z'), 'Browser authorization expired');
}
export function validateBrowserPeerResources(records: Partial<Record<BrowserSlot, any>>, stopped: boolean) {
  assert(!stopped, 'Browser round stopped; no automatic continuation');
  for (const [slot, record] of Object.entries(records)) {
    assert(isBrowserSlot(slot)); const policy = browserPolicy(browserRequest(slot));
    assert.equal(record.boot, browserBoot); assert.equal(record.swapouts, 48); assert.equal(record.pressure, 1);
    assert.equal(record.stopped, ''); assert.equal(record.trigger, null); assert.equal(record.rssLimit, policy.rssLimit);
    assert(record.peakRss > 0 && record.peakRss <= policy.rssLimit && record.minimumHeadroom >= 2 * GiB);
  }
}
function checkRound() {
  validateBrowserPeerResources(Object.fromEntries(browserSlots.filter(slot => existsSync(browserResourcePath(slot)))
    .map(slot => [slot, read(browserResourcePath(slot))])), existsSync(browserStopPath));
}
export function validateBrowserReview(request: Request, current: any) {
  const policy = browserPolicy(request), slot = policy.browserSlot, config = browserSlotConfig(slot), review = read(browserReviewPath);
  checkRound();
  validateBrowserState(review, current, policy, {used: [browserReceiptPath(slot), browserResourcePath(slot), config.out, config.profilePath].some(existsSync),
    stopped: existsSync(browserStopPath)});
  assert.deepEqual(review.requests, browserSlots.map(browserRequest));
  assert.deepEqual(review.history, collectHistory()); assert.deepEqual(review.sources, hashes(sources));
  assert.deepEqual(review.artifacts, collectArtifacts()); assert.deepEqual(review.inputs, collectInputs());
  assert.deepEqual(review.chrome, chromeEvidence());
  return {receiptPath: browserReceiptPath(slot), input: Buffer.alloc(0), receipt: {
    schema: 'cuberoot.chrome-wasm-consumption.v1', slot, label: request.label, variant: config.variant,
    engine: `${config.engine}-browser-wasm`, threads: config.threads, cases: config.cases, passes: 1, warmupCases: 0,
    reviewSha256: sha(browserReviewPath), artifactSha256: config.wasmSha256, chrome: review.chrome, before: current,
    consumedAt: new Date().toISOString(), stopPath: browserStopPath}};
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  assert.deepEqual(process.argv.slice(2), ['prepare']); checkRound();
  assert(!existsSync(browserReviewPath), 'Browser review already exists');
  for (const slot of browserSlots) {
    const config = browserSlotConfig(slot); assert(![browserReceiptPath(slot), browserResourcePath(slot), config.out, config.profilePath].some(existsSync));
  }
  const review = {schema: 'cuberoot.chrome-wasm-review.v1', authorization, startupReserveAuthorization,
    startupReserveBytes: GiB, slots: browserSlots, stopPath: browserStopPath, boot: browserBoot, swapouts: 48,
    requests: browserSlots.map(browserRequest), history: collectHistory(), sources: hashes(sources),
    artifacts: collectArtifacts(), inputs: collectInputs(), chrome: chromeEvidence()};
  mkdirSync(browserDir, {recursive: true}); writeFileSync(browserReviewPath, JSON.stringify(review, null, 2) + '\n', {flag: 'wx'});
  console.log(browserReviewPath);
}
