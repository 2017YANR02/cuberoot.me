import { join } from 'node:path';
import { intakeRegressionId, intakeRegressionRows } from '@/lib/recon-intake-regression';
import { readFileSync, writeFileSync } from 'node:fs';
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
  it(`${intakeRegressionId(item)}.json`, async () => {
    expect(item.expected).not.toBeNull();
    const checked = await checkReconIntake(item, libraries);
    if (checked.actual && process.env.RECON_GROUND_TRUTH_CAPTURE_DIR) {
      writeFileSync(join(process.env.RECON_GROUND_TRUTH_CAPTURE_DIR, `${intakeRegressionId(item)}.json`),
        JSON.stringify(intakeRegressionRows(checked.actual)));
    }
    expect(checked.errors).toEqual([]);
    expect(checked.actual).toEqual(item.expected);
  });
}

it('reconstructs the annotated closed-wide trigger and all five steps from the drifting raw recording', async () => {
  const recording = JSON.parse(readFileSync(new URL('./fixtures/recon-closed-wide-drift.json', import.meta.url), 'utf8'));
  const steps = [
    "R' F' r' U' R' F",
    "U' R' U R",
    "L F' L' F u' L' U L u",
    "F' U F R U R'",
    "U' L' U2' L U F L' U' L U L F' L2' U L U",
  ];
  const before = JSON.stringify(recording);
  const checked = await checkReconIntake({ id: 'closed-wide-drift', expected: null,
    input: { recording, source: '', observed: { inspection: '', lines: [] },
      annotations: [], verdict: 'needs-fix', language: 'zh', hadOverride: false } }, libraries);
  expect(checked.errors).toEqual([]);
  expect(checked.actual!.inspection).toBe('x');
  // Owner permits only half-turn spelling and the simplified final AUF.
  // No rotation-equivalence, reordering or regrouping can satisfy this check.
  const halfTurns = (text: string) => text.replace(/2'/g, '2');
  expect(checked.actual!.lines.map(line => halfTurns(line.moves.join(' '))))
    .toEqual(steps.map(halfTurns));
  expect(checked.actual!.lines.map(line => [line.fromIdx, line.toIdx]))
    .toEqual([[0, 5], [6, 9], [10, 18], [19, 24], [25, 44]]);
  expect(JSON.stringify(recording)).toBe(before);
});

it('does not recover the drifting wide pair without both compensating encoder turns', async () => {
  const { decodeGyroTrack } = await import('@cuberoot/shared/smart-cube/gyro-track');
  const { buildCoreTrack } = await import('@cuberoot/shared/timer/reconstruct/core-track');
  const recording = JSON.parse(readFileSync(new URL('./fixtures/recon-closed-wide-drift.json', import.meta.url), 'utf8'));
  const samples = decodeGyroTrack(recording.gyro);
  const original = JSON.stringify(samples);
  const detected = buildCoreTrack(samples)!.events;
  expect(detected.map(event => event.token)).toEqual(["x'", "y'", "y'", 'y']);
  const missingClose = recording.moves.filter((_: unknown, index: number) => index !== 18);
  expect(buildCoreTrack(samples, { moves: missingClose })!.events).toEqual(detected);
  expect(buildCoreTrack(samples, { moves: recording.moves })!.events.map(event => event.token))
    .toEqual(["x'", "y'", 'y']);
  expect(JSON.stringify(samples)).toBe(original);
});
