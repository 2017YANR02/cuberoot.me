/** Independent Chrome result audit. Reads bounded evidence; never loads a PDB or starts a solver. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { constants, closeSync, existsSync, fstatSync, openSync, readFileSync, readSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { browserBoot, browserPolicy, browserRequest, browserReviewPath, browserSlotConfig, browserReceiptPath,
  browserResourcePath, validateBrowserState, type BrowserSlot } from './wasm-browser-policy.mts';
import { openBase, openHere, openRoot } from './open-benchmark-policy.mts';
import { parsePrintedSolution, readWca100, validateSharedDepthResults } from './wasm-benchmark.mjs';
import { verify } from './benchmark.mjs';
import { patchOriginalWrapper } from './original-wasm-compat.mjs';
import { adaptRustSources } from './wasm-browser-adapter.mjs';

const MiB = 2 ** 20, GiB = 2 ** 30;
const digest = (bytes: Buffer | string) => createHash('sha256').update(bytes).digest('hex');
function readBytes(path: string, maximum = 4 * MiB) {
  const fd = openSync(path, constants.O_RDONLY | constants.O_NOFOLLOW);
  try { const info = fstatSync(fd); assert(info.isFile() && info.size <= maximum); return readFileSync(fd); }
  finally { closeSync(fd); }
}
const read = (path: string) => JSON.parse(readBytes(path).toString('utf8'));
function sha(path: string) {
  const fd = openSync(path, constants.O_RDONLY | constants.O_NOFOLLOW), hash = createHash('sha256');
  try {
    const info = fstatSync(fd); assert(info.isFile() && info.size <= 128 * MiB, 'Evidence only; no PDB hashing');
    const buffer = Buffer.alloc(MiB);
    for (let offset = 0; offset < info.size;) {
      const count = readSync(fd, buffer, 0, Math.min(buffer.length, info.size - offset), offset);
      assert(count > 0); hash.update(buffer.subarray(0, count)); offset += count;
    }
    return hash.digest('hex');
  } finally { closeSync(fd); }
}
function lines(path: string) {
  const text = readBytes(path, 128 * MiB).toString('utf8'); assert(text.endsWith('\n'));
  return text.trim().split('\n').map(line => JSON.parse(line));
}
const timestamp = (value: unknown) => { assert.equal(typeof value, 'string'); const time = Date.parse(value as string); assert(Number.isFinite(time)); return time; };
/** Keep upstream's printed counters named separately: they are not Rust's search.nodes. */
export function parseOriginalNodeFields(output: string[]) {
  const matched = [...output.join('\n').matchAll(/Cube\d+ finished in \d+,\s*(\d+)\/(\d+) node\(s\),[^\r\n]*?(\d+) split,\s*(\d+) pnode/g)];
  assert.equal(matched.length, 1, 'Exactly one original node-statistics line is required');
  const [activeContextVisits, inactiveContextSlots, splitCount, previousDepthActiveVisits] = matched[0].slice(1).map(Number);
  for (const value of [activeContextVisits, inactiveContextSlots, splitCount, previousDepthActiveVisits]) assert(Number.isSafeInteger(value) && value >= 0);
  return {activeContextVisits, inactiveContextSlots, splitCount, previousDepthActiveVisits};
}
export function validateBrowserCompletion(resource: any, exit: any, cleanup: any, rssLimit: number) {
  assert.equal(exit.exitCode, 0); assert.equal(resource.boot, browserBoot); assert.equal(resource.swapouts, 48);
  assert.equal(resource.pressure, 1); assert.equal(resource.stopped, ''); assert.equal(resource.trigger, null);
  assert.equal(resource.rssLimit, rssLimit); assert(resource.peakRss > 0 && resource.peakRss <= rssLimit);
  assert(resource.minimumHeadroom >= 2 * GiB);
  assert.deepEqual(cleanup.remaining, [], 'Chrome cleanup left live processes');
  assert(Array.isArray(cleanup.knownPids) && cleanup.knownPids.length > 0);
  assert(timestamp(resource.sampledAt) >= timestamp(cleanup.completed), 'Resources must include the final post-cleanup sample');
  assert(timestamp(exit.recordedAt) >= timestamp(resource.sampledAt), 'Exit evidence predates the terminal guard sample');
}

