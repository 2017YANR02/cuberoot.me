/** One-use scope for the explicitly approved EO comparison. No table loading. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

export const eoExperimentRoot = resolve(import.meta.dirname, '../..');
export const eoExperimentRelative = '.local-data/eo-stages-128g-20261110';
export const eoExperimentFiles = [
  'solver/scripts/benchmark_eo_stages.mts', 'solver/scripts/eo_stage_experiment_policy.mts',
  'solver/scripts/compare_eo_stages.mts', 'scripts/stats/common.ts', 'scripts/stats/resource-monitor.ts',
  'solver/experiments/cube48opt-rust/stats-resume-review.mts', 'core/scripts/mac-system-recorder.mts',
];
export const eoDigest = (path: string) => createHash('sha256').update(readFileSync(path)).digest('hex');
export const eoExperimentCommand = 'node --import ./core/node_modules/tsx/dist/loader.mjs solver/scripts/benchmark_eo_stages.mts --run';

export function readEoExperimentApproval(root = eoExperimentRoot) {
  const directory = resolve(root, eoExperimentRelative);
  assert(!existsSync(resolve(directory, 'used.json')), 'EO comparison already consumed; do not retry');
  const read = (name: string) => JSON.parse(readFileSync(resolve(directory, name), 'utf8'));
  const approval = read('authorization.json'), plan = read('plan.json');
  assert.equal(approval.scope, 'eo-stages-128g-20261110');
  assert.equal(approval.authorization, '允许本次受监控对照（推荐）');
  assert.equal(eoDigest(resolve(directory, 'plan.json')), approval.planSha256, 'EO plan changed');
  assert.equal(eoDigest(resolve(directory, 'resource-plan.json')), approval.resourcePlanSha256, 'EO table metadata changed');
  assert.deepEqual(Object.keys(approval.codeHashes).sort(), [...eoExperimentFiles].sort());
  for (const file of eoExperimentFiles) assert.equal(eoDigest(resolve(root, file)), approval.codeHashes[file], `EO reviewed code changed: ${file}`);
  assert.equal(plan.schema, 'cuberoot.eo-stage-experiment/v1');
  assert.equal(plan.cases, 100); assert.equal(plan.threads, 18);
  assert.equal(plan.repetitions, 1); assert.equal(plan.warmup, false);
  assert.equal(plan.baselineToPreserve.boot, '{ sec = 1794194703, usec = 456751 } Sun Nov  8 19:25:03 2026');
  assert.equal(plan.baselineToPreserve.swapouts, 336);
  assert.equal(plan.resourceBudget.tableBytes, 43_157_566_416);
  assert.equal(plan.resourceBudget.rssLimitBytes, 47_452_533_712);
  assert.equal(plan.resourceBudget.startupRequiredBytes, 50_136_888_272);
  assert.equal(plan.resourceBudget.minimumHeadroomBytes, 2 ** 31);
  assert.deepEqual(Object.keys(plan.versions).sort(), ['baseline', 'candidate']);
  assert.equal(eoDigest(resolve(directory, 'input.txt')), plan.inputSha256);
  assert.equal(eoDigest(resolve(directory, 'expected.csv')), plan.goldenSha256);
  for (const name of ['baseline', 'candidate']) {
    const binary = resolve(directory, name, 'eo_cross_analyzer');
    assert.equal(plan.versions[name].binary, binary);
    assert.equal(eoDigest(binary), plan.versions[name].binarySha256, `Changed ${name} binary`);
    assert.equal(eoDigest(resolve(directory, name, 'input.txt')), plan.inputSha256);
  }
  return { directory, approval, plan };
}

export function approvedEoExperimentCommand(command: string, cwd: unknown): boolean {
  if (command !== eoExperimentCommand || typeof cwd !== 'string' || resolve(cwd) !== eoExperimentRoot) return false;
  try { readEoExperimentApproval(); return true; } catch { return false; }
}
