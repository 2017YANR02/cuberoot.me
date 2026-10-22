/** Fixed, independently authorized WASM scopes. A later scope never revives a stopped one. */
import assert from 'node:assert/strict';
import { closeSync, existsSync, fstatSync, mkdirSync, openSync, readFileSync, readSync, statSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { availableParallelism } from 'node:os';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { openBase, openDir, openHere, openRoot } from './open-benchmark-policy.mts';
import { parseWasmBenchmarkArguments, readWca100, sharedBuildSources, wasmBuildContract } from './wasm-benchmark.mjs';
import { getVariant } from './variants.mjs';
import { patchOriginalWrapper } from './original-wasm-compat.mjs';

type Variant = 8 | 9;
export const opt9RoundScopes = ['opt9-batch', 'opt9-padded', 'opt9-batch-padded', 'opt9-select'] as const;
export type Opt9RoundScope = typeof opt9RoundScopes[number];
export type DualCandidateScope = 'coset' | 'opt8-lazy' | 'opt8-root' | 'opt8-original' | Opt9RoundScope;
export function isOpt9RoundScope(scope: string): scope is Opt9RoundScope {
  return (opt9RoundScopes as readonly string[]).includes(scope);
}
type Request = {label: string; executable: string; args: string[]; env: NodeJS.ProcessEnv};
const GiB = 2 ** 30, MiB = 2 ** 20;
export const dualCandidateDir = resolve(openBase, 'wasm-opt8-opt9-20261015');
export const dualCandidateReviewPath = resolve(dualCandidateDir, 'session.json');
export const dualCandidateStopPath = resolve(dualCandidateDir, 'stop.json');
export const dualCandidateFeatures = {8: 'coset-batch-four', 9: 'coset-batch'} as const;
const cargoFeatures = {8: 'wasm-coset-batch,production-four', 9: 'wasm-coset-batch'} as const;
const authorization = 'Opt8统一用8 GB 100条；Rust Opt9 16 GB 1000条，然后优化两档WASM；沿用4/16线程，各一轮不预热';
const opt8LazyAuthorization = '你就先优化和测试 opt8';
const originalAuthorization = '本机补测原版 Opt8 WASM：相同 WCA 前100条，4线程，只跑一轮，不预热；Rust 优化暂停';
// Each candidate consumes its own receipt, while all four share this stop boundary.
export const opt9RoundStopPath = resolve(openBase, 'wasm-opt9-round-20261015-stop.json');
const opt9Round = {id: 'opt9-four-20261015', scopes: opt9RoundScopes, stopPath: opt9RoundStopPath};
const opt9Approval = {
  authorization: '可以测试了',
  // Preserve the user's wording; “1G” retains the existing GiB unit.
  startupReserveAuthorization: '启动安全余量：3 GiB 该成 1G,然后测试',
  precedingQuestionScope: '用户撤销“先保留代码，不测试”的延后决定，授权此前保留的四个 Opt9 WASM 候选在本机按已说明的独立 Swapouts 48 范围顺序测试；同样 WCA1000、16线程、各一轮、零预热，不重跑原版，保留旧16→48停止记录与全部旧版本，仅本地不发布。',
};
const opt9Builds: Record<Opt9RoundScope, {wasm: string | null; sha256: string | null; metadataSha256: string | null;
  candidate: string; features: string; batch: boolean; padded: number; select: boolean}> = {
  'opt9-batch': {wasm: resolve(openBase, 'rust-wasm-shared-builds/build-gLDBF5/cube48opt-rust8.wasm'),
    sha256: '17d66df66935894e28a5ee0c7494853f79444c96eac3b9b2b9d4832eedcfb545',
    metadataSha256: '7c029055137c3f8afd8ca87a29e4708c50b6eac67fa957c29a3b05e6f4318640',
    candidate: 'opt9-batch', features: 'wasm-opt9-batch', batch: true, padded: 0, select: false},
  'opt9-padded': {wasm: resolve(openBase, 'rust-wasm-shared-builds/build-AigbMy/cube48opt-rust8.wasm'),
    sha256: '59da71ddda187745680daa21c671a6749aee6779e57cb2bfefdd4b284245f2f3',
    metadataSha256: '0b5197041b097fc5b513d04298a1f79c82305dbb99e4e35d9cd254a91c5c651c',
    candidate: 'padded-state', features: 'wasm-padded-state', batch: false, padded: 4200468, select: false},
  'opt9-batch-padded': {wasm: resolve(openBase, 'rust-wasm-shared-builds/build-CZO3Yd/cube48opt-rust8.wasm'),
    sha256: '42a0ba87ea6fbe06682fa563d5f2d1139583005664a34891a300a1ffe3804bb4',
    metadataSha256: '0a457f1e6df65141a78a57546df49c460fe69873bd0ea80cb8fa4f527f82b443',
    candidate: 'opt9-batch-padded', features: 'wasm-opt9-batch-padded', batch: true, padded: 4200468, select: false},
  'opt9-select': {wasm: resolve(openBase, 'rust-wasm-shared-builds/build-6zU5tn/cube48opt-rust8.wasm'),
    sha256: 'c2359a9b97138d4df27bfaf163c765afd13a0eef223e272bcfcf5700f185c2db',
    metadataSha256: '790e8dccc214d012cae4c4bf4538b0b6a1d3ee2133ba3fa06c44791f3c7364af',
    candidate: 'opt9-select', features: 'wasm-opt9-select', batch: true, padded: 0, select: true},
};
const precedingQuestionScope = '明确请求为本轮 Opt8/Opt9 候选建立同次启动的 Swapouts 48 新基线，保留此前 16→48 停止记录；用户将授权缩小为仅 Opt8';
const opt8LazyWasm = resolve(openBase, 'rust-wasm-shared-builds/build-UXKCJq/cube48opt-rust8.wasm');
const opt8LazyWasmSha256 = '09b20de0852d49436b762aeda188f7b0d5214f37756cb328c3ed606660922b0f';
const opt8Builds = {
  'opt8-lazy': {wasm: opt8LazyWasm, sha256: opt8LazyWasmSha256, candidate: 'lazy-normal-four', features: 'wasm-lazy-normal,production-four'},
  'opt8-root': {wasm: resolve(openBase, 'rust-wasm-shared-builds/build-vkpXmK/cube48opt-rust8.wasm'),
    sha256: '1a3761bd29fcd97063081220005a30e2cc3690244d790910323aaa5908394758',
    candidate: 'root-bound-four', features: 'wasm-root-bound,production-four'},
  // Harness metadata only: the original-only request never instantiates this Rust artifact.
  'opt8-original': {wasm: resolve(openBase, 'rust-wasm-shared-builds/build-FcRcSF/cube48opt-rust8.wasm'),
    sha256: 'b600c699ab91c29f0bef5a14b7c2871bf1fb03d840b8813d5656266132433bb6',
    candidate: 'original-opt8', features: 'quarter-fixed,production-four'},
} as const;
const originalPatchedWrapperSha256 = '8be9ddb568e96df55dbe0ba457d23a2e1440c395625b328ac80d87909e3a50ba';
const release4BuildSha256 = '6fd36070afdd7b1744e8cd8c22e27e0232d69c0a9dc937263999e0a30c2375e4';
const lazyEvidenceDigests = {
  'wasm-opt8-lazy-20261015/session.json': '1425585452eadf57c33ae649e3e017d7a06d484c193cf8a7fdd3c402731da913',
  'wasm-opt8-lazy-20261015/opt8-receipt.json': '7d3c71502ebf28bd8ed5d28b8a30dc97735393a0bc8a93900cd644ceb0db9da4',
  'wasm-opt8-lazy-20261015/opt8-exit.json': '1c61da59d5bfecaa85a44e51ec881c28dcc7fcad87db674772b4c5fc0e6366e5',
  'wasm-opt8-lazy-20261015/opt8-report.json': '331d8066692fd830bd10807d9616de1c8869d7583ec7f8e3921e33370b524b38',
  'wasm-opt8-lazy-20261015-resources.json': '360b3f8db0b4b5ea4fa50db64e43ea0eb0bf47a25d33e59955833ebaeef30c7a',
} as const;
const rootEvidenceDigests = {
  'wasm-opt8-root-20261015/session.json': '251331581f813ec55616b6ab9c3fac69246d35d42e53adb562d8173f70c45956',
  'wasm-opt8-root-20261015/opt8-receipt.json': 'be137ccba5b518dafac12afc4e2022cf8af441658263c54f879a473a2e5b419d',
  'wasm-opt8-root-20261015/opt8-exit.json': '93eb9e677a1dab2a12958c657903c325bd0452f6708e7c82b2fdb70ef8ae69e7',
  'wasm-opt8-root-20261015/opt8-report.json': '8500ef3d13984db9e57644d725378c3b6995b64733227457540c4acb6685f733',
  'wasm-opt8-root-20261015-resources.json': '3cd5d23643cd05ca7fc1f599969657fceb09b254598b1e3b943eb229345bafa2',
} as const;
const original8EvidenceDigests = {
  'original-opt8-local4-20261015/session.json': '8ae574d6d76c2f52386470577a9c67ea24d0db100f7bb1576c5ffdc8a1dd0c43',
  'original-opt8-local4-20261015/opt8-receipt.json': '0dd75fd51a31aa8b05c76a15a360da914bd0d9362813b4922e11480e9197fb9a',
  'original-opt8-local4-20261015/opt8-exit.json': 'b9b8258d8a84278e708e8f437ee09987510896f3feea20b4ae6ec06b8c1868c4',
  'original-opt8-local4-20261015/opt8-report.json': 'f165222be3b03314630bd0f0780585418669d711dff721fbb6e4b46c8a2a79d6',
  'original-opt8-local4-20261015-resources.json': '9bfc01ee266cf2e4b342259d699653f33852b460e2857ff643d23c1a80e47e95',
  'original-opt8-local4-20261015/preflight-failure.json': '0c50c7fc610eeb5ec68896e8d22f3b5939254d5221176d5f2fedbeaabf807c9c',
  'original-opt8-local4-20261015/opt8.stderr.log': '308640494034ddcde6d6c4a9a3987d675254e1df524984496a3ca737a6c2601a',
} as const;
const stoppedReviewSha256 = 'd67fb04e252f4d18f10361e6b308ea2d1f3e04c8c74d8afee452128962cb6ba1';
const stoppedScopeSha256 = '9860b4e3dc4cb12dc7325b8d3b0822201b694a37fb571fce842264b5a62d7ddc';
const stoppedResourceSha256 = 'd2e00f194638328f3204f5203a76593781cad69f2584d5d97ae247889d02e8de';
const boot = '{ sec = 1791771877, usec = 170806 } Sun Oct 11 19:24:37 2026';
const previousReview = resolve(openDir, 'session-opt9-quarter-fixed.json');
const previousReviewSha256 = 'b9cdb33500407bd5e8203da9d69a38e385d3156e9edff6f1f08188a3d5ed43e0';
const opt8Prior = 'wca100-local4-opt8-release4-turbofan-20261014';
const tablePaths = {
  8: resolve(openBase, 'opt8-generated/h48prun31h8.dat'),
  9: resolve(openBase, 'opt9-generated/h48prun31h9.dat'),
};
const expectedCorpus = {
  8: '92171d593d13982924ed16723f099bd771a873aaa2c30a0e08f319c86b75dcde',
  9: '5b42a18086b27e974115a73696702017b5dde0a19c9819a77c88c8014d67c8ea',
};
export function dualCandidateScopeConfig(scope: DualCandidateScope = 'coset') {
  assert(scope === 'coset' || scope === 'opt8-lazy' || scope === 'opt8-root' || scope === 'opt8-original' || isOpt9RoundScope(scope), 'Unknown candidate scope');
  const dir = scope === 'coset' ? dualCandidateDir : resolve(openBase,
    scope === 'opt8-original' ? 'original-opt8-local4-20261015' : `wasm-${scope}-20261015`);
  return {id: scope, dir, reviewPath: resolve(dir, 'session.json'),
    stopPath: isOpt9RoundScope(scope) ? opt9RoundStopPath : resolve(dir, 'stop.json'),
    swapouts: scope === 'coset' ? 16 : 48,
    authorization: scope === 'coset' ? authorization : isOpt9RoundScope(scope) ? opt9Approval.authorization
      : scope === 'opt8-original' ? originalAuthorization : opt8LazyAuthorization,
    variants: (scope === 'coset' ? [8, 9] : isOpt9RoundScope(scope) ? [9] : [8]) as Variant[],
    candidates: scope === 'coset' ? dualCandidateFeatures : isOpt9RoundScope(scope) ? {9: opt9Builds[scope].candidate}
      : {8: opt8Builds[scope].candidate} as Partial<Record<Variant, string>>,
  };
}
export function dualCandidateStartupReserveBytes(scope: DualCandidateScope = 'coset') {
  // This authorization changes admission only; runtime headroom remains 2 GiB.
  dualCandidateScopeConfig(scope);
  return (isOpt9RoundScope(scope) ? 1 : 3) * GiB;
}
function fixedBuild(scope: Exclude<DualCandidateScope, 'coset'>) {
  if (!isOpt9RoundScope(scope)) return opt8Builds[scope];
  return opt9CandidatePinnedBuild(scope);
}
export function opt9CandidatePinnedBuild(scope: Opt9RoundScope) {
  assert(isOpt9RoundScope(scope), 'Unknown Opt9 candidate');
  const build = opt9Builds[scope];
  assert(build.wasm && build.sha256 && build.metadataSha256, 'Fully verified Opt9 artifact has not been pinned; drafts cannot run');
  return {...build, wasm: build.wasm, sha256: build.sha256, metadataSha256: build.metadataSha256};
}
function requireOpt9Approval(scope: DualCandidateScope) {
  if (isOpt9RoundScope(scope)) assert.equal(opt9Approval.authorization, '可以测试了');
}
function scopeForRequest(request: Request): DualCandidateScope {
  const path = request.env.CUBEOPT_WASM_DUAL_CANDIDATE_REVIEW;
  for (const scope of ['coset', 'opt8-lazy', 'opt8-root', 'opt8-original', ...opt9RoundScopes] as const)
    if (path === dualCandidateScopeConfig(scope).reviewPath) return scope;
  throw Error('Review must name a fixed authorized candidate scope');
}
function checkVariant(variant: Variant, scope: DualCandidateScope) {
  assert(dualCandidateScopeConfig(scope).variants.includes(variant), 'Variant is not authorized in this scope');
}
function labelFor(variant: Variant, scope: DualCandidateScope) {
  checkVariant(variant, scope);
  return scope === 'coset' ? `wasm-opt${variant}-candidate-20261015`
    : scope === 'opt8-original' ? 'original-opt8-local4-20261015' : `wasm-${scope}-20261015`;
}
const read = (path: string) => {
  assert(statSync(path).isFile() && statSync(path).size <= 4 * MiB, 'Metadata must be bounded');
  return JSON.parse(readFileSync(path, 'utf8'));
};
// Results can be tens of MB; bounded streaming avoids copying them all into the guard heap.
function sha(path: string) {
  const fd = openSync(path, 'r'), hash = createHash('sha256');
  try {
    const stats = fstatSync(fd);
    assert(stats.isFile() && stats.size <= 128 * MiB, 'Evidence must be bounded; never hash a PDB in the guard');
    const buffer = Buffer.alloc(MiB);
    for (let offset = 0; offset < stats.size;) {
      const count = readSync(fd, buffer, 0, Math.min(buffer.length, stats.size - offset), offset);
      assert(count > 0, 'Truncated evidence'); hash.update(buffer.subarray(0, count)); offset += count;
    }
    return hash.digest('hex');
  } finally { closeSync(fd); }
}
const hashes = (paths: string[]) => Object.fromEntries(paths.map(path => [path, sha(path)]));
const sourcePaths = ['guard.mts', 'wasm-benchmark.mjs', 'wasm-dual-candidate-policy.mts', 'open-benchmark-policy.mts']
  .map(path => resolve(openHere, path));
const scopeSourcePaths = (scope: DualCandidateScope) => scope === 'coset' ? sourcePaths
  : [...sourcePaths, resolve(openHere, 'report-dual-wasm.mts'),
    ...(scope === 'opt8-original' ? ['original-wasm-compat.mjs', 'variants.mjs'].map(path => resolve(openHere, path)) : [])];
const corpusPath = (variant: Variant) => resolve(openRoot, `solver/testdata/benchmarks/wca-first${variant === 8 ? 100 : 1000}.json`);
const resourcePath = (variant: Variant, scope: DualCandidateScope = 'coset') => resolve(openBase, `${labelFor(variant, scope)}-resources.json`);
const receiptPath = (variant: Variant, scope: DualCandidateScope = 'coset') => resolve(dualCandidateScopeConfig(scope).dir, `opt${variant}-receipt.json`);
/** Pure cross-candidate stop check. A peer's protection result cannot be reset by choosing a new scope. */
export function validateOpt9RoundResourceRecords(records: Partial<Record<Opt9RoundScope, any>>, stopped: boolean) {
  assert(!stopped, 'This Opt9 round stopped; no automatic continuation with another candidate');
  for (const [scope, record] of Object.entries(records)) {
    assert(isOpt9RoundScope(scope));
    assert.equal(record.boot, boot); assert.equal(record.swapouts, 48); assert.equal(record.pressure, 1);
    assert.equal(record.stopped, '', 'A peer candidate stopped; the whole Opt9 round must stop');
    assert.equal(record.trigger, null, 'A peer candidate triggered resource protection');
    assert.equal(record.rssLimit, 19_778_730_352);
    assert(record.minimumHeadroom >= 2 * GiB && record.peakRss > 0 && record.peakRss <= record.rssLimit);
  }
}
function validateOpt9RoundClear() {
  const records = Object.fromEntries(opt9RoundScopes.filter(scope => existsSync(resourcePath(9, scope)))
    .map(scope => [scope, read(resourcePath(9, scope))]));
  validateOpt9RoundResourceRecords(records, existsSync(opt9RoundStopPath)
    || opt9RoundScopes.some(scope => existsSync(resolve(dualCandidateScopeConfig(scope).dir, 'stop.json'))));
}
export function dualCandidateOutput(variant: Variant, scope: DualCandidateScope = 'coset') {
  checkVariant(variant, scope);
  return resolve(dualCandidateScopeConfig(scope).dir, `opt${variant}`);
}

export function dualCandidateRequest(variant: Variant, wasm?: string, scope: DualCandidateScope = 'coset'): Request {
  checkVariant(variant, scope);
  if (isOpt9RoundScope(scope)) { fixedBuild(scope); requireOpt9Approval(scope); }
  const config = dualCandidateScopeConfig(scope);
  const executable = wasm ?? read(config.reviewPath).builds[variant].wasm;
  if (scope !== 'coset') assert.equal(executable, fixedBuild(scope).wasm, 'Only the reviewed artifact may run');
  return {
    label: labelFor(variant, scope), executable: process.execPath,
    env: {CUBEOPT_WASM_DUAL_CANDIDATE_REVIEW: config.reviewPath, CUBEOPT_BACKEND: 'opt',
      CUBEOPT_VARIANT: String(variant), CUBEOPT_SOLVE_THREADS: '1'},
    args: [resolve(openHere, 'wasm-benchmark.mjs'), '--variant', String(variant), '--threads', variant === 8 ? '4' : '16',
      '--cases', variant === 8 ? '100' : '1000', '--engine', scope === 'opt8-original' ? 'original' : 'rust', '--compiler', 'turbofan',
      '--table', tablePaths[variant], '--small', resolve(openBase, `opt${variant}-generated/small-memory.bin`),
      '--wasm', executable, '--out', dualCandidateOutput(variant, scope)],
  };
}

export function dualCandidatePolicy(request: Request) {
  const scope = scopeForRequest(request), config = dualCandidateScopeConfig(scope);
  const variant = Number(request.env.CUBEOPT_VARIANT) as Variant;
  checkVariant(variant, scope);
  const wasm = request.args[request.args.indexOf('--wasm') + 1];
  assert(typeof wasm === 'string' && /^build-[A-Za-z0-9]+$/.test(dirname(wasm).split('/').at(-1)!));
  assert.equal(dirname(dirname(wasm)), resolve(openBase, 'rust-wasm-shared-builds'));
  assert.equal(wasm, resolve(dirname(wasm), 'cube48opt-rust8.wasm'));
  const expected = dualCandidateRequest(variant, wasm, scope);
  assert.equal(request.label, expected.label); assert.equal(request.executable, expected.executable);
  assert.deepEqual(request.args, expected.args);
  assert.deepEqual(Object.fromEntries(Object.entries(request.env).filter(([key]) => key.startsWith('CUBEOPT_'))), expected.env);
  assert.equal(process.platform, 'darwin'); assert.equal(process.arch, 'arm64');
  const threads = variant === 8 ? 4 : 16, tableBytes = 30_401_280 * 2 ** variant;
  assert(availableParallelism() >= threads);
  // Preserve each cohort's existing per-runtime budget and all guard protections.
  const reserve = variant === 8 ? (threads - 1) * 64 * MiB : threads * 128 * MiB;
  const rssLimit = tableBytes + Math.ceil(tableBytes / 16) + 19_208_560 + GiB + reserve;
  return {entry: 'wasm-benchmark.mjs', mode: 'single-pass', backend: 'opt', variant, h: null, tablePath: null,
    tableBytes, measureNativeRss: false, wasmThreads: threads, rssLimit, deadlineMs: 60 * 60_000,
    startupReserveBytes: dualCandidateStartupReserveBytes(scope),
    openBenchmark: true, dualWasmCandidate: true, dualCandidateScope: scope, scopeStopPath: config.stopPath};
}

/** Pure stop/baseline checks are independently testable without observing or loading tables. */
export function validateDualCandidateState(review: any, current: any, rssLimit: number, state: {used: boolean; stopped: boolean}, now = Date.now(), scope: DualCandidateScope = 'coset') {
  const config = dualCandidateScopeConfig(scope);
  requireOpt9Approval(scope);
  assert.equal(review.schema, scope === 'coset' ? 'cuberoot.dual-wasm-candidate-review.v1' : 'cuberoot.dual-wasm-candidate-review.v2');
  assert.equal(review.authorization, config.authorization);
  if (scope !== 'coset') {
    assert.equal(review.scope, scope);
    assert.equal(review.precedingQuestionScope, isOpt9RoundScope(scope) ? opt9Approval.precedingQuestionScope : precedingQuestionScope);
    assert.equal(review.stoppedReviewSha256, stoppedReviewSha256);
    assert.equal(review.stoppedScopeSha256, stoppedScopeSha256);
    assert.equal(review.stoppedResourceSha256, stoppedResourceSha256);
    if (scope === 'opt8-root') assert.deepEqual(review.completedPredecessor, lazyEvidenceDigests, 'Completed lazy evidence changed');
    if (scope === 'opt8-original') assert.deepEqual(review.completedPredecessor, rootEvidenceDigests, 'Completed root evidence changed');
    if (isOpt9RoundScope(scope)) {
      assert.deepEqual(review.completedPredecessor, original8EvidenceDigests, 'Completed original Opt8 evidence changed');
      assert.deepEqual(review.round, opt9Round, 'Opt9 candidates must share one round stop boundary');
      assert.equal(review.startupReserveAuthorization, opt9Approval.startupReserveAuthorization);
      assert.equal(review.startupReserveBytes, dualCandidateStartupReserveBytes(scope));
    }
  }
  assert.equal(review.boot, boot); assert.equal(review.swapouts, config.swapouts);
  assert.equal(current.boot, boot); assert.equal(current.swapouts, config.swapouts, 'Swapouts changed; cannot reset');
  assert.equal(current.pressure, 1);
  assert(Number.isSafeInteger(current.available) && current.available >= rssLimit + dualCandidateStartupReserveBytes(scope), 'Insufficient memory');
  assert(now < Date.parse('2026-10-17T00:00:00Z'), 'Review expired');
  assert(!state.used && !state.stopped, 'Consumed run or stopped scope; no retry');
}

function successfulResource(resource: any) {
  assert.equal(resource.boot, boot); assert.equal(resource.swapouts, 16); assert.equal(resource.pressure, 1);
  assert.equal(resource.stopped, ''); assert.equal(resource.trigger, null);
  assert(resource.minimumHeadroom >= 2 * GiB && resource.peakRss > 0 && resource.peakRss <= resource.rssLimit);
}
function historyPaths(scope: DualCandidateScope = 'coset') {
  assert.equal(sha(previousReview), previousReviewSha256, 'Previous reviewed baseline changed');
  const previous = read(previousReview);
  assert.equal(previous.boot, boot); assert.equal(previous.swapouts, 16);
  assert.deepEqual(previous.history, hashes(Object.keys(previous.history)), 'Old evidence changed');
  const approved = read(resolve(openDir, 'session-rust-wasm.json'));
  assert.equal(approved.authorization, '允许本轮建立新基线，继续测试');
  assert.equal(approved.boot, boot); assert.equal(approved.swapouts, 16);
  const paths = [...new Set([...Object.keys(previous.history), previousReview,
    ...['opt9-quarter-fixed-receipt.json', 'rust-wasm-opt9-quarter-fixed-report.json',
      'rust-wasm-opt9-quarter-fixed/rust/results.jsonl', 'rust-wasm-opt9-quarter-fixed/input.json'].map(path => resolve(openDir, path)),
    resolve(openBase, 'open16-wca1000-opt9-quarter-fixed-20261015-resources.json'),
    ...['report.json', 'rust/report.json', 'rust/results.jsonl', 'input.json'].map(path => resolve(openBase, opt8Prior, path)),
    resolve(openBase, opt8Prior + '-resources.json'), resolve(openBase, opt8Prior + '-review.json'),
  ])];
  return scope === 'coset' ? paths : [...new Set([...paths, ...stoppedScopeHistoryPaths(),
    ...(scope === 'opt8-root' || scope === 'opt8-original' || isOpt9RoundScope(scope) ? completedOpt8HistoryPaths('opt8-lazy') : []),
    ...(scope === 'opt8-original' || isOpt9RoundScope(scope) ? completedOpt8HistoryPaths('opt8-root') : []),
    ...(isOpt9RoundScope(scope) ? [...completedOpt8HistoryPaths('opt8-original'),
      ...['session-preflight-3gib.json', 'preflight-failure.json', 'opt9.stdout.log', 'opt9.stderr.log']
        .map(path => resolve(openBase, 'wasm-opt9-batch-20261015', path)),
      resolve(openBase, 'wca1000-mt16-rust-native-opt9-exp-fixed.jsonl')] : [])])];
}
function stoppedScopeHistoryPaths() {
  assert.equal(sha(dualCandidateReviewPath), stoppedReviewSha256, 'Stopped review changed');
  assert.equal(sha(dualCandidateStopPath), stoppedScopeSha256, 'Swapouts 16→48 stop changed');
  assert.equal(sha(resourcePath(9)), stoppedResourceSha256, 'Stopped resource record changed');
  const prior = read(dualCandidateReviewPath), stop = read(dualCandidateStopPath), resource = read(resourcePath(9));
  assert.equal(prior.boot, boot); assert.equal(prior.swapouts, 16);
  assert.deepEqual(prior.history, hashes(Object.keys(prior.history)), 'Stopped scope history changed');
  assert.equal(stop.boot, boot); assert.equal(stop.swapouts, 16);
  assert.equal(stop.stopped, 'Resource protection: Swapouts changed');
  assert.equal(stop.trigger.details.boot, boot); assert.equal(stop.trigger.details.swapouts, 48);
  assert.equal(resource.boot, boot); assert.equal(resource.swapouts, 48);
  assert.equal(resource.stopped, stop.stopped); assert.deepEqual(resource.trigger, stop.trigger);
  const receipt = read(receiptPath(9)), exit = read(resolve(dualCandidateDir, 'opt9-exit.json'));
  assert.equal(receipt.reviewSha256, stoppedReviewSha256);
  assert.equal(receipt.before.boot, boot); assert.equal(receipt.before.swapouts, 16);
  assert.deepEqual(resource.openBenchmarkReceipt, receipt);
  assert.equal(exit.exitCode, 1); assert.equal(exit.completedCases, 0);
  assert.equal(exit.beforeSwapouts, 16); assert.equal(exit.stoppedSwapouts, 48);
  assert.equal(statSync(resolve(dualCandidateOutput(9), 'rust/results.jsonl')).size, 0);
  // The Opt9 failure is retained as small historical records only. This new
  // scope never reads its table or build artifacts, nor validates a new Opt9 build.
  assert.deepEqual(prior.builds[8].artifacts, hashes(Object.keys(prior.builds[8].artifacts)), 'Stopped Opt8 artifacts changed');
  validateFirstCandidate(prior);
  return [...Object.keys(prior.history), dualCandidateReviewPath, dualCandidateStopPath,
    ...[8, 9].flatMap(variant => [resourcePath(variant as Variant), receiptPath(variant as Variant),
      resolve(dualCandidateDir, `opt${variant}-exit.json`)]),
    ...['input.json', 'rust/results.jsonl', 'rust/raw.jsonl', 'table-manifest.json', 'small-manifest.json', 'rust-build-metadata.json']
      .map(path => resolve(dualCandidateOutput(8), path)),
    ...Object.keys(prior.builds[8].artifacts),
    resolve(dualCandidateDir, 'opt8-report.json'),
    ...['report.json', 'rust/report.json'].map(path => resolve(dualCandidateOutput(8), path)),
  ];
}
function completedOpt8HistoryPaths(scope: 'opt8-lazy' | 'opt8-root' | 'opt8-original') {
  const config = dualCandidateScopeConfig(scope), digests = scope === 'opt8-lazy' ? lazyEvidenceDigests
    : scope === 'opt8-original' ? original8EvidenceDigests : rootEvidenceDigests;
  assert(!existsSync(config.stopPath), 'Previous Opt8 scope stopped; no automatic continuation');
  for (const [relative, expected] of Object.entries(digests))
    assert.equal(sha(resolve(openBase, relative)), expected, 'Completed Opt8 evidence changed');
  const review = read(config.reviewPath), receipt = read(receiptPath(8, scope));
  const resource = read(resourcePath(8, scope)), report = read(resolve(config.dir, 'opt8-report.json'));
  assert.equal(review.scope, scope); assert.equal(review.boot, boot); assert.equal(review.swapouts, 48);
  assert.equal(receipt.reviewSha256, sha(config.reviewPath));
  assert.equal(receipt.before.boot, boot); assert.equal(receipt.before.swapouts, 48);
  assert.deepEqual(resource.openBenchmarkReceipt, receipt);
  assert.equal(resource.boot, boot); assert.equal(resource.swapouts, 48); assert.equal(resource.pressure, 1);
  assert.equal(resource.stopped, ''); assert.equal(resource.trigger, null);
  assert(resource.minimumHeadroom >= 2 * GiB && resource.peakRss > 0 && resource.peakRss <= resource.rssLimit);
  assert.equal(read(resolve(config.dir, 'opt8-exit.json')).exitCode, 0);
  assert.equal(report.scope, scope); assert.equal(report.exitCode, 0);
  assert.equal(report.cases, 100); assert.equal(report.threads, 4); assert.equal(report.passes, 1); assert.equal(report.warmupCases, 0);
  assert.equal(report.verifiedSolutions, 100); assert.equal(report.optimalLengthsMatched, 100);
  assert.equal(report.artifactSha256, scope === 'opt8-original' ? getVariant(8).wasmSha256 : opt8Builds[scope].sha256);
  const engine = scope === 'opt8-original' ? 'original' : 'rust';
  const raw = resolve(dualCandidateOutput(8, scope), engine, 'results.jsonl');
  assert.equal(report.rawSha256, sha(raw));
  // Historical source hashes describe the completed run, not today's files.
  // Its immutable session and frozen artifacts are bound; policy/report may evolve.
  assert.deepEqual(review.history, hashes(Object.keys(review.history)), 'Completed lazy history changed');
  const artifactPaths = Object.keys(review.builds[8].artifacts);
  assert.deepEqual(review.builds[8].artifacts, hashes(artifactPaths), 'Completed lazy artifacts changed');
  return [...Object.keys(digests).map(path => resolve(openBase, path)), raw,
    ...Object.keys(review.history), ...artifactPaths,
    ...['report.json', `${engine}/report.json`, 'input.json', 'table-manifest.json', 'small-manifest.json']
      .map(path => resolve(dualCandidateOutput(8, scope), path)),
    ...(scope === 'opt8-original' ? Object.values(report.harnessSummary.artifacts.files) as string[] : [])];
}
function validateHistory(scope: DualCandidateScope = 'coset') {
  successfulResource(read(resolve(openBase, 'open16-wca1000-opt9-quarter-fixed-20261015-resources.json')));
  const previous = read(resolve(openDir, 'rust-wasm-opt9-quarter-fixed-report.json'));
  assert.equal(previous.exitCode, 0); assert.equal(previous.verifiedSolutions, 1000); assert.equal(previous.optimalLengthsMatched, 1000);
  assert.equal(previous.rawSha256, sha(resolve(openDir, 'rust-wasm-opt9-quarter-fixed/rust/results.jsonl')));
  assert.equal(previous.harnessSummary.artifacts.sha256.wasm, 'cab08e553c5db5aacf5db7f4789bb537cb24da7ffaeab571a20bf1b8e0ef6193');
  const opt8 = read(resolve(openBase, opt8Prior, 'report.json'));
  assert.equal(opt8.variant, 8); assert.equal(opt8.cases, 100); assert.equal(opt8.threads, 4);
  assert.equal(opt8.measuredPasses, 1); assert.equal(opt8.warmupCases, 0); assert.equal(opt8.compiler, 'turbofan');
  assert.equal(opt8.engines.rust.processExited, true); assert.equal(opt8.engines.rust.verifiedSolutions, 100);
  assert.equal(opt8.engines.rust.optimalLengthsMatched, 100);
  assert.equal(opt8.engines.rust.artifacts.sha256.wasm, 'b600c699ab91c29f0bef5a14b7c2871bf1fb03d840b8813d5656266132433bb6');
  // Its old Swapouts=0 record remains historical evidence, never the new baseline.
  const priorResource = read(resolve(openBase, opt8Prior + '-resources.json'));
  assert.equal(priorResource.boot, boot); assert.equal(priorResource.swapouts, 0);
  assert.equal(priorResource.stopped, ''); assert.equal(priorResource.trigger, null); assert.equal(priorResource.pressure, 1);
  assert(priorResource.minimumHeadroom >= 2 * GiB && priorResource.peakRss > 0 && priorResource.peakRss <= priorResource.rssLimit);
  if (scope !== 'coset') stoppedScopeHistoryPaths();
  if (scope === 'opt8-root' || scope === 'opt8-original' || isOpt9RoundScope(scope)) completedOpt8HistoryPaths('opt8-lazy');
  if (scope === 'opt8-original' || isOpt9RoundScope(scope)) completedOpt8HistoryPaths('opt8-root');
  if (isOpt9RoundScope(scope)) completedOpt8HistoryPaths('opt8-original');
}
function artifactHashes(wasm: string) {
  return hashes(['cube48opt-rust8.wasm', 'cube48opt-rust8.mjs', 'cube48opt-rust8-worker.mjs', 'build-metadata.json']
    .map(path => resolve(dirname(wasm), path)));
}
function originalArtifacts() {
  const variant = getVariant(8), dir = resolve(openRoot, 'core/packages/client/public/cubeopt');
  const wasm = resolve(dir, 'cube48opt8.wasm'), wrapper = resolve(dir, 'cube48opt8.mjs');
  const compat = resolve(openHere, 'original-wasm-compat.mjs');
  assert.equal(sha(wasm), variant.wasmSha256, 'Original Opt8 WASM changed');
  assert.equal(sha(wrapper), variant.wrapperSha256, 'Original Opt8 wrapper changed');
  assert(statSync(wrapper).size <= 4 * MiB, 'Wrapper must be bounded');
  const patchedWrapperSha256 = createHash('sha256').update(patchOriginalWrapper(readFileSync(wrapper, 'utf8'))).digest('hex');
  assert.equal(patchedWrapperSha256, originalPatchedWrapperSha256, 'Reviewed compatibility patch changed');
  return {wasm, wrapper, compat, wasmSha256: variant.wasmSha256, wrapperSha256: variant.wrapperSha256,
    compatSha256: sha(compat), patchedWrapperSha256};
}
/** Bounded metadata validation; does not authorize a run or load a WASM/PDB. */
export function validateOpt9BatchBuildMetadata(build: any) {
  return validateOpt9CandidateBuildMetadata('opt9-batch', build);
}
export function validateOpt9CandidateBuildMetadata(scope: Opt9RoundScope, build: any) {
  const expected = fixedBuild(scope), flags = opt9Builds[scope];
  assert.equal(build.schema, 'cuberoot.rust-opt-shared-wasm64.build.v1');
  assert.notEqual(build.verified, false); assert.notEqual(build.benchmarkEligible, false);
  assert.equal(build.candidate, expected.candidate);
  assert.equal(build.wasmSha256, expected.sha256); assert.equal(build.maxThreads, 18);
  assert.deepEqual(build.command.args.slice(-2), ['--features', expected.features]);
  assert.deepEqual(build.checkCommand.args.slice(-2), ['--features', `small-check,${expected.features}`]);
  assert.equal(build.smallCheck.opt9BatchEnabled, flags.batch); assert.equal(build.smallCheck.paddedStateLayout, flags.padded);
  assert.equal(build.smallCheck.opt9SelectEnabled ?? false, flags.select);
  assert.equal(build.smallCheck.cosetBatchEnabled, false); assert.equal(build.smallCheck.rootBoundEnabled, false);
  assert.equal(build.smallCheck.lazyNormalEnabled, false); assert.equal(build.smallCheck.rootBoundDiagnostic.enabled, false);
  assert.equal(build.smallCheck.pdbAllocatedBytes, 0); assert.equal(build.smallCheck.batchProbeChecks, 3072);
  assert.deepEqual(build.smallCheck.threadCounts, [1, 2, 4, 16, 18]);
  assert.deepEqual(build.verifiedThreadCounts, [1, 2, 4, 16, 18]);
  assert.equal(build.smallCheck.independentlyVerifiedSolutions, 11790);
}
function validateBuild(variant: Variant, wasm: string, scope: DualCandidateScope = 'coset') {
  const request = dualCandidateRequest(variant, wasm, scope); dualCandidatePolicy(request);
  const build = read(resolve(dirname(wasm), 'build-metadata.json'));
  assert.equal(build.candidate, scope === 'opt8-original' ? 'quarter-fixed-four' : dualCandidateScopeConfig(scope).candidates[variant]);
  assert.deepEqual(build.command.args.slice(-2), ['--features', scope === 'coset' ? cargoFeatures[variant] : fixedBuild(scope).features]);
  if (scope === 'opt8-lazy' || scope === 'opt8-root') {
    assert.equal(build.wasmSha256, opt8Builds[scope].sha256);
    assert.equal(build.smallCheck.lazyNormalEnabled, scope === 'opt8-lazy'); assert.equal(build.smallCheck.rootBoundEnabled, true);
    assert.equal(build.smallCheck.cosetBatchEnabled, false); assert.equal(build.maxThreads, 4);
    assert.equal(build.smallCheck.rootBoundDiagnostic.enabled, true);
    assert.equal(build.smallCheck.rootBoundDiagnostic.pdbAllocatedBytes, 0);
  }
  if (isOpt9RoundScope(scope)) {
    assert.equal(sha(resolve(dirname(wasm), 'build-metadata.json')), opt9Builds[scope].metadataSha256);
    validateOpt9CandidateBuildMetadata(scope, build);
  }
  if (scope === 'opt8-original') {
    assert.equal(sha(resolve(dirname(wasm), 'build-metadata.json')), release4BuildSha256);
    assert.equal(build.wasmSha256, opt8Builds[scope].sha256);
    assert.equal(build.maxThreads, 4);
    originalArtifacts();
  }
  assert.equal(build.wasmSha256, sha(wasm));
  assert.equal(build.wrapperSha256, sha(resolve(dirname(wasm), 'cube48opt-rust8.mjs')));
  assert.equal(build.workerSha256, sha(resolve(dirname(wasm), 'cube48opt-rust8-worker.mjs')));
  wasmBuildContract(parseWasmBenchmarkArguments(request.args.slice(1)), build);
  for (const [name, expected] of Object.entries(sharedBuildSources(build))) {
    assert.equal(sha(resolve(dirname(wasm), 'source', name)), expected, 'Frozen build source changed');
    if (scope !== 'opt8-original' && !isOpt9RoundScope(scope))
      assert.equal(sha(resolve(openRoot, name)), expected, 'Candidate source changed since build');
  }
  return build;
}
function validateFirstCandidate(review: any) {
  const receipt = read(receiptPath(8)), resource = read(resourcePath(8));
  assert.equal(receipt.label, dualCandidateRequest(8).label);
  assert.equal(receipt.reviewSha256, sha(dualCandidateReviewPath));
  assert.deepEqual(resource.openBenchmarkReceipt, receipt);
  successfulResource(resource);
  const report = read(resolve(dualCandidateOutput(8), 'report.json'));
  assert.equal(report.variant, 8); assert.equal(report.threads, 4); assert.equal(report.cases, 100);
  assert.equal(report.measuredPasses, 1); assert.equal(report.warmupCases, 0); assert.equal(report.compiler, 'turbofan');
  assert.equal(report.engines.rust.processExited, true); assert.equal(report.engines.rust.verifiedSolutions, 100);
  assert.equal(report.engines.rust.optimalLengthsMatched, 100);
  assert.equal(report.engines.rust.artifacts.sha256.wasm, review.builds[8].artifacts[review.builds[8].wasm]);
  assert.equal(resource.variant, 8); assert.equal(resource.tableBytes, 7_782_727_680);
  assert.equal(resource.rssLimit, dualCandidatePolicy(dualCandidateRequest(8)).rssLimit);
}
export function validateDualCandidateReview(request: Request, current: any) {
  const policy = dualCandidatePolicy(request), variant = policy.variant, scope = policy.dualCandidateScope;
  const config = dualCandidateScopeConfig(scope), review = read(config.reviewPath);
  if (isOpt9RoundScope(scope)) validateOpt9RoundClear();
  validateDualCandidateState(review, current, policy.rssLimit, {
    used: existsSync(receiptPath(variant, scope)) || existsSync(dualCandidateOutput(variant, scope)) || existsSync(resourcePath(variant, scope)),
    stopped: existsSync(config.stopPath),
  }, Date.now(), scope);
  assert.equal(review.previousReviewSha256, previousReviewSha256);
  assert.deepEqual(request.args, dualCandidateRequest(variant, undefined, scope).args);
  assert.deepEqual(review.requests, config.variants.map(value => dualCandidateRequest(value, undefined, scope)));
  assert.deepEqual(Object.keys(review.builds).sort(), config.variants.map(String).sort());
  assert.deepEqual(Object.keys(review.inputs).sort(), config.variants.map(String).sort());
  assert.deepEqual(review.history, hashes(historyPaths(scope))); assert.deepEqual(review.sources, hashes(scopeSourcePaths(scope)));
  validateHistory(scope);
  if (scope === 'opt8-original') assert.deepEqual(review.original, originalArtifacts());
  for (const value of config.variants) {
    const item = review.builds[value]; validateBuild(value, item.wasm, scope);
    assert.deepEqual(item.artifacts, artifactHashes(item.wasm));
    const corpus = readWca100(corpusPath(value), value === 8 ? 100 : 1000);
    assert.equal(corpus.corpusSha256, expectedCorpus[value]);
    assert.equal(review.inputs[value].corpusSha256, expectedCorpus[value]);
    assert.equal(review.inputs[value].smallSha256, sha(resolve(openBase, `opt${value}-generated/small-memory.bin`)));
    assert.equal(statSync(tablePaths[value]).size, 30_401_280 * 2 ** value);
  }
  if (variant === 9 && scope === 'coset') validateFirstCandidate(review);
  return {receiptPath: receiptPath(variant, scope), input: Buffer.alloc(0), receipt: {
    schema: 'cuberoot.dual-wasm-candidate-consumption.v1', label: request.label, variant,
    engine: scope === 'opt8-original' ? 'original-wasm' : 'rust-wasm',
    ...(scope === 'coset' ? {} : {scope}),
    ...(isOpt9RoundScope(scope) ? {round: opt9Round.id} : {}),
    ...(scope === 'opt8-original' ? {artifactSha256: review.original.wasmSha256,
      upstreamWrapperSha256: review.original.wrapperSha256, wrapperSha256: review.original.patchedWrapperSha256} : {}),
    candidate: config.candidates[variant], reviewSha256: sha(config.reviewPath),
    before: current, consumedAt: new Date().toISOString(),
  }};
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const opt9Scope = (process.argv[2] ?? '').replace(/^prepare-/, '');
  const scope: DualCandidateScope = isOpt9RoundScope(opt9Scope) ? opt9Scope
    : process.argv[2] === 'prepare-opt8-original' ? 'opt8-original'
    : process.argv[2] === 'prepare-opt8-root' ? 'opt8-root'
    : process.argv[2] === 'prepare-opt8-lazy' ? 'opt8-lazy' : 'coset';
  assert.equal(process.argv[2], scope === 'coset' ? 'prepare' : `prepare-${scope}`);
  const config = dualCandidateScopeConfig(scope);
  requireOpt9Approval(scope);
  if (isOpt9RoundScope(scope)) validateOpt9RoundClear();
  assert.equal(process.argv.length, 3 + config.variants.length);
  assert(!existsSync(config.reviewPath) && !existsSync(config.stopPath));
  const builds = Object.fromEntries(config.variants.map((variant, index) => {
    const wasm = resolve(process.argv[index + 3]); validateBuild(variant, wasm, scope);
    assert(!existsSync(receiptPath(variant, scope)) && !existsSync(resourcePath(variant, scope)) && !existsSync(dualCandidateOutput(variant, scope)));
    return [variant, {wasm, artifacts: artifactHashes(wasm)}];
  }));
  validateHistory(scope);
  const history = hashes(historyPaths(scope));
  const inputs = Object.fromEntries(config.variants.map(variant => [variant, {
    corpusSha256: readWca100(corpusPath(variant), variant === 8 ? 100 : 1000).corpusSha256,
    smallSha256: sha(resolve(openBase, `opt${variant}-generated/small-memory.bin`)),
  }]));
  mkdirSync(config.dir, {recursive: true});
  writeFileSync(config.reviewPath, JSON.stringify({
    schema: scope === 'coset' ? 'cuberoot.dual-wasm-candidate-review.v1' : 'cuberoot.dual-wasm-candidate-review.v2',
    authorization: config.authorization,
    ...(scope === 'coset' ? {} : {scope,
      precedingQuestionScope: isOpt9RoundScope(scope) ? opt9Approval.precedingQuestionScope : precedingQuestionScope,
      stoppedReviewSha256, stoppedScopeSha256, stoppedResourceSha256}),
    ...(scope === 'opt8-root' ? {completedPredecessor: lazyEvidenceDigests} : {}),
    ...(scope === 'opt8-original' ? {completedPredecessor: rootEvidenceDigests, original: originalArtifacts()} : {}),
    ...(isOpt9RoundScope(scope) ? {completedPredecessor: original8EvidenceDigests, round: opt9Round,
      startupReserveBytes: dualCandidateStartupReserveBytes(scope),
      startupReserveAuthorization: opt9Approval.startupReserveAuthorization} : {}),
    boot, swapouts: config.swapouts, previousReviewSha256, builds, history, inputs, sources: hashes(scopeSourcePaths(scope)),
    requests: config.variants.map(value => dualCandidateRequest(value, builds[value].wasm, scope)),
  }, null, 2) + '\n', {flag: 'wx'});
  console.log(config.reviewPath);
}
