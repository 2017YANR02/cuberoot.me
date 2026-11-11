/** Bounded follow-up to the user's monitored 3x3 stage optimization request. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

export const stageRoot = resolve(import.meta.dirname, '../..');
export const stageRelative = '.local-data/three-stage-optimization-20261110';
export const stageFollowupRelative = '.local-data/pseudo-pair-conjugate-20261110';
export const stageRequest = '别的地方还有什么三阶分阶段求解器可以优化 你多派几个agent去调查 然后测试 优化好';
export const stageKeys = ['std', 'pseudo', 'pseudo_pair', 'pseudo_f2leo'];
export const stageFiles = [
  'solver/scripts/benchmark_stage_candidates.mts', 'solver/scripts/stage_candidate_policy.mts',
  'scripts/stats/common.ts', 'scripts/stats/resource-monitor.ts',
  'solver/experiments/cube48opt-rust/stats-resume-review.mts', 'core/scripts/mac-system-recorder.mts',
];
export const stageDigest = (path: string) => createHash('sha256').update(readFileSync(path)).digest('hex');
export const stageCommand = 'node --import ./core/node_modules/tsx/dist/loader.mjs solver/scripts/benchmark_stage_candidates.mts --run';
export const stageFollowupCommand = stageCommand.replace(/--run$/, '--run-pseudo-pair-conjugate');

export function readStageApproval(root = stageRoot, followup = false) {
  const directory = resolve(root, followup ? stageFollowupRelative : stageRelative);
  assert(!existsSync(resolve(directory, 'used.json')), 'Stage comparison already consumed; do not retry');
  const read = (name: string) => JSON.parse(readFileSync(resolve(directory, name), 'utf8'));
  const approval = read('authorization.json'), plan = read('plan.json');
  assert.equal(approval.scope, followup ? 'pseudo-pair-conjugate-20261110' : 'three-stage-optimization-20261110');
  assert.equal(approval.authorization, stageRequest);
  assert.equal(stageDigest(resolve(directory, 'plan.json')), approval.planSha256, 'Stage plan changed');
  assert.equal(stageDigest(resolve(directory, 'resource-plan.json')), approval.resourcePlanSha256, 'Stage metadata changed');
  assert.deepEqual(Object.keys(approval.codeHashes).sort(), [...stageFiles].sort());
  for (const file of stageFiles) assert.equal(stageDigest(resolve(root, file)), approval.codeHashes[file], `Stage reviewed code changed: ${file}`);
  assert.equal(plan.schema, 'cuberoot.stage-candidates/v1');
  assert.equal(plan.cases, 100); assert.equal(plan.threads, 18);
  assert.equal(plan.repetitions, 1); assert.equal(plan.warmup, false);
  assert.equal(plan.baselineToPreserve.boot, '{ sec = 1794194703, usec = 456751 } Sun Nov  8 19:25:03 2026');
  assert.equal(plan.baselineToPreserve.swapouts, 336);
  assert.equal(plan.minimumHeadroomBytes, 2 ** 31);
  assert.deepEqual(Object.keys(plan.stages), followup ? ['pseudo_pair'] : stageKeys);
  assert.equal(stageDigest(resolve(directory, 'input.txt')), plan.inputSha256);
  if (followup) {
    // A genuinely new per-node candidate reuses the already completed baseline.
    // Never rerun the original/cache candidate or renew their consumed receipt.
    const previous = resolve(root, stageRelative);
    const execution = JSON.parse(readFileSync(resolve(previous, 'execution.json'), 'utf8'));
    assert.equal(execution.status, 'complete');
    assert.equal(stageDigest(resolve(previous, 'execution.json')), plan.reference.executionSha256);
    assert.equal(stageDigest(resolve(previous, 'used.json')), plan.reference.usedSha256);
    assert.deepEqual(plan.reference.baseline, execution.versions.find((v: any) => v.key === 'pseudo_pair' && v.name === 'baseline'));
    assert.equal(stageDigest(resolve(previous, 'pseudo_pair/baseline/input_pseudo_pair.csv')), plan.reference.outputSha256);
    assert.equal(plan.inputSha256, stageDigest(resolve(previous, 'input.txt')));
    assert.equal(plan.stages.pseudo_pair.goldenSha256, plan.reference.outputSha256);
  }
  for (const key of Object.keys(plan.stages)) {
    const stage = plan.stages[key];
    assert.equal(stage.columns, key === 'std' ? 30 : 24);
    assert(stage.rssLimitBytes <= (followup ? 7 : 28) * 2 ** 30, 'Stage memory exceeds reviewed scope');
    assert.equal(stage.startupRequiredBytes, stage.rssLimitBytes + 2.5 * 2 ** 30);
    assert.deepEqual(Object.keys(stage.versions), followup ? ['candidate'] : ['baseline', 'candidate']);
    if (key !== 'pseudo_f2leo') assert.equal(stageDigest(resolve(directory, `${key}/expected.csv`)), stage.goldenSha256);
    for (const name of Object.keys(stage.versions)) {
      const work = resolve(directory, key, name), binary = resolve(work, `${key}_analyzer`);
      assert.equal(stage.versions[name].binary, binary);
      assert.equal(stageDigest(binary), stage.versions[name].binarySha256, `Changed ${key} ${name} binary`);
      assert.equal(stageDigest(resolve(work, 'input.txt')), plan.inputSha256);
    }
  }
  return { directory, approval, plan };
}

export function approvedStageCommand(command: string, cwd: unknown): boolean {
  if (![stageCommand, stageFollowupCommand].includes(command) || typeof cwd !== 'string' || resolve(cwd) !== stageRoot) return false;
  try { readStageApproval(stageRoot, command === stageFollowupCommand); return true; } catch { return false; }
}
