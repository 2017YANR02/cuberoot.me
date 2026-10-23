import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
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
    // A pre-existing local manifest does not prove a new/empty server has those
    // rows. First registration must carry full SQL even when local diff is empty.
    const bin = join(root, 'bin'), captured = join(root, 'captured'); await mkdir(bin); await mkdir(captured);
    const stub = `#!${process.execPath}\nconst fs=require('node:fs'),path=require('node:path');if(path.basename(process.argv[1])==='scp')fs.copyFileSync(process.argv[2],path.join(process.env.PG_TEST_CAPTURE,path.basename(process.argv[3].split(':').at(-1))));\n`;
    await writeFile(join(bin, 'scp'), stub, { mode: 0o755 }); await writeFile(join(bin, 'ssh'), stub, { mode: 0o755 });
    const priorPath = process.env.PATH, priorCapture = process.env.PG_TEST_CAPTURE;
    process.env.PATH = `${bin}:${priorPath}`; process.env.PG_TEST_CAPTURE = captured;
    try {
      const row = 'new,333,f,1,0,1,1,2,"{3,4}"';
      await writeFile(csv, `${row}\n`); await writeFile(layout, '{}');
      await writeFile(manifest, `new,333,f,1,0,1\t${createHash('sha1').update(row).digest('hex')}\n`);
      await loadStepsToPg(csv, layout, join(root, 'absent-rare.csv'), '2026-09-24');
      const stepsSql = (await readdir(captured)).find(name => name.endsWith('_wss_load.sql'));
      assert(stepsSql, 'first registration must prepare a complete steps load');
      assert.match(await readFile(join(captured, stepsSql), 'utf8'), /DELETE FROM wca_scramble_steps;/);
      const stepsRequest = JSON.parse(await readFile(join(captured, `${stepsSql}.json`), 'utf8'));
      assert.match(stepsRequest.apply, /gunzip -c '[^']+\.gz' > '[^']+'/);
      assert.doesNotMatch(stepsRequest.apply, /gunzip -f/);
      const optimal = join(root, 'optimal.csv'), optRow = 'new,333,f,1,0,1,1,R';
      await writeFile(optimal, `competition_id,event_id,round_type_id,group_id,is_extra,scramble_num,htm,optimal_scramble\n${optRow}\n`);
      await writeFile(join(root, 'wca/incremental/pg_optimal_333_manifest.tsv'), `new,333,f,1,0,1\t${createHash('sha1').update(optRow).digest('hex')}\n`);
      const { loadOptimalToPg } = await import('./publish-pg.js'); await loadOptimalToPg(optimal, '333');
      const optimalSql = (await readdir(captured)).find(name => name.endsWith('_timer_optimal_333.sql'));
      assert(optimalSql, 'first registration must prepare a complete optimal load');
      assert.match(await readFile(join(captured, optimalSql), 'utf8'), /DELETE FROM wca_scramble_optimal WHERE/);
    } finally {
      process.env.PATH = priorPath;
      if (priorCapture === undefined) delete process.env.PG_TEST_CAPTURE; else process.env.PG_TEST_CAPTURE = priorCapture;
    }
  } finally {
    if (previous === undefined) delete process.env.CUBEROOT_WCA_DATA_DIR;
    else process.env.CUBEROOT_WCA_DATA_DIR = previous;
    await rm(root, { recursive: true, force: true });
  }
});

test('independent PG publications never share SQL, CSV or decompression paths', async () => {
  const { remoteFiles } = await import('./publish-pg.js');
  const first = remoteFiles(), second = remoteFiles();
  for (const name of ['wss.csv', 'wssr.csv', 'mirror_delta.csv', 'opt_333.sql']) {
    assert.notEqual(first(name), second(name));
    assert.equal(first(`${name}.gz`), `${first(name)}.gz`);
  }
  assert.throws(() => first('../escape'), /Invalid remote staging filename/);
});
