/** File-only preparation for the explicitly authorized table study. Never spawns computation. */
import assert from 'node:assert/strict';
import { copyFileSync, constants, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { root, relative, request, digest, codeFiles, readJob, resolvedModes } from './stage_table_policy.mts';
import { tableBudget } from '../../scripts/stats/resource-monitor.ts';

const [flag, id, ...rest] = process.argv.slice(2);
assert(flag === '--prepare' && id && !rest.length && /^[a-z0-9][a-z0-9-]{0,80}$/.test(id));
const directory = resolve(root, relative, 'jobs', id);
assert(!existsSync(resolve(directory, 'authorization.json')) && !existsSync(resolve(directory, 'used.json')), 'Never replace an existing review or receipt');
const { binarySource, ...spec } = JSON.parse(readFileSync(resolve(directory, 'spec.json'), 'utf8'));
const binary = resolve(directory, spec.kind === 'generate' ? 'table_generator' : `${spec.analyzer}_analyzer`);
copyFileSync(resolve(root, binarySource), binary, constants.COPYFILE_EXCL);
const plan = { schema: 'cuberoot.stage-table-job/v1', threads: 18,
  baseline: { boot: '{ sec = 1794194703, usec = 456751 } Sun Nov  8 19:25:03 2026', swapouts: 336 },
  minimumHeadroomBytes: 2 ** 31, ...spec, startupRequiredBytes: spec.rssLimitBytes + 2.5 * 2 ** 30,
  binary, binarySha256: digest(binary) };
if (plan.kind === 'benchmark') {
  const budget = tableBudget(binary, { ...resolvedModes(plan.env, plan.analyzer), CUBE_TABLE_DIR: resolve(root, 'solver/tables'), CUBE_TABLE_PROFILE: 'high-memory' });
  Object.assign(plan, { files: budget.files, rssLimitBytes: budget.rssLimit, startupRequiredBytes: budget.rssLimit + 2.5 * 2 ** 30 });
  const cases = JSON.parse(readFileSync(resolve(root, 'solver/testdata/benchmarks/wca-first1000.json'), 'utf8')).cases;
  assert.equal(cases.length, 1000);
  for (const name of ['sample1', 'sample2', 'sample3']) writeFileSync(resolve(directory, name + '.txt'), cases.map((row: any) => `${row.id},${row.scramble}`).join('\n') + '\n', { flag: 'wx' });
  copyFileSync(resolve(root, 'solver/testdata/scramble_100.txt'), resolve(directory, 'warmup.txt'), constants.COPYFILE_EXCL);
  Object.assign(plan, { cases: 1000, rounds: 3, warmupCases: 100, inputSha256: digest(resolve(directory, 'sample1.txt')), warmupSha256: digest(resolve(directory, 'warmup.txt')) });
  if (plan.referenceDirectory) {
    plan.referenceDirectory = resolve(root, plan.referenceDirectory);
    plan.referenceHashes = Object.fromEntries(['warmup', 'sample1', 'sample2', 'sample3'].map(name => {
      const file = `${name}_${plan.analyzer}.csv`; return [file, digest(resolve(plan.referenceDirectory, file))];
    }));
    plan.referenceExecutionSha256 = digest(resolve(plan.referenceDirectory, 'execution.json'));
    const review = resolve(plan.referenceDirectory, 'completion-review.json');
    if (existsSync(review)) plan.referenceCompletionReviewSha256 = digest(review);
  }
  if (plan.goldenFile) plan.goldenSha256 = digest(resolve(root, plan.goldenFile));
}
writeFileSync(resolve(directory, 'plan.json'), JSON.stringify(plan, null, 2) + '\n', { flag: 'wx' });
const codeHashes: Record<string, string> = {};
for (const file of codeFiles) {
  codeHashes[file] = digest(resolve(root, file));
  const target = resolve(directory, 'reviewed-runner', file); mkdirSync(dirname(target), { recursive: true });
  copyFileSync(resolve(root, file), target, constants.COPYFILE_EXCL);
}
writeFileSync(resolve(directory, 'authorization.json'), JSON.stringify({ authorization: request, scope: `stage-pdb-build-20261110/${id}`,
  planSha256: digest(resolve(directory, 'plan.json')), codeHashes, preparedAt: new Date().toISOString() }, null, 2) + '\n', { flag: 'wx' });
readJob(id);
console.log(JSON.stringify({ id, kind: plan.kind, rssLimitBytes: plan.rssLimitBytes, startupRequiredBytes: plan.startupRequiredBytes }));
