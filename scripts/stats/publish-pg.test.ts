import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';

test('invalid local steps layout fails publication and preserves the PG manifest', async () => {
  const root = await mkdtemp(join(tmpdir(), 'scramble-pg-test-'));
  const previous = process.env.CUBEROOT_WCA_DATA_DIR;
  process.env.CUBEROOT_WCA_DATA_DIR = join(root, 'wca');
  try {
    const { loadStepsToPg } = await import('./publish-pg.js');
    const manifest = join(root, 'wca', 'incremental', 'pg_wss_manifest.tsv');
    const csv = join(root, 'steps.csv');
    const layout = join(root, 'layout.json');
    const old = `old,333,f,1,0,1\t${'a'.repeat(40)}\n`;
    await mkdir(join(root, 'wca', 'incremental'), { recursive: true });
    await writeFile(manifest, old);
    await writeFile(csv, 'new,333,f,1,0,1,1,2,{3}\n');
    await writeFile(layout, '{invalid json');
    await assert.rejects(() => loadStepsToPg(csv, layout, join(root, 'absent-rare.csv'), '2026-09-24'), SyntaxError);
    assert.equal(await readFile(manifest, 'utf8'), old);
  } finally {
    if (previous === undefined) delete process.env.CUBEROOT_WCA_DATA_DIR;
    else process.env.CUBEROOT_WCA_DATA_DIR = previous;
    await rm(root, { recursive: true, force: true });
  }
});
