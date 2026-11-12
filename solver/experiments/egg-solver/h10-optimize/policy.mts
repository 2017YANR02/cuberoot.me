/** Isolated h10 experiment. Never changes the accepted Egg installation. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { closeSync, existsSync, openSync, readFileSync, readSync, statSync } from 'node:fs';
import { resolve } from 'node:path';

export const root = resolve(import.meta.dirname, '../../../..');
export const relative = '.local-data/egg-h10-optimize-20261112';
export const directory = resolve(root, relative);
export const entry = 'solver/experiments/egg-solver/h10-optimize/benchmark.mts';
export const command = `node --import ./core/node_modules/tsx/dist/loader.mjs ${entry} --run`;
export const followupCommand = command.replace(/--run$/, '--run-ternary');
export const followupDirectory = resolve(directory, 'coordinate-followup');
export const splitCommand = command.replace(/--run$/, '--run-split-ternary');
export const splitDirectory = resolve(directory, 'split-coordinate-followup');
export const repeatCommand = command.replace(/--run$/, '--run-lanes-repeatability');
export const repeatDirectory = resolve(root, '.local-data/egg-h10-lanes-repeatability-20261112');
export const repeatReportFile = 'solver/experiments/egg-solver/h10-optimize/repeat-report.mts';
// Predeclared balanced order: four AB/BA blocks, eight paired comparisons.
export const repeatSequence = Array.from({ length: 8 }, (_, i) => (i % 2 ? [24, 32] : [32, 24])
  .map(lanes => ({ label: `pair-${String(i + 1).padStart(2, '0')}-lanes${lanes}`, lanes })) ).flat();
export const labels = ['current-egg', 'rebuilt', 'apple-m5', 'arm-keep', 'lanes24'];
export const codeFiles = [entry, 'solver/experiments/egg-solver/h10-optimize/policy.mts',
  'solver/experiments/egg-solver/h10-optimize/verify.mts', 'scripts/stats/resource-monitor.ts',
  'solver/experiments/cube48opt-rust/stats-resume-review.mts', 'core/scripts/mac-system-recorder.mts',
  'solver/333opt/stats-engine.mts'];
export const digest = (file: string) => createHash('sha256').update(readFileSync(file)).digest('hex');
export const read = (file: string) => JSON.parse(readFileSync(file, 'utf8'));
export function tableIdentity(path: string) {
  const s = statSync(path);
  assert.equal(s.size, 31_130_914_816, 'Only the accepted h10 table is allowed');
  const trailer = Buffer.alloc(4096), fd = openSync(path, 'r');
  try { assert.equal(readSync(fd, trailer, 0, 4096, s.size - 4096), 4096); }
  finally { closeSync(fd); }
  assert(trailer.toString().startsWith('egg-solver h48 table v1\nlayout h48\nk 10\nbase 10\nbytes 31130910720\n'));
  assert(trailer.toString().includes('\nchecksum f2c101eb651ea2c9\n'));
  return { path, bytes: s.size, mtimeMs: s.mtimeMs, ino: s.ino, dev: s.dev,
    trailerSha256: createHash('sha256').update(trailer).digest('hex') };
}
export function readPlan(checkUnused = true, followup: boolean | 'split' | 'repeat' = false) {
  const dataDir = followup === 'repeat' ? repeatDirectory : followup === 'split' ? splitDirectory : followup ? followupDirectory : directory;
  if (checkUnused) assert(!existsSync(resolve(dataDir, 'used.json')), 'Experiment already consumed; do not retry');
  const planFile = resolve(dataDir, 'plan.json'), frozen = read(resolve(dataDir, 'frozen.json'));
  assert.equal(digest(planFile), frozen.planSha256, 'Experiment plan changed');
  const reviewedFiles = followup === 'repeat' ? [...codeFiles, repeatReportFile] : codeFiles;
  assert.deepEqual(Object.keys(frozen.codeHashes).sort(), [...reviewedFiles].sort());
  for (const file of reviewedFiles) assert.equal(digest(resolve(root, file)), frozen.codeHashes[file], `Reviewed code changed: ${file}`);
  const plan = read(planFile);
  assert.equal(plan.schema, 'cuberoot.egg-h10-isolated/v1');
  assert.equal(plan.count, 1000); assert.equal(plan.threads, 16); assert.equal(plan.concurrency, 1);
  assert.equal(plan.passes, 1); assert.equal(plan.warmup, false);
  assert.deepEqual(plan.baseline, { boot: '1794194703', swapouts: 336 });
  assert.equal(plan.rssLimit, 32 * 2 ** 30); assert.equal(plan.startupRequiredBytes, 35 * 2 ** 30);
  assert.equal(plan.minimumHeadroomBytes, 2 * 2 ** 30); assert.equal(plan.deadlineMs, 600_000);
  assert.deepEqual(plan.variants.map((v: { label: string }) => v.label), followup === 'repeat' ? repeatSequence.map(v => v.label) : followup === 'split' ? ['split-ternary'] : followup ? ['ternary'] : labels);
  if (followup === 'repeat') {
    assert.equal(plan.repeatPairs, 8);
    assert.deepEqual(plan.variants.map(({ label, lanes }: { label: string; lanes: number }) => ({ label, lanes })), repeatSequence);
    assert.equal(digest(resolve(directory, 'final-report.json')), plan.originalFinalReportSha256);
  }
  if (followup) {
    assert.equal(read(resolve(directory, 'execution.json')).status, 'complete', 'Keep the completed baseline');
    for (const name of ['execution.json', 'report.json', 'used.json'])
      assert.equal(digest(resolve(directory, name)), plan.reference[name], 'Original benchmark evidence changed');
    if (followup === 'split') {
      assert.equal(read(resolve(followupDirectory, 'execution.json')).status, 'complete');
      assert.equal(digest(resolve(followupDirectory, 'report.json')), plan.priorCoordinateReportSha256);
    }
  }
  for (const v of plan.variants) {
    const binary = resolve(dataDir, 'bin', followup === 'repeat' || v.label === 'lanes24' ? 'current-egg' : v.label);
    assert.equal(v.binary, binary); assert.equal(digest(binary), v.sha256);
    if (followup === 'repeat') assert.equal(v.sha256, '4c7a994372cd976ff8903f8b4a31a6b163b438b44508c41a535b2fde9f9f81ba');
    else assert.equal(v.lanes, v.label === 'lanes24' ? 24 : 32);
  }
  for (const file of ['cases.json', 'input.txt', 'preserved/original.json'])
    assert.equal(digest(resolve(dataDir, file)), plan.fileHashes[file]);
  if (followup) for (const file of ['cases.json', 'input.txt'])
    assert.equal(digest(resolve(dataDir, file)), digest(resolve(directory, file)), 'Follow-up corpus changed');
  assert.deepEqual(tableIdentity(plan.table.path), plan.table);
  assert(!existsSync(plan.table.path + '.tune'), 'Keep the original table tuning unchanged');
  return { plan, frozen };
}
export function approvedH10Command(text: string, cwd: unknown): boolean {
  if (![command, followupCommand, splitCommand, repeatCommand].includes(text) || typeof cwd !== 'string' || resolve(cwd) !== root) return false;
  try { readPlan(true, text === repeatCommand ? 'repeat' : text === splitCommand ? 'split' : text === followupCommand); return true; } catch { return false; }
}
