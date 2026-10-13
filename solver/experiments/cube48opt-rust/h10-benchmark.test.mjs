// Protocol/configuration tests only. No table is opened and no solver is run.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import test from 'node:test';
import { parseArguments, parsePeakRss, parseResponse } from './h10-benchmark.mjs';
import { loadCases, verify } from './benchmark.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));

test('H10 benchmark retains the complete fixed historical corpus', () => {
  const cases = loadCases(null, true);
  assert.equal(cases.length, 60);
  assert.equal(new Set(cases.map(item => item.id)).size, 60);
  assert(cases.every(item => item.htm >= 15 && item.htm <= 19));
  assert.equal(parseArguments(['rust', 'c', 'table', 'out', '--probe']).probe, true);
  assert.throws(() => parseArguments(['rust', 'c', 'table', 'out', '--sequential']));
});

test('C protocol rejects candidate mode and mismatched request sequencing', () => {
  const raw = { id: 'case', mode: 'original', run: 0, index: 3, verified: true, nodes: 2_000_000_000,
    solution: "U'", length: 1, seconds: 0.2, cornerLookups: 0, cornerPrunes: 0, faceCuts: 0,
    bpmxCuts: 0, bpmxSkipped: 0, recursiveCuts: 0 };
  const response = { raw, requestNumber: 3, wallSeconds: 0.3 };
  assert.equal(parseResponse('c', response, { id: 'case' }).nodes, 2_000_000_000);
  assert.throws(() => parseResponse('c', { ...response, raw: { ...raw, mode: 'candidate' } }, { id: 'case' }));
  assert.throws(() => parseResponse('c', { ...response, requestNumber: 4 }, { id: 'case' }));
  assert.throws(() => parseResponse('c', { ...response, raw: { ...raw, faceCuts: 1 } }, { id: 'case' }));
});

test('Rust protocol keeps large node counts but rejects cancellation', () => {
  const response = { raw: { id: 'case', contexts: 8, cancelled: false, nodes: 2_000_000_000, seconds: 0.2,
    solution: "U'", length: 1 }, requestNumber: 1, wallSeconds: 0.3 };
  assert.equal(parseResponse('rust', response, { id: 'case' }).nodes, 2_000_000_000);
  assert.throws(() => parseResponse('rust', { ...response, raw: { ...response.raw, cancelled: true } }, { id: 'case' }));
});

test('macOS RSS requires one unambiguous time record', () => {
  assert.equal(parsePeakRss('0.12 real\n  30336314216  maximum resident set size\n'), 30_336_314_216);
  assert.throws(() => parsePeakRss('maximum resident set size missing'));
  assert.throws(() => parsePeakRss('1 maximum resident set size\n2 maximum resident set size\n'));
});

test('shared independent replay rejects incorrect solutions and known-distance mismatch', async () => {
  const { cube3x3x3 } = await import(pathToFileURL(path.resolve(here, '../../../core/jobs/alg-build/node_modules/cubing/dist/lib/cubing/puzzles/index.js')).href);
  const puzzle = await cube3x3x3.kpuzzle();
  verify(puzzle, { id: 'one', scramble: 'U', htm: 1 }, { solution: "U'", length: 1 });
  assert.throws(() => verify(puzzle, { id: 'one', scramble: 'U', htm: 1 }, { solution: 'U', length: 1 }));
  assert.throws(() => verify(puzzle, { id: 'one', scramble: 'U', htm: 2 }, { solution: "U'", length: 1 }));
});

test('backend mismatch is rejected before memory observation or child spawn', { skip: process.platform !== 'darwin' }, () => {
  for (const [backend, mode] of [['opt', 'solve-h10'], ['opt', 'query-h10'], ['h10', 'solve']]) {
    const result = spawnSync(process.execPath, ['--experimental-strip-types', path.join(here, 'guard.mts'),
      'protocol-invalid', path.join(here, 'target/release/cube48opt-research'), mode, 'not-a-table'],
    { env: { ...process.env, CUBEOPT_BACKEND: backend }, encoding: 'utf8', timeout: 5000 });
    assert.equal(result.status, 1);
    assert.match(result.stderr, /H10 entries require CUBEOPT_BACKEND=h10/);
  }
});

test('WCA benchmark uses all 100 original records without trimming or reordering', () => {
  const file = path.resolve(here, '../../testdata/benchmarks/wca-first100.json');
  const config = parseArguments(['rust', 'c', 'table', 'out', '--cases', file]);
  const cases = loadCases(config.casesFile, true);
  assert.equal(cases.length, 100);
  assert.equal(cases[0].id, '22001');
  assert.equal(cases[99].id, '273001');
  assert.deepEqual(cases.map(c => c.sourceLine), Array.from({length: 100}, (_, i) => i + 1));
});
