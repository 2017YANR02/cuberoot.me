import assert from 'node:assert/strict';
import test from 'node:test';
import { currentBoot, currentLabel, currentRequest, currentPolicy, validateCurrentSession } from './opt10-current-benchmark-policy.mts';
import { officialBinarySha256 } from './opt10-official-policy.mts';
import { researchPolicy, resourceProtectionReasons } from './guard.mts';

function fixture() {
  const evidence: any = {
    executableSha256: officialBinarySha256,
    input: { cases: 1000, corpusSha256: '5b42a18086b27e974115a73696702017b5dde0a19c9819a77c88c8014d67c8ea' },
    history: { 'resource-baseline.json': 'retained-old-boot-hash', 'wasm/stop.json': 'retained-swap48-hash' },
    sources: { 'guard.mts': 'current-guard' },
  };
  const review = { schema: 'cuberoot.opt10-current-benchmark-review.v1', scope: currentLabel,
    preparedAt: '2026-10-22T00:00:00Z', request: currentRequest(), evidence: structuredClone(evidence),
    boot: currentBoot, swapouts: 0, cases: 1000, threads: 16, passes: 1, warmupCases: 0 };
  return { review, evidence, now: { boot: currentBoot, swapouts: 0, pressure: 1, available: 40 * 2 ** 30 } };
}

test('dated Opt10 scope uses the exact frozen release and unchanged official budget through guard', () => {
  const request = currentRequest(), policy = currentPolicy(request);
  assert.deepEqual(researchPolicy(request.label, request.executable, request.args, request.env), policy);
  assert.equal(policy.rssLimit, 32_473_089_024);
  assert.equal(policy.searchThreads, 16); assert.equal(policy.openBenchmark, true);
  for (const changed of [
    { ...request, label: 'opt10-official-another-run' },
    { ...request, executable: request.executable.replace('opt10-official', 'opt10') },
    { ...request, args: ['generate-opt10', ...request.args.slice(1)] },
    { ...request, env: { ...request.env, CUBEOPT_SEARCH_THREADS: '8' } },
    { ...request, env: { ...request.env, CUBEOPT_OPT10_OFFICIAL_REVIEW: 'old-review' } },
  ]) assert.throws(() => currentPolicy(changed));
});

test('new boot review preserves historic stop hashes and cannot reset a consumed or stopped session', () => {
  const { review, evidence, now } = fixture(), retained = structuredClone(evidence);
  validateCurrentSession(review, evidence, now);
  assert.deepEqual(evidence, retained);
  assert.throws(() => validateCurrentSession(review, evidence, now, true));
  assert.throws(() => validateCurrentSession(review, evidence, now, false, true));
  for (const changed of [
    { ...evidence, history: {} },
    { ...evidence, history: { ...evidence.history, 'wasm/stop.json': 'reset' } },
    { ...evidence, executableSha256: 'rebuilt-program' },
    { ...evidence, sources: { 'guard.mts': 'changed-guard' } },
  ]) assert.throws(() => validateCurrentSession(review, changed, now));
  for (const changed of [{ passes: 3 }, { warmupCases: 1 }, { cases: 100 }, { swapouts: 1 }, { boot: 'historic-boot' }])
    assert.throws(() => validateCurrentSession({ ...review, ...changed }, evidence, now));
});

test('fixed current boot/swap baseline and original memory margins remain enforced', () => {
  const { review, evidence, now } = fixture(), policy = currentPolicy(currentRequest());
  validateCurrentSession(review, evidence, { ...now, available: policy.rssLimit + 3 * 2 ** 30 });
  for (const changed of [{ swapouts: 1 }, { boot: 'new-boot' }, { pressure: 2 }, { available: policy.rssLimit + 3 * 2 ** 30 - 1 }])
    assert.throws(() => validateCurrentSession(review, evidence, { ...now, ...changed }));
  assert(resourceProtectionReasons(now, { ...now, swapouts: 1 }, 1, policy.rssLimit, 3 * 2 ** 30).length > 0);
  assert(resourceProtectionReasons(now, now, 1, policy.rssLimit, 2 * 2 ** 30 - 1).length > 0);
});
