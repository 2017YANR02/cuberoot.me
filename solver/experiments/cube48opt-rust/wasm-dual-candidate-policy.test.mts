import assert from 'node:assert/strict';
import test from 'node:test';
import { resolve } from 'node:path';
import { readFileSync, statSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { openBase } from './open-benchmark-policy.mts';
import { dualCandidatePolicy, dualCandidateRequest, dualCandidateScopeConfig, dualCandidateOutput, dualCandidateStartupReserveBytes, validateDualCandidateState, validateOpt9BatchBuildMetadata, opt9RoundScopes, opt9RoundStopPath, opt9CandidatePinnedBuild, validateOpt9CandidateBuildMetadata, validateOpt9RoundResourceRecords } from './wasm-dual-candidate-policy.mts';
import { researchPolicy, resourceProtectionReasons } from './guard.mts';
import { compareExhaustedShardWork } from './report-dual-wasm.mts';

const wasm = resolve(openBase, 'rust-wasm-shared-builds/build-fixture/cube48opt-rust8.wasm');
const reviewed = {schema: 'cuberoot.dual-wasm-candidate-review.v1',
  authorization: 'Opt8统一用8 GB 100条；Rust Opt9 16 GB 1000条，然后优化两档WASM；沿用4/16线程，各一轮不预热',
  boot: '{ sec = 1791771877, usec = 170806 } Sun Oct 11 19:24:37 2026', swapouts: 16};
const current = {boot: reviewed.boot, swapouts: 16, pressure: 1, available: 40 * 2 ** 30};
const unused = {used: false, stopped: false};
const now = Date.parse('2026-10-15T12:00:00Z');

test('only the two fixed Rust-only cohort commands receive the existing per-runtime budgets', () => {
  for (const variant of [8, 9] as const) {
    const request = dualCandidateRequest(variant, wasm), policy = dualCandidatePolicy(request);
    assert.equal(policy.variant, variant); assert.equal(policy.wasmThreads, variant === 8 ? 4 : 16);
    assert.equal(policy.rssLimit, variant === 8 ? 9_563_425_136 : 19_778_730_352);
    assert.equal(policy.startupReserveBytes, 3 * 2 ** 30);
    assert.deepEqual(researchPolicy(request.label, request.executable, request.args, request.env), policy);
    for (const [flag, value] of [['--engine', 'original'], ['--threads', '18'], ['--cases', variant === 8 ? '1000' : '100'],
      ['--out', '/tmp/retry'], ['--compiler', 'liftoff'], ['--table', '/tmp/other-table']]) {
      const args = [...request.args]; args[args.indexOf(flag) + 1] = value;
      assert.throws(() => dualCandidatePolicy({...request, args}));
    }
    assert.throws(() => dualCandidatePolicy({...request, label: request.label + '-retry'}));
    assert.throws(() => dualCandidatePolicy({...request, env: {...request.env, CUBEOPT_SEARCH_THREADS: '16'}}));
    assert.throws(() => dualCandidatePolicy({...request, args: [...request.args, '--resume-from', '/tmp/partial']}));
    assert.throws(() => dualCandidateRequest(7 as any, wasm));
  }
});

test('review continues Swapouts 16 and cannot reset it, reuse a run, ignore stops or exceed its expiry', () => {
  const budget = dualCandidatePolicy(dualCandidateRequest(9, wasm)).rssLimit;
  assert.doesNotThrow(() => validateDualCandidateState(reviewed, current, budget, unused, now));
  for (const changed of [{...current, swapouts: 17}, {...current, swapouts: 0}, {...current, boot: 'other'},
    {...current, pressure: 2}, {...current, available: budget + 3 * 2 ** 30 - 1}]) {
    assert.throws(() => validateDualCandidateState(reviewed, changed, budget, unused, now));
  }
  assert.throws(() => validateDualCandidateState({...reviewed, swapouts: 17}, {...current, swapouts: 17}, budget, unused, now));
  for (const state of [{used: true, stopped: false}, {used: false, stopped: true}])
    assert.throws(() => validateDualCandidateState(reviewed, current, budget, state, now));
  assert.throws(() => validateDualCandidateState(reviewed, current, budget, unused, Date.parse('2026-10-17T00:00:00Z')));
  assert.deepEqual(resourceProtectionReasons(current, {...current, swapouts: 17}, budget, budget, 4 * 2 ** 30), ['Swapouts changed']);
});

test('the new authorization permits only the pinned Opt8 artifact once, with an isolated stop path', () => {
  const scope = 'opt8-lazy', config = dualCandidateScopeConfig(scope);
  const pinned = resolve(openBase, 'rust-wasm-shared-builds/build-UXKCJq/cube48opt-rust8.wasm');
  const request = dualCandidateRequest(8, pinned, scope), policy = dualCandidatePolicy(request);
  assert.deepEqual(config.variants, [8]); assert.equal(config.swapouts, 48);
  assert.equal(config.authorization, '你就先优化和测试 opt8');
  assert.equal(config.candidates[8], 'lazy-normal-four');
  assert.equal(policy.scopeStopPath, resolve(openBase, 'wasm-opt8-lazy-20261015/stop.json'));
  assert.notEqual(policy.scopeStopPath, dualCandidateScopeConfig().stopPath);
  assert.equal(policy.wasmThreads, 4); assert.equal(policy.rssLimit, 9_563_425_136);
  assert.equal(request.label, 'wasm-opt8-lazy-20261015');
  assert.equal(dualCandidateOutput(8, scope), resolve(config.dir, 'opt8'));
  assert.deepEqual(researchPolicy(request.label, request.executable, request.args, request.env), policy);
  for (const [flag, value] of [['--variant', '9'], ['--engine', 'original'], ['--threads', '16'], ['--cases', '1000'],
    ['--out', '/tmp/retry'], ['--compiler', 'liftoff'], ['--table', '/tmp/other-table'], ['--wasm', wasm]]) {
    const args = [...request.args]; args[args.indexOf(flag) + 1] = value;
    assert.throws(() => dualCandidatePolicy({...request, args}));
  }
  assert.throws(() => dualCandidateRequest(9, pinned, scope));
  assert.throws(() => dualCandidateOutput(9, scope));
  assert.throws(() => dualCandidateRequest(8, wasm, scope));
  assert.throws(() => dualCandidateScopeConfig('retry' as any));
  assert.throws(() => dualCandidatePolicy({...request, label: request.label + '-retry'}));
  assert.throws(() => dualCandidatePolicy({...request, env: {...request.env, CUBEOPT_VARIANT: '9'}}));
  assert.throws(() => dualCandidatePolicy({...request, env: {...request.env, CUBEOPT_WASM_DUAL_CANDIDATE_REVIEW: '/tmp/session.json'}}));
  assert.throws(() => dualCandidatePolicy({...request, env: {...request.env, CUBEOPT_SWAPOUTS: '48'}}));
  assert.throws(() => dualCandidatePolicy({...request, args: [...request.args, '--resume-from', '/tmp/partial']}));
});

test('the Opt8-only review binds the explicit 48 authorization and old stop, never resetting either scope', () => {
  const scope = 'opt8-lazy', config = dualCandidateScopeConfig(scope);
  const lazyReview = {schema: 'cuberoot.dual-wasm-candidate-review.v2', scope,
    authorization: '你就先优化和测试 opt8',
    precedingQuestionScope: '明确请求为本轮 Opt8/Opt9 候选建立同次启动的 Swapouts 48 新基线，保留此前 16→48 停止记录；用户将授权缩小为仅 Opt8',
    stoppedReviewSha256: 'd67fb04e252f4d18f10361e6b308ea2d1f3e04c8c74d8afee452128962cb6ba1',
    stoppedScopeSha256: '9860b4e3dc4cb12dc7325b8d3b0822201b694a37fb571fce842264b5a62d7ddc',
    stoppedResourceSha256: 'd2e00f194638328f3204f5203a76593781cad69f2584d5d97ae247889d02e8de',
    boot: reviewed.boot, swapouts: 48};
  const observation = {...current, swapouts: 48}, budget = 9_563_425_136;
  const validate = (review = lazyReview, observed = observation, state = unused) =>
    validateDualCandidateState(review, observed, budget, state, now, scope);
  assert.doesNotThrow(() => validate());
  for (const change of [{swapouts: 49}, {swapouts: 16}, {swapouts: 0}, {boot: 'other'},
    {pressure: 2}, {available: budget + 3 * 2 ** 30 - 1}]) assert.throws(() => validate(lazyReview, {...observation, ...change}));
  for (const change of [{authorization: authorizationNotGranted()}, {scope: 'coset'}, {swapouts: 49},
    {stoppedScopeSha256: 'changed'}, {stoppedReviewSha256: 'changed'}, {stoppedResourceSha256: 'changed'},
    {precedingQuestionScope: ''}]) assert.throws(() => validate({...lazyReview, ...change}));
  for (const state of [{used: true, stopped: false}, {used: false, stopped: true}]) assert.throws(() => validate(lazyReview, observation, state));
  assert.throws(() => validateDualCandidateState(lazyReview, observation, budget, unused,
    Date.parse('2026-10-17T00:00:00Z'), scope));
  assert.throws(() => validateDualCandidateState(reviewed, observation, budget, unused, now));
  assert.throws(() => validateDualCandidateState({...reviewed, swapouts: 48}, observation, budget, unused, now));
  assert.deepEqual(resourceProtectionReasons(observation, {...observation, swapouts: 49}, budget, budget, 4 * 2 ** 30), ['Swapouts changed']);
  assert.equal(dualCandidateScopeConfig().swapouts, 16);
  assert.notEqual(config.reviewPath, dualCandidateScopeConfig().reviewPath);
});

function authorizationNotGranted() { return '允许 Opt8 和 Opt9'; }

test('root-only candidate has a new fixed Opt8 scope and cannot reuse the lazy build or run Opt9', () => {
  const scope = 'opt8-root', config = dualCandidateScopeConfig(scope);
  const pinned = resolve(openBase, 'rust-wasm-shared-builds/build-vkpXmK/cube48opt-rust8.wasm');
  const request = dualCandidateRequest(8, pinned, scope), policy = dualCandidatePolicy(request);
  assert.deepEqual(config.variants, [8]); assert.equal(config.swapouts, 48);
  assert.equal(config.candidates[8], 'root-bound-four');
  assert.equal(request.label, 'wasm-opt8-root-20261015');
  assert.equal(policy.scopeStopPath, resolve(openBase, 'wasm-opt8-root-20261015/stop.json'));
  assert.notEqual(config.reviewPath, dualCandidateScopeConfig('opt8-lazy').reviewPath);
  assert.equal(policy.rssLimit, 9_563_425_136); assert.equal(policy.wasmThreads, 4);
  assert.deepEqual(researchPolicy(request.label, request.executable, request.args, request.env), policy);
  assert.throws(() => dualCandidateRequest(9, pinned, scope));
  assert.throws(() => dualCandidateRequest(8, resolve(openBase, 'rust-wasm-shared-builds/build-UXKCJq/cube48opt-rust8.wasm'), scope));
  assert.throws(() => dualCandidateRequest(8, pinned, 'opt8-lazy'));
  for (const [flag, value] of [['--engine', 'original'], ['--threads', '16'], ['--cases', '1000'], ['--out', '/tmp/retry']]) {
    const args = [...request.args]; args[args.indexOf(flag) + 1] = value;
    assert.throws(() => dualCandidatePolicy({...request, args}));
  }
  assert.throws(() => dualCandidatePolicy({...request, env: {...request.env, CUBEOPT_VARIANT: '9'}}));
});

test('root continuation binds completed lazy evidence and preserves the 48 baseline and no-retry boundary', () => {
  const scope = 'opt8-root';
  const review = {schema: 'cuberoot.dual-wasm-candidate-review.v2', scope,
    authorization: '你就先优化和测试 opt8',
    precedingQuestionScope: '明确请求为本轮 Opt8/Opt9 候选建立同次启动的 Swapouts 48 新基线，保留此前 16→48 停止记录；用户将授权缩小为仅 Opt8',
    stoppedReviewSha256: 'd67fb04e252f4d18f10361e6b308ea2d1f3e04c8c74d8afee452128962cb6ba1',
    stoppedScopeSha256: '9860b4e3dc4cb12dc7325b8d3b0822201b694a37fb571fce842264b5a62d7ddc',
    stoppedResourceSha256: 'd2e00f194638328f3204f5203a76593781cad69f2584d5d97ae247889d02e8de',
    completedPredecessor: {
      'wasm-opt8-lazy-20261015/session.json': '1425585452eadf57c33ae649e3e017d7a06d484c193cf8a7fdd3c402731da913',
      'wasm-opt8-lazy-20261015/opt8-receipt.json': '7d3c71502ebf28bd8ed5d28b8a30dc97735393a0bc8a93900cd644ceb0db9da4',
      'wasm-opt8-lazy-20261015/opt8-exit.json': '1c61da59d5bfecaa85a44e51ec881c28dcc7fcad87db674772b4c5fc0e6366e5',
      'wasm-opt8-lazy-20261015/opt8-report.json': '331d8066692fd830bd10807d9616de1c8869d7583ec7f8e3921e33370b524b38',
      'wasm-opt8-lazy-20261015-resources.json': '360b3f8db0b4b5ea4fa50db64e43ea0eb0bf47a25d33e59955833ebaeef30c7a',
    }, boot: reviewed.boot, swapouts: 48};
  const observation = {...current, swapouts: 48}, budget = 9_563_425_136;
  const validate = (candidate = review, observed = observation, state = unused) =>
    validateDualCandidateState(candidate, observed, budget, state, now, scope);
  assert.doesNotThrow(() => validate());
  for (const path of Object.keys(review.completedPredecessor))
    assert.throws(() => validate({...review, completedPredecessor: {...review.completedPredecessor, [path]: 'changed'}}));
  assert.throws(() => validate({...review, completedPredecessor: undefined as any}));
  for (const swapouts of [16, 0, 49]) assert.throws(() => validate(review, {...observation, swapouts}));
  assert.throws(() => validate({...review, swapouts: 49}, {...observation, swapouts: 49}));
  assert.throws(() => validate(review, {...observation, boot: 'other'}));
  for (const state of [{used: true, stopped: false}, {used: false, stopped: true}]) assert.throws(() => validate(review, observation, state));
});

test('original Opt8 is one original-only WCA100/4 run with fixed metadata and isolated output', () => {
  const scope = 'opt8-original', config = dualCandidateScopeConfig(scope);
  const frozen = resolve(openBase, 'rust-wasm-shared-builds/build-FcRcSF/cube48opt-rust8.wasm');
  const request = dualCandidateRequest(8, frozen, scope), policy = dualCandidatePolicy(request);
  assert.equal(config.dir, resolve(openBase, 'original-opt8-local4-20261015'));
  assert.equal(request.label, 'original-opt8-local4-20261015');
  assert.equal(config.candidates[8], 'original-opt8'); assert.deepEqual(config.variants, [8]);
  assert.equal(request.args[request.args.indexOf('--engine') + 1], 'original');
  assert.equal(policy.rssLimit, 9_563_425_136); assert.equal(policy.wasmThreads, 4);
  assert.equal(policy.scopeStopPath, resolve(config.dir, 'stop.json'));
  assert.deepEqual(researchPolicy(request.label, request.executable, request.args, request.env), policy);
  for (const [flag, value] of [['--engine', 'rust'], ['--engine', 'both'], ['--variant', '9'], ['--threads', '16'],
    ['--cases', '1000'], ['--compiler', 'liftoff'], ['--table', '/tmp/another'], ['--out', '/tmp/retry'], ['--wasm', wasm]]) {
    const args = [...request.args]; args[args.indexOf(flag) + 1] = value;
    assert.throws(() => dualCandidatePolicy({...request, args}));
  }
  assert.throws(() => dualCandidatePolicy({...request, args: [...request.args, '--resume-from', '/tmp/previous']}));
  assert.throws(() => dualCandidatePolicy({...request, env: {...request.env, CUBEOPT_SWAPOUTS: '48'}}));
  assert.throws(() => dualCandidateRequest(9, frozen, scope));
  assert.throws(() => dualCandidateRequest(8, frozen, 'opt8-lazy'));
  assert.throws(() => dualCandidateScopeConfig('opt8-padded' as any), 'Interrupted padded scope remains disabled');
});

test('original Opt8 binds completed root evidence and cannot reset 48, reuse results or ignore stops', () => {
  const scope = 'opt8-original', config = dualCandidateScopeConfig(scope);
  const review = {schema: 'cuberoot.dual-wasm-candidate-review.v2', scope, authorization: config.authorization,
    precedingQuestionScope: '明确请求为本轮 Opt8/Opt9 候选建立同次启动的 Swapouts 48 新基线，保留此前 16→48 停止记录；用户将授权缩小为仅 Opt8',
    stoppedReviewSha256: 'd67fb04e252f4d18f10361e6b308ea2d1f3e04c8c74d8afee452128962cb6ba1',
    stoppedScopeSha256: '9860b4e3dc4cb12dc7325b8d3b0822201b694a37fb571fce842264b5a62d7ddc',
    stoppedResourceSha256: 'd2e00f194638328f3204f5203a76593781cad69f2584d5d97ae247889d02e8de',
    completedPredecessor: {
      'wasm-opt8-root-20261015/session.json': '251331581f813ec55616b6ab9c3fac69246d35d42e53adb562d8173f70c45956',
      'wasm-opt8-root-20261015/opt8-receipt.json': 'be137ccba5b518dafac12afc4e2022cf8af441658263c54f879a473a2e5b419d',
      'wasm-opt8-root-20261015/opt8-exit.json': '93eb9e677a1dab2a12958c657903c325bd0452f6708e7c82b2fdb70ef8ae69e7',
      'wasm-opt8-root-20261015/opt8-report.json': '8500ef3d13984db9e57644d725378c3b6995b64733227457540c4acb6685f733',
      'wasm-opt8-root-20261015-resources.json': '3cd5d23643cd05ca7fc1f599969657fceb09b254598b1e3b943eb229345bafa2',
    }, boot: reviewed.boot, swapouts: 48};
  const observation = {...current, swapouts: 48}, budget = 9_563_425_136;
  const validate = (value = review, observed = observation, state = unused) =>
    validateDualCandidateState(value, observed, budget, state, now, scope);
  assert.doesNotThrow(() => validate());
  for (const path of Object.keys(review.completedPredecessor))
    assert.throws(() => validate({...review, completedPredecessor: {...review.completedPredecessor, [path]: 'changed'}}));
  for (const swapouts of [0, 16, 49]) assert.throws(() => validate(review, {...observation, swapouts}));
  assert.throws(() => validate({...review, swapouts: 49}, {...observation, swapouts: 49}));
  assert.throws(() => validate({...review, authorization: '你就先优化和测试 opt8'}));
  assert.throws(() => validate(review, {...observation, boot: 'other'}));
  for (const state of [{used: true, stopped: false}, {used: false, stopped: true}]) assert.throws(() => validate(review, observation, state));
});

test('the four newly authorized Opt9 scopes accept only their frozen artifacts and fixed single-pass commands', () => {
  const dirs = new Set<string>();
  for (const scope of opt9RoundScopes) {
    const config = dualCandidateScopeConfig(scope), pinned = opt9CandidatePinnedBuild(scope);
    const request = dualCandidateRequest(9, pinned.wasm, scope), policy = dualCandidatePolicy(request);
    assert.deepEqual(config.variants, [9]); assert.equal(config.candidates[9], pinned.candidate);
    assert.equal(config.authorization, '可以测试了'); assert.equal(config.swapouts, 48);
    assert.equal(config.dir, resolve(openBase, `wasm-${scope}-20261015`)); dirs.add(config.dir);
    assert.equal(dualCandidateOutput(9, scope), resolve(config.dir, 'opt9'));
    assert.equal(policy.scopeStopPath, opt9RoundStopPath); assert.equal(policy.wasmThreads, 16);
    assert.equal(policy.rssLimit, 19_778_730_352);
    assert.equal(policy.startupReserveBytes, 2 ** 30);
    assert.deepEqual(researchPolicy(request.label, request.executable, request.args, request.env), policy);
    assert.throws(() => dualCandidateRequest(8, pinned.wasm, scope), /Variant is not authorized/);
    assert.throws(() => dualCandidateRequest(9, wasm, scope), /Only the reviewed artifact/);
    for (const peer of opt9RoundScopes.filter(value => value !== scope))
      assert.throws(() => dualCandidateRequest(9, opt9CandidatePinnedBuild(peer).wasm, scope));
    for (const [flag, value] of [['--threads', '4'], ['--engine', 'original'], ['--cases', '100'], ['--compiler', 'liftoff'],
      ['--out', '/tmp/retry'], ['--table', '/tmp/other-table'], ['--wasm', '/tmp/draft/cube48opt-rust8.wasm']]) {
      const args = [...request.args]; args[args.indexOf(flag) + 1] = value;
      assert.throws(() => dualCandidatePolicy({...request, args}));
    }
    assert.throws(() => dualCandidatePolicy({...request, label: request.label + '-retry'}));
    assert.throws(() => dualCandidatePolicy({...request, env: {...request.env, CUBEOPT_SWAPOUTS: '49'}}));
    assert.throws(() => dualCandidatePolicy({...request, args: [...request.args, '--resume-from', '/tmp/partial']}));
  }
  assert.equal(dirs.size, 4);
  for (const scope of ['coset', 'opt8-lazy', 'opt8-root', 'opt8-original'] as const)
    assert.equal(dualCandidateStartupReserveBytes(scope), 3 * 2 ** 30);
  assert.equal(dualCandidateScopeConfig('coset').swapouts, 16);
  assert.equal(dualCandidateScopeConfig('opt8-lazy').authorization, '你就先优化和测试 opt8');
  assert.throws(() => dualCandidateScopeConfig('opt8-padded' as any));
});

test('any Opt9 candidate protection record blocks the whole round, including missing common-stop recovery', () => {
  const clean = {boot: reviewed.boot, swapouts: 48, pressure: 1, stopped: '', trigger: null,
    rssLimit: 19_778_730_352, minimumHeadroom: 2 * 2 ** 30, peakRss: 16 * 2 ** 30};
  assert.doesNotThrow(() => validateOpt9RoundResourceRecords({}, false));
  assert.throws(() => validateOpt9RoundResourceRecords({}, true));
  const records = Object.fromEntries(opt9RoundScopes.map(scope => [scope, clean]));
  assert.doesNotThrow(() => validateOpt9RoundResourceRecords(records, false));
  for (const scope of opt9RoundScopes) {
    for (const changed of [{swapouts: 49}, {swapouts: 16}, {swapouts: 0}, {boot: 'other'}, {pressure: 2},
      {stopped: 'Resource protection: Swapouts changed'}, {trigger: {reason: 'RSS limit'}}, {rssLimit: 20 * 2 ** 30},
      {minimumHeadroom: clean.minimumHeadroom - 1}, {peakRss: clean.rssLimit + 1}]) {
      assert.throws(() => validateOpt9RoundResourceRecords({...records, [scope]: {...clean, ...changed}}, false));
    }
  }
});

test('Opt9 authorization binds the shared round and immutable 16-to-48 history without enabling retries', () => {
  const observation = {...current, swapouts: 48}, budget = 19_778_730_352;
  const completedPredecessor = {
    'original-opt8-local4-20261015/session.json': '8ae574d6d76c2f52386470577a9c67ea24d0db100f7bb1576c5ffdc8a1dd0c43',
    'original-opt8-local4-20261015/opt8-receipt.json': '0dd75fd51a31aa8b05c76a15a360da914bd0d9362813b4922e11480e9197fb9a',
    'original-opt8-local4-20261015/opt8-exit.json': 'b9b8258d8a84278e708e8f437ee09987510896f3feea20b4ae6ec06b8c1868c4',
    'original-opt8-local4-20261015/opt8-report.json': 'f165222be3b03314630bd0f0780585418669d711dff721fbb6e4b46c8a2a79d6',
    'original-opt8-local4-20261015-resources.json': '9bfc01ee266cf2e4b342259d699653f33852b460e2857ff643d23c1a80e47e95',
    'original-opt8-local4-20261015/preflight-failure.json': '0c50c7fc610eeb5ec68896e8d22f3b5939254d5221176d5f2fedbeaabf807c9c',
    'original-opt8-local4-20261015/opt8.stderr.log': '308640494034ddcde6d6c4a9a3987d675254e1df524984496a3ca737a6c2601a',
  };
  for (const scope of opt9RoundScopes) {
    const review = {schema: 'cuberoot.dual-wasm-candidate-review.v2', scope, authorization: '可以测试了',
      precedingQuestionScope: '用户撤销“先保留代码，不测试”的延后决定，授权此前保留的四个 Opt9 WASM 候选在本机按已说明的独立 Swapouts 48 范围顺序测试；同样 WCA1000、16线程、各一轮、零预热，不重跑原版，保留旧16→48停止记录与全部旧版本，仅本地不发布。',
      stoppedReviewSha256: 'd67fb04e252f4d18f10361e6b308ea2d1f3e04c8c74d8afee452128962cb6ba1',
      stoppedScopeSha256: '9860b4e3dc4cb12dc7325b8d3b0822201b694a37fb571fce842264b5a62d7ddc',
      stoppedResourceSha256: 'd2e00f194638328f3204f5203a76593781cad69f2584d5d97ae247889d02e8de',
      completedPredecessor, round: {id: 'opt9-four-20261015', scopes: opt9RoundScopes, stopPath: opt9RoundStopPath},
      startupReserveBytes: 2 ** 30, startupReserveAuthorization: '启动安全余量：3 GiB 该成 1G,然后测试',
      boot: reviewed.boot, swapouts: 48};
    const validate = (candidate = review, observed = observation, state = unused) =>
      validateDualCandidateState(candidate, observed, budget, state, now, scope);
    assert.doesNotThrow(() => validate());
    assert.doesNotThrow(() => validate(review, {...observation, available: budget + 2 ** 30}));
    for (const swapouts of [0, 16, 49]) assert.throws(() => validate(review, {...observation, swapouts}));
    for (const changed of [{boot: 'other'}, {pressure: 2}, {available: budget + 2 ** 30 - 1}])
      assert.throws(() => validate(review, {...observation, ...changed}));
    for (const changed of [{authorization: null}, {authorization: '你就先优化和测试 opt8'}, {precedingQuestionScope: ''},
      {stoppedScopeSha256: 'changed'}, {completedPredecessor: {}}, {round: {...review.round, stopPath: '/tmp/retry'}},
      {startupReserveAuthorization: undefined}, {startupReserveBytes: undefined}, {startupReserveBytes: 0},
      {startupReserveBytes: 3 * 2 ** 30}])
      assert.throws(() => validate({...review, ...changed} as any));
    for (const state of [{used: true, stopped: false}, {used: false, stopped: true}])
      assert.throws(() => validate(review, observation, state));
  }
});

test('the frozen Opt9 batch metadata enables only batch loads and proves the actual 16-worker fixture', () => {
  const path = resolve(openBase, 'rust-wasm-shared-builds/build-gLDBF5/build-metadata.json');
  assert(statSync(path).size < 4 * 2 ** 20);
  const build = JSON.parse(readFileSync(path, 'utf8'));
  assert.doesNotThrow(() => validateOpt9BatchBuildMetadata(build));
  for (const key of ['cosetBatchEnabled', 'rootBoundEnabled', 'lazyNormalEnabled']) {
    const changed = structuredClone(build); changed.smallCheck[key] = true;
    assert.throws(() => validateOpt9BatchBuildMetadata(changed));
  }
  for (const change of [{opt9BatchEnabled: false}, {paddedStateLayout: 48}, {threadCounts: [1, 2, 4, 18]},
    {independentlyVerifiedSolutions: 7074}, {batchProbeChecks: 3071}, {pdbAllocatedBytes: 1}])
    assert.throws(() => validateOpt9BatchBuildMetadata({...build, smallCheck: {...build.smallCheck, ...change}}));
  assert.throws(() => validateOpt9BatchBuildMetadata({...build, wasmSha256: 'changed'}));
  assert.throws(() => validateOpt9BatchBuildMetadata({...build, verifiedThreadCounts: [1, 2, 4, 18]}));
});

test('all four pinned builds match their immutable artifact and fixture contracts; drafts and crossed markers fail', () => {
  for (const scope of opt9RoundScopes) {
    const pinned = opt9CandidatePinnedBuild(scope), path = resolve(pinned.wasm, '../build-metadata.json');
    assert(statSync(path).size < 4 * 2 ** 20); assert(statSync(pinned.wasm).size < 4 * 2 ** 20);
    const bytes = readFileSync(path), build = JSON.parse(bytes.toString());
    assert.equal(createHash('sha256').update(bytes).digest('hex'), pinned.metadataSha256);
    assert.equal(createHash('sha256').update(readFileSync(pinned.wasm)).digest('hex'), pinned.sha256);
    assert.doesNotThrow(() => validateOpt9CandidateBuildMetadata(scope, build));
    assert.throws(() => validateOpt9CandidateBuildMetadata(scope, {...build, verified: false}));
    assert.throws(() => validateOpt9CandidateBuildMetadata(scope, {...build, benchmarkEligible: false}));
    for (const [key, value] of Object.entries({opt9BatchEnabled: !pinned.batch, opt9SelectEnabled: !pinned.select,
      paddedStateLayout: pinned.padded ? 0 : 4200468}))
      assert.throws(() => validateOpt9CandidateBuildMetadata(scope, {...build, smallCheck: {...build.smallCheck, [key]: value}}));
  }
});

test('exhausted-shard work comparison excludes winning work and exposes even balanced worker changes', () => {
  const shard = (worker: number, depth: number) => ({worker, depth, completed: true, cancelled: false,
    solution: null, nodes: 3 + worker, probes: 5 + worker, jobs: 1, quarterRemoved: 2});
  const row = {id: 'case1', length: 1, threads: 2, search: {depthResults: [
    [shard(0, 0), shard(1, 0)],
    [{...shard(0, 1), completed: false, solution: 'R'}, {...shard(1, 1), completed: false, cancelled: true}],
  ]}};
  const identical = compareExhaustedShardWork([row], [structuredClone(row)]);
  assert.equal(identical.workEquivalent, true); assert.equal(identical.comparedShards, 2);
  assert.equal(identical.skippedShards, 2); assert.equal(identical.firstDifference, null);
  const winning = structuredClone(row); winning.search.depthResults[1][0].nodes += 100;
  assert.equal(compareExhaustedShardWork([winning], [row]).workEquivalent, true);
  const changed = structuredClone(row);
  changed.search.depthResults[0][0].jobs++; changed.search.depthResults[0][1].jobs--;
  const comparison = compareExhaustedShardWork([changed], [row]);
  assert.equal(comparison.workEquivalent, false); assert.equal(comparison.differingShards, 2);
  assert.equal(comparison.allExhaustedLayerTotalsMatched, true);
  assert.deepEqual(comparison.firstDifference, {index: 0, id: 'case1', depth: 0, worker: 0, metric: 'jobs', baseline: 1, candidate: 2});
  changed.search.depthResults[0][0].nodes++;
  assert.equal(compareExhaustedShardWork([changed], [row]).allExhaustedLayerTotalsMatched, false);
  const incomplete = structuredClone(row); incomplete.search.depthResults[0][0].completed = false;
  assert.throws(() => compareExhaustedShardWork([incomplete], [row]), /Every below-optimum shard/);
});
