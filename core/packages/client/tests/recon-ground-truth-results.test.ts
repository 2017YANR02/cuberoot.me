import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { startResult, finishResult, publishResults } from '../../../scripts/recon-ground-truth-results.mts';
import { readTestRuns, saveTestRun, fixtureContentHash, isApprovedFixture } from '@/lib/recon-test-history.server';
import { isReconTestRun } from '@cuberoot/shared/recon-ground-truth';

const roots: string[] = [];
const rows = [{ moves: 'R U', label: '// F1', colors: ['red/blue'], hrefs: ['/alg/3x3/f2l/b-'], diagrams: ['3d'] }];
function setup() {
  const root = mkdtempSync(join(tmpdir(), 'recon-results-')); roots.push(root);
  const dir = join(root, 'core/packages/client/tests/fixtures/recon-workbook'); mkdirSync(dir, { recursive: true });
  const fixture = { source: 'https://cuberoot.me/timer?share=example', issue: 'Preserve orientation', recording: { moves: [] }, displayRows: rows };
  writeFileSync(join(dir, 'example.json'), JSON.stringify({ ...fixture, approval: { status: 'approved', instruction: '收录到回归测试', confirmedBy: 'user', confirmedAt: '2026-10-15T00:00:00Z', contentHash: fixtureContentHash(fixture) } }));
  return { root, context: startResult(root, 'a'.repeat(64), 'manual') };
}
function report(context: ReturnType<typeof startResult>, passed = true) {
  writeFileSync(context.reportFile, JSON.stringify({ numPassedTests: passed ? 1 : 0, numFailedTests: passed ? 0 : 1, numTotalTests: 1,
    testResults: [{ assertionResults: [{ title: 'example.json', fullName: 'display example.json', status: passed ? 'passed' : 'failed', duration: 4, failureMessages: passed ? [] : ['Wrong orientation'] }] }] }));
  writeFileSync(join(context.captureDirectory, 'example.json'), JSON.stringify(rows));
}
afterEach(() => { for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true }); });
describe('durable ground-truth results', () => {
  it('requires explicit user approval of the unchanged recording and answer', () => {
    const { root } = setup();
    const fixture = JSON.parse(readFileSync(join(root, 'core/packages/client/tests/fixtures/recon-workbook/example.json'), 'utf8'));
    expect(isApprovedFixture(fixture)).toBe(true);
    for (const approval of [undefined, { status: 'pending' }, { ...fixture.approval, instruction: 'tests passed' }, { ...fixture.approval, confirmedBy: 'AI' }]) {
      expect(isApprovedFixture({ ...fixture, approval })).toBe(false);
    }
    expect(isApprovedFixture({ ...fixture, recording: { moves: ['U'] } })).toBe(false);
    expect(isApprovedFixture({ ...fixture, displayRows: [] })).toBe(false);
  });
  it('retains pending samples without running or promoting them, even if an old assertion passed', () => {
    const { root, context: old } = setup(); report(old); finishResult(root, old, 0);
    const oldPath = join(root, '.tmp/recon-ground-truth-runs', old.run.id + '.json');
    const oldText = readFileSync(oldPath, 'utf8');
    const path = join(root, 'core/packages/client/tests/fixtures/recon-workbook/example.json');
    const fixture = JSON.parse(readFileSync(path, 'utf8')); fixture.approval = { status: 'pending' };
    writeFileSync(path, JSON.stringify(fixture));
    const context = startResult(root, 'b'.repeat(64), 'manual'); report(context);
    expect(finishResult(root, context, 0)).toBe(0);
    expect(context.run.cases[0]).toMatchObject({ approved: false, status: 'not-run', expected: rows });
    expect(context.run.cases[0].actual).toBeUndefined();
    expect(isReconTestRun(context.run)).toBe(true);
    expect(readFileSync(oldPath, 'utf8')).toBe(oldText);
    expect(startResult(root, 'b'.repeat(64), 'manual').run.cases[0].approved).toBe(false);
  });
  it('retains every execution with expected and actual output, rather than overwriting the last pass', () => {
    const { root, context } = setup(); expect(readTestRuns(root)[0].status).toBe('running');
    report(context); expect(finishResult(root, context, 0)).toBe(0);
    const passed = readTestRuns(root)[0]; expect(passed.cases[0].actual).toEqual(rows); expect(isReconTestRun(passed)).toBe(true);
    const next = startResult(root, 'b'.repeat(64), 'commit'); report(next, false); expect(finishResult(root, next, 1)).toBe(1);
    expect(readTestRuns(root).map(run => run.status).sort()).toEqual(['failed', 'passed']);
    expect(readTestRuns(root).find(run => run.id === next.run.id)?.cases[0].errors).toEqual(['Wrong orientation']);
  });
  it('never marks missing, corrupt or incomplete reports as passing', () => {
    for (const content of [undefined, '{', JSON.stringify({ numPassedTests: 1, numTotalTests: 1, testResults: [] })]) {
      const { root, context } = setup(); if (content) writeFileSync(context.reportFile, content);
      expect(finishResult(root, context, 0)).toBe(2);
      expect(readTestRuns(root)[0].status).toBe('failed');
      expect(readTestRuns(root)[0].cases[0].status).toBe('not-run');
    }
  });
  it('includes active intake revisions in the same catalog, captures failures and rejects missing evidence', () => {
    const { root } = setup();
    const id = '03c8a2fd-2d76-4d4b-92e3-3a79ffddc52e';
    const expected = { inspection: 'x', lines: [{ key: 'cross', kind: 'cross',
      fromIdx: 0, toIdx: 1, moves: ['R', 'U'], label: null }] };
    writeFileSync(join(root, 'core/packages/client/tests/fixtures/recon-intake.json'), JSON.stringify({
      version: 1, cases: [{ id, revision: 2, input: { source: '' }, expected }],
    }));
    for (const evidence of ['complete', 'missing-capture', 'wrong-revision', 'failed']) {
      const context = startResult(root, 'c'.repeat(64), 'manual'); report(context);
      const sample = context.run.cases[1];
      expect(sample).toMatchObject({ id: `intake-${id}-v2`, approved: true, status: 'not-run' });
      expect(sample.expected.map(row => row.moves)).toEqual(['x', 'R U']);
      const result = JSON.parse(readFileSync(context.reportFile, 'utf8'));
      result.numTotalTests = 2;
      result.numPassedTests = evidence === 'failed' ? 1 : 2;
      result.numFailedTests = evidence === 'failed' ? 1 : 0;
      result.testResults[0].assertionResults.push({
        title: `intake-${id}-v${evidence === 'wrong-revision' ? 1 : 2}.json`,
        status: evidence === 'failed' ? 'failed' : 'passed', failureMessages: evidence === 'failed' ? ['Wrong moves'] : [],
      });
      writeFileSync(context.reportFile, JSON.stringify(result));
      if (evidence !== 'missing-capture') writeFileSync(join(context.captureDirectory, sample.id + '.json'), JSON.stringify(sample.expected));
      expect(finishResult(root, context, 0)).toBe(evidence === 'complete' ? 0 : 2);
      expect(isReconTestRun(context.run)).toBe(true);
      if (evidence === 'failed') expect(sample.errors).toEqual(['Wrong moves']);
    }
  });
  it('records an exited process as interrupted and retains it for synchronization', () => {
    const { root, context } = setup(); context.run.pid = 2147483647; saveTestRun(root, context.run);
    const run = readTestRuns(root)[0]; expect(run.status).toBe('interrupted'); expect(run.finishedAt).toBeTruthy();
    expect(isReconTestRun(run)).toBe(true);
  });
  it('retries failed synchronization, acknowledges only successful uploads and never rewrites the local report', async () => {
    const { root, context } = setup(); report(context); finishResult(root, context, 0);
    const path = join(root, '.tmp/recon-ground-truth-runs', context.run.id + '.json'); const before = readFileSync(path, 'utf8');
    const fetcher = vi.fn<typeof fetch>().mockResolvedValueOnce(Response.json({}, { status: 503 })).mockResolvedValue(Response.json({ saved: true }));
    const options = { key: 'test-only', url: 'https://example.test/runs', fetcher };
    expect(await publishResults(root, options)).toEqual({ sent: 0, pending: true });
    expect(await publishResults(root, options)).toEqual({ sent: 1, pending: false });
    expect(await publishResults(root, options)).toEqual({ sent: 0, pending: false });
    expect(fetcher).toHaveBeenCalledTimes(2); expect(readFileSync(path, 'utf8')).toBe(before);
  });
  it('rejects malformed reports and a passing label with unfinished cases', () => {
    const { root, context } = setup(); report(context); finishResult(root, context, 0);
    const run = readTestRuns(root)[0];
    for (const value of [{ ...run, id: '-'.repeat(36) }, { ...run, cases: [null] }, { ...run, failed: 2 },
      { ...run, cases: [{ ...run.cases[0], status: 'not-run' }] }, { ...run, cases: [...run.cases, ...run.cases] }]) expect(isReconTestRun(value)).toBe(false);
  });
});
