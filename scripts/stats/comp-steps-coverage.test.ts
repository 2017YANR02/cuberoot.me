import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { COMP_STEP_TARGETS } from '../../core/jobs/scramble-stats-build/src/comp_step_targets.ts';
import { validateCompSteps } from '../../core/jobs/scramble-stats-build/src/validate_comp_steps.ts';

test('publication requires every variant, scramble and valid bottom result', async t => {
  const root = await mkdtemp(join(tmpdir(), 'comp-coverage-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  for (const target of COMP_STEP_TARGETS) {
    await mkdir(join(root, target.outDir));
    await writeFile(join(root, target.outDir, 'WC2025.json'), JSON.stringify({ R: Array(target.stages * 6).fill(3) }));
  }
  assert.deepEqual(await validateCompSteps(root), { competitions: 1, scrambles: 1, variants: 15 });
  const file = join(root, 'comp_steps_daisy', 'WC2025.json');
  await writeFile(file, JSON.stringify({ R: [3, 3, 3, 3, null, 3] }));
  await assert.rejects(validateCompSteps(root), /Missing\/invalid/);
  await writeFile(file, JSON.stringify({ U: Array(6).fill(3) }));
  await assert.rejects(validateCompSteps(root), /Missing\/invalid/);
  await rm(file);
  await assert.rejects(validateCompSteps(root), /Incomplete competition coverage/);
});

test('builder rejects incomplete source rows before replacing published shards', async t => {
  const { buildTarget } = await import('../../core/jobs/scramble-stats-build/src/build_comp_steps.ts');
  const root = await mkdtemp(join(tmpdir(), 'comp-builder-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const csv = join(root, 'daisy.csv'), out = join(root, 'out');
  const comps = new Map([['1', 'WC2025'], ['2', 'WC2025']]);
  const keys = new Map([['1', 'R'], ['2', 'U']]);
  await mkdir(out); await writeFile(join(out, 'keep.json'), '{}');
  const header = 'id,a,b,c,d,e,f\n';
  await writeFile(csv, header + '1,1,2,3,4,5,6\n');
  await assert.rejects(buildTarget(csv, 1, out, comps, keys), /Incomplete stage results/);
  await writeFile(csv, header + '1,1,2,3,4,5,6\n2,1,2,-1,4,5,6\n');
  await assert.rejects(buildTarget(csv, 1, out, comps, keys), /Invalid\/duplicate/);
  const { readFile } = await import('node:fs/promises');
  assert.equal(await readFile(join(out, 'keep.json'), 'utf8'), '{}');
  await writeFile(csv, header + '1,1,2,3,4,5,6\n2,2,3,4,5,6,7\n');
  await buildTarget(csv, 1, out, comps, keys);
  assert.deepEqual(JSON.parse(await readFile(join(out, 'WC2025.json'), 'utf8')), { R: [2,1,4,3,6,5], U: [3,2,5,4,7,6] });
});
