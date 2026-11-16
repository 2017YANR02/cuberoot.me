import assert from 'node:assert/strict';
import { test } from 'node:test';
import { comparePlan, compatiblePlans, parseGitChanges, planClientTests } from './client-test-plan.ts';

const client = 'core/packages/client/';
const tests = ['alg-row-tags', 'timer-scramble-history-shared', 'recon-edit-readonly', 'wca_identity_callback', 'comp-series', 'teaching-main-site', 'workflow-path-contract'].map(name => `${client}tests/${name}.test.ts`);
const plan = (path: string, status = 'M') => planClientTests({ changes: [{ path, status }], tests });

test('a compact formula CSS edit selects the whole business group and common guards', () => {
  const result = plan(`${client}components/alg-formula-row.css`);
  assert.equal(result.full, false);
  assert.deepEqual(result.selectedTests, [tests[0], tests[6]].sort());
  assert.equal(result.groups.account.selected, false);
});

test('domain routes and CamelCase components reuse the same group ownership', () => {
  for (const path of ['app/[lang]/alg/page.tsx', 'components/AlgCategoryView.tsx', 'hooks/useAlgLibrary.ts']) {
    assert.equal(plan(`${client}${path}`).groups.alg.selected, true);
    assert.equal(plan(`${client}${path}`).full, false);
  }
  assert.equal(plan(`${client}app/[lang]/account/page.tsx`).groups.account.selected, true);
});

test('new, removed and renamed paths conservatively select everything', () => {
  for (const status of ['A', 'D', 'R']) assert.equal(plan(`${client}components/AlgRow.tsx`, status).full, true);
  assert.deepEqual(parseGitChanges('D\0old.ts\0A\0new.ts\0'), [{ status: 'D', path: 'old.ts' }, { status: 'A', path: 'new.ts' }]);
  assert.throws(() => parseGitChanges('M\0'));
});

test('shared, global CSS, configs and unknown paths fail closed', () => {
  for (const path of ['core/packages/shared/src/alg.ts', `${client}app/globals.css`, `${client}vitest.config.ts`, 'core/pnpm-lock.yaml', `${client}components/BrandNew.tsx`]) {
    assert.equal(plan(path).selectedTests.length, tests.length, path);
  }
  assert.equal(planClientTests({ changes: null, tests }).full, true);
  assert.equal(planClientTests({ changes: [], tests }).full, true);
});

test('unknown file-reading guard tests stay in the common group', () => {
  assert.equal(plan(`${client}components/AlgCategoryView.tsx`).groups.common.tests.includes(tests[6]), true);
  assert.equal(plan(tests[6]).full, true);
});

test('shadow comparison exposes missed failures instead of hiding them', () => {
  const selection = plan(`${client}components/AlgCategoryView.tsx`);
  const report = { testResults: tests.map(name => ({ name, status: name === tests[3] ? 'failed' : 'passed' })) };
  assert.deepEqual(comparePlan(selection, report).missedFailures, [tests[3]]);
  report.testResults[3].status = 'passed';
  report.testResults[0].status = 'failed';
  assert.deepEqual(comparePlan(selection, report).missedFailures, []);
  report.testResults.pop();
  assert.deepEqual(comparePlan(selection, report).missingResults, [tests[6]]);
});

test('merged shard reports restore complete coverage and reject unknown files', () => {
  const selection = plan(`${client}components/AlgCategoryView.tsx`);
  const shard1 = tests.slice(0, 3).map(name => ({ name, status: 'passed' }));
  const shard2 = tests.slice(3).map(name => ({ name, status: 'passed' }));
  assert.equal(comparePlan(selection, { testResults: shard1 }).missingResults.length, 4);
  assert.deepEqual(comparePlan(selection, { testResults: [...shard1, ...shard2] }).missingResults, []);
  assert.deepEqual(comparePlan(selection, { testResults: [{ name: 'unregistered.test.ts', status: 'failed' }] }).unexpectedResults, ['unregistered.test.ts']);
});

test('aggregate evidence rejects stale commits or inconsistent shard plans', () => {
  const selection = plan(`${client}components/AlgCategoryView.tsx`);
  assert.equal(compatiblePlans([selection, structuredClone(selection)], 'HEAD'), selection);
  assert.throws(() => compatiblePlans([selection], 'different-merge-sha'), /head/);
  assert.throws(() => compatiblePlans([selection, { ...selection, base: 'different-base' }]), /disagree/);
  assert.throws(() => compatiblePlans([selection, { ...selection, deferredTests: [] }]), /disagree/);
  assert.throws(() => compatiblePlans([selection, { ...selection, full: true }]), /disagree/);
});