export async function reportBrowser(slot: BrowserSlot) {
  const config = browserSlotConfig(slot), request = browserRequest(slot), policy = browserPolicy(request), out = config.out;
  const outputPath = resolve(out, 'report.json'); assert(!existsSync(outputPath), 'Never overwrite a Chrome report');
  assert(!existsSync(resolve(out, 'failure.json')), 'Failed browser run is not a benchmark result');
  const paths = {result: resolve(out, 'result.json'), ready: resolve(out, 'ready.json'), input: resolve(out, 'input.json'),
    raw: resolve(out, 'results.jsonl'), cleanup: resolve(out, 'cleanup.json'), exit: resolve(out, 'exit.json'),
    resource: browserResourcePath(slot), receipt: browserReceiptPath(slot), review: browserReviewPath};
  const result = read(paths.result), ready = read(paths.ready), input = read(paths.input), cleanup = read(paths.cleanup), exit = read(paths.exit);
  const resource = read(paths.resource), receipt = read(paths.receipt), review = read(paths.review);
  validateBrowserCompletion(resource, exit, cleanup, policy.rssLimit);
  validateBrowserState(review, receipt.before, policy, {used: false, stopped: false}, timestamp(receipt.consumedAt));
  assert.equal(receipt.schema, 'cuberoot.chrome-wasm-consumption.v1'); assert.equal(receipt.slot, slot);
  assert.equal(receipt.label, config.label); assert.equal(receipt.variant, config.variant);
  assert.equal(receipt.engine, `${config.engine}-browser-wasm`); assert.equal(receipt.cases, config.cases);
  assert.equal(receipt.threads, config.threads); assert.equal(receipt.passes, 1); assert.equal(receipt.warmupCases, 0);
  assert.equal(receipt.reviewSha256, sha(paths.review)); assert.equal(receipt.artifactSha256, config.wasmSha256);
  assert.deepEqual(resource.openBenchmarkReceipt, receipt); assert.deepEqual(receipt.chrome, review.chrome);
  assert.equal(resource.variant, config.variant); assert.equal(resource.wasmThreads ?? config.threads, config.threads);
  assert.equal(resource.tableBytes, config.tableBytes); assert.equal(resource.entry, 'wasm-browser-benchmark.mjs');
  assert.equal(resource.mode, 'single-pass'); assert.equal(resource.backend, 'opt');
  for (const field of ['history', 'sources', 'artifacts']) {
    assert(review[field] && Object.keys(review[field]).length > 0);
    for (const [path, expected] of Object.entries(review[field])) assert.equal(sha(path), expected, `${field} changed: ${path}`);
  }
  assert.equal(review.artifacts[config.wasm], config.wasmSha256); assert.equal(sha(config.wasm), config.wasmSha256);
  const corpus = readWca100(config.corpus, config.cases);
  assert.equal(corpus.corpusSha256, config.corpusSha256); assert.equal(review.inputs[slot].corpusSha256, corpus.corpusSha256);
  assert.equal(review.inputs[slot].tableBytes, config.tableBytes); assert.equal(review.inputs[slot].smallSha256, sha(config.small));
  const reviewedInput = review.inputs[slot];
  assert.equal(reviewedInput.tableManifestPath, resolve(openBase, `opt${config.variant}-generated/table.json`));
  assert.equal(reviewedInput.tableManifestSha256, sha(reviewedInput.tableManifestPath));
  assert.equal(read(reviewedInput.tableManifestPath).tableSha256, reviewedInput.tableSha256);
  assert.equal(input.schema, 'cuberoot.chrome-wasm-run.v1'); assert.equal(result.schema, 'cuberoot.chrome-wasm-result.v1');
  for (const value of [input, result, ready]) {
    assert.equal(value.mode, 'benchmark'); assert.equal(value.engine, config.engine); assert.equal(value.variant, config.variant);
    assert.equal(value.threads, config.threads); assert.equal(value.warmupCases, 0);
  }
  assert.equal(input.slot, slot); assert.equal(result.slot, slot); assert.equal(input.passes, 1); assert.equal(result.passes, 1);
  assert.equal(input.corpusSha256, corpus.corpusSha256); assert.equal(result.corpusSha256, corpus.corpusSha256);
  assert.equal(input.tableSha256, reviewedInput.tableSha256); assert.equal(result.tableSha256, reviewedInput.tableSha256);
  assert.deepEqual(input.cases, corpus.cases); assert.equal(result.cases, config.cases);
  assert.equal(result.verifiedSolutions, config.cases); assert.equal(result.optimalLengthsMatched, config.cases);
  assert.equal(input.wasmSha256, config.wasmSha256); assert.equal(result.wasmSha256, config.wasmSha256);
  assert.equal(ready.capabilities.wasmSha256, config.wasmSha256);
  assert.equal(input.chrome.version, config.chromeVersion); assert.equal(result.chromeVersion, config.chromeVersion);
  assert(review.chrome.version.includes(config.chromeVersion)); assert.equal(review.chrome.path, config.chromePath);
  assert(input.chrome.args.includes(`--user-data-dir=${config.profilePath}`)); assert(input.chrome.args.includes('--remote-debugging-port=0'));
  assert.equal(input.chrome.environment.crossOriginIsolated, true); assert.equal(input.chrome.environment.sharedArrayBuffer, true);
  assert.equal(ready.capabilities.crossOriginIsolated, true); assert.equal(ready.capabilities.sharedMemory, true); assert.equal(ready.capabilities.memory64, true);
  assert.equal(ready.tableBytes, config.tableBytes); assert.equal(ready.loaded.loadedBytes, config.tableBytes);
  assert.equal(ready.loaded.chunkBytes, 8 * MiB); assert.equal(ready.loaded.chunkSha256Verified, true);
  assert(ready.linearMemoryBytes >= ready.loaded.tablePointer + config.tableBytes);
  assert(Number.isFinite(ready.loadSeconds) && ready.loadSeconds >= 0);
  const tableManifests = Object.keys(review.history).filter(path => path.endsWith('/table-manifest.json'))
    .map(path => read(path)).filter(value => value.variant === config.variant && value.tableBytes === config.tableBytes);
  assert(tableManifests.length > 0, 'Table checksum must match previously frozen history');
  for (const manifest of tableManifests) {
    assert.equal(input.tableSha256, manifest.tableSha256); assert.equal(result.tableSha256, manifest.tableSha256);
  }
  assert.equal(input.sourceSha256, review.sources[resolve(openHere, 'wasm-browser-benchmark.mjs')]);
  assert.equal(input.workerSha256, review.sources[resolve(openHere, 'wasm-browser-worker.mjs')]);
  assert.equal(sha(resolve(out, 'wasm-browser-worker.mjs')), input.workerSha256);
  const adapter = input.adapter, adapterPath = resolve(out, 'adapter/browser-adapter.json');
  assert.equal(adapter.manifestPath, adapterPath); assert.deepEqual(adapter, {...read(adapterPath), manifestPath: adapterPath});
  assert.equal(adapter.engine, config.engine); assert.equal(adapter.sources.wrapper.path, config.wrapper);
  assert.equal(adapter.sources.wrapper.sha256, review.artifacts[config.wrapper]);
  for (const [name, path] of Object.entries(adapter.files)) {
    assert.equal(path, resolve(out, 'adapter', name)); assert.equal(sha(path as string), adapter.sha256[name]);
  }
  for (const value of Object.values(adapter.sources) as any[]) assert.equal(sha(value.path), value.sha256);
  if (config.engine === 'original') {
    const expected = digest(patchOriginalWrapper(readBytes(config.wrapper).toString('utf8')));
    assert.equal(adapter.sha256['engine.mjs'], expected); assert.equal(adapter.sha256[`cube48opt${config.variant}.mjs`], expected);
  } else {
    const frozenWorker = resolve(dirname(config.wasm), 'cube48opt-rust8-worker.mjs');
    const adapted = adaptRustSources(readBytes(config.wrapper).toString('utf8'), readBytes(frozenWorker).toString('utf8'));
    assert.equal(adapter.sha256['engine.mjs'], digest(adapted.wrapper)); assert.equal(adapter.sha256['cube48opt-rust8-worker.mjs'], digest(adapted.worker));
    assert.equal(ready.metadata.threads, config.threads); assert.equal(ready.metadata.sharedTable, true); assert.equal(ready.metadata.abiVersion, 2);
  }
  const referencePath = resolve(openBase, 'wca1000-mt16-rust-native-opt9-exp-fixed.jsonl');
  assert.equal(reviewedInput.referencePath, referencePath); assert.equal(reviewedInput.referenceSha256, sha(referencePath));
  assert.equal(review.history[referencePath], sha(referencePath));
  const reference = lines(referencePath); assert.equal(reference.length, 1000);
  const rows = lines(paths.raw); assert.equal(rows.length, config.cases); assert.equal(result.rawSha256, sha(paths.raw));
  const {cube3x3x3} = await import(pathToFileURL(resolve(openRoot, 'core/jobs/alg-build/node_modules/cubing/dist/lib/cubing/puzzles/index.js')).href);
  const puzzle = await cube3x3x3.kpuzzle();
  let totalSeconds = 0, searchNodes = 0, quarterRemoved = 0;
  const printedNodes = {activeContextVisits: 0, inactiveContextSlots: 0, splitCount: 0, previousDepthActiveVisits: 0};
  for (const [index, row] of rows.entries()) {
    const item = corpus.cases[index], known = reference[index];
    assert.equal(row.index, index); assert.equal(row.id, item.id); assert.equal(row.scramble, item.scramble);
    assert.equal(known.id, item.id);
    assert.equal(known.cancelled, false); assert.equal(known.completed_depth, known.length - 1);
    assert.equal(row.length, known.length); assert.equal(row.threads, config.threads); assert.equal(row.engine, config.engine);
    assert(Number.isFinite(row.seconds) && row.seconds >= 0); totalSeconds += row.seconds;
    verify(puzzle, item, row);
    const printed = parsePrintedSolution(row.output);
    assert.equal(row.solution, printed.solution); assert.equal(row.length, printed.length); assert.equal(row.engineReportedSeconds, printed.engineReportedSeconds);
    if (config.engine === 'original') {
      assert.equal(row.search, undefined); const fields = parseOriginalNodeFields(row.output);
      for (const key of Object.keys(printedNodes) as (keyof typeof printedNodes)[]) printedNodes[key] += fields[key];
    } else {
      assert.equal(row.search.solution, row.solution); assert.equal(row.search.length, row.length); assert.equal(row.search.cancelled, false);
      assert.equal(row.search.threads, config.threads); assert.equal(row.search.contexts, 8);
      assert.equal(row.search.completed_depth, row.length === 0 ? null : row.length - 1);
      for (const key of ['initialDepth', 'skippedDepths', 'rootBoundProof']) assert.equal(row.search[key], undefined);
      validateSharedDepthResults(row.search, config.threads); assert(Number.isSafeInteger(row.search.nodes) && row.search.nodes >= 0);
      searchNodes += row.search.nodes;
      for (const worker of row.search.depthResults.flat()) {
        assert.equal(worker.cosetRemoved, undefined); assert(Number.isSafeInteger(worker.quarterRemoved) && worker.quarterRemoved >= 0);
        quarterRemoved += worker.quarterRemoved;
      }
    }
  }
  assert(Math.abs(result.totalSeconds - totalSeconds) < 1e-8);
  assert.equal(result.searchNodes, config.engine === 'rust' ? searchNodes : null);
  // Re-read terminal records after replay, so a replaced/unfinished resource file cannot slip through.
  const resourceSha256 = sha(paths.resource), exitSha256 = sha(paths.exit);
  assert.deepEqual(read(paths.resource), resource); assert.deepEqual(read(paths.exit), exit);
  const report = {schema: 'cuberoot.chrome-wasm-report.v1', slot, runtime: 'Chrome', engine: config.engine, variant: config.variant,
    chromeVersion: config.chromeVersion, cases: config.cases, threads: config.threads, passes: 1, warmupCases: 0,
    exitCode: 0, verifiedSolutions: rows.length, optimalLengthsMatched: rows.length, seconds: totalSeconds,
    tableLoadSeconds: ready.loadSeconds, tableBytes: config.tableBytes, corpusSha256: config.corpusSha256,
    tableSha256: result.tableSha256, artifactSha256: config.wasmSha256, rawSha256: result.rawSha256,
    processTreePeakRssBytes: resource.peakRss, minimumHeadroomBytes: resource.minimumHeadroom, swapoutsDelta: 0,
    resourceSha256, exitSha256, receiptSha256: sha(paths.receipt), reviewSha256: sha(paths.review),
    inputSha256: sha(paths.input), readySha256: sha(paths.ready), cleanupSha256: sha(paths.cleanup), resultSha256: sha(paths.result),
    searchNodes: config.engine === 'rust' ? searchNodes : null, quarterRemoved: config.engine === 'rust' ? quarterRemoved : null,
    originalPrintedNodeFields: config.engine === 'original' ? printedNodes : null,
    notes: ['One browser pass, no warmup; table load excluded from solve time.',
      'RSS is the conservative sum of the guarded process tree; shared pages are not guessed or deducted.',
      'Original N/M are activeContextVisits/inactiveContextSlots; pnode is previousDepthActiveVisits already included in N.',
      'Rust search.nodes counts nonempty context processing including leaf checks; it is not an identical cross-engine metric.'], recordedAt: new Date().toISOString()};
  writeFileSync(outputPath, JSON.stringify(report, null, 2) + '\n', {flag: 'wx'});
  console.log(JSON.stringify({slot, report: outputPath, seconds: totalSeconds, verifiedSolutions: rows.length, processTreePeakRssBytes: resource.peakRss}));
  return report;
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  assert.equal(process.argv.length, 3); await reportBrowser(process.argv[2] as BrowserSlot);
}
