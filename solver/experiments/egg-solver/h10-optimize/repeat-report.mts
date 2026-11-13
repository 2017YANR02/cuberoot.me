/** Analyze the predeclared eight pairs, using every run rather than its best time. */
import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { repeatDirectory as directory, readPlan, read, digest, repeatSequence } from './policy.mts';

const { plan, frozen } = readPlan(false, 'repeat');
const execution = read(resolve(directory, 'execution.json'));
assert.equal(execution.status, 'complete');
assert.equal(execution.planSha256, frozen.planSha256);
assert.equal(execution.variants.length, 16);
assert.deepEqual(execution.variants.map((v: { label: string }) => v.label), repeatSequence.map(v => v.label));
for (const [i, v] of execution.variants.entries()) {
  assert.equal(v.code, 0); assert.equal(v.signal, null); assert.equal(v.verifiedSolutions, 1000);
  assert.equal(v.sha256, plan.variants[i].sha256);
  assert.equal(v.total.lanes, plan.variants[i].lanes); assert.equal(v.total.threads, 16);
  assert.equal(v.total.concurrency, 1); assert.equal(v.total.cubes, 1000);
  assert.equal(v.resultsSha256, digest(resolve(directory, v.label, 'results.jsonl')));
}
const pairs = Array.from({ length: 8 }, (_, i) => {
  const runs = execution.variants.slice(i * 2, i * 2 + 2);
  const baseline = runs.find((v: any) => v.total.lanes === 32), candidate = runs.find((v: any) => v.total.lanes === 24);
  assert(baseline && candidate);
  return { pair: i + 1, firstLanes: runs[0].total.lanes,
    seconds32: baseline.searchSeconds, seconds24: candidate.searchSeconds,
    reduction: 1 - candidate.searchSeconds / baseline.searchSeconds,
    p95Ratio: candidate.p95Seconds / baseline.p95Seconds,
    nodeRatio: candidate.nodes / baseline.nodes,
    logTimeRatio: Math.log(candidate.searchSeconds / baseline.searchSeconds) };
});
const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
const logs = pairs.map(p => p.logTimeRatio), averageLog = mean(logs);
const standardError = Math.sqrt(logs.reduce((sum, x) => sum + (x - averageLog) ** 2, 0) / (logs.length - 1) / logs.length);
// Two-sided 95% Student t critical value for 7 degrees of freedom. This is
// an exploratory paired interval, not a guarantee about every future workload.
const margin = 2.364624251 * standardError;
const interval = { lower: 1 - Math.exp(averageLog + margin), upper: 1 - Math.exp(averageLog - margin) };
const total32 = pairs.reduce((n, p) => n + p.seconds32, 0), total24 = pairs.reduce((n, p) => n + p.seconds24, 0);
const wins = pairs.filter(p => p.reduction > 0).length;
const byOrder = [32, 24].map(first => {
  const group = pairs.filter(p => p.firstLanes === first);
  return { firstLanes: first, pairs: group.length, geometricReduction: 1 - Math.exp(mean(group.map(p => p.logTimeRatio))) };
});
const criteria = {
  confidenceIntervalPositive: interval.lower > 0,
  winsAtLeastSevenPairs: wins >= 7,
  bothOrdersImprove: byOrder.every(g => g.geometricReduction > 0),
  geometricP95RatioWithinLimit: Math.exp(mean(pairs.map(p => Math.log(p.p95Ratio)))) <= 1.05,
};
const resourceExit = read(resolve(execution.resourceRun, 'exit.json'));
assert.equal(resourceExit.status, 'complete'); assert.equal(resourceExit.baseline.swapouts, 336); assert.equal(resourceExit.last.swapouts, 336);
assert.equal(resourceExit.last.completion.survivors.length, 0);
const report = { schema: 'cuberoot.egg-h10-lanes-repeatability/v1', at: new Date().toISOString(),
  planSha256: frozen.planSha256, executionSha256: digest(resolve(directory, 'execution.json')),
  pairCount: 8, solvesPerRun: 1000, verifiedSolutions: 16_000, pairs, total32, total24,
  aggregateReduction: 1 - total24 / total32, geometricReduction: 1 - Math.exp(averageLog),
  paired95Interval: interval, wins24: wins, minReduction: Math.min(...pairs.map(p => p.reduction)),
  maxReduction: Math.max(...pairs.map(p => p.reduction)), byOrder, criteria,
  supportedImprovementOnThisWorkload: Object.values(criteria).every(Boolean),
  automaticPromotion: false, resourceRun: execution.resourceRun, peakRssGiB: resourceExit.peakRss / 2 ** 30,
  minimumHeadroomGiB: resourceExit.minimumHeadroom / 2 ** 30, swapouts: resourceExit.last.swapouts,
  limitation: 'Eight adjacent pairs on this Mac and corpus. Neither the mean nor its paired interval guarantees a gain for every case or future run.' };
writeFileSync(resolve(directory, 'report.json'), JSON.stringify(report, null, 2) + '\n', { flag: 'wx' });
console.log(JSON.stringify(report, null, 2));
