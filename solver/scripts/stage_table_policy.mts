/** Explicit 2026-11-10 authorization for new 3×3 PDBs, separate from old receipts. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { basename, resolve } from 'node:path';

export const root = resolve(import.meta.dirname, '../..');
export const relative = '.local-data/stage-pdb-build-20261110';
export const request = '然后呢 你把该做的都做了，可以建表';
export const codeFiles = ['solver/scripts/run_stage_tables.mts', 'solver/scripts/stage_table_policy.mts',
  'scripts/stats/common.ts', 'scripts/stats/resource-monitor.ts',
  'solver/experiments/cube48opt-rust/stats-resume-review.mts', 'core/scripts/mac-system-recorder.mts'];
export const commandPrefix = 'node --import ./core/node_modules/tsx/dist/loader.mjs solver/scripts/run_stage_tables.mts --run ';
export const tableNames = ['pt_cross_pair_C4E0', ...[0, 1, 2, 3].map(i => `pt_pscross_pair_C4E${i}`),
  'pt_cross_eo_E0E1E2E3', 'pt_C4C5C6C7E0E1E2E3', 'pt_cross_C4C6E0E1E2'];
export const analyzerNames = ['pair', 'pseudo_pair', 'f2leo', 'pseudo_f2leo', 'std', 'f2b'];
export const digest = (file: string) => createHash('sha256').update(readFileSync(file)).digest('hex');
/** The final acceptance jobs remove mode overrides to exercise native defaults. */
export function resolvedModes(env: Record<string, string>, analyzer?: string) {
  const resolved = Object.fromEntries(Object.entries(env).filter(([, value]) => value !== 'default'));
  // A native-default acceptance job must not silently become the daily auto
  // profile after its table budget was frozen. Zero preserves native Off.
  if (analyzer === 'std' && env.CUBE_STAGE_JOINT_MODE === 'default' && env.CUBE_STAGE_DEEP_NO_DIAG === undefined)
    resolved.CUBE_STAGE_DEEP_NO_DIAG = '0';
  return resolved;
}
export function validateModes(env: Record<string, string>, kind: string, analyzer?: string) {
  const required = ['CUBE_F2LEO_COMPACT_MODE', 'CUBE_PAIR_JOINT_MODE', 'CUBE_STAGE_JOINT_MODE'];
  const optional = env.CUBE_STAGE_DEEP_NO_DIAG === undefined ? [] : ['CUBE_STAGE_DEEP_NO_DIAG'];
  assert.deepEqual(Object.keys(env).sort(), [...required, ...optional].sort());
  assert(['off', 'first', 'default'].includes(env.CUBE_F2LEO_COMPACT_MODE));
  assert(['off', 'first', 'all', 'default'].includes(env.CUBE_PAIR_JOINT_MODE));
  assert(['off', 'middle', 'deep', 'both', 'default'].includes(env.CUBE_STAGE_JOINT_MODE));
  if (optional.length) {
    assert(['0', '1'].includes(env.CUBE_STAGE_DEEP_NO_DIAG));
    assert.equal(kind, 'benchmark'); assert.equal(analyzer, 'std');
    assert(['deep', 'both'].includes(env.CUBE_STAGE_JOINT_MODE));
  }
}
/** A reviewed completion race can reuse verified output, never rerun the job or
 * erase its protected-stop status. Resource-limit failures are not eligible.
 */
