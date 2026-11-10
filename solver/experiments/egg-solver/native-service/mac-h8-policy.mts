/** One user-requested local diagnosis; old benchmark/stop records stay intact. */
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {existsSync, readFileSync, statSync} from 'node:fs';
import {resolve} from 'node:path';

export const macRoot = resolve(import.meta.dirname, '../../../..');
export const macDir = resolve(macRoot, '.local-data/egg-h8-mac-20261109');
export const macReview = resolve(macDir, 'plan.json');
export const macStop = resolve(macDir, 'runtime-stop.json');
export const macDriver = resolve(import.meta.dirname, 'mac-h8-benchmark.mts');
export const macPrepDriver = resolve(import.meta.dirname, 'mac-h8-prepare.mts');
export const macPrepReview = resolve(macDir, 'preparation-fixed-plan.json');
export const macLabel = 'egg-h8-mac-wca100-20261109';
export const macHash = (path: string) => {
  assert(statSync(path).isFile() && statSync(path).size < 64 * 2 ** 20);
  return createHash('sha256').update(readFileSync(path)).digest('hex');
};
export const macIdentity = (path: string) => {
  const s = statSync(path, {bigint: true}); assert(s.isFile());
  return Object.fromEntries(['dev', 'ino', 'size', 'mtimeNs', 'ctimeNs'].map(k => [k, String(s[k as keyof typeof s])]));
};
type Request = {label: string; executable: string; args: string[]; env: NodeJS.ProcessEnv};
export function macPolicy(request: Request) {
  const preparation = request.env.CUBEOPT_EGG_H8_REVIEW === macPrepReview;
  assert.equal(request.label, preparation ? macLabel + '-prepare-fixed' : macLabel);
  assert.equal(request.executable, process.execPath);
  assert.deepEqual(request.args, [preparation ? macPrepDriver : macDriver]);
  assert.deepEqual(Object.fromEntries(Object.entries(request.env).filter(([k]) => k.startsWith('CUBEOPT_'))),
    {CUBEOPT_EGG_H8_REVIEW: preparation ? macPrepReview : macReview});
  return {entry: 'mac-h8-benchmark.mts', mode: 'three-engines-one-pass', backend: 'opt', variant: 8,
    h: null, tablePath: null, tableBytes: 7_782_731_776, rssLimit: preparation ? 43 * 2 ** 30 : 7_782_731_776 + 2 * 2 ** 30,
    measureNativeRss: false, deadlineMs: (preparation ? 40 : 20) * 60_000, openBenchmark: true,
    macH8Benchmark: true, scopeStopPath: macStop, wasmThreads: 4};
}
export function validateMacObservation(plan: any, now: {boot: string; swapouts: number; pressure: number; available: number}, stopped: boolean, consumed: boolean) {
  assert.equal(plan.schema, 'cuberoot.egg-h8-mac-diagnosis/v1');
  assert.equal(plan.authorization, '用户要求在本机复查 egg 与 Opt8 的速度差异；100题、4线程、三个入口各一轮、不预热');
  assert.equal(plan.threads, 4); assert.equal(plan.cases, 100); assert.equal(plan.warmupCases, 0);
  assert.equal(plan.measuredPasses, 1); assert.equal(plan.eggLanes, 40);
  assert.deepEqual(plan.order, ['egg-cli', 'egg-adapter', 'opt8']);
  assert.equal(now.boot, plan.baseline.boot); assert.equal(now.swapouts, plan.baseline.swapouts);
  assert.equal(now.pressure, 1); assert(now.available >= 7_782_731_776 + 5 * 2 ** 30);
  assert(!stopped, 'Local diagnosis stopped; no automatic restart');
  assert(!consumed, 'Local diagnosis already consumed');
}
export function validateMacReview(request: Request, now: Parameters<typeof validateMacObservation>[1]) {
  const policy = macPolicy(request);
  if (request.env.CUBEOPT_EGG_H8_REVIEW === macPrepReview) {
    const plan = JSON.parse(readFileSync(macPrepReview, 'utf8'));
    const receiptPath = resolve(macDir, 'preparation-fixed-started.json');
    assert.equal(plan.schema, 'cuberoot.egg-h8-mac-preparation/v1');
    assert.equal(now.boot, plan.baseline.boot); assert.equal(now.swapouts, plan.baseline.swapouts);
    assert.equal(now.pressure, 1); assert(now.available >= policy.rssLimit + 3 * 2 ** 30);
    assert(!existsSync(macStop) && !existsSync(receiptPath));
    assert.equal(plan.threads, 18); assert.equal(plan.sourceH, 10); assert.equal(plan.targetH, 8);
    assert.equal(plan.eggGen, resolve(macRoot, '../egg-solver/target/release/cuberoot-derive-h8'));
    assert.equal(plan.h10, resolve(macRoot, '../egg-solver-benchmarks/2026-11-09-m5-max/h10'));
    assert.equal(plan.opt8Oracle, resolve(macRoot, 'solver/experiments/cube48opt-rust/oracle.mjs'));
    assert.equal(plan.eggOutput, resolve(macDir, 'egg-derived-h8.dat'));
    assert.equal(plan.opt8Output, resolve(macDir, 'opt8-generated'));
    assert(!existsSync(plan.eggOutput) && !existsSync(plan.opt8Output));
    // The original attempt exited in clap before opening any table. A command
    // repair may retain that evidence and the exact same baseline, never a
    // resource-triggered stop or a reset swap counter.
    const original = JSON.parse(readFileSync(resolve(macDir, 'preparation-plan.json'), 'utf8'));
    const stopped = JSON.parse(readFileSync(resolve(macDir, 'protected-stop.json'), 'utf8'));
    const exit = JSON.parse(readFileSync(resolve(macDir, 'derive-egg-h8.exit.json'), 'utf8'));
    const resources = JSON.parse(readFileSync(resolve(macRoot, '.local-data/cubeopt-reverse', macLabel + '-prepare-resources.json'), 'utf8'));
    assert.deepEqual(plan.baseline, original.baseline);
    assert.equal(stopped.stopped, 'Benchmark child exited with status 1');
    assert.equal(exit.code, 2); assert(resources.peakRss < 512 * 2 ** 20);
    assert.equal(resources.swapouts, original.baseline.swapouts); assert.equal(resources.pressure, 1);
    assert(readFileSync(resolve(macDir, 'derive-egg-h8.stderr'), 'utf8').includes('required argument was not provided: k'));
    assert.equal(statSync(plan.h10).size, 31_130_914_816);
    assert.deepEqual(macIdentity(plan.h10), plan.sourceIdentity);
    for (const [path, hash] of Object.entries({...plan.artifacts, ...plan.history})) assert.equal(macHash(path), hash);
    return {receiptPath, input: undefined, receipt: {schema: 'cuberoot.egg-h8-mac-preparation-start/v1',
      planSha256: macHash(macPrepReview), before: now, guardPid: process.pid, consumedAt: new Date().toISOString()}};
  }
  const plan = JSON.parse(readFileSync(macReview, 'utf8'));
  const receiptPath = resolve(macDir, 'started.json');
  validateMacObservation(plan, now, existsSync(macStop), existsSync(receiptPath));
  for (const [path, hash] of Object.entries({...plan.artifacts, ...plan.history})) assert.equal(macHash(path), hash, `Changed evidence: ${path}`);
  for (const [path, identity] of Object.entries(plan.tables)) assert.deepEqual(macIdentity(path), identity);
  assert.equal(statSync(plan.eggTable).size, 7_782_731_776);
  assert.equal(statSync(plan.opt8Table).size, 7_782_727_680);
  assert(!existsSync(resolve(macDir, 'report.json')));
  return {receiptPath, input: undefined, receipt: {schema: 'cuberoot.egg-h8-mac-start/v1',
    planSha256: macHash(macReview), before: now, guardPid: process.pid, consumedAt: new Date().toISOString()}};
}
