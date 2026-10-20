import { existsSync, mkdirSync, readdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import type { ReconTestCase, ReconTestRun } from './recon-test-results.ts';

type WorkbookFixture = {
  recording?: unknown; displayRows: ReconTestCase['expected']; source: string; issue: string;
  approval?: { status: string; instruction?: string; confirmedBy?: string; confirmedAt?: string; contentHash?: string };
};
/** Approval binds the user's reviewed recording AND answer; test success never grants approval. */
export function fixtureContentHash(fixture: Pick<WorkbookFixture, 'recording' | 'displayRows'>) {
  return createHash('sha256').update(JSON.stringify({ recording: fixture.recording, displayRows: fixture.displayRows })).digest('hex');
}
export function isApprovedFixture(fixture: WorkbookFixture): boolean {
  const approval = fixture.approval;
  return approval?.status === 'approved' && approval.confirmedBy === 'user'
    && approval.instruction === '收录到回归测试'
    && typeof approval.confirmedAt === 'string' && Number.isFinite(Date.parse(approval.confirmedAt))
    && approval.contentHash === fixtureContentHash(fixture);
}
export function readWorkbookCases(root: string): ReconTestCase[] {
  const dir = join(root, 'core/packages/client/tests/fixtures/recon-workbook');
  if (!existsSync(dir)) return [];
  return readdirSync(dir).filter(file => file.endsWith('.json') && file !== 'libraries.json').sort().map(file => {
    const fixture: WorkbookFixture = JSON.parse(readFileSync(join(dir, file), 'utf8'));
    return { id: file.slice(0, -5), source: fixture.source, issue: fixture.issue, expected: fixture.displayRows,
      approved: isApprovedFixture(fixture), status: 'not-run', errors: [] };
  });
}

export function historyDirectory(root: string) { return join(root, '.tmp/recon-ground-truth-runs'); }
export function findCheckoutRoot(): string | null {
  let path = process.cwd();
  for (let i = 0; i < 6; i++) {
    if (existsSync(join(path, 'core/scripts/recon-ground-truth-gate.mjs'))) return path;
    const parent = resolve(path, '..'); if (path === parent) break; path = parent;
  }
  return null;
}
export function saveTestRun(root: string, run: ReconTestRun) {
  const dir = historyDirectory(root); mkdirSync(dir, { recursive: true });
  const target = join(dir, `${run.id}.json`);
  const temp = `${target}.${randomUUID()}.tmp`;
  writeFileSync(temp, JSON.stringify(run)); renameSync(temp, target);
}
export function readTestRuns(root: string): ReconTestRun[] {
  const dir = historyDirectory(root);
  if (!existsSync(dir)) return [];
  return readdirSync(dir).filter(file => file.endsWith('.json')).flatMap(file => {
    try {
      const run = JSON.parse(readFileSync(join(dir, file), 'utf8')) as ReconTestRun;
      if (run.version !== 1 || !Array.isArray(run.cases)) return [];
      if (run.status === 'running') {
        try { process.kill(run.pid, 0); }
        catch (error) { if ((error as NodeJS.ErrnoException).code === 'ESRCH') {
          run.status = 'interrupted';
          // This is the time interruption was detected, not a claimed test completion.
          run.finishedAt = new Date().toISOString();
          run.errors.push('Test process ended without a final report; interruption detected at ' + run.finishedAt);
          saveTestRun(root, run);
        } }
      }
      return [run];
    } catch { return []; }
  }).sort((a, b) => b.startedAt.localeCompare(a.startedAt));
}
