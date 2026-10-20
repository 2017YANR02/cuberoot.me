import assert from 'node:assert/strict';
import test from 'node:test';
import { browserSlots, browserBoot, browserReviewPath, browserStopPath, browserSlotConfig, browserRequest, browserPolicy,
  validateBrowserState, validateBrowserPeerResources } from './wasm-browser-policy.mts';
import { researchPolicy, resourceProtectionReasons } from './guard.mts';
const GiB = 2 ** 30, now = Date.parse('2026-10-15T13:00:00Z');
const review = {schema: 'cuberoot.chrome-wasm-review.v1',
  authorization: '本机 Chrome 对照原版和我们的 WASM：8 GB 档 WCA100、4线程；16 GB 档 WCA1000、16线程；每版一轮、零预热，Node 四版结束后运行',
  startupReserveAuthorization: '启动安全余量：3 GiB 该成 1G,然后测试', startupReserveBytes: GiB,
  slots: browserSlots, stopPath: browserStopPath, boot: browserBoot, swapouts: 48};
const current = {boot: browserBoot, swapouts: 48, pressure: 1, available: 32 * GiB};
const unused = {used: false, stopped: false};
test('only the four fixed Chrome cohorts receive their own budgets and a shared stop boundary', () => {
  const outputs = new Set();
  for (const slot of browserSlots) {
    const config = browserSlotConfig(slot), request = browserRequest(slot), policy = browserPolicy(request);
    outputs.add(config.out);
    assert.equal(config.cases, config.variant === 8 ? 100 : 1000); assert.equal(config.threads, config.variant === 8 ? 4 : 16);
    assert.equal(config.passes, 1); assert.equal(config.warmupCases, 0); assert.equal(policy.startupReserveBytes, GiB);
    assert.equal(policy.rssLimit, config.variant === 8 ? 9_831_860_592 : 20_047_165_808);
    assert.equal(policy.scopeStopPath, browserStopPath);
    assert.deepEqual(researchPolicy(request.label, request.executable, request.args, request.env), policy);
    for (const change of [{label: request.label + '-retry'}, {executable: '/bin/sh'},
      {args: [...request.args, '--warmup', '1']}, {args: [request.args[0], '--probe']},
      {args: [request.args[0], '--slot', slot, '--out', '/tmp/other']},
      {env: {...request.env, CUBEOPT_VARIANT: config.variant === 8 ? '9' : '8'}},
      {env: {...request.env, CUBEOPT_BROWSER_REVIEW: browserReviewPath + '.retry'}},
      {env: {...request.env, CUBEOPT_SEARCH_THREADS: '18'}}, {env: {...request.env, CUBEOPT_SWAPOUTS: '49'}}])
      assert.throws(() => browserPolicy({...request, ...change}));
  }
  assert.equal(outputs.size, 4); assert.throws(() => browserRequest('rust10' as any));
});
test('Chrome admission keeps the authorized boot/48 and one-GiB reserve, with no retry or runtime relaxation', () => {
  for (const slot of browserSlots) {
    const policy = browserPolicy(browserRequest(slot));
    const validate = (r = review, observation = current, state = unused) => validateBrowserState(r, observation, policy, state, now);
    assert.doesNotThrow(() => validate());
    assert.doesNotThrow(() => validate(review, {...current, available: policy.rssLimit + GiB}));
    for (const changed of [{boot: 'new-boot'}, {swapouts: 49}, {swapouts: 16}, {swapouts: 0}, {pressure: 2},
      {available: policy.rssLimit + GiB - 1}]) assert.throws(() => validate(review, {...current, ...changed}));
    for (const changed of [{authorization: ''}, {startupReserveAuthorization: ''}, {startupReserveBytes: 0},
      {swapouts: 49}, {stopPath: '/tmp/retry'}, {slots: ['rust9']}]) assert.throws(() => validate({...review, ...changed} as any));
    assert.throws(() => validate(review, current, {used: true, stopped: false}));
    assert.throws(() => validate(review, current, {used: false, stopped: true}));
    assert.throws(() => validateBrowserState(review, current, policy, unused, Date.parse('2026-10-17T00:00:00Z')));
    assert.deepEqual(resourceProtectionReasons(current, current, policy.rssLimit, policy.rssLimit, 2 * GiB - 1), [`headroom ${2 * GiB - 1} < ${2 * GiB}`]);
  }
});
test('a failed peer stops all browser cohorts without resetting their counters or ignoring resource evidence', () => {
  const records = Object.fromEntries(browserSlots.map(slot => [slot, {boot: browserBoot, swapouts: 48, pressure: 1,
    stopped: '', trigger: null, rssLimit: browserPolicy(browserRequest(slot)).rssLimit, peakRss: 8 * GiB, minimumHeadroom: 2 * GiB}]));
  assert.doesNotThrow(() => validateBrowserPeerResources(records, false));
  assert.throws(() => validateBrowserPeerResources({}, true));
  for (const slot of browserSlots) for (const change of [{boot: 'other'}, {swapouts: 49}, {swapouts: 16}, {pressure: 2},
    {stopped: 'Interrupted'}, {trigger: {reason: 'RSS'}}, {peakRss: 32 * GiB}, {minimumHeadroom: 2 * GiB - 1}])
    assert.throws(() => validateBrowserPeerResources({...records, [slot]: {...records[slot], ...change}}, false));
});
