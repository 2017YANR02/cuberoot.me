import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { codeFiles, digest, readJob, relative, request, root, resolvedModes, validateCompletedReference, validateModes } from './stage_table_policy.mts';

test('default acceptance removes only the chosen native mode overrides', () => {
  assert.deepEqual(resolvedModes({ CUBE_PAIR_JOINT_MODE: 'default', CUBE_F2LEO_COMPACT_MODE: 'first', CUBE_STAGE_JOINT_MODE: 'off' }),
    { CUBE_F2LEO_COMPACT_MODE: 'first', CUBE_STAGE_JOINT_MODE: 'off' });
  assert.deepEqual(resolvedModes({ CUBE_STAGE_JOINT_MODE: 'default' }, 'std'), { CUBE_STAGE_DEEP_NO_DIAG: '0' });
  assert.deepEqual(resolvedModes({ CUBE_STAGE_JOINT_MODE: 'default' }, 'f2b'), {});
  assert.deepEqual(resolvedModes({ CUBE_STAGE_JOINT_MODE: 'deep', CUBE_STAGE_DEEP_NO_DIAG: '1' }, 'std'),
    { CUBE_STAGE_JOINT_MODE: 'deep', CUBE_STAGE_DEEP_NO_DIAG: '1' });
});

test('diagonal projection is limited to an explicit standard Deep benchmark', () => {
  const env = { CUBE_PAIR_JOINT_MODE: 'off', CUBE_F2LEO_COMPACT_MODE: 'off', CUBE_STAGE_JOINT_MODE: 'deep', CUBE_STAGE_DEEP_NO_DIAG: '1' };
  validateModes(env, 'benchmark', 'std');
  validateModes({ ...env, CUBE_STAGE_JOINT_MODE: 'both' }, 'benchmark', 'std');
  for (const mode of ['off', 'middle', 'default']) assert.throws(() => validateModes({ ...env, CUBE_STAGE_JOINT_MODE: mode }, 'benchmark', 'std'));
  for (const analyzer of ['f2leo', 'pseudo', 'f2b']) assert.throws(() => validateModes(env, 'benchmark', analyzer));
  assert.throws(() => validateModes(env, 'generate'));
  assert.throws(() => validateModes({ ...env, CUBE_STAGE_DEEP_NO_DIAG: 'default' }, 'benchmark', 'std'));
  assert.throws(() => validateModes({ ...env, CUBE_OTHER_SKIP: '1' }, 'benchmark', 'std'));
  assert.equal(resolvedModes(env).CUBE_STAGE_DEEP_NO_DIAG, '1');
});

test('reviewed completion preserves stopped evidence and rejects a resource failure or changed review', () => {
  const scratch = resolve(root, '.tmp/scratch'); mkdirSync(scratch, { recursive: true });
  const directory = mkdtempSync(resolve(scratch, 'stage-completion-'));
  const put = (file: string, value: any) => writeFileSync(resolve(directory, file), JSON.stringify(value));
  const reason = 'Error: Statistics finished with surviving child processes';
  const stop = { reason, baseline: { boot: '1794194703', swapouts: 336 }, last: { boot: '1794194703', swapouts: 336, pressure: 1 }, minimumHeadroom: 3 * 2 ** 30 };
  const result = { resourceRun: directory, status: 'protected-stop', protectionReason: reason,
    rounds: ['warmup', 'sample1', 'sample2', 'sample3'].map(name => ({ name, rows: name === 'warmup' ? 100 : 1000 })),
    measurements: [1, 2, 3, 4], medianSeconds: 0.4 };
  const hashes = { warmup_pair: 'frozen' };
  const plan: any = { referenceDirectory: directory, referenceHashes: hashes };
  const prepare = () => {
    put('protected-stop.json', stop); put('finish.json', { status: 'complete' }); put('execution.json', result);
    plan.referenceExecutionSha256 = digest(resolve(directory, 'execution.json'));
    put('completion-review.json', { schema: 'cuberoot.stage-completion-review/v1', disposition: 'reuse-verified-output-without-rerun',
      executionSha256: plan.referenceExecutionSha256, outputHashes: hashes, reason: 'Reviewed process snapshot race', reviewedAt: '2026-11-11T07:30:00Z',
      stopSha256: digest(resolve(directory, 'protected-stop.json')), finishSha256: digest(resolve(directory, 'finish.json')) });
    plan.referenceCompletionReviewSha256 = digest(resolve(directory, 'completion-review.json'));
  };
  try {
    prepare(); validateCompletedReference(plan);
    put('completion-review.json', {}); assert.throws(() => validateCompletedReference(plan), /changed completion review/);
    stop.last.swapouts++; prepare(); assert.throws(() => validateCompletedReference(plan)); stop.last.swapouts--;
    stop.reason = 'Resource limit exceeded'; prepare(); assert.throws(() => validateCompletedReference(plan));
  } finally { rmSync(directory, { recursive: true, force: true }); }
});

