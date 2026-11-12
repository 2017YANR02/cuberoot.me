// Publish exactly the independently accepted binary and existing generated table.
// This does not switch current.json, load a table, or scan the 8 GB table again.
import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { chmod, copyFile, link, lstat, mkdir, open, readFile, rename, rm } from 'node:fs/promises';
import { resolve } from 'node:path';
import { CUBEOPT_ARTIFACT_SCHEMA, CUBEOPT_EGG_H8, assertEggCpu, syncDirectoryDurably, verifyCubeoptBundle } from '../src/cubeopt/artifact.mjs';

const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const identity = info => Object.fromEntries(['dev', 'ino', 'size', 'mtimeNs', 'ctimeNs'].map(k => [k, String(info[k])]));
const json = async path => JSON.parse(await readFile(path, 'utf8'));
async function writeDurably(path, value) {
  const fd = await open(path, 'wx', 0o600);
  try { await fd.writeFile(JSON.stringify(value, null, 2) + '\n'); await fd.sync(); } finally { await fd.close(); }
}

export async function prepareEggCandidate({ taskDir, storeDir, repositoryRevision, candidateLabel = 'egg-t0', allowFixtureSizes = false }) {
  assert(taskDir?.startsWith('/') && storeDir?.startsWith('/'), 'Absolute paths are required');
  assert(/^[a-f0-9]{40}$/.test(repositoryRevision), 'Repository revision is required');
  const task = resolve(taskDir), store = resolve(storeDir);
  assert(/^[a-z0-9-]+$/.test(candidateLabel), 'Invalid candidate label');
  const acceptanceBytes = await readFile(`${task}/independent-verification.json`), acceptance = JSON.parse(acceptanceBytes);
  assert.equal(acceptance.schema, 'cuberoot.egg-h8-linux-verification/v1');
  const followup = Boolean(acceptance.acceptance?.candidates);
  const verdict = followup ? acceptance.acceptance.candidates[candidateLabel] : acceptance.acceptance;
  assert.equal(verdict?.accepted, true, 'Candidate did not pass acceptance');
  assert.equal(acceptance.instrumented, false, 'Profiled measurements cannot qualify');
  if (!followup) assert.equal(acceptance.verifiedSolutions, 200);
  assert.equal(acceptance.allSolutionsAndOptimalLengths, true);
  for (const key of ['wall', 'cpu', 'p50', 'p95', 'p99', 'idle', 'noProcessSwap']) {
    assert.equal(verdict.checks[key], true, `Failed ${key} gate`);
  }
  for (const [name, digest] of Object.entries(acceptance.files)) {
    assert(!name.includes('..') && !name.startsWith('/'), 'Invalid evidence filename');
    assert.equal(hash(await readFile(`${task}/${name}`)), digest, `Acceptance evidence changed: ${name}`);
  }
  const planBytes = await readFile(`${task}/plan.json`), plan = JSON.parse(planBytes);
  assert.equal(hash(planBytes), acceptance.planSha256);
  assert.equal(plan.profile, false); assert.equal(plan.passesPerCandidate, 1); assert.equal(plan.warmupCases, 0);
  assert.equal(plan.threads, 4); assert.equal(plan.eggLanes, 40);
  if (followup) {
    assert.equal(acceptance.verifiedSolutions, 100 * plan.passes.length);
    assert.equal(acceptance.acceptance.baselineLabel, plan.baselineLabel);
    let baseline = acceptance.engines[plan.baselineLabel];
    if (plan.baselineReference) {
      assert(/^[a-zA-Z0-9_-]+\.json$/.test(plan.baselineReference.file), 'Invalid baseline reference filename');
      assert.equal(hash(await readFile(`${task}/${plan.baselineReference.file}`)), plan.baselineReference.sha256);
      const reference = await json(`${task}/${plan.baselineReference.file}`);
      assert.equal(reference.instrumented, false); assert.equal(reference.allSolutionsAndOptimalLengths, true);
      assert.equal(reference.bootId, acceptance.bootId); assert.equal(reference.files['cases.json'], plan.casesSha256);
      baseline = reference.engines[plan.baselineLabel];
    }
    assert.equal(baseline?.sha256, plan.productionSha256, 'Follow-up baseline is not the measured production binary');
    assert.equal(baseline.verifiedSolutions, 100); assert.equal(baseline.optimalLengthsMatched, 100);
  }
  assert.deepEqual(plan.acceptance, { minWallTimeReduction: 0.1, maxCpuTimeRatio: 1, maxMedianRatio: 1.05,
    maxP95Ratio: 1, maxP99Ratio: 1.05, allSolutionsAndOptimalLengths: true, eachGroupMustPass: true, idleCpuSecondsMax: 0.1 });
  const input = await json(`${task}/results/input.json`), report = await json(`${task}/results/report.json`);
  assert.equal(input.planSha256, acceptance.planSha256); assert.equal(report.complete, true);
  assert.deepEqual(input.plan, plan);
  if (followup) assert.equal(input.assets.manifest.files.binary.sha256, plan.productionSha256);
  assert.equal((await json(`${task}/diagnose-maintenance/exit.json`)).code, 0);
  const pass = plan.passes.find(p => p.label === candidateLabel); assert(pass?.checkIdle);
  const build = followup ? plan.candidateBuilds[candidateLabel] : plan.candidateBuild;
  assert.equal(build.upstream, CUBEOPT_EGG_H8.upstream);
  assert.equal(build.target, 'x86_64-unknown-linux-musl');
  if (followup) {
    assert.equal(build.schema, 'cuberoot.egg-native-followup-build/v1');
    assert(build.toolchain.startsWith('rustc 1.98.1 '));
    assert(['skylake-avx512', 'skylake-avx512 with AVX512F/VL/BW/DQ/CD disabled'].includes(build.cpu));
    assert.equal(build.sources['src/prefetch.rs'], 'b56ba004fd38ff135e9d020cb6f81f9ca18a29936f944fffb08409a3892c49a2', 'Only measured T0 table prefetch is allowed');
    assert([24, 40].includes(pass.lanes));
  } else {
    assert.equal(build.cpu, CUBEOPT_EGG_H8.cpuTarget); assert.equal(build.toolchain, '1.98.1');
    assert(build.patch?.sha256, 'A source-built candidate is required');
  }
  assert(!build.diagnosticOnly, 'A source-built candidate is required');
  const binary = pass.binary, table = pass.table;
  const generation = await json(`${table}.generation.json`);
  assert.equal(generation.schema, 'cuberoot.egg-generated-table/v1');
  assert.equal(generation.upstream, CUBEOPT_EGG_H8.upstream); assert.equal(generation.k, 8); assert.equal(generation.base, 10);
  const binaryBytes = await readFile(binary), binaryDigest = hash(binaryBytes);
  assert.equal(binaryDigest, pass.sha256); assert.equal(binaryDigest, build.files['cuberoot-egg'].sha256);
  assert.equal(binaryDigest, acceptance.engines[candidateLabel].sha256);
  const before = await lstat(table, { bigint: true }); assert(before.isFile());
  assert.deepEqual(identity(before), input.assets.extraTables.find(t => t.path === table)?.identity, 'Measured table changed after acceptance');
  assert.equal(Number(before.size), generation.bytes);
  if (!allowFixtureSizes) {
    assert.equal(generation.bytes, CUBEOPT_EGG_H8.tableBytes);
    assert.equal(generation.sha256, '7e55eb54ae19daef1e2ef6ccca5bc3f2af7430f2298e82b6682ec3c8550cbdd8');
  }
  const pointer = await readFile(`${store}/current.json`);
  assert.equal(hash(pointer), input.assets.pointerSha256, 'Production changed during acceptance');
  const previous = JSON.parse(pointer);
  assert(/^cubeopt-(?:opt8|h8)-[A-Za-z0-9._-]+$/.test(previous.bundle));
  const previousDir = resolve(store, 'bundles', previous.bundle);
  // Adding or removing a hard link changes the table inode's ctime. Carry the
  // measured digest to the previous egg alias too, so rollback never needs an
  // unnecessary full-table scan. Legacy Opt8 uses a different inode/format.
  const refreshPreviousReceipt = async () => {
    if (input.assets.manifest?.engine !== 'egg-native') return;
    assert.equal(input.assets.manifest.files.table.sha256, generation.sha256);
    const alias = `${previousDir}/egg-h8.dat`, info = await lstat(alias, { bigint: true });
    for (const key of ['dev', 'ino', 'size', 'mtimeNs']) assert.equal(String(info[key]), String(before[key]));
    const receiptIdentity = JSON.stringify(['cubeopt-sha256-v1', generation.sha256, ...['dev', 'ino', 'size', 'mtimeNs', 'ctimeNs'].map(key => String(info[key]))]);
    const temporary = `${previousDir}/.digest-${randomUUID()}.json`;
    try {
      await writeDurably(temporary, { identity: receiptIdentity });
      await rename(temporary, `${alias}.sha256-verified.json`); await syncDirectoryDurably(previousDir);
    } finally { await rm(temporary, { force: true }); }
  };
  assert(process.platform === 'linux' && process.arch === 'x64', 'egg requires Linux x86_64');
  assertEggCpu(await readFile('/proc/cpuinfo', 'utf8'));
  const bundle = `cubeopt-h8-egg-t0-${repositoryRevision.slice(0, 12)}-${binaryDigest.slice(0, 12)}`;
  const staging = `${store}/bundles/.egg-stage-${randomUUID()}`, finalDir = `${store}/bundles/${bundle}`;
  await mkdir(staging);
  let published = false;
  try {
    await copyFile(binary, `${staging}/cuberoot-egg`); await chmod(`${staging}/cuberoot-egg`, 0o555);
    const fd = await open(`${staging}/cuberoot-egg`, 'r'); try { await fd.sync(); } finally { await fd.close(); }
    assert.deepEqual(identity(await lstat(table, { bigint: true })), identity(before));
    // Generation hashed the initial write. Acceptance pins the unchanged inode.
    // link/chmod change ctime; carry the verified lineage to its new identity.
    await link(table, `${staging}/egg-h8.dat`); await chmod(`${staging}/egg-h8.dat`, 0o444);
    const after = await lstat(`${staging}/egg-h8.dat`, { bigint: true });
    for (const key of ['dev', 'ino', 'size', 'mtimeNs']) assert.equal(String(after[key]), String(before[key]));
    const receiptIdentity = JSON.stringify(['cubeopt-sha256-v1', generation.sha256, ...['dev', 'ino', 'size', 'mtimeNs', 'ctimeNs'].map(k => String(after[k]))]);
    await writeDurably(`${staging}/egg-h8.dat.sha256-verified.json`, { identity: receiptIdentity });
    const manifest = { schema: CUBEOPT_ARTIFACT_SCHEMA, bundle, engine: 'egg-native', variant: 'h8', protocol: 1, maxThreads: 4,
      cpuTarget: CUBEOPT_EGG_H8.cpuTarget, tablePrefetch: CUBEOPT_EGG_H8.tablePrefetch,
      source: { url: 'https://github.com/ArhanChaudhary/egg-solver', revision: build.upstream,
        buildCommand: `Rust 1.98.1; ${build.rustflags ?? build.cpu}; linux-table-prefetch-t0.patch; ${pass.lanes ?? 40} lanes; source-built measured binary`, adapterRevision: repositoryRevision },
      files: { binary: { path: 'cuberoot-egg', bytes: binaryBytes.length, sha256: binaryDigest }, table: { path: 'egg-h8.dat', bytes: generation.bytes, sha256: generation.sha256 } } };
    await writeDurably(`${staging}/manifest.json`, manifest);
    await writeDurably(`${staging}/acceptance.json`, { acceptance, acceptanceSha256: hash(acceptanceBytes), build, generation, originalIdentity: identity(before), publishedIdentity: identity(after) });
    await verifyCubeoptBundle(staging, { allowFixtureSizes, cachedTable: true });
    assert.equal(hash(await readFile(`${store}/current.json`)), hash(pointer));
    await syncDirectoryDurably(staging); await rename(staging, finalDir); published = true;
    await syncDirectoryDurably(`${store}/bundles`);
    return { bundle, finalDir, acceptanceSha256: hash(acceptanceBytes), activated: false, tableCopied: false, tableRescanned: false };
  } finally {
    if (!published) await rm(staging, { recursive: true, force: true });
    await refreshPreviousReceipt();
  }
}

if (import.meta.main) console.log(JSON.stringify(await prepareEggCandidate({ taskDir: process.argv[2], storeDir: process.argv[3], repositoryRevision: process.argv[4], candidateLabel: process.argv[5] }), null, 2));