export function validateCompletedReference(plan: any) {
  const directory = plan.referenceDirectory;
  const result = JSON.parse(readFileSync(resolve(directory, 'execution.json'), 'utf8'));
  assert.equal(digest(resolve(directory, 'execution.json')), plan.referenceExecutionSha256);
  if (result.status === 'complete') return;
  const reviewPath = resolve(directory, 'completion-review.json');
  assert.equal(digest(reviewPath), plan.referenceCompletionReviewSha256, 'Missing or changed completion review');
  const review = JSON.parse(readFileSync(reviewPath, 'utf8'));
  assert.equal(review.schema, 'cuberoot.stage-completion-review/v1');
  assert.equal(review.disposition, 'reuse-verified-output-without-rerun');
  assert.equal(review.executionSha256, plan.referenceExecutionSha256);
  assert.deepEqual(review.outputHashes, plan.referenceHashes);
  assert(review.reason?.trim() && Number.isFinite(Date.parse(review.reviewedAt)));
  const stopPath = resolve(result.resourceRun, 'protected-stop.json');
  assert.equal(digest(stopPath), review.stopSha256);
  const stop = JSON.parse(readFileSync(stopPath, 'utf8'));
  const reason = 'Error: Statistics finished with surviving child processes';
  assert.equal(result.status, 'protected-stop'); assert.equal(result.protectionReason, reason);
  assert.equal(stop.reason, reason);
  assert.equal(stop.baseline.boot, '1794194703'); assert.equal(stop.baseline.swapouts, 336);
  assert.equal(stop.last.boot, stop.baseline.boot); assert.equal(stop.last.swapouts, 336);
  assert.equal(stop.last.pressure, 1); assert(stop.minimumHeadroom >= 2 ** 31);
  const finish = resolve(result.resourceRun, 'finish.json');
  assert.equal(digest(finish), review.finishSha256);
  assert.equal(JSON.parse(readFileSync(finish, 'utf8')).status, 'complete');
  assert.deepEqual(result.rounds.map((row: any) => [row.name, row.rows]), [['warmup', 100], ['sample1', 1000], ['sample2', 1000], ['sample3', 1000]]);
  assert.equal(result.measurements.length, 4); assert(result.medianSeconds > 0);
}
export function readJob(id: string, repo = root) {
  assert(/^[a-z0-9][a-z0-9-]{0,80}$/.test(id), 'Invalid job id');
  const directory = resolve(repo, relative, 'jobs', id);
  assert(!existsSync(resolve(directory, 'used.json')), 'Job already consumed; preserve results and do not retry');
  const plan = JSON.parse(readFileSync(resolve(directory, 'plan.json'), 'utf8'));
  const approval = JSON.parse(readFileSync(resolve(directory, 'authorization.json'), 'utf8'));
  assert.equal(approval.authorization, request);
  assert.equal(approval.scope, `stage-pdb-build-20261110/${id}`);
  assert.equal(approval.planSha256, digest(resolve(directory, 'plan.json')));
  assert.deepEqual(Object.keys(approval.codeHashes).sort(), [...codeFiles].sort());
  for (const file of codeFiles) assert.equal(digest(resolve(repo, file)), approval.codeHashes[file], `Reviewed code changed: ${file}`);
  assert.equal(plan.schema, 'cuberoot.stage-table-job/v1');
  assert.equal(plan.threads, 18);
  assert.equal(plan.baseline.boot, '{ sec = 1794194703, usec = 456751 } Sun Nov  8 19:25:03 2026');
  assert.equal(plan.baseline.swapouts, 336);
  assert.equal(plan.minimumHeadroomBytes, 2 ** 31);
  assert(Number.isSafeInteger(plan.rssLimitBytes) && plan.rssLimitBytes > 0 && plan.rssLimitBytes <= (plan.kind === 'generate' ? 72 : 96) * 2 ** 30);
  assert.equal(plan.startupRequiredBytes, plan.rssLimitBytes + 2.5 * 2 ** 30);
  assert(Number.isSafeInteger(plan.timeoutSeconds) && plan.timeoutSeconds > 0 && plan.timeoutSeconds <= 172800);
  validateModes(plan.env, plan.kind, plan.analyzer);
  assert.equal(plan.binary, resolve(directory, plan.kind === 'generate' ? 'table_generator' : `${plan.analyzer}_analyzer`));
  assert.equal(digest(plan.binary), plan.binarySha256, 'Frozen executable changed');
  if (plan.kind === 'generate') {
    assert(tableNames.includes(plan.table));
    assert.equal(basename(plan.binary), 'table_generator');
    assert.deepEqual(plan.env, { CUBE_PAIR_JOINT_MODE: 'off', CUBE_F2LEO_COMPACT_MODE: 'off', CUBE_STAGE_JOINT_MODE: 'off' });
    assert(Number.isSafeInteger(plan.outputBytes) && plan.outputBytes > 0);
    assert(Number.isSafeInteger(plan.mappedBytes ?? 0) && (plan.mappedBytes ?? 0) >= 0 && (plan.mappedBytes ?? 0) <= plan.rssLimitBytes);
  } else {
    assert.equal(plan.kind, 'benchmark'); assert(analyzerNames.includes(plan.analyzer));
    assert.equal(plan.cases, 1000); assert.equal(plan.rounds, 3); assert.equal(plan.warmupCases, 100);
    for (const file of ['warmup.txt', 'sample1.txt', 'sample2.txt', 'sample3.txt'])
      assert.equal(digest(resolve(directory, file)), file === 'warmup.txt' ? plan.warmupSha256 : plan.inputSha256, 'Frozen input changed');
    if (plan.referenceDirectory) {
      for (const name of ['warmup', 'sample1', 'sample2', 'sample3']) {
        const file = `${name}_${plan.analyzer}.csv`;
        assert.equal(digest(resolve(plan.referenceDirectory, file)), plan.referenceHashes[file], 'Frozen baseline output changed');
      }
      validateCompletedReference(plan);
    }
    if (plan.goldenFile) assert.equal(digest(resolve(repo, plan.goldenFile)), plan.goldenSha256, 'Golden fixture changed');
  }
  return { directory, plan, approval };
}
export function approvedStageTableCommand(command: string, cwd: unknown): boolean {
  if (typeof cwd !== 'string' || resolve(cwd) !== root || !command.startsWith(commandPrefix)) return false;
  try { readJob(command.slice(commandPrefix.length)); return true; } catch { return false; }
}
