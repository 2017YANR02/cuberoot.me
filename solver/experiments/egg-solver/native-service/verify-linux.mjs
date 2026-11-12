// Independent verification of Linux profiles and final, uninstrumented acceptance.
// Only small evidence files are read; no solver or prune table is loaded.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { cube3x3x3 } from '../../../../core/jobs/alg-build/node_modules/cubing/dist/lib/cubing/puzzles/index.js';
import { LIMITS, readCorpus } from '../../cube48opt-rust/remote/native-service-benchmark.mjs';
import { replay } from '../../cube48opt-rust/remote/verify-native-service-benchmark.mjs';

const [task] = process.argv.slice(2);
assert(task?.startsWith('/'));
const root = resolve(import.meta.dirname, '../../../..');
const files = {};
const read = name => { const b = readFileSync(resolve(task, name)); files[name] = createHash('sha256').update(b).digest('hex'); return b; };
const json = name => JSON.parse(read(name));
const rows = name => { const s = read(name).toString(); assert(s.endsWith('\n')); return s.trimEnd().split('\n').map(JSON.parse); };
const plan = json('plan.json'), input = json('results/input.json'), report = json('results/report.json');
assert.equal(plan.schema, 'cuberoot.egg-h8-linux-diagnosis/v1');
assert.equal(input.planSha256, files['plan.json']); assert.deepEqual(input.plan, plan);
const cases = json('cases.json'); assert.equal(files['cases.json'], plan.casesSha256); assert.deepEqual(input.cases, cases);
assert.deepEqual(input.limits, LIMITS); assert.equal(input.clockTicks, 100);
assert.equal(report.complete, true); assert.equal(report.instrumented, plan.profile);
assert.equal(report.measuredPasses, 1); assert.equal(report.warmupCases, 0);
assert.equal(plan.threads, 4); assert.equal(plan.eggLanes, 40);
assert(!existsSync(resolve(task, 'results/failure.json')));
assert.equal(json('diagnose-maintenance/exit.json').code, 0);
const restored = json('diagnose-maintenance/restored-state.json');
assert(restored.enabled && restored.configured && restored.ready);
const baselinePath = resolve(root, '.local-data/egg-h8-aliyun-20261109/baseline-reused/r1-baseline/results.jsonl');
const baselineBytes = readFileSync(baselinePath);
const baselineSha = createHash('sha256').update(baselineBytes).digest('hex');
assert.equal(baselineSha, 'bb573371e00f8bedeaaf37a512a61ce2b69a96335e7a5c90bdff0a1c7e30626c');
const baseline = baselineBytes.toString().trimEnd().split('\n').map(JSON.parse);
const { corpus } = readCorpus(resolve(root, 'solver/testdata/benchmarks/wca-first100.json'));
const puzzle = await cube3x3x3.kpuzzle();
assert.equal(cases.length, 100);
for (const [i, item] of corpus.cases.entries()) {
  assert.equal(cases[i].id, item.id); assert.equal(cases[i].scramble, item.scramble);
  assert.equal(baseline[i].id, item.id); assert.equal(cases[i].expectedLength, baseline[i].length);
  replay(puzzle, item, baseline[i], baseline[i].length);
}
const engines = {}; let boot;
for (const pass of plan.passes) {
  const prefix = `results/${pass.label}`;
  assert(!existsSync(resolve(task, prefix, 'failure.json')));
  assert.equal(input.assets.binaries[pass.binary].sha256, pass.sha256);
  const answers = rows(`${prefix}/results.jsonl`), stats = json(`${prefix}/report.json`);
  const startup = json(`${prefix}/startup.json`), exit = json(`${prefix}/exit.json`);
  assert.deepEqual(stats, report.engines[pass.label]); assert.equal(stats.pid, startup.pid); assert.equal(stats.pid, exit.pid);
  assert.equal(stats.threads, 4); assert.equal(startup.readyLine, 'READY\t4');
  assert.equal(exit.code, 0); assert.equal(exit.signal, null); assert.deepEqual(exit.remainingPids, []);
  assert.equal(answers.length, 100);
  const output = read(`${prefix}/stdout.log`).toString().trimEnd().split('\n');
  assert.equal(output.length, 101); assert.equal(output[0], 'READY\t4');
  for (const [i, answer] of answers.entries()) {
    const item = cases[i]; assert.equal(answer.id, item.id); assert.equal(answer.scramble, item.scramble);
    assert.equal(answer.pid, stats.pid); assert.equal(answer.raw, output[i + 1]);
    assert.equal(answer.raw, `${answer.id}\t${answer.length}\t${answer.solution}`);
    assert(answer.wallSeconds >= 0 && answer.wallSeconds <= LIMITS.requestMs / 1000);
    replay(puzzle, item, answer, item.expectedLength);
  }
  const resources = rows(`${prefix}/resources.jsonl`); assert(resources.length);
  boot ??= resources[0].bootId;
  for (const sample of resources) {
    assert.equal(sample.pid, stats.pid); assert.equal(sample.bootId, boot);
    assert(sample.treeRssBytes <= LIMITS.treeRssBytes && sample.availableBytes >= LIMITS.reserveBytes);
    assert(sample.fullPressureAvg10 === null || sample.fullPressureAvg10 <= LIMITS.fullPressureAvg10);
  }
  const admission = rows(`${prefix}/admission.jsonl`);
  assert(admission.some(r => r.phase === 'preflight' && r.outcome === 'disabled'));
  assert(admission.every(r => ['disabled', 'cancelled'].includes(r.outcome)));
  const memory = {}, ticks = {};
  for (const phase of ['ready', 'complete']) {
    const snapshot = json(`${prefix}/memory-${phase}.json`);
    const smaps = read(`${prefix}/memory-${phase}.smaps_rollup`).toString();
    const stat = read(`${prefix}/memory-${phase}.stat`).toString();
    const fields = stat.slice(stat.lastIndexOf(') ') + 2).trim().split(/\s+/);
    assert.equal(snapshot.pid, stats.pid);
    for (const [key, proc] of [['anonHugePagesBytes', 'AnonHugePages'], ['rssBytes', 'Rss'], ['anonymousBytes', 'Anonymous'], ['swapBytes', 'Swap']]) {
      const match = smaps.match(new RegExp(`^${proc}:\\s+(\\d+) kB$`, 'm'));
      assert(match); assert.equal(snapshot[key], Number(match[1]) * 1024);
    }
    ticks[phase] = Number(fields[11]) + Number(fields[12]); memory[phase] = snapshot;
  }
  const times = answers.map(r => r.wallSeconds).sort((a, b) => a - b);
  const totalSeconds = answers.reduce((sum, r) => sum + r.wallSeconds, 0);
  assert.equal(totalSeconds, stats.totalWallSeconds);
  let idle;
  if (pass.checkIdle) { const r = json(`${prefix}/idle.json`); assert.equal(r.pid, stats.pid); idle = { seconds: r.seconds, cpuSeconds: r.cpuTicks / input.clockTicks }; }
  engines[pass.label] = { sha256: pass.sha256, verifiedSolutions: 100, optimalLengthsMatched: 100,
    totalSeconds, cpuSeconds: (ticks.complete - ticks.ready) / input.clockTicks,
    p50: times[49], p95: times[94], p99: times[98], startupSeconds: startup.startupSeconds,
    peakRssBytes: Math.max(...resources.map(r => r.treeRssBytes)), minAvailableBytes: Math.min(...resources.map(r => r.availableBytes)),
    maxProcessSwapBytes: Math.max(...resources.map(r => r.treeSwapBytes)),
    maxSystemSwapOutDeltaPages: Math.max(...resources.map(r => r.swapOutDeltaPages)),
    memory, ...(idle ? { idle } : {}) };
}
let acceptance;
if (plan.acceptance) {
  assert.equal(plan.profile, false, 'Instrumented runs cannot qualify for promotion');
  const oldPlan = JSON.parse(readFileSync(resolve(root, '.local-data/egg-h8-aliyun-20261109/plan100.json')));
  assert.deepEqual(plan.acceptance, oldPlan.acceptance, 'Do not weaken the frozen acceptance gates');
  const baselineLabel = plan.baselineLabel ?? 'opt8';
  let b = engines[baselineLabel];
  if (plan.baselineReference) {
    assert(!b, 'Do not replace a measured baseline');
    assert(/^[a-zA-Z0-9_-]+\.json$/.test(plan.baselineReference.file));
    const reference = json(plan.baselineReference.file);
    assert.equal(files[plan.baselineReference.file], plan.baselineReference.sha256);
    assert.equal(reference.schema, 'cuberoot.egg-h8-linux-verification/v1');
    assert.equal(reference.instrumented, false); assert.equal(reference.allSolutionsAndOptimalLengths, true);
    assert.equal(reference.files['cases.json'], plan.casesSha256); assert.equal(reference.bootId, boot);
    b = reference.engines[baselineLabel];
    assert.equal(b?.sha256, plan.productionSha256, 'Referenced baseline must still be production');
    assert.equal(b.verifiedSolutions, 100); assert.equal(b.optimalLengthsMatched, 100);
  }
  const a = plan.acceptance;
  assert(b, 'Missing measured baseline');
  const assess = c => {
    const ratios = { wall: c.totalSeconds / b.totalSeconds, cpu: c.cpuSeconds / b.cpuSeconds,
      p50: c.p50 / b.p50, p95: c.p95 / b.p95, p99: c.p99 / b.p99 };
    const checks = { wall: ratios.wall <= 1 - a.minWallTimeReduction, cpu: ratios.cpu <= a.maxCpuTimeRatio,
      p50: ratios.p50 <= a.maxMedianRatio, p95: ratios.p95 <= a.maxP95Ratio, p99: ratios.p99 <= a.maxP99Ratio,
      idle: c.idle?.seconds === 5 && c.idle.cpuSeconds <= a.idleCpuSecondsMax,
      noProcessSwap: b.maxProcessSwapBytes === 0 && c.maxProcessSwapBytes === 0 };
    return { ratios, checks, accepted: Object.values(checks).every(Boolean) };
  };
  if (plan.baselineLabel) {
    if (!plan.baselineReference) {
      assert.equal(plan.passes[0].label, baselineLabel);
      assert.equal(plan.passes[0].sha256, plan.productionSha256, 'Baseline must be the current production binary');
    }
    acceptance = { baselineLabel, ...(plan.baselineReference ? { baselineReference: plan.baselineReference } : {}),
      candidates: Object.fromEntries(plan.passes.filter(pass => pass.label !== baselineLabel).map(pass => [pass.label, assess(engines[pass.label])])) };
  } else acceptance = assess(engines['egg-t0']);
}
const verification = { schema: 'cuberoot.egg-h8-linux-verification/v1', verifiedAt: new Date().toISOString(),
  planSha256: files['plan.json'], instrumented: plan.profile, allSolutionsAndOptimalLengths: true,
  verifiedSolutions: 100 * plan.passes.length, baselineSha256: baselineSha, bootId: boot, engines,
  ...(acceptance ? { acceptance } : {}), files,
  limitations: 'WCA1–100, one pass per candidate, four threads; no warmup; load excluded. Shared production VM. Software profiles cannot identify individual hardware cache counters.' };
writeFileSync(resolve(task, 'independent-verification.json'), JSON.stringify(verification, null, 2) + '\n', { flag: 'wx' });
console.log(JSON.stringify({ verifiedSolutions: verification.verifiedSolutions, engines: Object.fromEntries(Object.entries(engines).map(([k, v]) => [k, { seconds: v.totalSeconds, cpuSeconds: v.cpuSeconds, p95: v.p95, maxSwap: v.maxProcessSwapBytes }])), acceptance }, null, 2));
