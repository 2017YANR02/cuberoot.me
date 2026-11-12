import { createHash } from 'node:crypto';
import { chmod, lstat, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, expect, it } from 'vitest';
import { prepareEggCandidate } from '../scripts/prepare-egg-candidate.mjs';
import { CUBEOPT_EGG_H8, assertEggCpu } from '../src/cubeopt/artifact.mjs';
import { verifyTableDigest } from '../src/cubeopt/table-digest.mjs';

const scratch = [], revision = 'a'.repeat(40);
const sha = b => createHash('sha256').update(b).digest('hex');
const save = (p, x) => writeFile(p, JSON.stringify(x));
let supported = false;
if (process.platform === 'linux' && process.arch === 'x64') {
  try { assertEggCpu(await readFile('/proc/cpuinfo', 'utf8')); supported = true; } catch { /* CI may lack AVX-512. */ }
}
async function fixture() {
  const task = await mkdtemp(join(tmpdir(), 'egg-install-fixture-')); scratch.push(task);
  for (const p of ['candidate', 'results', 'diagnose-maintenance', 'store/bundles']) await mkdir(`${task}/${p}`, { recursive: true });
  const info = { engine: 'egg-native', variant: 'h8', protocol: 1, maxThreads: 4, optimized: true, upstream: CUBEOPT_EGG_H8.upstream };
  const binary = Buffer.from(`#!/bin/sh\n[ "$1" = '--server-info' ] || exit 9\nprintf '%s\\n' '${JSON.stringify(info)}'\n`);
  const binaryPath = `${task}/candidate/cuberoot-egg`, tablePath = `${task}/egg-h8.dat`;
  await writeFile(binaryPath, binary); await chmod(binaryPath, 0o755);
  const table = Buffer.from('bounded generated table fixture'); await writeFile(tablePath, table);
  const stat = await lstat(tablePath, { bigint: true });
  const identity = Object.fromEntries(['dev', 'ino', 'size', 'mtimeNs', 'ctimeNs'].map(k => [k, String(stat[k])]));
  const generation = { schema: 'cuberoot.egg-generated-table/v1', upstream: CUBEOPT_EGG_H8.upstream, k: 8, base: 10, bytes: table.length, sha256: sha(table) };
  const build = { upstream: CUBEOPT_EGG_H8.upstream, cpu: 'skylake-avx512', target: 'x86_64-unknown-linux-musl', toolchain: '1.98.1', patch: { sha256: 'c'.repeat(64) }, files: { 'cuberoot-egg': { sha256: sha(binary) } } };
  const pointer = JSON.stringify({ schema: 'cuberoot.cubeopt-current/v1', bundle: 'cubeopt-opt8-fixture' });
  await writeFile(`${task}/store/current.json`, pointer);
  const plan = { profile: false, passesPerCandidate: 1, warmupCases: 0, threads: 4, eggLanes: 40, candidateBuild: build,
    passes: [{ label: 'egg-t0', binary: binaryPath, table: tablePath, sha256: sha(binary), checkIdle: true }],
    acceptance: { minWallTimeReduction: 0.1, maxCpuTimeRatio: 1, maxMedianRatio: 1.05, maxP95Ratio: 1, maxP99Ratio: 1.05, allSolutionsAndOptimalLengths: true, eachGroupMustPass: true, idleCpuSecondsMax: 0.1 } };
  const planBytes = JSON.stringify(plan); await writeFile(`${task}/plan.json`, planBytes);
  const acceptance = { schema: 'cuberoot.egg-h8-linux-verification/v1', instrumented: false, verifiedSolutions: 200, allSolutionsAndOptimalLengths: true,
    planSha256: sha(planBytes), engines: { 'egg-t0': { sha256: sha(binary) } }, files: { 'plan.json': sha(planBytes) },
    acceptance: { accepted: true, checks: { wall: true, cpu: true, p50: true, p95: true, p99: true, idle: true, noProcessSwap: true } } };
  await save(`${task}/independent-verification.json`, acceptance); await save(`${tablePath}.generation.json`, generation);
  await save(`${task}/results/input.json`, { plan, planSha256: sha(planBytes), assets: { pointerSha256: sha(pointer), extraTables: [{ path: tablePath, identity }] } });
  await save(`${task}/results/report.json`, { complete: true });
  await save(`${task}/diagnose-maintenance/exit.json`, { code: 0 });
  return { task, acceptance, pointer, generation, binaryPath, tablePath,
    options: { taskDir: task, storeDir: `${task}/store`, repositoryRevision: revision, allowFixtureSizes: true } };
}
afterEach(async () => { await Promise.all(scratch.splice(0).map(p => rm(p, { recursive: true, force: true }))); });