test('new PDB receipts bind executable, code and plan, and never renew consumed work', () => {
  const scratch = resolve(root, '.tmp/scratch'); mkdirSync(scratch, { recursive: true });
  const repo = mkdtempSync(resolve(scratch, 'stage-table-policy-'));
  const directory = resolve(repo, relative, 'jobs/pair');
  const put = (file: string, content: string) => { mkdirSync(dirname(file), { recursive: true }); writeFileSync(file, content); };
  try {
    for (const file of codeFiles) put(resolve(repo, file), 'reviewed code');
    const binary = resolve(directory, 'table_generator'); put(binary, 'reviewed binary');
    const plan = { schema: 'cuberoot.stage-table-job/v1', kind: 'generate', threads: 18,
      baseline: { boot: '{ sec = 1794194703, usec = 456751 } Sun Nov  8 19:25:03 2026', swapouts: 336 },
      minimumHeadroomBytes: 2 ** 31, rssLimitBytes: 2 ** 30, startupRequiredBytes: 3.5 * 2 ** 30, timeoutSeconds: 3600,
      binary, binarySha256: digest(binary), table: 'pt_cross_pair_C4E0', outputBytes: 54_743_056,
      env: { CUBE_PAIR_JOINT_MODE: 'off', CUBE_F2LEO_COMPACT_MODE: 'off', CUBE_STAGE_JOINT_MODE: 'off' } };
    const approve = () => {
      put(resolve(directory, 'plan.json'), JSON.stringify(plan));
      put(resolve(directory, 'authorization.json'), JSON.stringify({ authorization: request, scope: 'stage-pdb-build-20261110/pair',
        planSha256: digest(resolve(directory, 'plan.json')), codeHashes: Object.fromEntries(codeFiles.map(file => [file, digest(resolve(repo, file))])) }));
    };
    approve(); assert.equal(readJob('pair', repo).plan.table, plan.table);
    put(binary, 'changed'); assert.throws(() => readJob('pair', repo), /executable changed/); put(binary, 'reviewed binary');
    put(resolve(repo, codeFiles[0]), 'changed'); assert.throws(() => readJob('pair', repo), /code changed/); put(resolve(repo, codeFiles[0]), 'reviewed code');
    plan.baseline.swapouts++; approve(); assert.throws(() => readJob('pair', repo)); plan.baseline.swapouts--;
    plan.table = 'h48h11'; approve(); assert.throws(() => readJob('pair', repo)); plan.table = 'pt_cross_pair_C4E0';
    plan.rssLimitBytes = 100 * 2 ** 30; plan.startupRequiredBytes = 102.5 * 2 ** 30; approve(); assert.throws(() => readJob('pair', repo));
    plan.rssLimitBytes = 2 ** 30; plan.startupRequiredBytes = 3.5 * 2 ** 30; approve();
    assert.throws(() => readJob('pair --run-other', repo)); assert.throws(() => readJob('../pair', repo));
    put(resolve(directory, 'used.json'), '{}'); assert.throws(() => readJob('pair', repo), /already consumed/);
  } finally { rmSync(repo, { recursive: true, force: true }); }
});
