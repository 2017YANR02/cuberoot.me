import assert from 'node:assert/strict';
import test from 'node:test';
import { zbllMultisolutionRequest, zbllMultisolutionPolicy, zbllMultisolutionLabel,
  validateZbllMultisolutionInput, validateZbllMultisolutionSession, validateZbllSetupFailure } from './zbll-multisolution-policy.mts';
import { researchPolicy, resourceProtectionReasons } from './guard.mts';

test('fixed Opt9 command rejects alternate inputs, commands, threads and review flags', () => {
  const request = zbllMultisolutionRequest(), policy = zbllMultisolutionPolicy(request);
  assert.equal(policy.rssLimit, 15_565_455_360 + 2 ** 30);
  assert.equal(policy.deadlineMs, 600_000);
  assert.equal(request.env.CUBEOPT_SEARCH_THREADS, '1');
  assert.deepEqual(researchPolicy(request.label, request.executable, request.args, request.env), policy);
  for (const changed of [
    { ...request, label: request.label + '-retry' },
    { ...request, args: [...request.args.slice(0, -1), '0'] },
    { ...request, env: { ...request.env, CUBEOPT_SEARCH_THREADS: '16' } },
    { ...request, env: { ...request.env, CUBEOPT_H: '11' } },
  ]) assert.throws(() => zbllMultisolutionPolicy(changed));
});

test('input accepts bounded unique outer-turn states and rejects extra or ambiguous work', () => {
  assert.equal(validateZbllMultisolutionInput(Buffer.from("c0\tR U R'\nc1\tD2 F B'\n")).rows, 2);
  for (const input of ['', 'c0\tR\nc0\tU\n', 'c0\tr U M\n', 'c0\tR  U\n', 'c0\tR\textra\n',
    'c0\tR\r\n', 'c0\tR', Array.from({ length: 5001 }, (_, i) => `c${i}\tR\n`).join('')])
    assert.throws(() => validateZbllMultisolutionInput(Buffer.from(input)));
});

test('consumption and stop are final; reviewed boot, swap, evidence and startup reserve cannot reset', () => {
  const request = zbllMultisolutionRequest(), policy = zbllMultisolutionPolicy(request);
  const now = Date.now(), current = { boot: 'fixture-boot', swapouts: 12, pressure: 1, available: policy.rssLimit + 3 * 2 ** 30 };
  const evidence = { input: { sha256: 'fixture', rows: 2, bytes: 16 }, setupFailure: { boot: current.boot, swapouts: current.swapouts } } as any;
  const review = { schema: 'cuberoot.zbll-multisolution-review.v1', scope: zbllMultisolutionLabel,
    authorization: 'user sample request', preparedAt: new Date(now).toISOString(), ...current,
    cases: 1, resultLimit: 200, passes: 1, warmupCases: 0, request, evidence };
  validateZbllMultisolutionSession(review, evidence, current, false, false, now);
  assert.throws(() => validateZbllMultisolutionSession(review, evidence, current, true, false, now));
  assert.throws(() => validateZbllMultisolutionSession(review, evidence, current, false, true, now));
  for (const changed of [{ boot: 'reboot' }, { swapouts: 13 }, { pressure: 2 }, { available: current.available - 1 }])
    assert.throws(() => validateZbllMultisolutionSession(review, evidence, { ...current, ...changed }, false, false, now));
  assert.throws(() => validateZbllMultisolutionSession(review, { ...evidence, changed: true }, current, false, false, now));
  assert.throws(() => validateZbllMultisolutionSession(review, evidence, current, false, false, now + 86_400_001));
  assert(resourceProtectionReasons(current, { ...current, swapouts: 13 }, 1, policy.rssLimit, 3 * 2 ** 30).length > 0);
  assert(resourceProtectionReasons(current, current, 1, policy.rssLimit, 2 * 2 ** 30 - 1).length > 0);
  const resetEvidence = { ...evidence, setupFailure: { boot: current.boot, swapouts: current.swapouts - 1 } };
  assert.throws(() => validateZbllMultisolutionSession({ ...review, evidence: resetEvidence }, resetEvidence, current, false, false, now));
});

test('only the observed pre-table CLI rejection permits the single-thread repair', () => {
  const next = zbllMultisolutionRequest(), label = 'zbll-mcc-20261023-opt9';
  const request = { ...next, label, env: { ...next.env,
    CUBEOPT_ZBLL_MULTISOLUTION_REVIEW: next.env.CUBEOPT_ZBLL_MULTISOLUTION_REVIEW.replace('/single/session.json', '/session.json'),
    CUBEOPT_SEARCH_THREADS: '4' } };
  const reviewSha256 = '04b88057be24f1184a2bdb4657fc49c5f41969f3a01c9ccb63ee8d045b18e54d';
  const before = { boot: 'fixture-boot', swapouts: 0, pressure: 1 };
  const reason = 'Opt10 fixed input pipe failed: Error: write EPIPE';
  const review = { schema: 'cuberoot.zbll-multisolution-review.v1', scope: label, request, ...before,
    evidence: { input: { sha256: 'fixed-input' } } };
  const receipt = { schema: 'cuberoot.zbll-multisolution-consumption.v1', scope: label,
    request, reviewSha256, inputSha256: 'fixed-input', before };
  const stop = { ...before, stopped: reason, trigger: { reason } };
  const resources = { ...stop, openBenchmarkReceipt: receipt, sessionSha256: reviewSha256, guardPid: 1,
    rssLimit: 15_565_455_360 + 2 ** 30, tableBytes: 15_565_455_360, peakRss: 100 * 2 ** 20, minimumHeadroom: 3 * 2 ** 30 };
  const run = { count: 0, firstResultSeconds: null, milestones: [], exitCode: 1, signal: null, wallSeconds: 0.2, guardPid: 1 };
  const failure = { review, receipt, stop, resources, run, exit: { ...run }, raw: Buffer.alloc(0),
    stderr: 'parallel single-cube search requires MAX_NODES=0; finite node budgets remain available with CUBEOPT_SEARCH_THREADS=1\n'
      + '2162688 maximum resident set size\n0 swaps\n0 block input operations\n' };
  assert.equal(validateZbllSetupFailure(failure).nativePeakRss, 2162688);
  for (const change of [
    { raw: Buffer.from('{"solved":true}\n') },
    { run: { ...run, count: 1 } },
    { resources: { ...resources, stopped: 'Resource protection: Swapouts changed' } },
    { resources: { ...resources, swapouts: 1 } },
    { resources: { ...resources, peakRss: 2 ** 30 } },
    { stop: { ...stop, trigger: { reason, details: { observationError: 'ps failed' } } } },
    { stderr: failure.stderr.replace('2162688', '15565455360') },
    { stderr: failure.stderr.replace('0 block input operations', '1 block input operations') },
  ]) assert.throws(() => validateZbllSetupFailure({ ...failure, ...change }));
});
