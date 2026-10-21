import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { syncAnalyzerChunks, validateAnalyzerOutput, type AnalyzerChunksOptions } from './analyzer-chunks.js';
import { openAnalyzerSession } from './common.js';

async function fixture() {
  const dir = await mkdtemp(join(tmpdir(), 'cuberoot-resident-fixture-'));
  const script = join(dir, 'analyzer.mjs');
  const calls = join(dir, 'calls.jsonl');
  await writeFile(script, `import fs from 'node:fs'; import readline from 'node:readline';
for await (const input of readline.createInterface({input:process.stdin})) {
  if(input==='exit') break;
  const source=fs.readFileSync(input,'utf8');
  const output=input.replace(/\\.txt$/, '_fixture.csv');
  fs.appendFileSync(process.env.FIXTURE_CALLS,JSON.stringify({pid:process.pid,source,checkpoint:fs.existsSync(output+'.checkpoint'),profile:process.env.CUBE_TABLE_PROFILE,identity:process.env.ANALYZER_CHECKPOINT_ID})+'\\n');
  const ids=source.trim().split('\\n').map(row=>row.split(',')[0]);
  fs.writeFileSync(output,'id,depth\\n'+ids.map(id=>id+',4').join('\\n')+'\\n');
  console.error('[DONE] '+ids.length+' tasks, output='+output);
}`);
  const options: AnalyzerChunksOptions = {
    binary: process.execPath, args: [script], input: join(dir, 'chunk.txt'), output: join(dir, 'chunk_fixture.csv'),
    log: join(dir, 'analyzer.log'), env: { ...process.env, FIXTURE_CALLS: calls }, label: 'fixture',
    master: join(dir, 'master.txt'), target: join(dir, 'stats.csv'), chunkSize: 1, maxChunks: 0,
  };
  return { dir, calls, options };
}

test('multiple chunks use one PID, commit all rows once, and a repeat opens no analyzer', { timeout: 10_000 }, async () => {
  const { dir, calls, options } = await fixture();
  try {
    await writeFile(options.master, '1,U\n2,R\n3,F\n');
    assert.equal(await syncAnalyzerChunks(options), 3);
    const observed = (await readFile(calls, 'utf8')).trim().split('\n').map(row => JSON.parse(row));
    assert.equal(observed.length, 3);
    assert.equal(new Set(observed.map(row => row.pid)).size, 1);
    assert.deepEqual(observed.map(row => row.source), ['1,U\n', '2,R\n', '3,F\n']);
    assert.equal(await readFile(options.target, 'utf8'), 'id,depth\n1,4\n2,4\n3,4\n');
    assert.equal(await syncAnalyzerChunks(options), 0);
    assert.equal((await readFile(calls, 'utf8')).trim().split('\n').length, 3);
  } finally { await rm(dir, { recursive: true, force: true }); }
});

test('pending input is recovered before overwrite; an interrupted merge remains idempotent', { timeout: 10_000 }, async () => {
  const { dir, calls, options } = await fixture();
  try {
    await writeFile(options.master, '1,U\n2,R\n3,F\n');
    await writeFile(options.target, 'id,depth\n1,4\n');
    await writeFile(options.input, '1,U\n2,R\n');
    await writeFile(`${options.output}.checkpoint`, 'fixture-committed-row');
    await writeFile(`${options.output}.checkpoint.meta`, 'fixture-identity');
    assert.equal(await syncAnalyzerChunks(options), 2);
    const observed = (await readFile(calls, 'utf8')).trim().split('\n').map(row => JSON.parse(row));
    assert.deepEqual(observed.map(row => [row.source, row.checkpoint]), [['1,U\n2,R\n', true], ['3,F\n', false]]);
    assert.equal(new Set(observed.map(row => row.pid)).size, 1);
    assert.equal(await readFile(options.target, 'utf8'), 'id,depth\n1,4\n2,4\n3,4\n');
  } finally { await rm(dir, { recursive: true, force: true }); }
});

test('checkpoint identity binds the explicit table profile passed to the resident child', { timeout: 10_000 }, async () => {
  const { dir, calls, options } = await fixture();
  try {
    await writeFile(options.input, '1,U\n');
    const identities: string[] = [];
    for (const profile of ['default', 'high-memory']) {
      const session = await openAnalyzerSession(options.binary, options.log,
        { ...options.env, CUBE_TABLE_PROFILE: profile }, 'profile-fixture', options.args);
      try {
        identities.push(session.checkpointId);
        await session.run(options.input, options.output);
        await session.close();
      } finally { await session.abort(); }
    }
    assert.notEqual(identities[0], identities[1]);
    const observed = (await readFile(calls, 'utf8')).trim().split('\n').map(row => JSON.parse(row));
    assert.deepEqual(observed.map(row => row.profile), ['default', 'high-memory']);
    assert.deepEqual(observed.map(row => row.identity), identities);
  } finally { await rm(dir, { recursive: true, force: true }); }
});

test('changed input, corrupt outputs and premature child exit fail without committing results', { timeout: 10_000 }, async () => {
  const { dir, options } = await fixture();
  try {
    await writeFile(options.master, '1,U\n');
    await writeFile(options.input, '1,R\n');
    await writeFile(`${options.output}.checkpoint`, 'preserved');
    await assert.rejects(syncAnalyzerChunks(options), /scramble changed/);
    assert.equal(await readFile(`${options.output}.checkpoint`, 'utf8'), 'preserved');
    await writeFile(options.input, '1,U\n2,R\n');
    for (const bad of ['id,depth\n1,4\n1,5\n', 'id,depth\n1,4\n2,', 'id,depth\n1,nope\n2,4\n']) {
      await writeFile(options.output, bad);
      await assert.rejects(validateAnalyzerOutput(options.input, options.output));
    }
    const session = await openAnalyzerSession(process.execPath, options.log, options.env, 'exit-fixture', ['-e', 'process.exit(23)']);
    try { await assert.rejects(session.run(options.input, options.output), /exited with 23/); }
    finally { await session.abort(); }
  } finally { await rm(dir, { recursive: true, force: true }); }
});