async function followupFixture({ reference = false } = {}) {
  const f = await fixture(), plan = JSON.parse(await readFile(`${f.task}/plan.json`));
  const input = JSON.parse(await readFile(`${f.task}/results/input.json`));
  plan.baselineLabel = 'egg-current'; plan.productionSha256 = 'b'.repeat(64); plan.casesSha256 = 'd'.repeat(64);
  plan.passes[0].label = 'lanes24'; plan.passes[0].lanes = 24;
  plan.candidateBuilds = { lanes24: { ...plan.candidateBuild, schema: 'cuberoot.egg-native-followup-build/v1',
    toolchain: 'rustc 1.98.1 (fixture)', sources: { 'src/prefetch.rs': 'b56ba004fd38ff135e9d020cb6f81f9ca18a29936f944fffb08409a3892c49a2' } } };
  delete plan.candidateBuild;
  const baseline = { sha256: plan.productionSha256, verifiedSolutions: 100, optimalLengthsMatched: 100 };
  f.acceptance.engines = { lanes24: f.acceptance.engines['egg-t0'], ...(reference ? {} : { 'egg-current': baseline }) };
  f.acceptance.bootId = 'fixture-boot'; f.acceptance.verifiedSolutions = 100;
  f.acceptance.acceptance = { baselineLabel: plan.baselineLabel, candidates: { lanes24: f.acceptance.acceptance, rejected: { accepted: false } } };
  if (reference) {
    const bytes = JSON.stringify({ instrumented: false, allSolutionsAndOptimalLengths: true, bootId: f.acceptance.bootId,
      files: { 'cases.json': plan.casesSha256 }, engines: { 'egg-current': baseline } });
    await writeFile(`${f.task}/reference.json`, bytes);
    plan.baselineReference = { file: 'reference.json', sha256: sha(bytes) };
  }
  const planBytes = JSON.stringify(plan); await writeFile(`${f.task}/plan.json`, planBytes);
  f.acceptance.planSha256 = sha(planBytes); f.acceptance.files['plan.json'] = sha(planBytes);
  await save(`${f.task}/independent-verification.json`, f.acceptance);
  input.plan = plan; input.planSha256 = sha(planBytes); input.assets.manifest = { files: { binary: { sha256: plan.productionSha256 } } };
  await save(`${f.task}/results/input.json`, input);
  f.options.candidateLabel = 'lanes24'; return f;
}

it('selects the measured candidate without accepting a rejected sibling', async () => {
  const f = await followupFixture();
  await expect(prepareEggCandidate({ ...f.options, candidateLabel: 'rejected' })).rejects.toThrow('Candidate did not pass acceptance');
  await expect(prepareEggCandidate({ ...f.options, candidateLabel: 'missing' })).rejects.toThrow('Candidate did not pass acceptance');
  await writeFile(f.tablePath, 'changed table');
  await expect(prepareEggCandidate(f.options)).rejects.toThrow('Measured table changed');
});
it('pins the reused verified baseline before publishing a later candidate', async () => {
  const f = await followupFixture({ reference: true });
  const reference = `${f.task}/reference.json`, original = await readFile(reference);
  await writeFile(reference, '{}'); await expect(prepareEggCandidate(f.options)).rejects.toThrow();
  await writeFile(reference, original); await writeFile(f.tablePath, 'changed table');
  await expect(prepareEggCandidate(f.options)).rejects.toThrow('Measured table changed');
});

it('refuses a rejected candidate or a failed tail-latency gate before publication', async () => {
  const f = await fixture(); f.acceptance.acceptance.accepted = false; await save(`${f.task}/independent-verification.json`, f.acceptance);
  await expect(prepareEggCandidate(f.options)).rejects.toThrow('Candidate did not pass acceptance');
  f.acceptance.acceptance.accepted = true; f.acceptance.acceptance.checks.p99 = false; await save(`${f.task}/independent-verification.json`, f.acceptance);
  await expect(prepareEggCandidate(f.options)).rejects.toThrow('Failed p99 gate');
});
it('rejects profiled timings even when they appear fast', async () => {
  const f = await fixture(); f.acceptance.instrumented = true; await save(`${f.task}/independent-verification.json`, f.acceptance);
  await expect(prepareEggCandidate(f.options)).rejects.toThrow('Profiled measurements cannot qualify');
});
it('rejects changed measurement evidence', async () => {
  const f = await fixture(); await writeFile(`${f.task}/plan.json`, '{}');
  await expect(prepareEggCandidate(f.options)).rejects.toThrow('Acceptance evidence changed');
});
it('rejects an unmeasured replacement binary', async () => {
  const f = await fixture(); await writeFile(f.binaryPath, 'different executable');
  await expect(prepareEggCandidate(f.options)).rejects.toThrow();
  expect(await readFile(`${f.task}/store/current.json`, 'utf8')).toBe(f.pointer);
});
it('rejects a changed table instead of trusting an old streaming digest', async () => {
  const f = await fixture(); await writeFile(f.tablePath, 'tampered table');
  await expect(prepareEggCandidate(f.options)).rejects.toThrow('Measured table changed');
  expect(await readFile(`${f.task}/store/current.json`, 'utf8')).toBe(f.pointer);
});
it.skipIf(!supported)('hard-links the accepted table, reuses its digest and leaves production unchanged', async () => {
  const f = await fixture(), result = await prepareEggCandidate(f.options);
  const table = `${result.finalDir}/egg-h8.dat`;
  expect((await lstat(table)).ino).toBe((await lstat(f.tablePath)).ino);
  expect(await verifyTableDigest(table, f.generation.sha256, { cached: true })).toEqual({ cached: true });
  expect(await readFile(`${f.task}/store/current.json`, 'utf8')).toBe(f.pointer);
  expect(result.activated).toBe(false); expect(result.tableRescanned).toBe(false);
});
