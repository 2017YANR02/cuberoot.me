import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const repo = resolve(here, '../..');

test('H48 resume checks current corpus IDs and counts existing plus appended rows', {
  skip: process.platform === 'win32' ? 'Fixture worker uses a POSIX executable script' : false,
}, t => {
  // Exercise the real coordinator with a tiny fake native worker. The preload
  // changes only this fixture table's stat size; no H10 data is loaded/created.
  const fixture = mkdtempSync(resolve(tmpdir(), 'cuberoot-h48-resume-'));
  t.after(() => rmSync(fixture, { recursive: true, force: true }));
  for (const dir of ['333opt', 'native', 'vendor/nissy-core/src/utils', 'target/release']) {
    mkdirSync(resolve(fixture, dir), { recursive: true });
  }
  copyFileSync(resolve(here, 'solve_h10.mts'), resolve(fixture, '333opt/solve_h10.mts'));
  copyFileSync(resolve(here, 'data_paths.mjs'), resolve(fixture, '333opt/data_paths.mjs'));
  for (const path of ['native/solve_h48_h10.c', 'vendor/nissy-core/src/nissy.c', 'vendor/nissy-core/src/utils/wrapthread.h']) {
    writeFileSync(resolve(fixture, path), 'fixture');
  }
  writeFileSync(resolve(fixture, 'target/release/solve_h48_h10_1'), `#!/usr/bin/env node
const { createInterface } = require('node:readline');
createInterface({ input: process.stdin }).on('line', row => {
  const [id, scramble] = row.split(',');
  if (scramble !== 'R') process.exit(2);
  console.log(id + ",1,R'");
});
`, { mode: 0o755 });
  const table = resolve(fixture, 'fixture-table');
  writeFileSync(table, 'not a real table');
  const preload = resolve(fixture, 'stat-fixture.mjs');
  writeFileSync(preload, `import fs from 'node:fs';
import { syncBuiltinESMExports } from 'node:module';
const original = fs.statSync;
fs.statSync = function(path, ...args) {
  const stat = original.call(fs, path, ...args);
  if (String(path) === process.env.H48_H10_TABLE) stat.size = 30336314216;
  return stat;
};
syncBuiltinESMExports();
`);
  const corpus = resolve(fixture, 'corpus.txt');
  const output = resolve(fixture, 'out.csv');
  writeFileSync(corpus, 'current,R\n');
  const oldRows = "old-a,1,R'\nold-b,1,R'\n";
  writeFileSync(output, oldRows);
  const run = () => spawnSync(process.execPath, ['--import', preload, '--import', resolve(repo, 'core/node_modules/tsx/dist/loader.mjs'), resolve(fixture, '333opt/solve_h10.mts')], {
    env: { ...process.env, THREADS: '1', CORPUS: corpus, OUT: output, H48_H10_TABLE: table },
    encoding: 'utf8', timeout: 15_000,
  });
  const first = run();
  assert.equal(first.status, 0, first.stderr);
  assert.match(first.stdout, /solved=0\/1/);
  assert.match(first.stdout, /complete: 1\/1/);
  assert.equal(readFileSync(output, 'utf8'), `${oldRows}current,1,R'\n`);
  assert.deepEqual(JSON.parse(readFileSync(resolve(fixture, '333opt/counts.json'), 'utf8')), {
    samples: 3, counts: { 1: 3 },
  });
  const second = run();
  assert.equal(second.status, 0, second.stderr);
  assert.match(second.stdout, /corpus complete: 1\/1/);
  assert.equal(readFileSync(output, 'utf8'), `${oldRows}current,1,R'\n`);
});
