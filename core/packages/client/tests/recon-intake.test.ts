import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { expect, it } from 'vitest';
import { checkReconIntake } from '@/lib/recon-intake-check.mts';
import type { ReconIntakeCase } from '@cuberoot/shared/recon-ground-truth';

const snapshot = JSON.parse(readFileSync(new URL('./fixtures/recon-intake.json', import.meta.url), 'utf8'));
const libraries = JSON.parse(readFileSync(new URL('./fixtures/recon-workbook/libraries.json', import.meta.url), 'utf8'));
it('loads the AI checker in the real Node/tsx runtime', () => {
  const loaded = spawnSync(process.execPath, ['--import', 'tsx', '--input-type=module', '-e',
    "await import('./packages/client/lib/recon-intake-check.mts')"], {
    cwd: new URL('../../../', import.meta.url), encoding: 'utf8', timeout: 30000,
  });
  expect(loaded.status, loaded.stderr).toBe(0);
}, 30000);
it('loads the fixed intake export without treating an empty corpus as verified recordings', () => {
  expect(snapshot.version).toBe(1);
  expect(Array.isArray(snapshot.cases)).toBe(true);
});
it('diagnoses an unapproved recording from raw moves and rejects a changed expected answer', async () => {
  const fixture = JSON.parse(readFileSync(new URL('./fixtures/recon-workbook/6wrK7I3TuMk.json', import.meta.url), 'utf8'));
  const wrong = { inspection: 'x x x', lines: [{ key: 'wrong', kind: 'cross', fromIdx: 0, toIdx: 0, moves: ['U'], label: null }] };
  const item: Pick<ReconIntakeCase, 'id' | 'input' | 'expected'> = {
    id: 'diagnostic-only', input: { source: '', recording: fixture.recording, observed: wrong,
      annotations: [], verdict: 'needs-fix', language: 'en', hadOverride: true }, expected: wrong,
  };
  const before = JSON.stringify(item);
  const checked = await checkReconIntake(item, libraries);
  expect(checked.actual).not.toBeNull();
  expect(checked.actual).not.toEqual(wrong);
  expect(checked.errors).toContain('Actual notation differs from the administrator-approved expectation');
  expect(JSON.stringify(item)).toBe(before);
}, 30000);
for (const item of snapshot.cases as ReconIntakeCase[]) {
  it(`approved intake ${item.id} revision ${item.revision}`, async () => {
    expect(item.expected).not.toBeNull();
    const checked = await checkReconIntake(item, libraries);
    expect(checked.errors).toEqual([]);
    expect(checked.actual).toEqual(item.expected);
  });
}
